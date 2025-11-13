# Things fiexed and to fix

[x] - done

## [1] Colors

This is a TUI app, shouldn't use #hex colors, use basic colors so it can work in all terminals and match everyone's theme.

## [x] Item name accidently wrap instead of truncate

In some cases in the Lists - Layer, item names will wrap to the next line instead of being truncated with ellipsis. This also causes the item below it to be covered and fully unvisible.

## [x] Show artist name after the track

In the First and the Second layer, the Artist name should be shown after the track name (like "Track Name - Artist Name").

## [x] Selected item should be remained when opening a new layer

When opening a new layer (for example, pressing Enter on an album to open its tracks), the selected item should be displayed in the same position as it was in the previous layer (gray). And other items in the previous layer and not be selected should be hidden.

## [x] list item loading indicator

When selecting a list item, should open a layer immediately and display a loading placeholder while loading the content.

don't hard code this thing, since we will be outputing different things in the future, like `launching...`, `deleting...`, etc.

```this will be the place holder for loading list's items
loading...
```

Should not open a layer when user select an [track] item, because tracks are loaded instantly.

## [x] Global: Log message manage

This is a TUI app, so shouldn't be using log methods like `console.log`, this cause display flickering even if everything is working fine.

`console.error` is acceptable for error handling, but not really recommended since the message won't be displayed properly, it will be covered by the Ink TUI rendering.

There is an `setMessage` method in `App.tsx`, we should use that to display nessesary messages to users through CommandBar.

For layer, there is a `loadingMessage` prop we can use to display loading messages.

## [x] Error handling track switching when rapidly switching tracks and R1/R/S/A modes (QUEUE management)

When rapidly switching tracks and R1/R/S/A modes, issues may occur like:

1. Won't be able to switch to the selected `[track]`.
2. The `Player` showing the wrong track art / info.

throguh testing, the issue has various cases, like:

1. Showing the wrong track art / info only but actually playing the correct track.

The Art image issue while switching tracks may be related to the fetching method or timing, need further investigation into the image streaming and rendering process.

目前為止，播放邏輯跟刷新邏輯跟 UI 邏輯已經很清晰:

1. 使用者切換歌曲 / 播放歌曲
2. 手動儲存 playing track id
3. 確定這是前後 0.5 秒內的唯一一次儲存
   - 向 Cider 請求播放這首歌
   - Fetch 這首歌的資訊（包含圖片）
   - 更新 UI

目前仍然有一些問題，下游可以透過新增 3. 的 buffer 時間來解決
而更上游的根本問題，應該是要去確定儲存的 track id 是不是正確的，並且這個 track id 應該永遠都要與 Layer 裡面 Cyan 的 [track] 一致

我們把 Track id 放在本地就是為了要確保這個一致性，讓使用者的操作可以被正確且瞬間的反映在 UI 上

[7-a] fixed

Buffer 實作存在問題，需求是 "在 0.5 秒內的唯一一次儲存"，才會去執行播放跟 UI 更新，但目前儘管是直接按住切換按鍵，連續頻繁的操作，仍然會導致多次的播放請求跟 UI 更新，而不是在最後一次操作後的 0.5 秒才執行

[7-b] fixed by giving a version to every fetched image, also with some buffer time and the trashing fetches that are too old

目前對於專輯封面的顯示似乎不夠積極，我認為我們需要更積極的去管理跟清理所有的進行中 Fetch 動作，而不是去依賴回傳或讀取的完成順序。

[8] Station

我們之前實在是沒辦法開啟一個 Station，所以暫時把他 Filter 隱藏起來了。

apple music api 的 回傳片段

```json
    "data": [
        {
            "id": "ra.1498157166",
            "type": "stations",
```

Cider RPC 的播放 API 說明

```md
POST /play-item

Triggers playback of an item.

Accepts a type of item to play and an id for the item. type should be one of the accepted types in the Apple Music API, such as songs. Note that the ID is required to be a string, not a number.
Request Body (`application/json`)

200: OK
```

### 修復步驟：

1. 先把 Filter 移除
2. 確認 Layer 已經有設置給 [Station] 的 NerdFont 跟樣式
3. 嘗試傳送正確的 type 跟 id 到 Cider RPC 的播放 API

### 發現：

1. 已經可以成功播放，但是由於 TUI 的 Fetch 結構，播放電台後並不會顯示 Player - info。

2. 開始播放電台之後，Cider 能夠拿到下一首歌的資訊

### 修復完成：

經研究 Apple Music API 文檔，確認 station 的曲目是動態生成的，API 無法直接查詢 station 當前播放的曲目。

**解決方案：**

- TUI 接管邏輯，監聽 Cider socket 的 now-playing 事件
- 當偵測到 socket 回傳的 trackId 與當前 nowPlayingId 不同時（**僅限 station 模式**）
- 自動同步更新 nowPlayingId 為實際播放的 track ID
- 這樣 Player 組件就能正確顯示 station 播放的曲目資訊

**Station 特殊處理：**

1. **播放控制**：播放 station 時不設定 nowPlayingId，等待 socket 同步
2. **上下首切換**：Station 模式下，Ctrl+左/右箭頭直接調用 Cider 的 previous/next API，而非使用虛擬佇列
3. **自動播放下一首**：Station 模式下跳過 TUI 的自動播放邏輯，由 Cider 自動處理電台播放清單
4. **狀態隔離**：使用 `isPlayingStation` 標記確保特殊邏輯只影響 station，不影響普通曲目

**實作位置：**

- `App.tsx` 的 socket playback 監聽器中加入同步邏輯
- `App.tsx` 的鍵盤控制中加入 station 特殊分支處理

[8-a] fixed

**問題描述：**
邏輯已經完全隔離，能夠透過 Cider API 正常播放跟切換電台歌曲，但 UI 存在以下問題：

1. **Player - info 不顯示**：播放電台時，Player 組件不顯示當前播放的歌曲資訊（歌名、藝人、專輯封面等）
2. **Layer highlighted item 不顯示**：Layer 中不會顯示當前正在播放的曲目（cyan 高亮）

詳細解決方法請見 markdowns/STATION.md
