# お気に入り機能 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 再生中の動画をお気に入り登録し、サイドバー上部のセクションとツリー内の★マーカーですばやくアクセスできるようにする。

**Architecture:** localStorage に相対パスの配列を保存する。サーバー変更なし。`public/index.html` の HTML・CSS・JS のみを変更する。お気に入りトグル時にツリーとお気に入りセクションを再描画する。

**Tech Stack:** Vanilla JS、localStorage、既存の Express サーバー（変更なし）

## Global Constraints

- 変更ファイルは `public/index.html` のみ（server.js は触らない）
- 既存の `escapeHtml` / `escapeAttr` / `playVideo` などの関数名・シグネチャを変えない
- CSS カラーは既存の CSS 変数（`--accent`, `--muted`, `--surface` 等）を使う
- テストフレームワークなし。各タスクの確認はブラウザで手動テストする

---

### Task 1: お気に入りのデータ層（CRUD 関数）

**Files:**
- Modify: `public/index.html` — `<script>` 内の定数宣言ブロック（`VIDEO_KEY` / `TIME_KEY` の直下）に追加

**Interfaces:**
- Produces:
  - `getFavorites() → string[]`
  - `saveFavorites(arr: string[]) → void`
  - `isFavorite(path: string) → boolean`
  - `toggleFavorite(path: string) → void`

- [ ] **Step 1: 定数と関数を追加する**

`const TIME_KEY = 'video-server-time';` の直後に以下を追加:

```js
const FAVORITES_KEY = 'video-server-favorites';

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  } catch (e) { return []; }
}

function saveFavorites(arr) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr)); } catch (e) {}
}

function isFavorite(path) {
  return getFavorites().includes(path);
}

function toggleFavorite(path) {
  const favs = getFavorites();
  const idx = favs.indexOf(path);
  if (idx === -1) { favs.push(path); } else { favs.splice(idx, 1); }
  saveFavorites(favs);
}
```

- [ ] **Step 2: ブラウザで動作確認する**

サーバーを起動してブラウザの DevTools コンソールで実行:

```js
toggleFavorite('test/video.mp4');
console.log(getFavorites());   // ["test/video.mp4"]
console.log(isFavorite('test/video.mp4'));  // true
toggleFavorite('test/video.mp4');
console.log(getFavorites());   // []
```

期待値: 上記の通りすべて正しく動作する。

- [ ] **Step 3: コミット**

```bash
git add public/index.html
git commit -m "feat: お気に入りCRUDユーティリティを追加"
```

---

### Task 2: CSS とHTML構造の追加

**Files:**
- Modify: `public/index.html` — `<style>` ブロック末尾にCSS追加、`<aside>` 内と `<div class="controls">` 内にHTML追加、DOM参照を追加

**Interfaces:**
- Consumes: なし（このタスクは構造のみ）
- Produces:
  - `#favSection` 要素（`display:none` で初期非表示）
  - `#favList` 要素（お気に入りリスト）
  - `#favBtn` 要素（コントロールのボタン）
  - `const favBtn` DOM参照

- [ ] **Step 1: CSS を追加する**

`</style>` の直前に追加:

```css
#favSection {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 0.5rem;
  margin-bottom: 0.25rem;
}
.fav-header {
  padding: 0.5rem 0.75rem 0.25rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.fav-item {
  padding: 0.35rem 0.5rem 0.35rem 1.25rem;
  cursor: pointer;
  border-radius: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9rem;
  color: var(--accent);
}
.fav-item:hover {
  background: rgba(255, 255, 255, 0.08);
}
.fav-item.active {
  background: rgba(124, 156, 255, 0.2);
}
```

- [ ] **Step 2: サイドバーに favSection を追加する**

```html
<aside>
```
を以下に変更:

```html
<aside>
  <div id="favSection" style="display:none">
    <div class="fav-header">★ お気に入り</div>
    <ul id="favList" class="video-tree"></ul>
  </div>
```

- [ ] **Step 3: コントロールに favBtn を追加する**

```html
<button class="btn" id="sizeToggle">サイズ2倍</button>
```
の直前に追加:

```html
<button class="btn" id="favBtn">☆ お気に入り</button>
```

- [ ] **Step 4: DOM参照を追加する**

`const selectFolderBtn = document.getElementById('selectFolderBtn');` の直後に追加:

```js
const favBtn = document.getElementById('favBtn');
const favSection = document.getElementById('favSection');
const favList = document.getElementById('favList');
```

- [ ] **Step 5: ブラウザで確認する**

ページをリロードして:
- `favSection` が非表示であること（DevTools Elements で確認）
- コントロールに「☆ お気に入り」ボタンが表示されること（動画再生後に表示される）

- [ ] **Step 6: コミット**

```bash
git add public/index.html
git commit -m "feat: お気に入りセクションとボタンのHTML/CSSを追加"
```

---

### Task 3: サイドバーセクション・ツリーマーカー・配線

**Files:**
- Modify: `public/index.html` — `currentPath` / `lastTree` 変数追加、`renderFavSection` / `rebindTree` 関数追加、`renderTree` / `loadVideos` / `setActiveItem` / `playVideo` を更新

**Interfaces:**
- Consumes:
  - `getFavorites() → string[]`（Task 1）
  - `isFavorite(path) → boolean`（Task 1）
  - `#favSection`, `#favList`, `favSection`, `favList`（Task 2）
  - `playVideo(path)`（既存）
  - `setActiveItem(path)`（既存）
- Produces:
  - `renderFavSection() → void`
  - `rebindTree() → void`
  - `let currentPath: string | null`
  - `let lastTree: object[]`
  - 更新された `renderTree(nodes)` — お気に入りに ★ プレフィックスを付与
  - 更新された `setActiveItem(path)` — favList のアイテムにも `.active` クラスを付与
  - 更新された `loadVideos()` — `lastTree` を保存し `renderFavSection()` を呼ぶ
  - 更新された `playVideo(path)` — `currentPath` を更新

- [ ] **Step 1: `currentPath` と `lastTree` 変数を追加する**

`let videoList = [];` の直後に追加:

```js
let currentPath = null;
let lastTree = [];
```

- [ ] **Step 2: `rebindTree` 関数を追加する**

`function escapeAttr(s)` の直前に追加:

```js
function rebindTree() {
  videoTreeEl.querySelectorAll('.tree-folder').forEach((el) => {
    if (el.nextElementSibling?.tagName === 'UL') {
      el.addEventListener('click', () => el.classList.toggle('collapsed'));
    }
  });
  videoTreeEl.querySelectorAll('.tree-file').forEach((el) => {
    el.addEventListener('click', () => playVideo(el.dataset.path));
  });
}
```

- [ ] **Step 3: `renderFavSection` 関数を追加する**

`function rebindTree()` の直後に追加:

```js
function renderFavSection() {
  const favs = getFavorites().filter((p) => videoList.includes(p));
  favSection.style.display = favs.length === 0 ? 'none' : 'block';
  favList.innerHTML = favs
    .map((p) => {
      const name = p.split('/').pop();
      return `<li class="fav-item" data-path="${escapeAttr(p)}">${escapeHtml(name)}</li>`;
    })
    .join('');
  favList.querySelectorAll('.fav-item').forEach((el) => {
    el.addEventListener('click', () => playVideo(el.dataset.path));
  });
  setActiveItem(currentPath);
}
```

- [ ] **Step 4: `renderTree` を更新してお気に入りに ★ を付ける**

`renderTree` の `else` ブロック（ファイルノードの処理）を以下に変更:

変更前:
```js
} else {
  html += `<li class="tree-file" data-path="${escapeAttr(n.path)}">${escapeHtml(n.name)}</li>`;
}
```

変更後:
```js
} else {
  const star = isFavorite(n.path) ? '<span style="color:var(--accent)">★ </span>' : '';
  html += `<li class="tree-file" data-path="${escapeAttr(n.path)}">${star}${escapeHtml(n.name)}</li>`;
}
```

- [ ] **Step 5: `setActiveItem` を更新して favList にも `.active` を付ける**

変更前:
```js
function setActiveItem(relativePath) {
  videoTreeEl.querySelectorAll('.tree-file').forEach((el) => {
    el.classList.toggle('active', el.dataset.path === relativePath);
  });
}
```

変更後:
```js
function setActiveItem(relativePath) {
  videoTreeEl.querySelectorAll('.tree-file').forEach((el) => {
    el.classList.toggle('active', el.dataset.path === relativePath);
  });
  favList.querySelectorAll('.fav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.path === relativePath);
  });
}
```

- [ ] **Step 6: `playVideo` を更新して `currentPath` を記録する**

`function playVideo(relativePath) {` 直後の最初の行に追加:

```js
currentPath = relativePath;
```

つまり:
```js
function playVideo(relativePath) {
  currentPath = relativePath;           // ← 追加
  const url = '/video?path=' + encodeURIComponent(relativePath);
  // ... 以降は変更なし
```

- [ ] **Step 7: `loadVideos` を更新して `lastTree` 保存と `renderFavSection` 呼び出しを追加する**

`loadVideos` 内の `const tree = data.tree || [];` の直後に追加:

```js
lastTree = tree;
```

ツリーのイベント付与ブロックを `rebindTree()` 呼び出しに変更:

変更前:
```js
videoTreeEl.innerHTML = renderTree(tree);

videoTreeEl.querySelectorAll('.tree-folder').forEach((el) => {
  if (el.nextElementSibling?.tagName === 'UL') {
    el.addEventListener('click', () =>
      el.classList.toggle('collapsed'),
    );
  }
});
videoTreeEl.querySelectorAll('.tree-file').forEach((el) => {
  el.addEventListener('click', () => playVideo(el.dataset.path));
});
```

変更後:
```js
videoTreeEl.innerHTML = renderTree(tree);
rebindTree();
```

`const saved = getSavedState();` の直前に `renderFavSection()` 呼び出しを追加:

```js
renderFavSection();

const saved = getSavedState();
```

- [ ] **Step 8: ブラウザで手動テストする**

1. ブラウザの DevTools コンソールで以下を実行してお気に入りをセット:
   ```js
   toggleFavorite(videoList[0]);  // 最初の動画をお気に入りに登録
   ```
2. ページをリロードする
3. 確認事項:
   - サイドバー上部に「★ お気に入り」セクションが表示される
   - ツリー内の該当ファイルに `★` プレフィックスが付く
   - お気に入りセクションの動画をクリックすると再生される

- [ ] **Step 9: コミット**

```bash
git add public/index.html
git commit -m "feat: お気に入りセクションとツリーマーカーを実装"
```

---

### Task 4: ★ボタンの動作を実装する

**Files:**
- Modify: `public/index.html` — `updateFavBtn` 関数追加、`playVideo` に `updateFavBtn` 呼び出し追加、`favBtn` クリックハンドラ追加

**Interfaces:**
- Consumes:
  - `isFavorite(path) → boolean`（Task 1）
  - `toggleFavorite(path) → void`（Task 1）
  - `renderFavSection() → void`（Task 3）
  - `rebindTree() → void`（Task 3）
  - `lastTree: object[]`（Task 3）
  - `currentPath: string | null`（Task 3）
  - `favBtn`（Task 2）
- Produces:
  - `updateFavBtn(path: string) → void`

- [ ] **Step 1: `updateFavBtn` 関数を追加する**

`function renderFavSection()` の直後に追加:

```js
function updateFavBtn(path) {
  favBtn.textContent = isFavorite(path) ? '★ お気に入り済み' : '☆ お気に入り';
}
```

- [ ] **Step 2: `playVideo` に `updateFavBtn` 呼び出しを追加する**

`playVideo` 内の `showPlayer(true);` の直後に追加:

```js
updateFavBtn(relativePath);
```

つまり:
```js
video.play().catch(() => {});
showPlayer(true);
updateFavBtn(relativePath);  // ← 追加
setActiveItem(relativePath);
```

- [ ] **Step 3: `favBtn` のクリックハンドラを追加する**

`sizeToggle.addEventListener('click', ...)` の直後に追加:

```js
favBtn.addEventListener('click', () => {
  if (!currentPath) return;
  toggleFavorite(currentPath);
  updateFavBtn(currentPath);
  videoTreeEl.innerHTML = renderTree(lastTree);
  rebindTree();
  setActiveItem(currentPath);
  renderFavSection();
});
```

- [ ] **Step 4: ブラウザで手動テストする**

1. サーバーを起動してページをリロード
2. サイドバーから動画を1本選んで再生する
3. 確認:「☆ お気に入り」ボタンがコントロールに表示される
4. ボタンをクリックする
5. 確認:
   - ボタンが「★ お気に入り済み」に変わる
   - サイドバー上部に「★ お気に入り」セクションが表示され、動画名が並ぶ
   - ツリー内の該当ファイルに「★ 」プレフィックスが付く
6. もう一度ボタンをクリックする
7. 確認:
   - ボタンが「☆ お気に入り」に戻る
   - お気に入りセクションが非表示になる（他にお気に入りがなければ）
   - ツリーの ★ が消える
8. ページをリロードして、お気に入りが復元されることを確認する

- [ ] **Step 5: コミット**

```bash
git add public/index.html
git commit -m "feat: お気に入りボタンの動作を実装"
```
