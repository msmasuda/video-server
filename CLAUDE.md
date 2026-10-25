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

This is a minimal Node.js app: `server.js` (Express backend), `db.js` (SQLite persistence via `node:sqlite`), and `public/` frontend (vanilla JS, no build step).

**`db.js`**:
- SQLite database wrapper using built-in `node:sqlite` (`data.db`, WAL mode enabled).
- Manages `favorites` and `playback_state` tables.
- Provides functions for reading/updating favorites and playback positions with subsecond accuracy.

**`server.js`** exposes routes:
- `GET /api/videos` — walks `VIDEO_PATH` recursively via `buildTree()` and returns a JSON folder tree (folders before files, Japanese-aware natural sort). Hidden files/dirs (`.` prefix) and non-MP4 files are excluded.
- `POST /api/select-folder` — Mac-only; launches an AppleScript `choose folder` dialog via `exec(osascript …)` and mutates the in-process `VIDEO_PATH` variable. The change is not persisted across restarts.
- `GET /api/favorites` — returns JSON array of favorite video paths from SQLite.
- `POST /api/favorites/toggle` — toggles favorite state for a path in SQLite.
- `POST /api/favorites/sync` — batch adds favorites (for automatic migration from browser `localStorage`).
- `GET /api/playback` — returns playback state (`path` and `time`) for specified path or the most recently played video.
- `POST /api/playback` — updates/upserts playback position in SQLite.
- `GET /video?path=<relative>` — streams the requested MP4 with full HTTP Range support for browser seeking. `resolveVideoPath()` sanitizes the path to prevent directory traversal.
- `express.static('public')` serves the frontend.

**`public/index.html`** is a self-contained SPA:
- Fetches `/api/videos` and `/api/favorites` on load, renders a collapsible folder tree in the sidebar.
- Plays videos via `<video src="/video?path=…">` with Range requests handled natively by the browser.
- Automatically saves playback position to SQLite via throttled `POST /api/playback` (and mirrors to `localStorage`), auto-resumes last played video on next load.
- Migrates any legacy `localStorage` favorites/playback data to SQLite on first load.
- The sidebar width is drag-resizable via a CSS grid resizer column.
- Custom skip buttons: ⏪60s, ⏪30s, 30s⏩, 60s⏩ (note: button labels say 60s/30s but the IDs say rewind30/rewind10 — the labels are the actual skip amounts).
- Supports opening videos in a new tab via the `↗ 別タブで開く` button or the `↗` icon beside each video.

**`public/player.html`** is a minimal player page for opening videos in a separate tab:
- Fullscreen-style video with audio muted by default.
- Custom skip buttons: ⏪60s, ⏪30s, 30s⏩, 60s⏩.
- Receives `path` and optional `t` (seconds) query parameters, fetches initial time from SQLite if `t` omitted, and saves playback progress to SQLite via `POST /api/playback`.

## Mac-specific dependency

The folder-selection feature (`/api/select-folder`) uses `osascript` and is Mac-only. The rest of the server is cross-platform.
