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

/** 指定フォルダ配下の .mp4 を再帰的に取得（相対パスで返す） */
function findMp4Files(dir, baseDir = dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const relative = path.relative(baseDir, full);
      if (ent.isDirectory()) {
        results.push(...findMp4Files(full, baseDir));
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.mp4')) {
        results.push(relative);
      }
    }
  } catch (err) {
    console.error('readdir error:', dir, err.message);
  }
  return results.sort();
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

// 動画一覧 API
app.get('/api/videos', (req, res) => {
  const list = findMp4Files(VIDEO_PATH);
  res.json({ basePath: VIDEO_PATH, videos: list });
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
