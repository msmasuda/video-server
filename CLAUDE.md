# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start the server (default: ~/Movies, port 3000)
npm start

# Start with a specific video folder and/or port
VIDEO_PATH="/Volumes/MyDrive/Movies" npm start
PORT=8080 VIDEO_PATH="/Volumes/HDD/Videos" npm start
```

There is no test suite or linter configured.

## Architecture

This is a minimal Node.js app: `server.js` (Express backend) and `public/` frontend (vanilla JS, no build step).

**`server.js`** exposes routes:
- `GET /api/videos` — walks `VIDEO_PATH` recursively via `buildTree()` and returns a JSON folder tree (folders before files, Japanese-aware natural sort). Hidden files/dirs (`.` prefix) and non-MP4 files are excluded.
- `POST /api/select-folder` — Mac-only; launches an AppleScript `choose folder` dialog via `exec(osascript …)` and mutates the in-process `VIDEO_PATH` variable. The change is not persisted across restarts.
- `GET /video?path=<relative>` — streams the requested MP4 with full HTTP Range support for browser seeking. `resolveVideoPath()` sanitizes the path to prevent directory traversal.
- `express.static('public')` serves the frontend.

**`public/index.html`** is a self-contained SPA:
- Fetches `/api/videos` on load, renders a collapsible folder tree in the sidebar.
- Plays videos via `<video src="/video?path=…">` with Range requests handled natively by the browser.
- Persists the current video path and playback position in `localStorage` (`video-server-current`, `video-server-time`) and auto-resumes on next load.
- The sidebar width is drag-resizable via a CSS grid resizer column.
- Custom skip buttons: ⏪60s, ⏪30s, 30s⏩, 60s⏩ (note: button labels say 60s/30s but the IDs say rewind30/rewind10 — the labels are the actual skip amounts).
- Supports opening videos in a new tab via the `↗ 別タブで開く` button or the `↗` icon beside each video.

**`public/player.html`** is a minimal player page for opening videos in a separate tab:
- Fullscreen-style video with audio muted by default.
- Custom skip buttons: ⏪60s, ⏪30s, 30s⏩, 60s⏩.
- Receives `path` and optional `t` (seconds) query parameters, and shares playback progress via `localStorage`.

## Mac-specific dependency

The folder-selection feature (`/api/select-folder`) uses `osascript` and is Mac-only. The rest of the server is cross-platform.
