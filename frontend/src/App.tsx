import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Clipboard,
  Clock3,
  Copy,
  Download,
  Facebook,
  FileAudio,
  FileVideo,
  Gauge,
  History,
  Infinity,
  Instagram,
  Loader2,
  Menu,
  Play,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Twitter,
  X,
  Zap,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import PlaylistView from './PlaylistView';

const API_BASE = '/api';

type Format = {
  quality: string;
  format_id: string;
  filesize?: number | null;
  ext: string;
  hasAudio?: boolean;
  height?: number;
  bitrate?: string | null;
};

type VideoDetails = {
  title: string;
  thumbnail: string;
  duration: number;
  channel?: string;
  viewCount?: number;
  formats: Format[];
  message?: string | null;
};

type FormatMode = 'video' | 'audio';

type DownloadHistoryItem = {
  id: string;
  title: string;
  channel?: string;
  thumbnail: string;
  quality: string;
  filesize: string;
  url: string;
  downloadedAt: string;
};

const HISTORY_STORAGE_KEY = 'DownloadHubX-download-history';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

const steps = [
  {
    title: 'Paste Link',
    description: 'Drop your video URL into the downloader and keep the original link handy.',
    icon: Clipboard,
  },
  {
    title: 'Fetch Video',
    description: 'DownloadHubX reads the available formats, thumbnail, duration, and title.',
    icon: Search,
  },
  {
    title: 'Download',
    description: 'Choose video or audio quality and save the file to your device.',
    icon: Download,
  },
];

const features = [
  { title: 'Fast Downloads', icon: Zap },
  { title: '100% Safe', icon: ShieldCheck },
  { title: 'Unlimited', icon: Infinity },
  { title: 'All Devices', icon: Smartphone },
];

const fallbackQualities = ['MP4 1080p', 'MP4 720p', 'MP4 480p', 'MP3 320kbps'];

function formatDuration(seconds?: number) {
  if (!seconds) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return 'Size detected after fetch';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${sizes[index]}`;
}

function formatViews(viewCount?: number) {
  if (!viewCount) return 'Views unavailable';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(viewCount);
}

function isLikelyUrl(value: string) {
  return /^https?:\/\/\S+\.\S+/i.test(value.trim());
}

function isPlaylistUrl(value: string) {
  return /[?&]list=|\/playlist\?/i.test(value.trim());
}

function getFormatLabel(format: Format) {
  const resolutionMatch = format.quality.match(/(\d{3,4}p)/i);
  if (format.height) return `${format.height}p`;
  if (resolutionMatch) return resolutionMatch[1].toLowerCase();

  if (format.ext === 'mp3' || format.quality.toLowerCase().includes('audio')) {
    return 'MP3 Audio';
  }

  return format.quality.replace(/\s*\(.+\)/, '');
}

function App() {
  const [url, setUrl] = useState('');
  const [details, setDetails] = useState<VideoDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [formatMode, setFormatMode] = useState<FormatMode>('video');
  const [selectedFormatId, setSelectedFormatId] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>([]);

  const [currentView, setCurrentView] = useState<'home' | 'playlist'>('home');
  const [playlistVideos, setPlaylistVideos] = useState<any[]>([]);
  const [fetchingPlaylist, setFetchingPlaylist] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        setDownloadHistory(JSON.parse(stored) as DownloadHistoryItem[]);
      }
    } catch {
      setDownloadHistory([]);
    }
  }, []);

  const filteredFormats = useMemo(() => {
    const formats = details?.formats ?? [];
    const filtered = formats.filter((format) =>
      formatMode === 'audio'
        ? format.ext === 'mp3' || format.quality.toLowerCase().includes('audio')
        : format.ext !== 'mp3' && !format.quality.toLowerCase().includes('audio'),
    );

    return filtered.length ? filtered : formats;
  }, [details, formatMode]);

  const selectedFormat = useMemo(() => {
    return filteredFormats.find((format) => format.format_id === selectedFormatId) ?? filteredFormats[0];
  }, [filteredFormats, selectedFormatId]);

  const hasPlaylistUrl = isPlaylistUrl(url);

  async function fetchVideoDetails(event?: FormEvent) {
    event?.preventDefault();

    if (!isLikelyUrl(url)) {
      setError('Invalid URL');
      setDetails(null);
      return;
    }

    setLoading(true);
    setError('');
    setDownloadProgress(0);

    try {
      const response = await fetch(`${API_BASE}/fetch-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Fetch failed');
      }

      const data = (await response.json()) as VideoDetails;
      setDetails(data);
      setSelectedFormatId(data.formats[0]?.format_id ?? '');
      setFormatMode(data.formats[0]?.ext === 'mp3' ? 'audio' : 'video');

      if (data.message) {
        setError(data.message);
      }
    } catch {
      setDetails(null);
      setError('Invalid URL');
    } finally {
      setLoading(false);
    }
  }

  async function pasteFromClipboard() {
    try {
      const value = await navigator.clipboard.readText();
      setUrl(value);
      setError('');
    } catch {
      setError('Clipboard access is blocked');
    }
  }

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function clearInput() {
    setUrl('');
    setError('');
    setDetails(null);
    setDownloadProgress(0);
  }

  function startDownload(format = selectedFormat) {
    if (!format || !details) return;

    const historyItem: DownloadHistoryItem = {
      id: `${Date.now()}-${format.format_id}`,
      title: details.title,
      channel: details.channel,
      thumbnail: details.thumbnail,
      quality: getFormatLabel(format),
      filesize: formatFileSize(format.filesize),
      url,
      downloadedAt: new Date().toISOString(),
    };
    const nextHistory = [historyItem, ...downloadHistory].slice(0, 20);
    setDownloadHistory(nextHistory);
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));

    setDownloadProgress(12);
    const timer = window.setInterval(() => {
      setDownloadProgress((value) => {
        if (value >= 92) {
          window.clearInterval(timer);
          return value;
        }
        return value + 8;
      });
    }, 800);

    const downloadUrl = `${API_BASE}/download?url=${encodeURIComponent(url)}&formatId=${encodeURIComponent(format.format_id)}&ext=${encodeURIComponent(format.ext)}&title=${encodeURIComponent(details.title)}`;
    
    // Clear any existing cookie
    document.cookie = 'downloadStarted=; Max-Age=-99999999; path=/';
    
    // Start download without opening a new blank tab
    window.location.href = downloadUrl;
    
    // Poll for the cookie to know when download actually started
    const checkCookie = window.setInterval(() => {
      if (document.cookie.includes('downloadStarted=1')) {
        window.clearInterval(checkCookie);
        window.clearInterval(timer);
        setDownloadProgress(100);
        document.cookie = 'downloadStarted=; Max-Age=-99999999; path=/';
        setTimeout(() => setDownloadProgress(0), 3000);
      }
    }, 1000);
  }

  async function fetchPlaylistVideos() {
    if (!isLikelyUrl(url) || !hasPlaylistUrl) {
      setError('Paste a YouTube playlist link first');
      return;
    }

    setFetchingPlaylist(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/playlist-details?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch playlist details');
      }
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setPlaylistVideos(data.videos);
      setCurrentView('playlist');
    } catch (err: any) {
      setError(err.message || 'Failed to load playlist');
    } finally {
      setFetchingPlaylist(false);
    }
  }

  function startPlaylistDownload(selectedIndices: number[], mode: 'video' | 'audio', height: string) {
    if (!isLikelyUrl(url) || !hasPlaylistUrl) {
      setError('Paste a YouTube playlist link first');
      return;
    }

    const title = details?.title || 'YouTube playlist';
    const items = selectedIndices.join(',');
    
    const historyItem: DownloadHistoryItem = {
      id: `${Date.now()}-playlist`,
      title: `${title} playlist (${selectedIndices.length} items)`,
      channel: details?.channel,
      thumbnail: playlistVideos[selectedIndices[0] - 1]?.thumbnail || details?.thumbnail || '',
      quality: mode === 'audio' ? 'Playlist MP3 Audio' : `Playlist ${height}p`,
      filesize: 'ZIP file',
      url,
      downloadedAt: new Date().toISOString(),
    };
    const nextHistory = [historyItem, ...downloadHistory].slice(0, 20);
    setDownloadHistory(nextHistory);
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));

    setDownloadProgress(12);
    const timer = window.setInterval(() => {
      setDownloadProgress((value) => {
        if (value >= 88) {
          window.clearInterval(timer);
          return value;
        }
        return value + 2;
      });
    }, 2000);

    const playlistUrl = `${API_BASE}/download-playlist?url=${encodeURIComponent(url)}&mode=${encodeURIComponent(mode)}&height=${encodeURIComponent(height)}&title=${encodeURIComponent(title)}&items=${encodeURIComponent(items)}`;
    
    // Clear any existing cookie
    document.cookie = 'downloadStarted=; Max-Age=-99999999; path=/';
    
    // Start download without opening a new blank tab
    window.location.href = playlistUrl;
    
    // Poll for the cookie to know when download actually started
    const checkCookie = window.setInterval(() => {
      if (document.cookie.includes('downloadStarted=1')) {
        window.clearInterval(checkCookie);
        window.clearInterval(timer);
        setDownloadProgress(100);
        document.cookie = 'downloadStarted=; Max-Age=-99999999; path=/';
        setTimeout(() => setDownloadProgress(0), 3000);
      }
    }, 1000);
  }

  function convertToMp3() {
    const audioFormat =
      details?.formats.find((format) => format.ext === 'mp3' || format.quality.toLowerCase().includes('audio')) ??
      selectedFormat;
    setFormatMode('audio');
    setSelectedFormatId(audioFormat?.format_id ?? '');
    startDownload(audioFormat);
  }

  function clearHistory() {
    setDownloadHistory([]);
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  }

  return (
    <div className="min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="glow-drift absolute left-[-12%] top-[-18%] h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="glow-drift-delayed absolute right-[-8%] top-[18%] h-[28rem] w-[28rem] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[30%] h-[30rem] w-[30rem] rounded-full bg-blue-700/15 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />
      </div>

      <section id="home" className="relative flex min-h-screen flex-col px-4 pb-20 sm:px-6 lg:px-8">
        <Navbar
          historyCount={downloadHistory.length}
          historyOpen={historyOpen}
          onToggleHistory={() => setHistoryOpen((value) => !value)}
        />

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center pt-24 text-center">
        
          

          {currentView === 'home' && (
            <>
              <motion.h1
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                transition={{ duration: 0.8, delay: 0.08, ease: 'easeOut' }}
                className="font-serifDisplay text-5xl leading-[0.95] tracking-normal text-white sm:text-7xl lg:text-8xl"
              >
            Download Videos{' '}
            <span className="bg-gradient-to-r from-cyan-200 via-blue-300 to-violet-300 bg-clip-text italic text-transparent">
              Instantly
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.8, delay: 0.16, ease: 'easeOut' }}
            className="mt-6 max-w-2xl text-base leading-8 text-white/65 sm:text-lg"
          >
            Fast, Free, and Unlimited video downloads from all platforms
          </motion.p>

          <motion.form
            onSubmit={fetchVideoDetails}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.8, delay: 0.24, ease: 'easeOut' }}
            className="liquid-glass mt-10 w-full max-w-4xl rounded-[2rem] p-3 sm:p-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <button
                  type="button"
                  onClick={pasteFromClipboard}
                  className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
                  aria-label="Paste from clipboard"
                >
                  <Clipboard className="h-5 w-5" />
                </button>
                <input
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setError('');
                  }}
                  placeholder="Paste video link here..."
                  className="h-16 w-full rounded-full border border-white/10 bg-black/30 px-16 text-base text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/60 focus:bg-black/40 focus:ring-4 focus:ring-cyan-300/10"
                />
                {url && (
                  <button
                    type="button"
                    onClick={clearInput}
                    className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
                    aria-label="Clear link"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              {hasPlaylistUrl ? (
                <button
                  type="button"
                  onClick={fetchPlaylistVideos}
                  disabled={fetchingPlaylist}
                  className="inline-flex h-16 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-8 font-semibold text-white shadow-[0_22px_60px_rgba(34,211,238,0.36)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {fetchingPlaylist ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                  {fetchingPlaylist ? 'Fetching Playlist...' : 'View Playlist Videos'}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-16 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-blue-500 to-violet-600 px-8 font-semibold text-white shadow-[0_22px_60px_rgba(79,70,229,0.36)] transition hover:scale-[1.02] hover:from-cyan-400 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                  {loading ? 'Fetching...' : 'Download Video'}
                </button>
              )}
            </div>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 px-2 text-sm text-white/50 sm:flex-row">
              <span>Supports YouTube, Instagram, Facebook, TikTok and more</span>
            </div>
          </motion.form>

          <AnimatePresence>
            {(loading || fetchingPlaylist) && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                className="mt-6 inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 text-sm text-cyan-100 backdrop-blur-xl"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                {fetchingPlaylist ? 'Fetching playlist videos...' : 'Fetching video...'}
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                className="mt-6 rounded-full border border-rose-300/20 bg-rose-400/10 px-5 py-3 text-sm text-rose-100 backdrop-blur-xl"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {historyOpen && (
              <DownloadHistory
                items={downloadHistory}
                onClear={clearHistory}
                onClose={() => setHistoryOpen(false)}
              />
            )}

            {details && !loading && !fetchingPlaylist && (
              <VideoCard
                details={details}
                formatMode={formatMode}
                setFormatMode={setFormatMode}
                formats={filteredFormats}
                selectedFormat={selectedFormat}
                setSelectedFormatId={setSelectedFormatId}
                downloadProgress={downloadProgress}
                onDownload={() => startDownload()}
                onConvert={convertToMp3}
                isPlaylist={hasPlaylistUrl}
                onDownloadPlaylist={fetchPlaylistVideos}
              />
            )}
          </AnimatePresence>
            </>
          )}

          {currentView === 'playlist' && (
            <AnimatePresence>
              <PlaylistView
                url={url}
                videos={playlistVideos}
                onBack={() => setCurrentView('home')}
                onDownload={startPlaylistDownload}
                downloadProgress={downloadProgress}
              />
            </AnimatePresence>
          )}
        </main>
      </section>

      <HowItWorks />
      <Features />
      <Footer />
    </div>
  );
}

function Navbar({
  historyCount,
  historyOpen,
  onToggleHistory,
}: {
  historyCount: number;
  historyOpen: boolean;
  onToggleHistory: () => void;
}) {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 py-4 sm:px-6 lg:px-8">
      <nav className="liquid-glass mx-auto flex max-w-7xl items-center justify-between rounded-full px-4 py-3">
        <a href="#home" className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-500 shadow-[0_12px_30px_rgba(34,211,238,0.24)]">
            <Download className="h-5 w-5 text-white" />
          </span>
          <span className="font-serifDisplay text-2xl text-white">DownloadHubX</span>
        </a>

        <div className="hidden items-center gap-7 text-sm text-white/60 md:flex">
          <a className="transition hover:text-white" href="#home">
            Home
          </a>
          <a className="transition hover:text-white" href="#supported-sites">
            Supported Sites
          </a>
          <a className="transition hover:text-white" href="#how-it-works">
            How it Works
          </a>
          <a className="transition hover:text-white" href="#faq">
            FAQ
          </a>
        </div>

       <div className="flex items-center gap-2">
  <button
    onClick={onToggleHistory}
    className={`flex h-10 items-center gap-2 rounded-full border px-3 sm:px-4 text-sm transition ${
      historyOpen
        ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
        : 'border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
    }`}
  >

    <History className="h-4 w-4" />
   <span className="hidden sm:inline">History</span>
    {historyCount > 0 && (
      <span className="hidden sm:inline rounded-full bg-white px-2 py-0.5 text-xs font-bold text-black">
        {historyCount}
      </span>
    )}
  </button>
</div>
      </nav>
    </header>
  );
}

function DownloadHistory({
  items,
  onClear,
  onClose,
}: {
  items: DownloadHistoryItem[];
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="liquid-glass mt-8 w-full max-w-5xl rounded-[2rem] p-4 text-left sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-cyan-200/70">History</p>
          <h2 className="mt-1 font-serifDisplay text-3xl text-white">Downloaded videos</h2>
        </div>
        <div className="flex gap-2">
          {items.length > 0 && (
            <button
              onClick={onClear}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
        {items.length ? (
          items.map((item) => (
            <article
              key={item.id}
              className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-[7rem_1fr]"
            >
              <img
                src={item.thumbnail}
                alt={item.title}
                className="aspect-video w-full rounded-2xl object-cover sm:h-20"
              />
              <div className="min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-white/50">{item.channel || 'Channel unavailable'}</p>
                  </div>
                  <span className="w-fit shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                    {item.quality}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/45">
                  <span>{item.filesize}</span>
                  <span>{new Date(item.downloadedAt).toLocaleString()}</span>
                  <a href={item.url} className="inline-flex items-center gap-1 text-white/65 transition hover:text-white">
                    <Copy className="h-3.5 w-3.5" />
                    Source link
                  </a>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 text-center text-white/50">
            No downloads yet. Your next download will appear here.
          </div>
        )}
      </div>
    </motion.section>
  );
}

type VideoCardProps = {
  details: VideoDetails;
  formatMode: FormatMode;
  setFormatMode: (mode: FormatMode) => void;
  formats: Format[];
  selectedFormat?: Format;
  setSelectedFormatId: (id: string) => void;
  downloadProgress: number;
  onDownload: () => void;
  onConvert: () => void;
  isPlaylist: boolean;
  onDownloadPlaylist: () => void;
};

function VideoCard({
  details,
  formatMode,
  setFormatMode,
  formats,
  selectedFormat,
  setSelectedFormatId,
  downloadProgress,
  onDownload,
  onConvert,
  isPlaylist,
  onDownloadPlaylist,
}: VideoCardProps) {
  const qualityLabels = formats.length ? formats.map(getFormatLabel) : fallbackQualities;

  return (
    <motion.section
      initial={{ opacity: 0, y: 34, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.98 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      className="liquid-glass mt-10 w-full max-w-5xl rounded-[2rem] p-4 text-left sm:p-5 lg:p-6"
    >
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <img src={details.thumbnail} alt={details.title} className="aspect-video w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-white/20 bg-black/40 backdrop-blur-xl">
              <Play className="ml-1 h-7 w-7 fill-white text-white" />
            </span>
          </div>
          <span className="absolute bottom-4 right-4 rounded-full bg-black/70 px-3 py-1 text-sm text-white/80 backdrop-blur-xl">
            {formatDuration(details.duration)}
          </span>
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              Video Found
            </div>
            <h2 className="font-serifDisplay text-3xl leading-tight text-white sm:text-4xl">{details.title}</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/55">
              <span>{details.channel || 'Channel unavailable'}</span>
              <span className="h-1 w-1 rounded-full bg-white/30" />
              <span>{formatViews(details.viewCount)} views</span>
              <span className="h-1 w-1 rounded-full bg-white/30" />
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-4 w-4" />
                {formatDuration(details.duration)}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-sm font-medium text-white/70" htmlFor="format-mode">
                Format selector
              </label>
           <select
          id="format-mode"
          value={formatMode}
          onChange={(event) => setFormatMode(event.target.value as FormatMode)}
         className="appearance-none rounded-full border border-white/20 bg-black px-5 py-3 pr-10 text-sm text-white shadow-md shadow-black/40 outline-none transition-all focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/30"
        >
          <option value="video" className="bg-black text-white">
            🎬 Video
          </option>
          <option value="audio" className="bg-black text-white">
            🎧 Audio
          </option>
        </select>

            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {formats.length
                ? formats.map((format, index) => (
                    <button
                      key={format.format_id}
                      onClick={() => setSelectedFormatId(format.format_id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedFormat?.format_id === format.format_id || (!selectedFormat && index === 0)
                          ? 'border-cyan-300/55 bg-cyan-300/10'
                          : 'border-white/10 bg-white/[0.035] hover:border-white/25 hover:bg-white/[0.065]'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-semibold text-white">
                        {formatMode === 'audio' ? <FileAudio className="h-4 w-4" /> : <FileVideo className="h-4 w-4" />}
                        {getFormatLabel(format)}
                      </span>
                      <span className="mt-2 block text-sm text-white/50">{formatFileSize(format.filesize)}</span>
                    </button>
                  ))
                : qualityLabels.map((label) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                      <span className="font-semibold text-white">{label}</span>
                      <span className="mt-2 block text-sm text-white/50">Size detected after fetch</span>
                    </div>
                  ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onDownload}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-black transition hover:scale-[1.02] hover:bg-cyan-100"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                onClick={onConvert}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <FileAudio className="h-4 w-4" />
                Convert to MP3
              </button>
            </div>

            {isPlaylist && (
              <button
                onClick={onDownloadPlaylist}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
              >
                <Play className="h-4 w-4" />
                View Playlist Videos
              </button>
            )}

            {downloadProgress > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs text-white/50">
                  <span>Download progress</span>
                  <span>{downloadProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="How it Works" title="Three steps. No friction." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <motion.article
              key={step.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="liquid-glass rounded-3xl p-6"
            >
              <div className="mb-8 grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-cyan-200">
                <step.icon className="h-6 w-6" />
              </div>
              <h3 className="font-serifDisplay text-3xl text-white">{step.title}</h3>
              <p className="mt-3 leading-7 text-white/55">{step.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="supported-sites" className="relative px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Features" title="Built for everyday downloads." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              transition={{ duration: 0.45, delay: index * 0.06 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="liquid-glass rounded-3xl p-5"
            >
              <feature.icon className="h-7 w-7 text-violet-200" />
              <h3 className="mt-6 text-lg font-semibold text-white">{feature.title}</h3>
            </motion.div>
          ))}
        </div>

        <div id="faq" className="liquid-glass mt-16 rounded-3xl p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-white/35">FAQ</p>
              <h3 className="mt-2 font-serifDisplay text-3xl text-white">Works with public video links.</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-white/60">
              {['YouTube', 'Instagram', 'Facebook', 'TikTok', 'Shorts', 'Reels'].map((site) => (
                <span key={site} className="rounded-full border border-white/10 px-3 py-2">
                  {site}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={fadeUp}
      transition={{ duration: 0.55 }}
      className="max-w-2xl"
    >
      <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/70">{eyebrow}</p>
      <h2 className="mt-3 font-serifDisplay text-4xl leading-tight text-white sm:text-5xl">{title}</h2>
    </motion.div>
  );
}

function Footer() {
  return (
    <footer className="relative px-4 pb-10 pt-16 sm:px-6 lg:px-8">
      <div className="liquid-glass mx-auto max-w-6xl rounded-[2rem] p-6">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-500">
                <Download className="h-5 w-5 text-white" />
              </span>
              <span className="font-serifDisplay text-2xl text-white">DownloadHubX</span>
            </div>
            <p className="mt-4 leading-7 text-white/55">
              A clean, fast downloader interface for saving public videos and audio in the format you need.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-white/60">
            {['Home', 'FAQ', 'Contact', 'Terms'].map((link) => (
              <a key={link} href="#home" className="transition hover:text-white">
                {link}
              </a>
            ))}
          </div>

          <div className="flex gap-2">
            {[Instagram, Facebook, Twitter].map((Icon, index) => (
              <button
                key={index}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Social link"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 text-sm text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>Copyright 2026 DownloadHubX. All rights reserved.</span>
          <span className="inline-flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Optimized for speed and usability
          </span>
        </div>
      </div>
    </footer>
  );
}

export default App;
