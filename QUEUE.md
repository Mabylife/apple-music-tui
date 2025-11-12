# 最簡播放佇列實作

本文件會說明本專案的播放佇列系統實作方式。

## 佇列概述

AM-TUI 預計不提供佇列檢視頁面，我們把播放佇列分成兩種狀態 `in List` `single`。

會有三種數值用於決定播放佇列行為的狀態 `shuffle` `repeat` `auto-play`，這三種狀態會影響播放佇列的行為，並且應該要用簡單的 Nerdfont 圖示來顯示在 `Player` - `info` 裡面。

### `in List`

使用者選擇播放一首歌時，若使用者的上一層選擇的是一個清單（`[playlist]`, `[album]`, `[top tracks]`），則該清單內的所有歌曲會被加入播放佇列，並從使用者選擇的歌曲開始播放。

### `single`

若使用者直接在 Layer 1 播放一首歌，則該歌曲會被加入播放佇列。

## 佇列行為

請先閱讀 Cider RPC 文件以了解 `shuffle` `repeat` `auto-play` 這三個狀態的意義。

若 shuffle 為關閉狀態，則播放佇列會依照歌曲在清單中的順序播放。
若 shuffle 為開啟狀態， 則在當前歌曲播放完畢後，會隨機播放佇列中其餘的其中一首歌曲。
若 repeat 為開啟狀態，則在播放完最後一首歌曲後，會把該播放清單重新加入佇列。
若 repeat 為關閉狀態，則在播放完最後一首歌曲後，會停止播放並清空播放佇列。
若 repeat 為單曲循環狀態，則會無限重複播放目前的歌曲。
若 auto-play 為開啟狀態並且 repeat 為關閉狀態，則在播放完最後一首歌曲後，會自動播放下一首歌曲。

## UIUX (done)

Cider RPC 提供為 `shuffle` `repeat` `auto-play` 三種狀態都設計了一個 GET 跟一個循環的 SET 方法，請參考 Cider RPC 文件。

`Ctrl + ->` 跳到下一首歌曲，使用 `Ctrl + <-` 跳到上一首歌曲。
`Ctrl + R` 切換 repeat 狀態。
`Ctrl + S` 切換 shuffle 狀態。
`Ctrl + A` 切換 auto-play 狀態。

## 虛擬佇列系統實作架構

### 核心概念

AM-TUI 採用虛擬佇列系統：
- **TUI 完全掌控佇列邏輯**：維護完整的播放清單、當前播放位置、以及播放順序
- **Cider 僅作為播放器**：每次只接收單首歌曲的 URL 進行播放
- **Cider 的內部佇列永遠只有 1 首歌**：TUI 負責決定「下一首是什麼」，然後依序傳送給 Cider

這個設計讓 TUI 能完全控制播放邏輯，同時避免與 Cider 內建佇列系統產生衝突。

### QueueService 設計

建立 `src/services/queue.ts` 管理虛擬佇列狀態：

```typescript
interface QueueState {
  mode: 'in-list' | 'single';
  tracks: Track[];              // 完整歌曲清單
  currentIndex: number;          // 當前播放位置
  playedIndices: number[];       // 已播放的 index（用於 shuffle）
  sourceContext: {               // 來源上下文
    type: 'playlist' | 'album' | 'top-tracks' | 'single';
    id?: string;
    name?: string;
  } | null;
}
```

主要方法：
- `setQueue(tracks, startIndex, context)` - 設定新佇列（從 playlist/album 播放）
- `setSingleTrack(track)` - 單曲模式
- `getNextIndex(shuffle, repeat)` - 根據模式計算下一首的 index
- `getPreviousIndex()` - 計算上一首的 index
- `updateCurrentIndex(index)` - 更新當前位置
- `getCurrentTrack()` - 取得當前歌曲
- `clearQueue()` - 清空佇列

### 播放觸發邏輯

**在 Layer 2/3（Playlist/Album/TopTracks）中：**
```typescript
const handlePlayTrack = async (trackIndex: number) => {
  // 1. 獲取完整清單
  const tracks = await fetchAllTracks();
  
  // 2. 設定虛擬佇列
  QueueService.setQueue(tracks, trackIndex, {
    type: 'playlist',
    id: playlistId,
    name: playlistName,
  });
  
  // 3. 播放選中的歌曲
  const track = tracks[trackIndex];
  await CiderAPI.playItem(track.id, 'songs');
};
```

**在 Layer 1（直接播放單曲）中：**
```typescript
const handlePlaySingleTrack = async (track: Track) => {
  QueueService.setSingleTrack(track);
  await CiderAPI.playItem(track.id, 'songs');
};
```

### 播放結束處理

監聽 Cider 的播放狀態，當歌曲結束時自動播放下一首：

```typescript
SocketService.onPlayback(async (data) => {
  if (data.status === 'ended' || data.playbackProgress >= 0.99) {
    await handleTrackEnded();
  }
});

const handleTrackEnded = async () => {
  const [shuffle, repeat, autoplay] = await Promise.all([
    PlayerAPI.getShuffleMode(),
    PlayerAPI.getRepeatMode(),
    PlayerAPI.getAutoPlayMode(),
  ]);

  const nextIndex = QueueService.getNextIndex(shuffle, repeat);

  if (nextIndex !== null) {
    // 有下一首：更新 index 並播放
    QueueService.updateCurrentIndex(nextIndex);
    const nextTrack = QueueService.getCurrentTrack();
    if (nextTrack) {
      await CiderAPI.playItem(nextTrack.id, 'songs');
    }
  } else {
    // 播放完畢：根據 autoplay 決定行為
    const queue = QueueService.getQueue();
    if (autoplay && repeat === 0 && queue.mode === 'in-list') {
      // TODO: Autoplay 功能（播放推薦歌曲）
    } else {
      await PlayerAPI.stop();
      QueueService.clearQueue();
    }
  }
};
```

### Next/Previous 邏輯

重新實作 `Ctrl + ←/→` 使用虛擬佇列：

```typescript
// 下一首
if (key.ctrl && key.rightArrow) {
  const [shuffle, repeat] = await Promise.all([
    PlayerAPI.getShuffleMode(),
    PlayerAPI.getRepeatMode(),
  ]);
  
  const nextIndex = QueueService.getNextIndex(shuffle, repeat);
  if (nextIndex !== null) {
    QueueService.updateCurrentIndex(nextIndex);
    const track = QueueService.getCurrentTrack();
    if (track) await CiderAPI.playItem(track.id, 'songs');
  }
  return;
}

// 上一首
if (key.ctrl && key.leftArrow) {
  const prevIndex = QueueService.getPreviousIndex();
  if (prevIndex !== null) {
    QueueService.updateCurrentIndex(prevIndex);
    const track = QueueService.getCurrentTrack();
    if (track) await CiderAPI.playItem(track.id, 'songs');
  }
  return;
}
```

### getNextIndex 實作邏輯

```typescript
static getNextIndex(shuffle: number, repeat: number): number | null {
  const { tracks, currentIndex, playedIndices } = this.queue;
  
  // Repeat one: 重複當前歌曲
  if (repeat === 1) {
    return currentIndex;
  }
  
  // Shuffle: 隨機選擇未播放的歌曲
  if (shuffle === 1) {
    const unplayedIndices = tracks
      .map((_, i) => i)
      .filter(i => !playedIndices.includes(i));
    
    if (unplayedIndices.length > 0) {
      // 還有未播放的歌曲
      return unplayedIndices[Math.floor(Math.random() * unplayedIndices.length)];
    } else if (repeat === 2) {
      // 全部播完且 repeat all：重新開始
      this.queue.playedIndices = [];
      return Math.floor(Math.random() * tracks.length);
    }
    return null; // 播放完畢
  }
  
  // 順序播放
  const nextIndex = currentIndex + 1;
  if (nextIndex < tracks.length) {
    return nextIndex;
  } else if (repeat === 2) {
    return 0; // Repeat all：從頭開始
  }
  return null; // 播放完畢
}
```

### 實作步驟

1. **建立 QueueService** - `src/services/queue.ts`
2. **修改播放觸發點** - 所有 Layer 中按 Enter 播放的邏輯
3. **實作播放結束監聽** - `handleTrackEnded()` 
4. **改寫 Next/Previous** - `Ctrl + ←/→` 使用虛擬佇列
5. **測試各種組合** - shuffle/repeat 的所有排列組合

### 檔案結構

```
src/
├── services/
│   ├── api.ts            (已存在，已有 playItem 方法)
│   ├── player.ts         (已存在)
│   ├── socket.ts         (已存在)
│   └── queue.ts          (新增 - 虛擬佇列管理)
│
├── components/
│   └── Layer*/           (需修改播放邏輯)
│
└── App.tsx               (需修改 Enter 和 Ctrl+←/→ 邏輯)
```

## Cider RPC 相關端點

```md
GET /repeat-mode

Gets the current repeat mode as a number. 0 is off, 1 is "repeat this song", and 2 is "repeat".
200: OK

POST /toggle-repeat

Toggles repeat between "repeat this song", "repeat", and "off".

Note that this method doesn't take the mode to set, just changes to the next mode in the cycle repeat this song -> repeat -> off.
200: OK

GET /shuffle-mode

Gets the current shuffle mode as a number. 0 is off and 1 is on.
200: OK

POST /toggle-shuffle

Toggles shuffle between "off" and "on".
200: OK

GET /autoplay

Gets the current autoplay status as a boolean. true is on and false is off.
200: OK

POST /toggle-autoplay

Toggles autoplay between "off" and "on".
200: OK
```
