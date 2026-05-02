const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const frontendDist = path.join(__dirname, '../frontend/dist');
const frontendRoot = path.join(__dirname, '../frontend');
app.use(express.static(fs.existsSync(frontendDist) ? frontendDist : frontendRoot));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// Keep yt-dlp/ffmpeg temporary extraction inside the project. This avoids
// Windows temp permission issues when the server is launched by another tool.
const tempDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

function getSpawnOptions() {
  return {
    env: {
      ...process.env,
      TEMP: tempDir,
      TMP: tempDir,
      TMPDIR: tempDir
    }
  };
}

function hasFfmpegInstalled() {
  return Boolean(ffmpegPath && fs.existsSync(ffmpegPath));
}

function getFormatSize(format) {
  return format.filesize || format.filesize_approx || null;
}

function getBitrateLabel(format, audioOnly = false) {
  const bitrate = audioOnly ? format.abr || format.tbr : format.vbr || format.tbr;
  return bitrate ? `${Math.round(bitrate)}kbps` : null;
}

function getCodecLabel(format) {
  const codecs = [];

  if (format.vcodec && format.vcodec !== 'none') {
    codecs.push(format.vcodec.split('.')[0]);
  }

  if (format.acodec && format.acodec !== 'none') {
    codecs.push(format.acodec.split('.')[0]);
  }

  return codecs.length ? codecs.join(' + ') : null;
}

function buildVideoQuality(format, hasAudio) {
  const fpsLabel = format.fps && format.fps > 30 ? ` ${format.fps}fps` : '';
  const extLabel = (format.ext || 'video').toUpperCase();
  const audioLabel = hasAudio ? 'video + audio' : 'video + best audio';

  return `${format.height}p${fpsLabel} ${extLabel} (${audioLabel})`;
}

function buildVideoFormats(formats, allowAdaptiveFormats) {
  const videoFormats = formats
    .filter((format) => {
      const hasVideo = format.vcodec !== 'none';
      const hasHeight = format.height && format.height >= 144 && format.height <= 2160;
      const hasAudio = format.acodec && format.acodec !== 'none';

      return hasVideo && hasHeight && (allowAdaptiveFormats || hasAudio);
    })
    .map((format) => {
      const hasAudio = format.acodec && format.acodec !== 'none';
      const formatId = hasAudio || !allowAdaptiveFormats
        ? format.format_id
        : `${format.format_id}+bestaudio/best`;

      return {
        quality: buildVideoQuality(format, hasAudio),
        height: format.height,
        fps: format.fps || 0,
        format_id: formatId,
        filesize: getFormatSize(format),
        ext: 'mp4',
        hasAudio,
        sourceExt: format.ext || 'mp4',
        formatNote: format.format_note || null,
        resolution: format.resolution || null,
        bitrate: getBitrateLabel(format),
        codecs: getCodecLabel(format)
      };
    })
    .sort((a, b) => {
      if (b.height !== a.height) return b.height - a.height;
      if (b.fps !== a.fps) return b.fps - a.fps;
      if (Number(b.hasAudio) !== Number(a.hasAudio)) return Number(b.hasAudio) - Number(a.hasAudio);
      return String(a.sourceExt).localeCompare(String(b.sourceExt));
    });

  return videoFormats;
}

function buildAudioFormats(formats) {
  return formats
    .filter((format) => format.acodec && format.acodec !== 'none' && format.vcodec === 'none')
    .map((format) => {
      const bitrate = getBitrateLabel(format, true);
      const extLabel = (format.ext || 'audio').toUpperCase();
      const bitrateLabel = bitrate ? ` ${bitrate}` : '';

      return {
        quality: `Audio Only ${extLabel}${bitrateLabel}`,
        format_id: format.format_id || 'bestaudio/best',
        filesize: getFormatSize(format),
        ext: 'mp3',
        sourceExt: format.ext || null,
        formatNote: format.format_note || null,
        bitrate,
        codecs: getCodecLabel(format)
      };
    })
    .sort((a, b) => {
      const bitrateA = parseInt(a.bitrate, 10) || 0;
      const bitrateB = parseInt(b.bitrate, 10) || 0;
      return bitrateB - bitrateA;
    });
}

function buildVideoFormatForSelection(format, hasAudio, allowAdaptiveFormats) {
  const hasAudioInFormat = format.acodec && format.acodec !== 'none';
  const formatId = hasAudioInFormat || !allowAdaptiveFormats
    ? format.format_id
    : `${format.format_id}+bestaudio/best`;

  return {
    quality: buildVideoQuality(format, hasAudioInFormat),
    height: format.height,
    fps: format.fps || 0,
    format_id: formatId,
    filesize: getFormatSize(format),
    ext: 'mp4',
    hasAudio: hasAudioInFormat,
    sourceExt: format.ext || 'mp4',
    formatNote: format.format_note || null,
    resolution: format.resolution || null,
    bitrate: getBitrateLabel(format),
    codecs: getCodecLabel(format)
  };
}

function buildAudioFormatForSelection(format) {
  const bitrate = getBitrateLabel(format, true);
  const extLabel = (format.ext || 'audio').toUpperCase();

  return {
    quality: `Audio Only ${extLabel}${bitrate ? ` ${bitrate}` : ''}`,
    format_id: format.format_id || 'bestaudio/best',
    filesize: getFormatSize(format),
    ext: 'mp3',
    sourceExt: format.ext || null,
    formatNote: format.format_note || null,
    bitrate,
    codecs: getCodecLabel(format)
  };
}

function addFfmpegLocation(args) {
  if (hasFfmpegInstalled()) {
    args.push('--ffmpeg-location', ffmpegPath);
  }

  return args;
}

function sanitizeFilename(filename) {
  return String(filename || 'download')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'download';
}

function isInsideDownloads(targetPath) {
  const resolvedDownloads = path.resolve(downloadsDir);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget === resolvedDownloads || resolvedTarget.startsWith(`${resolvedDownloads}${path.sep}`);
}

function cleanupDownloadPath(targetPath) {
  if (!isInsideDownloads(targetPath)) return;
  fs.rm(targetPath, { recursive: true, force: true }, (err) => {
    if (err) console.error('Error cleaning up file:', err);
  });
}

function zipFolder(sourceDir, zipPath, callback) {
  const safeSource = sourceDir.replace(/'/g, "''");
  const safeZip = zipPath.replace(/'/g, "''");
  const command = `Compress-Archive -Path (Join-Path '${safeSource}' '*') -DestinationPath '${safeZip}' -Force`;
  const zipper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], getSpawnOptions());
  let errorOutput = '';

  zipper.stderr.on('data', (chunk) => {
    errorOutput += chunk;
  });

  zipper.on('close', (code) => {
    if (code !== 0) {
      callback(new Error(errorOutput.trim() || `Compress-Archive exited with code ${code}`));
      return;
    }

    callback(null);
  });

  zipper.on('error', (err) => callback(err));
}

function normalizePlaylistUrl(inputUrl) {
  try {
    const parsedUrl = new URL(inputUrl);
    const playlistId = parsedUrl.searchParams.get('list');

    if (playlistId) {
      return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
    }
  } catch {
    return inputUrl;
  }

  return inputUrl;
}

// Fetch video details
app.post('/api/fetch-details', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const isWindows = process.platform === 'win32';
  const ytDlpPath = path.join(__dirname, isWindows ? 'yt-dlp.exe' : 'yt-dlp');
  const ytDlp = spawn(ytDlpPath, ['--dump-json', '--extractor-args', 'youtube:player_client=android', url], getSpawnOptions());

  let data = '';
  let errorOutput = '';
  ytDlp.stdout.on('data', (chunk) => {
    data += chunk;
  });
  ytDlp.stderr.on('data', (chunk) => {
    errorOutput += chunk;
  });

  ytDlp.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({
        error: 'Failed to fetch video details',
        details: errorOutput.trim() || `yt-dlp exited with code ${code}`
      });
    }

    try {
      const videoInfo = JSON.parse(data);
      const ffmpegInstalled = hasFfmpegInstalled();
      const uniqueFormats = buildVideoFormats(videoInfo.formats || [], ffmpegInstalled);
      const audioFormats = buildAudioFormats(videoInfo.formats || []);

      res.json({
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        duration: videoInfo.duration,
        channel: videoInfo.channel || videoInfo.uploader || null,
        viewCount: videoInfo.view_count || null,
        formats: [...uniqueFormats, ...audioFormats],
        audioSupportMode: ffmpegInstalled ? 'merged' : 'progressive-only',
        message: ffmpegInstalled
          ? null
          : 'Audio is included in the listed video qualities. Install ffmpeg to unlock all higher qualities with audio.'
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to parse video details',
        details: err.message
      });
    }
  });

  ytDlp.on('error', (err) => {
    res.status(500).json({
      error: 'yt-dlp not found or failed to execute',
      details: err.message
    });
  });
});

// Fetch playlist details (without downloading)
app.get('/api/playlist-details', (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const playlistUrl = normalizePlaylistUrl(String(url));
  const isWindows = process.platform === 'win32';
  const ytDlpPath = path.join(__dirname, isWindows ? 'yt-dlp.exe' : 'yt-dlp');

  // Use --flat-playlist to get only metadata without extracting each video
  const args = [
    '--flat-playlist',
    '--dump-json',
    '--skip-download',
    '--extractor-args',
    'youtube:player_client=android',
    playlistUrl
  ];

  const ytDlp = spawn(ytDlpPath, args, getSpawnOptions());
  let data = '';
  let errorOutput = '';

  ytDlp.stdout.on('data', (chunk) => {
    data += chunk;
  });

  ytDlp.stderr.on('data', (chunk) => {
    errorOutput += chunk;
  });

  ytDlp.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({
        error: 'Failed to fetch playlist details',
        details: errorOutput.trim() || `yt-dlp exited with code ${code}`
      });
    }

    try {
      // yt-dlp outputs one JSON object per line for flat-playlist
      const lines = data.trim().split('\n').filter(line => line.trim());
      const videos = lines.map((line, idx) => {
        const info = JSON.parse(line);
        let thumb = info.thumbnail;
        if (!thumb && info.thumbnails && info.thumbnails.length > 0) {
          thumb = info.thumbnails[info.thumbnails.length - 1].url;
        }
        if (!thumb && info.id) {
          thumb = `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`;
        }
        return {
          id: info.id || info.webpage_url,
          title: info.title,
          thumbnail: thumb,
          duration: info.duration,
          playlist_index: info.playlist_index || (idx + 1),
          channel: info.channel || info.uploader || null,
          viewCount: info.view_count || null,
          webpage_url: info.webpage_url
        };
      });

      res.json({ videos });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to parse playlist details',
        details: err.message
      });
    }
  });

  ytDlp.on('error', (err) => {
    res.status(500).json({
      error: 'yt-dlp not found or failed to execute',
      details: err.message
    });
  });
});

// Download video
app.get('/api/download', (req, res) => {
  const { url, formatId, ext, title } = req.query;
  if (!url || !formatId || !ext) {
    return res.status(400).json({ error: 'URL, formatId, and ext are required' });
  }

  const isWindows = process.platform === 'win32';
  const ytDlpPath = path.join(__dirname, isWindows ? 'yt-dlp.exe' : 'yt-dlp');
  const baseFilename = `download_${Date.now()}`;
  const outputTemplate = path.join(downloadsDir, `${baseFilename}.%(ext)s`);

  let args = [];
  if (ext === 'mp3') {
    args = ['-f', formatId, '-x', '--audio-format', 'mp3', '-o', outputTemplate];
  } else {
    args = ['-f', formatId, '--merge-output-format', 'mp4', '-o', outputTemplate];
  }

  // Help bypass Windows file lock errors (WinError 32) when ffmpeg or antivirus holds the handle
  args.push('--file-access-retries', '20');
  
  // Bypass YouTube datacenter bot protection
  args.push('--extractor-args', 'youtube:player_client=android');
  
  addFfmpegLocation(args);
  args.push(url);

  const ytDlp = spawn(ytDlpPath, args, getSpawnOptions());
  let errorOutput = '';
  ytDlp.stderr.on('data', (chunk) => {
    errorOutput += chunk;
  });

  ytDlp.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({
        error: 'Download failed',
        details: errorOutput.trim() || `yt-dlp exited with code ${code}`
      });
    }

    // Find the actual downloaded file
    const files = fs.readdirSync(downloadsDir);
    const downloadedFile = files.find(f => f.startsWith(baseFilename));
    if (!downloadedFile) {
      return res.status(500).json({ error: 'Downloaded file not found' });
    }

    const filePath = path.join(downloadsDir, downloadedFile);
    const downloadName = `${sanitizeFilename(title)}.${ext === 'mp3' ? 'mp3' : 'mp4'}`;

    res.cookie('downloadStarted', '1', { path: '/', sameSite: 'lax' });
    res.download(filePath, downloadName, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up file after download
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    });
  });

  ytDlp.on('error', (err) => {
    res.status(500).json({
      error: 'Download failed',
      details: err.message
    });
  });
});

app.get('/api/download-playlist', (req, res) => {
  const { url, mode = 'video', height, title, items } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const playlistUrl = normalizePlaylistUrl(String(url));
  const isWindows = process.platform === 'win32';
  const ytDlpPath = path.join(__dirname, isWindows ? 'yt-dlp.exe' : 'yt-dlp');
  const playlistId = `playlist_${Date.now()}`;
  const playlistDir = path.join(downloadsDir, playlistId);
  const zipPath = path.join(downloadsDir, `${playlistId}.zip`);
  fs.mkdirSync(playlistDir, { recursive: true });

  const outputTemplate = path.join(playlistDir, '%(autonumber)03d - %(title).180B.%(ext)s');
  const args = [
    '--yes-playlist',
    '--windows-filenames',
    '--ignore-errors',
    '--no-abort-on-error',
    '--file-access-retries',
    '20',
    '--extractor-args',
    'youtube:player_client=android',
    '-o',
    outputTemplate
  ];

  if (items) {
    args.push('--playlist-items', String(items));
  }

  if (mode === 'audio') {
    args.push('-f', 'bestaudio/best', '-x', '--audio-format', 'mp3');
  } else {
    const targetHeight = parseInt(height, 10);
    const selector = Number.isFinite(targetHeight) && targetHeight > 0
      ? `bv*[height<=${targetHeight}]+ba/b[height<=${targetHeight}]/best`
      : 'bv*+ba/best';
    args.push('-f', selector, '--merge-output-format', 'mp4');
  }

  addFfmpegLocation(args);
  args.push(playlistUrl);

  const ytDlp = spawn(ytDlpPath, args, getSpawnOptions());
  let errorOutput = '';

  ytDlp.stderr.on('data', (chunk) => {
    errorOutput += chunk;
  });

  ytDlp.on('close', (code) => {
    const downloadedFiles = fs.existsSync(playlistDir) ? fs.readdirSync(playlistDir) : [];
    if (downloadedFiles.length === 0) {
      cleanupDownloadPath(playlistDir);
      return res.status(500).json({
        error: 'Playlist download failed',
        details: errorOutput.trim() || `yt-dlp exited with code ${code}`
      });
    }

    zipFolder(playlistDir, zipPath, (zipErr) => {
      if (zipErr) {
        cleanupDownloadPath(playlistDir);
        cleanupDownloadPath(zipPath);
        return res.status(500).json({
          error: 'Playlist zip failed',
          details: zipErr.message
        });
      }

      const downloadName = `${sanitizeFilename(title || 'youtube playlist')}.zip`;
      res.cookie('downloadStarted', '1', { path: '/', sameSite: 'lax' });
      res.download(zipPath, downloadName, (err) => {
        if (err) {
          console.error('Error sending playlist zip:', err);
        }
        cleanupDownloadPath(playlistDir);
        cleanupDownloadPath(zipPath);
      });
    });
  });

  ytDlp.on('error', (err) => {
    cleanupDownloadPath(playlistDir);
    cleanupDownloadPath(zipPath);
    res.status(500).json({
      error: 'Playlist download failed',
      details: err.message
    });
  });
});

// Fallback route for SPA (MUST BE LAST)
app.get("*", (req, res) => {
  const distHtml = path.join(__dirname, "../frontend/dist/index.html");
  if (fs.existsSync(distHtml)) {
    res.sendFile(distHtml);
  } else {
    res.status(404).send("Production build not found. Run npm run build in frontend directory.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
