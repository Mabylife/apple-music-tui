# Fetch data through Cider RPC & Apple Music API

This data will explain how the data fetching in this TUI app works.

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
