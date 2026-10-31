# 動画サーバー（Video Server）

外付けHDDなどにある MP4 をブラウザで再生するローカル Node.js サーバーです。

## 要件

- Node.js 22.5+（Node.js 標準組み込みの `node:sqlite` を利用）
- OS: macOS / Linux (Ubuntu等) / Windows に対応
  - ブラウザ上のWebフォルダピッカーにより、ディスプレイのないCLI/ヘッドレスサーバーでも遠隔操作可能
  - macOS ローカル環境では Finder ダイアログでの選択も可能

## 機能

- **フォルダツリー表示**
  - 指定フォルダ配下の MP4 をツリー構造で一覧表示
  - フォルダ優先・日本語対応の自然順ソート（数値順対応）
  - フォルダのクリックによる展開／折りたたみ
  - 隠しファイル・フォルダ（`.` 始まり）および MP4 以外の自動除外
- **動画再生**
  - `<video>` タグによるスムーズな再生（Range リクエスト対応でシーク可能）
  - 初期状態は自動再生・ミュート（消音）設定
- **お気に入り機能（SQLite 保存）**
  - 再生中動画のお気に入り登録／解除（「☆ お気に入り」／「★ お気に入り済み」ボタン）
  - フォルダツリー内のお気に入り動画に「★」マーカーを表示
  - お気に入りデータはサーバー側の SQLite データベース（`data.db`）に永続保存
- **再生位置のレジューム（SQLite 保存）**
  - 各動画の再生位置および直近に再生していた動画を SQLite データベースに保存
  - 次回ページを開いた際に最後に再生していた動画・続きの位置から自動復元
  - 過去に再生した動画を一覧から再度選んだ際も前回の続きから再生
- **シーク（スキップ）ボタン**
  - ⏪ 60秒 / ⏪ 30秒 / 30秒 ⏩ / 60秒 ⏩ のワンクリックシークボタン
- **別タブでの動画再生**
  - 画面いっぱいに表示される専用プレイヤー（`player.html`）を別タブで起動
  - 一覧各項目の「↗」アイコンまたはコントロールの「↗ 別タブで開く」ボタンから起動
  - メインタブの再生位置を引き継ぎ、メイン側は自動一時停止
  - 別タブ側で進めた再生位置も SQLite に保存・同期
- **UI 操作・カスタマイズ**
  - サイドバーの開閉（ヘッダーのボタンまたはショートカット `Ctrl+B` / `Cmd+B`）
  - サイドバー境界のドラッグによる幅のリサイズ（開閉状態・幅はブラウザに自動保存）
  - 動画表示サイズの切り替え（「サイズ標準」／「サイズ2倍」）
  - ブラウザ上の「📂 フォルダを選択」ボタンで参照先フォルダを変更（Webフォルダピッカー対応。MacローカルではFinderダイアログも併用可能）

## データの保存（SQLite）について

本アプリはお気に入りや再生位置のデータを、サーバー側の **SQLite データベース（`data.db`）** に保存します。
Node.js 22.5+ 組み込みの `node:sqlite` を使用しているため、**追加の npm パッケージインストールは不要**です。

### 保存されるテーブル

| テーブル | カラム | 内容 |
| :--- | :--- | :--- |
| `favorites` | `path` (PK), `created_at` | お気に入り登録された動画の相対パスと登録日時 |
| `playback_state` | `path` (PK), `time`, `updated_at` | 各動画の再生位置（秒数）と最終更新日時 |

### SQLite 化のメリット

- **データが消えない**: ブラウザのキャッシュクリアやシークレットウィンドウ利用でもデータが維持されます。
- **端末・ブラウザ間で共有可能**: 同じPC上の異なるブラウザ（Chrome、Safari 等）や、LAN内の他端末（スマホ、タブレット等）からアクセスしても同じお気に入り・再生位置が共有されます。
- **自動引き継ぎ**: 以前のバージョンでブラウザの `localStorage` に保存されていたお気に入りや再生位置がある場合、初回アクセス時に自動で SQLite へ移行されます。

> ※ データベースファイルの保存先は、環境変数 `DB_PATH`（デフォルト: プロジェクト直下の `data.db`）で変更可能です。

## 起動方法

### 方法 A: Docker Compose で起動（おすすめ・Node.js インストール不要）

ホストマシンに Node.js 22 をインストールすることなく、Docker だけで即座に起動できます。

```bash
# 1. 設定ファイルの作成（外付けHDDのパスを設定）
cp .env.example .env
# 必要に応じて .env 内の VIDEO_DIR を編集（例: VIDEO_DIR=/mnt/videos）

# 2. 起動（バックグラウンド実行）
docker compose up -d

# ログ確認
docker compose logs -f

# 停止
docker compose down
```

### 方法 B: Node.js 直接起動

動画フォルダを環境変数 `VIDEO_PATH` で指定して起動します。

```bash
# 事前準備
npm install

# 例: Mac (外付けHDD)
VIDEO_PATH="/Volumes/MyDrive/Movies" npm start

# 例: Linux (外付けHDDマウント先)
VIDEO_PATH="/mnt/videos" npm start
```

未指定の場合はプラットフォームに応じて以下を自動検出します：
- macOS: `~/Movies` または `~/Videos`
- Linux: `~/Videos` または `~/Movies`、`/mnt`、`/media`

ポートは `PORT` で変更可能（デフォルト 3000）。

```bash
PORT=8080 VIDEO_PATH="/mnt/videos" npm start
```

## 使い方

1. ブラウザで `http://localhost:3000`（またはサーバーのIPアドレス:3000）を開く
2. 左のツリー一覧から動画をクリックして再生
3. **お気に入り登録**: 再生中に「☆ お気に入り」ボタンを押すと登録され、ツリー内に★が表示されます
4. **別タブで再生**: 動画項目の「↗」アイコンまたは「↗ 別タブで開く」ボタンを押すと、専用プレイヤー画面が別タブで開きます
5. **フォルダ切り替え**: ヘッダーの「📂 フォルダを選択」ボタンで Web フォルダピッカーが開き、サーバー内のディレクトリをブラウズ・選択できます（Mac ローカルでは Finder ダイアログも併用可能）
6. **続きから再生**: 再生位置やお気に入りは SQLite に自動保存されるため、次回アクセス時や別ブラウザから開いた際もそのまま引き継がれます

## Linux (Ubuntu 24.04 CLI) での利用ガイド

### 1. Node.js 22 のインストール
本アプリは `node:sqlite` を利用するため **Node.js 22.5.0 以上** が必要です。

```bash
# NodeSource から Node.js 22.x をインストール
curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
sudo -E bash nodesource_setup.sh
sudo apt-get install -y nodejs

node -v # v22.5.0 以上であることを確認
```

### 2. Mac フォーマット（HFS+）外付けHDDのマウント
Mac で使っていた外付けHDD（Journaled HFS+）は、Ubuntu 上で読み取り専用（Read-Only）として安全にマウントできます。動画の配信は読み込みのみで行われ、お気に入りや再生位置はサーバーローカルの `data.db` に保存されるため、完全に対応します。

```bash
# HFS+ パッケージのインストール
sudo apt install -y hfsprogs

# デバイス名を確認（例: /dev/sdb2）
lsblk -f

# 読み取り専用 (-o ro) でマウント
sudo mkdir -p /mnt/videos
sudo mount -t hfsplus -o ro /dev/sdb2 /mnt/videos
```

### 3. systemd によるサービス化（バックグラウンド常駐）
テンプレートファイル `video-server.service.example` を参考にサービス登録できます：

```bash
sudo cp video-server.service.example /etc/systemd/system/video-server.service
# ユーザー名やパスを編集
sudo nano /etc/systemd/system/video-server.service

# 有効化＆起動
sudo systemctl daemon-reload
sudo systemctl enable --now video-server
```

## 注意

- `VIDEO_PATH` には動画フォルダのパス（Mac: `/Volumes/...`、Linux: `/mnt/...` や `/media/...` 等）を指定してください
- サーバーはローカル利用（LAN内）を想定しています。インターネット等に外部公開する場合は、認証やリバースプロキシ（nginx等）による保護を検討してください
