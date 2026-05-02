import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CheckSquare, Download, FileAudio, FileVideo, Loader2, Play, Square } from 'lucide-react';
import { useState } from 'react';

type PlaylistVideo = {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  playlist_index: number;
  channel?: string;
  viewCount?: number;
  webpage_url: string;
};

type PlaylistViewProps = {
  url: string;
  videos: PlaylistVideo[];
  onBack: () => void;
  onDownload: (selectedIndices: number[], mode: 'video' | 'audio', height: string) => void;
  downloadProgress: number;
};

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

export default function PlaylistView({ url, videos, onBack, onDownload, downloadProgress }: PlaylistViewProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [formatMode, setFormatMode] = useState<'video' | 'audio'>('video');
  const [quality, setQuality] = useState('720'); // 1080, 720, 480, 360

  const allSelected = selectedIndices.size === videos.length && videos.length > 0;
  const isDownloading = downloadProgress > 0 && downloadProgress < 100;

  function toggleSelection(index: number) {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(videos.map(v => v.playlist_index)));
    }
  }

  function handleDownload() {
    if (selectedIndices.size === 0) return;
    onDownload(Array.from(selectedIndices).sort((a, b) => a - b), formatMode, quality);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-6xl px-4 py-8 mx-auto"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
          <h2 className="text-3xl font-serifDisplay text-white">Playlist Videos</h2>
          <p className="text-white/50 mt-1">{videos.length} videos found in playlist</p>
        </div>

        <div className="liquid-glass rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex gap-3 items-center">
            <select
              value={formatMode}
              onChange={(e) => setFormatMode(e.target.value as 'video' | 'audio')}
              className="bg-black/40 border border-white/20 text-white text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2.5 outline-none"
            >
              <option value="video">🎬 Video</option>
              <option value="audio">🎧 Audio Only</option>
            </select>
            
            {formatMode === 'video' && (
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="bg-black/40 border border-white/20 text-white text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2.5 outline-none"
              >
                <option value="1080">1080p</option>
                <option value="720">720p</option>
                <option value="480">480p</option>
                <option value="360">360p</option>
              </select>
            )}
          </div>

          <button
            onClick={handleDownload}
            disabled={selectedIndices.size === 0 || isDownloading}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-2.5 font-semibold text-white shadow-lg transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download Selected ({selectedIndices.size})
          </button>
        </div>
      </div>

      {isDownloading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="liquid-glass max-w-md w-full mx-4 rounded-3xl p-8 text-center border border-cyan-400/30">
            <Loader2 className="h-12 w-12 animate-spin text-cyan-400 mx-auto mb-6" />
            <h3 className="text-2xl font-serifDisplay text-white mb-2">Preparing your ZIP</h3>
            <p className="text-white/60 mb-6 text-sm">
              We are fetching and compressing {selectedIndices.size} videos. This might take a few minutes depending on the file sizes. Please don't close this page.
            </p>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="mt-4 text-xs font-semibold text-cyan-200">
              Download starting automatically...
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={toggleAll}
          className="inline-flex items-center gap-2 text-white/80 hover:text-white transition"
        >
          {allSelected ? (
            <CheckSquare className="h-5 w-5 text-cyan-400" />
          ) : (
            <Square className="h-5 w-5" />
          )}
          <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {videos.map((video) => {
          const actualIndex = video.playlist_index;
          const isSelected = selectedIndices.has(actualIndex);
          return (
            <div
              key={video.id}
              onClick={() => toggleSelection(actualIndex)}
              className={`group relative flex flex-col rounded-2xl overflow-hidden border transition cursor-pointer ${
                isSelected
                  ? 'border-cyan-400/60 bg-cyan-400/10'
                  : 'border-white/10 bg-white/5 hover:border-white/30'
              }`}
            >
              <div className="relative aspect-video w-full overflow-hidden">
                <img
                  src={video.thumbnail || 'https://via.placeholder.com/320x180?text=No+Thumbnail'}
                  alt={video.title}
                  className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition" />
                <div className="absolute top-3 left-3">
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-cyan-400 bg-black/50 rounded" />
                  ) : (
                    <Square className="h-5 w-5 text-white/70 bg-black/20 rounded" />
                  )}
                </div>
                <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-0.5 text-xs font-medium text-white">
                  {formatDuration(video.duration)}
                </span>
                <span className="absolute bottom-2 left-2 rounded-md bg-black/80 px-2 py-0.5 text-xs font-medium text-white">
                  #{actualIndex}
                </span>
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <h3 className="text-sm font-medium text-white line-clamp-2 leading-tight mb-1">
                  {video.title}
                </h3>
                <p className="text-xs text-white/50 mt-auto line-clamp-1">
                  {video.channel || 'Unknown Channel'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
