# DownloadHubX Downloader

A modern, premium single-page video downloader with a dark glassmorphism interface.

## Features

- React + TypeScript + Vite frontend
- Tailwind CSS liquid glass styling
- Framer Motion animations and Lucide icons
- Fetch video details including title, thumbnail, duration, channel, and views
- Video and audio download options, including MP4 and MP3 where available
- Responsive layout for mobile and desktop
- Loading, invalid URL, copy-link, and download progress states

## Prerequisites

- Node.js 18 or higher
- The included `backend/yt-dlp.exe`

## Installation

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

## Development

Start the backend:

```bash
cd backend
npm start
```

Start the Vite frontend:

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

## Production

Build the frontend and serve it from the backend:

```bash
cd frontend
npm run build
cd ../backend
npm start
```

Open http://localhost:3001 in your browser.

## API Endpoints

- `POST /api/fetch-details`: Fetch video information and available formats
- `GET /api/download`: Download the selected format

## Project Structure

```text
backend/
  package.json
  server.js
  downloads/
frontend/
  src/
  index.html
  package.json
  tailwind.config.js
README.md
```

## Disclaimer

This tool is for educational purposes only. Respect platform terms of service and copyright laws.
