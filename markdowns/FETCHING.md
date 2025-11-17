# Fetch data through Cider RPC & Apple Music API

This data will explain how the data fetching in this TUI app works.

> 📝 **Note**: See `api-test.html` in the project root for tested API actions

## Get Lists data

### 術語說明

We use user navigation as the signal to send GET. <br />

- `[something]` stands for a option in Lists - Layer

- `[item]` can be `[track]`, `[Album]`, `[Artist]` or just its name like `[Top Tracks]`

- `第一層` 是最底層，`第四層` 是最高層

---

### `[item]`顯示格式

- `[track]` -> `󰝚  example track` nerd: f075a
- `[album]` -> `󰀥  example album` nerd: f0025
- `[artist]` -> `󱍞 example artist` nerd: f135e

---

### 第一層**預設**列出`使用者推薦內容`

這一個頁面（第一層 + `使用者推薦內容` 稱作 `home`）

```
Get a Recommendation
Fetch a recommendation by using its identifier.
https://developer.apple.com/documentation/applemusicapi/get-a-recommendation

把前十個[item]列入第一層
```

---

### 按下`方向鍵右`

根據當前選中`[item]`去判斷動作

#### [track]

```
直接插播該Track
```

#### [album]

```
載入該 Album 所有 [Tracks] 進到下一層
```

#### [singer]

```
- 如果該Artist有熱門歌曲 -> 新增 [Top Tracks] 到下一層 -> 載入並新增所有[Track]到下一層
- 新增 [Albums] 到下一層 -> 載入並新增該歌手的所有[Album]到下一層（由新到舊）
- 新增 [Tracks] 到下一層 -> 載入並新增該歌手的所有[Track]到下一層（由新到舊）
```

### 在 n-1 層按下`方向鍵右`到 n 層後

- 在 n-1 層的選中的位置顯示 n-1 層 被選中 `[item]`的名稱，超出容器部分使顯示如下`examp..` `(example)`
- 如果有 n-2, n-3 也同理
- n-1 (n-2, n-3)的其他未被顯示的元素應該要隱藏

---

### `SearchBar`

`SearchBar`使用`Tab`進入，使用`ESC`退出.

#### 按下 `Enter` 來搜尋

UI 層面，每當開始搜尋，應該要讓使用者回到第一層，並在第一層顯示全部搜尋結果`[item]`

```js
//範例：應該要實現Apple Music搜尋(根據使用者地區, 上限10)

async function search() {
  const query = document.getElementById("searchQuery").value;
  const storefront = document.getElementById("storefront").value || "tw";
  if (!query) return;

  const body = {
    path: `/v1/catalog/${storefront}/search?term=${encodeURIComponent(
      query
    )}&types=songs,albums,artists&limit=10`,
  };

  await quickAction("POST", "/api/v1/amapi/run-v3", body);
}
```

## Get Player / Post Playback Command

### Reference

[Cider RPC](/cider-rpc-document.md)
[AM APIs](https://developer.apple.com/documentation/applemusicapi)

### Player Live Playing

Use Socket.IO Channels to update the info on Player

#### 需要顯示的元素

```
Socket.IO Channels
    API:Playback - Live Now Playing Feed (readonly)
```

- Track Name
- Artist Name
- Album Name
- Time (SSS/SSS)

### 需要實現的 Playback 功能

- `Space` -> Play/Pause

- `:stop` -> Stop the player

- `Ctrl` + `ArrowLeft` / `ArrowRight` -> Next Track / Prev Track

- `Ctrl + S ` -> Toggle Shuffle Mode

  - 在 `CommandBar` 顯示 [Shuffle Mode `off / on`]

- `Ctrl + R ` -> Toggle Repeat Mode

  - 在 `CommandBar` 顯示 [Repeat Mode `This track / Repeat / Off`]

- `Ctrl` + `+ / -` / `Ctrl` + `ArrowUp` / `Arrow Down` -> Volumn Up / Down

  - 在 `CommandBar` 顯示 [Volumn `69`]

- `:vol 69` -> Volumn set to `69`
