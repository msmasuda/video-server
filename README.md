# 動画サーバー（Video Server）

外付けHDDなどにある MP4 をブラウザで再生するローカル Node.js サーバーです。

## 要件

- Node.js 18+
- Express
- Mac 想定

## 機能

- 指定フォルダ配下の MP4 を再帰的に一覧表示
- `<video>` タグで再生（シーク対応のため Range リクエスト対応）
- 再生位置を localStorage で保存・復元

## セットアップ

```bash
npm install
```

## 起動方法

動画フォルダを環境変数 `VIDEO_PATH` で指定して起動します。

```bash
# 例: 外付けHDDの動画フォルダを指定
VIDEO_PATH="/Volumes/MyDrive/Movies" npm start
```

未指定の場合は `~/Movies` を使用します。ポートは `PORT` で変更可能（デフォルト 3000）。

```bash
PORT=8080 VIDEO_PATH="/Volumes/HDD/Videos" npm start
```

## 使い方

1. ブラウザで http://localhost:3000 を開く
2. 左の一覧から動画をクリックして再生
3. 再生位置は自動で localStorage に保存され、次回同じ動画を開くと続きから再生されます

## 注意

- `VIDEO_PATH` には外付けHDDのマウントパス（例: `/Volumes/ディスク名/フォルダ`）を指定してください
- サーバーはローカル利用を想定しています。外部に公開する場合は認証等の対策を検討してください
