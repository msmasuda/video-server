const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new DatabaseSync(DB_PATH);

// WALモードを有効化し、テーブルを作成
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS favorites (
    path TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS playback_state (
    path TEXT PRIMARY KEY,
    time REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
`);

let lastTimestamp = 0;
function getNextTimestamp() {
  let now = Date.now();
  if (now <= lastTimestamp) {
    now = lastTimestamp + 1;
  }
  lastTimestamp = now;
  return now;
}

// プリペアドステートメント
const stmts = {
  getFavorites: db.prepare('SELECT path FROM favorites ORDER BY created_at ASC'),
  isFavorite: db.prepare('SELECT 1 FROM favorites WHERE path = ?'),
  addFavorite: db.prepare('INSERT OR IGNORE INTO favorites (path) VALUES (?)'),
  removeFavorite: db.prepare('DELETE FROM favorites WHERE path = ?'),

  getPlaybackState: db.prepare('SELECT path, time FROM playback_state WHERE path = ?'),
  getLastPlaybackState: db.prepare('SELECT path, time FROM playback_state ORDER BY updated_at DESC LIMIT 1'),
  upsertPlaybackState: db.prepare(`
    INSERT INTO playback_state (path, time, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      time = excluded.time,
      updated_at = excluded.updated_at
  `),
};

/** お気に入りのパス一覧を取得 */
function getFavorites() {
  return stmts.getFavorites.all().map((row) => row.path);
}

/** 指定パスがお気に入りか判定 */
function isFavorite(videoPath) {
  return !!stmts.isFavorite.get(videoPath);
}

/** お気に入りをトグル（登録ならtrue、解除ならfalse） */
function toggleFavorite(videoPath) {
  if (isFavorite(videoPath)) {
    stmts.removeFavorite.run(videoPath);
    return false;
  } else {
    stmts.addFavorite.run(videoPath);
    return true;
  }
}

/** 複数のお気に入りをまとめて追加（マイグレーション用） */
function addFavorites(paths) {
  if (!Array.isArray(paths)) return;
  for (const p of paths) {
    if (typeof p === 'string' && p.trim()) {
      stmts.addFavorite.run(p.trim());
    }
  }
}

/** 再生位置を取得（videoPath指定時はその動画、未指定時は直近に再生した動画） */
function getPlayback(videoPath) {
  if (videoPath) {
    return stmts.getPlaybackState.get(videoPath) || null;
  }
  return stmts.getLastPlaybackState.get() || null;
}

/** 再生位置を保存 */
function savePlayback(videoPath, time) {
  const safeTime = Math.max(0, typeof time === 'number' && !isNaN(time) ? time : 0);
  const ts = getNextTimestamp();
  stmts.upsertPlaybackState.run(videoPath, safeTime, ts);
}

module.exports = {
  db,
  getFavorites,
  isFavorite,
  toggleFavorite,
  addFavorites,
  getPlayback,
  savePlayback,
};
