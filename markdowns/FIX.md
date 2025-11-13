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

## [7] Error handling track switching when rapidly switching tracks and R1/R/S/A modes (QUEUE management)

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

[a] fixed

- Buffer 實作存在問題，需求是 "在 0.5 秒內的唯一一次儲存"，才會去執行播放跟 UI 更新，但目前儘管是直接按住切換按鍵，連續頻繁的操作，仍然會導致多次的播放請求跟 UI 更新，而不是在最後一次操作後的 0.5 秒才執行
