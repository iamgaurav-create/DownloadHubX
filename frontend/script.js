const API_BASE = 'http://localhost:3001/api';

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const fetchBtn = document.getElementById('fetchBtn');
  const loading = document.getElementById('loading');
  const videoDetails = document.getElementById('videoDetails');
  const errorDiv = document.getElementById('error');
  const thumbnail = document.getElementById('thumbnail');
  const title = document.getElementById('title');
  const duration = document.getElementById('duration');
  const formats = document.getElementById('formats');

  fetchBtn.addEventListener('click', fetchVideoDetails);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      fetchVideoDetails();
    }
  });

  async function fetchVideoDetails() {
    const url = urlInput.value.trim();
    if (!url) {
      showError('Please enter a YouTube URL');
      return;
    }

    hideError();
    showLoading();
    hideVideoDetails();

    try {
      const response = await fetch(`${API_BASE}/fetch-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch video details');
      }

      const data = await response.json();

      displayVideoDetails(data);
    } catch (err) {
      showError('Invalid URL or video not available');
      console.error(err);
    } finally {
      hideLoading();
    }
  }

  function displayVideoDetails(data) {
    thumbnail.src = data.thumbnail;
    title.textContent = data.title;
    duration.textContent = `Duration: ${formatDuration(data.duration)}`;

    if (data.message) {
      showError(data.message);
    } else {
      hideError();
    }

    formats.innerHTML = '';
    data.formats.forEach(format => {
      const formatDiv = document.createElement('div');
      formatDiv.className = 'format-option';
      formatDiv.innerHTML = `
        <div class="quality">${format.quality}</div>
        <div class="size">${getFormatDescription(format)}</div>
      `;
      formatDiv.addEventListener('click', () => downloadVideo(urlInput.value, format.format_id, format.ext));
      formats.appendChild(formatDiv);
    });

    showVideoDetails();
  }

  async function downloadVideo(url, formatId, ext) {
    const downloadUrl = `${API_BASE}/download?url=${encodeURIComponent(url)}&formatId=${encodeURIComponent(formatId)}&ext=${encodeURIComponent(ext)}`;
    window.open(downloadUrl, '_blank');
  }

  function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  function formatFileSize(bytes) {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  function getFormatDescription(format) {
    const sizeLabel = format.filesize ? formatFileSize(format.filesize) : 'Size unknown';

    if (format.ext === 'mp3') {
      return sizeLabel;
    }

    return format.hasAudio ? `${sizeLabel} | video + audio` : `${sizeLabel}`;
  }

  function showLoading() {
    loading.classList.remove('hidden');
  }

  function hideLoading() {
    loading.classList.add('hidden');
  }

  function showVideoDetails() {
    videoDetails.classList.remove('hidden');
  }

  function hideVideoDetails() {
    videoDetails.classList.add('hidden');
  }

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }

  function hideError() {
    errorDiv.textContent = '';
    errorDiv.classList.add('hidden');
  }
});
