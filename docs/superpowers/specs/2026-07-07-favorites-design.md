# お気に入り機能 設計ドキュメント

## 概要

再生中の動画をお気に入り登録し、サイドバー上部からすばやくアクセスできるようにする。サーバー変更なし、localStorage のみで完結する。

## データモデル

- **キー:** `video-server-favorites`
- **型:** JSON 配列（相対パスの文字列）
- **例:** `["Series/ep01.mp4", "Movies/action.mp4"]`
- フォルダをまたぐパスも保持し続けるが、表示は現在の `videoList` に含まれるもののみ

## UI 変更

### 1. サイドバー上部 — お気に入りセクション

- `<aside>` 内の `<ul id="videoTree">` の上に追加
- 構造:
  ```html
  <div id="favSection">
    <div class="fav-header">★ お気に入り</div>
    <ul id="favList"></ul>
  </div>
  ```
- 現在の `videoList` に含まれるお気に入りパスのみ表示
- 0件の場合はセクション全体を非表示（`display:none`）
- クリックで `playVideo(path)` を呼ぶ（ツリーと同様）
- アクティブな動画は `.active` クラスで強調（`setActiveItem` に連動）

### 2. 再生コントロール — ★ ボタン

- `id="favBtn"` のボタンを既存コントロール末尾に追加
- 状態:
  - 未登録: テキスト `☆ お気に入り`
  - 登録済み: テキスト `★ お気に入り済み`
- 動画切り替え（`playVideo` 呼び出し）のたびにボタン状態を更新
- クリックでトグル（登録 ↔ 解除）し、サイドバーを即時再描画

### 3. ツリー内 ★ マーカー

- `renderTree` でお気に入りのパスには `★ ` プレフィックスをファイル名の前に付与
- 色は CSS 変数 `--accent` を使用

## ロジック

### お気に入りの読み書き

```js
function getFavorites() { ... }          // localStorage から配列を返す
function saveFavorites(arr) { ... }      // 配列を localStorage に保存
function isFavorite(path) { ... }        // 指定パスが登録済みかを返す
function toggleFavorite(path) { ... }   // 登録/解除をトグルして保存
```

### サイドバー再描画

- お気に入り変更時に `renderFavSection()` を呼び出してお気に入りリストを更新
- お気に入り変更時にツリーも再描画（`renderTree` は描画時に `getFavorites()` を参照して ★ を付与するため）
- フォルダ切り替え（`loadVideos` 解決後）にも `renderFavSection()` を呼ぶ
- `setActiveItem` で favList 内のアイテムにも `.active` クラスを付与

### フォルダ切り替え時の挙動

- 保存済みお気に入り配列はそのまま維持
- `renderFavSection` は `videoList.filter(p => isFavorite(p))` でフィルタして表示

## スコープ外

- サーバーサイドへの保存
- フォルダをまたいだお気に入りの表示
- お気に入り順の並び替え
