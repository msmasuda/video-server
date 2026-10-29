FROM node:22-alpine

WORKDIR /app

# 本番依存パッケージのインストール
COPY package*.json ./
RUN npm ci --omit=dev

# アプリケーションコードのコピー
COPY server.js db.js ./
COPY public ./public

# データ保存先ディレクトリおよび動画マウント用ディレクトリを作成
RUN mkdir -p /data /videos

# 環境変数の初期設定
ENV NODE_ENV=production \
    PORT=3000 \
    VIDEO_PATH=/videos \
    DB_PATH=/data/data.db

EXPOSE 3000

CMD ["node", "server.js"]
