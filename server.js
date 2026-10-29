const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 動画フォルダのデフォルトパスを判定（環境変数 > プラットフォームごとの既定フォルダ）
function getDefaultVideoPath() {
  if (process.env.VIDEO_PATH) return process.env.VIDEO_PATH;
  if (fs.existsSync('/videos')) return '/videos'; // Docker コンテナ用マウント先
  const home = process.env.HOME || '';
  const candidates = process.platform === 'darwin'
    ? [path.join(home, 'Movies'), path.join(home, 'Videos')]
    : [path.join(home, 'Videos'), path.join(home, 'Movies'), '/mnt', '/media'];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return home || process.cwd();
}

let VIDEO_PATH = getDefaultVideoPath();

if (!fs.existsSync(VIDEO_PATH)) {
  console.warn(`警告: VIDEO_PATH が存在しません: ${VIDEO_PATH}`);
  console.warn('起動時に環境変数 VIDEO_PATH を設定してください。例: VIDEO_PATH=/Volumes/HDD/Videos npm start');
}

/**
 * 指定フォルダ配下をツリー構造で取得
 * - folder: { type: 'folder', name, children }
 * - file:   { type: 'file', name, path }  path は VIDEO_PATH からの相対パス
 */
function buildTree(dir, baseDir = dir) {
  const nodes = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      // 隠しファイル・フォルダ（Macの .DocumentRevisions-V100 など）を除外
      if (ent.name.startsWith('.')) continue;

      const full = path.join(dir, ent.name);
      const relative = path.relative(baseDir, full);
      if (ent.isDirectory()) {
        const children = buildTree(full, baseDir);
        nodes.push({ type: 'folder', name: ent.name, children });
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.mp4')) {
        nodes.push({ type: 'file', name: ent.name, path: relative });
      }
    }
  } catch (err) {
    // 権限エラー (EPERM, EACCES) の場合はログ出力を抑える
    if (err.code !== 'EPERM' && err.code !== 'EACCES') {
      console.error('readdir error:', dir, err.message);
    }
  }
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '', 'ja', { numeric: true });
  });
}

/** 安全に動画ルート内の絶対パスに変換（パストラバーサル対策） */
function resolveVideoPath(relativePath) {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolute = path.join(VIDEO_PATH, normalized);
  const realBase = path.resolve(VIDEO_PATH);
  const realResolved = path.resolve(absolute);
  if (realResolved !== realBase && !realResolved.startsWith(realBase + path.sep)) {
    return null;
  }
  return realResolved;
}

// 動画一覧 API（フォルダツリー形式）
app.get('/api/videos', (req, res) => {
  const tree = buildTree(VIDEO_PATH);
  res.json({
    basePath: VIDEO_PATH,
    tree,
    platform: process.platform,
    hasNativePicker: process.platform === 'darwin',
  });
});

// ディレクトリ一覧取得 API（Webフォルダ選択モーダル用）
app.get('/api/browse-directories', (req, res) => {
  let targetPath = req.query.path ? path.resolve(req.query.path) : path.resolve(VIDEO_PATH);
  if (!fs.existsSync(targetPath)) {
    targetPath = path.resolve(VIDEO_PATH);
    if (!fs.existsSync(targetPath)) {
      targetPath = process.env.HOME || '/';
    }
  }

  try {
    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      targetPath = path.dirname(targetPath);
    }
  } catch (err) {
    return res.status(400).json({ error: '無効なパスです: ' + err.message });
  }

  const parentPath = path.dirname(targetPath);
  const directories = [];

  try {
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue; // 隠しディレクトリ除外
      if (ent.isDirectory()) {
        directories.push({
          name: ent.name,
          path: path.join(targetPath, ent.name),
        });
      }
    }
  } catch (err) {
    return res.json({
      currentPath: targetPath,
      parentPath: targetPath === parentPath ? null : parentPath,
      directories: [],
      error: 'このディレクトリへのアクセス権限がありません (' + (err.code || err.message) + ')',
    });
  }

  directories.sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true }));

  // システム共通の便利なショートカット候補
  const shortcuts = [];
  const home = process.env.HOME;
  if (home && fs.existsSync(home)) {
    shortcuts.push({ name: 'ホーム (~)', path: home });
    const homeMovies = path.join(home, 'Movies');
    if (fs.existsSync(homeMovies)) shortcuts.push({ name: 'Movies', path: homeMovies });
    const homeVideos = path.join(home, 'Videos');
    if (fs.existsSync(homeVideos)) shortcuts.push({ name: 'Videos', path: homeVideos });
  }
  if (process.platform === 'darwin' && fs.existsSync('/Volumes')) {
    shortcuts.push({ name: '/Volumes (外付けドライブ)', path: '/Volumes' });
  }
  if (fs.existsSync('/videos')) shortcuts.push({ name: '動画 (/videos)', path: '/videos' });
  if (fs.existsSync('/mnt')) shortcuts.push({ name: '/mnt', path: '/mnt' });
  if (fs.existsSync('/media')) shortcuts.push({ name: '/media', path: '/media' });
  shortcuts.push({ name: 'ルート (/)', path: '/' });

  res.json({
    currentPath: targetPath,
    parentPath: targetPath === parentPath ? null : parentPath,
    directories,
    shortcuts,
    platform: process.platform,
    hasNativePicker: process.platform === 'darwin',
  });
});

// フォルダ選択・変更 API
app.post('/api/select-folder', (req, res) => {
  const { path: requestedPath } = req.body || {};

  // パスが直接渡された場合（Webフォルダピッカー等）
  if (requestedPath && typeof requestedPath === 'string') {
    const selectedPath = path.resolve(requestedPath.trim());
    if (fs.existsSync(selectedPath)) {
      try {
        const stat = fs.statSync(selectedPath);
        if (stat.isDirectory()) {
          VIDEO_PATH = selectedPath;
          return res.json({ success: true, path: selectedPath });
        } else {
          return res.status(400).json({ error: '指定されたパスはフォルダではありません' });
        }
      } catch (err) {
        return res.status(400).json({ error: 'フォルダにアクセスできません: ' + err.message });
      }
    } else {
      return res.status(400).json({ error: '指定されたフォルダが存在しません' });
    }
  }

  // パス指定がなく、macOS の場合は AppleScript ダイアログを表示
  if (process.platform === 'darwin') {
    const script = `osascript -e 'tell application "System Events"
      activate
      return POSIX path of (choose folder with prompt "動画フォルダを選択してください")
    end tell'`;

    exec(script, (error, stdout, stderr) => {
      if (error) {
        if (error.code === 1) {
          return res.json({ canceled: true });
        }
        console.error('Folder selection error:', error);
        return res.status(500).json({ error: 'フォルダ選択に失敗しました' });
      }

      const selectedPath = stdout.trim();
      if (selectedPath && fs.existsSync(selectedPath)) {
        VIDEO_PATH = path.resolve(selectedPath);
        res.json({ success: true, path: VIDEO_PATH });
      } else {
        res.status(400).json({ error: '無効なパスが選択されました' });
      }
    });
  } else {
    // Linux等のCLI/非Mac環境でパス指定がない場合
    return res.status(400).json({
      error: 'この環境ではGUIダイアログは利用できません。Webフォルダ選択をご利用ください。',
    });
  }
});

// お気に入り一覧 API
app.get('/api/favorites', (req, res) => {
  res.json({ favorites: db.getFavorites() });
});

// お気に入りトグル API
app.post('/api/favorites/toggle', (req, res) => {
  const { path: videoPath } = req.body || {};
  if (!videoPath || typeof videoPath !== 'string') {
    return res.status(400).json({ error: 'path is required' });
  }
  const isFav = db.toggleFavorite(videoPath);
  res.json({ isFavorite: isFav, favorites: db.getFavorites() });
});

// お気に入り一括同期 API（localStorage からの移行用）
app.post('/api/favorites/sync', (req, res) => {
  const { paths } = req.body || {};
  if (Array.isArray(paths)) {
    db.addFavorites(paths);
  }
  res.json({ success: true, favorites: db.getFavorites() });
});

// 再生状態取得 API（path 指定時はその動画、未指定時は直近に再生した動画）
app.get('/api/playback', (req, res) => {
  const videoPath = req.query.path;
  const playback = db.getPlayback(typeof videoPath === 'string' ? videoPath : undefined);
  res.json({ playback });
});

// 再生状態保存 API
app.post('/api/playback', (req, res) => {
  const { path: videoPath, time } = req.body || {};
  if (!videoPath || typeof videoPath !== 'string' || typeof time !== 'number') {
    return res.status(400).json({ error: 'path and numeric time are required' });
  }
  db.savePlayback(videoPath, time);
  res.json({ success: true });
});

// 動画ストリーミング（Range 対応でシーク可能）
app.get('/video', (req, res) => {
  const relativePath = req.query.path;
  if (!relativePath || typeof relativePath !== 'string') {
    return res.status(400).send('path required');
  }
  const filePath = resolveVideoPath(relativePath);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).send('Not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return res.status(416).set({ 'Content-Range': `bytes */${fileSize}` }).send();
    }
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.status(206);
    res.set({
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.set({
      'Accept-Ranges': 'bytes',
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`動画サーバー: http://localhost:${PORT}`);
    console.log(`動画フォルダ: ${VIDEO_PATH}`);
  });
}

module.exports = app;
