const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 動画フォルダ（外付けHDDのパスを指定。例: /Volumes/MyDrive/Movies）
const VIDEO_PATH = process.env.VIDEO_PATH || path.join(process.env.HOME || '', 'Movies');

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
    console.error('readdir error:', dir, err.message);
  }
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true });
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
  res.json({ basePath: VIDEO_PATH, tree });
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

app.listen(PORT, () => {
  console.log(`動画サーバー: http://localhost:${PORT}`);
  console.log(`動画フォルダ: ${VIDEO_PATH}`);
});
