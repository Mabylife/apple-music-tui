# Auto-Play 功能實作說明

本文檔說明 Apple Music TUI 中 Auto-Play 功能的實作細節。

最後更新：2025-11-13

## 功能概述

當播放清單/專輯播放完畢時，如果 `auto-play == true` 且 `repeat == 0`，系統會自動根據最近播放的歌曲創建一個 Station，並無縫切換到 Station 模式繼續播放。

## 觸發條件

Auto-play 功能會在以下條件滿足時觸發：

1. ✅ **播放佇列已結束**：`QueueService.getNextIndex()` 返回 `null`
2. ✅ **Auto-play 已開啟**：`playbackStateService.getAutoPlayMode() === true`
3. ✅ **Repeat 為關閉狀態**：`playbackStateService.getRepeatMode() === 0`

**觸發時機**：
- 🎵 **自動播放完畢**：歌曲播放到結尾時自動檢測
- 🎮 **手動按下一首**：用戶按 `Ctrl+→` 但沒有下一首時

**注意**：
- ✅ 支援 `in-list` 模式（播放清單/專輯）
- ✅ 支援 `single` 模式（單曲）
- ❌ 如果 `repeat` 不為 0（單曲循環或全部循環），則不觸發
- ❌ 如果 `auto-play` 關閉，則停止播放並清空佇列

## 實作流程

```
播放佇列結束
  ↓
檢查條件（autoplay=true, repeat=0）
  ↓ (條件滿足)
取得最近播放的 5 首歌曲
  ↓
選擇最後一首歌（最近播放的）
  ↓
調用 Apple Music API 獲取該歌曲的 Station
GET /v1/catalog/{storefront}/songs/{lastSongId}/station
  ↓
收到 Station ID (例如: "ra.1670904153")
  ↓
清空舊的播放佇列
  ↓
切換到 Station 模式
requestTrackChange(stationId, "stations")
  ↓
開始播放 Station（使用現有 Station 播放機制）
```

**注意**: 雖然我們獲取了 5 首最近播放的歌曲，但 Apple Music API 只支援**單首歌曲的 Station**，因此實際使用**第一首**（最近播放的）來創建 Station。這樣能提供基於使用者最新聆聽習慣的推薦。

**重要**: Apple Music Station 不一定會從 seed 歌曲開始播放，而是會根據 seed 推薦相似的歌曲。所以 Station 的第一首歌可能是任何相似的歌曲，包括原播放清單中的其他歌曲。

## 核心 API

### 1. QueueService.getRecentlyPlayedTracks(limit)

**位置**: `src/services/queue.ts`

**功能**: 從播放佇列中取得最近播放的 N 首歌曲

**邏輯**:
- 從 `playedIndices` 陣列中取得最後 N 個 index
- 反向排序（最近播放的在前）
- 過濾無效的 index
- 返回對應的 `MusicItem` 物件

**範例**:
```typescript
const recentTracks = QueueService.getRecentlyPlayedTracks(5);
// Returns: [track5, track4, track3, track2, track1]
// (最近播放的 5 首歌，由新到舊)
```

### 2. CiderAPI.createStationFromSongs(songIds)

**位置**: `src/services/api.ts`

**功能**: 根據歌曲創建 Apple Music Station

**參數**:
- `songIds: string[]` - 歌曲 ID 陣列（傳入最近播放的歌曲）

**返回**:
- `Promise<string | null>` - Station ID（例如 "ra.1670904153"）或 null（失敗時）

**實作說明**:
- Apple Music API **不支援**透過 API 創建多 seed 自定義 Station
- 實際使用**最後一首歌**（最近播放的）來獲取其對應的 Station
- 每首歌都有自動生成的 Station：`/v1/catalog/{storefront}/songs/{id}/station`
- Station ID 格式：`ra.{songId}`

**API 請求**:
```typescript
POST /api/v1/amapi/run-v3
{
  path: "/v1/catalog/tw/songs/1670904153/station"
}
```

**Response 格式**:
```json
{
  "data": {
    "data": [{
      "id": "ra.1670904153",
      "type": "stations",
      "attributes": {
        "name": "歌曲名稱 電台",
        "kind": "songSeeded",
        "playParams": {
          "id": "ra.1670904153",
          "kind": "radioStation"
        }
      }
    }]
  }
}
```

## 主要實作位置

### App.tsx - 播放結束處理與手動下一首

**位置**: `src/App.tsx`

#### 1. Auto-play 輔助函數 (約第 239-296 行)

```typescript
const handleAutoPlay = async () => {
  const autoplay = playbackStateService.getAutoPlayMode();
  const repeat = playbackStateService.getRepeatMode();
  
  if (!autoplay || repeat !== 0) {
    // No autoplay or repeat is on: stop and clear
    await PlayerAPI.stop();
    setNowPlayingId(null);
    QueueService.clearQueue();
    return;
  }
  
  // Auto-play enabled: Create station from recently played tracks
  try {
    setMessage("Creating station from recent tracks...");
    
    // Get last 5 played tracks
    const recentTracks = QueueService.getRecentlyPlayedTracks(5);
    
    if (recentTracks.length > 0) {
      const trackIds = recentTracks.map(track => track.id);
      const stationId = await CiderAPI.createStationFromSongs(trackIds);
      
      if (stationId) {
        QueueService.clearQueue();
        requestTrackChange(stationId, "stations");
      } else {
        // Handle failure
        await PlayerAPI.stop();
        setNowPlayingId(null);
        QueueService.clearQueue();
      }
    }
  } catch (error) {
    // Handle error
    await PlayerAPI.stop();
    setNowPlayingId(null);
    QueueService.clearQueue();
  }
};
```

#### 2. 播放結束時觸發 (約第 440 行)

```typescript
} else {
  // Queue ended - trigger auto-play
  await handleAutoPlay();
}
```

#### 3. 手動按下一首時觸發 (約第 665-672 行)

```typescript
const nextIndex = QueueService.getNextIndex(shuffle, repeat);

if (nextIndex === null) {
  // No next track - trigger auto-play
  handleAutoPlay().catch(error => {
    console.error("Auto-play failed:", error);
  });
  return;
}

// ... continue with normal next track logic
```

## 使用情境

### 情境 1：播放專輯後自動續播

```
使用者操作：
1. 開啟 auto-play (Ctrl+A)
2. 播放一張專輯
3. 聽完整張專輯

系統行為：
- 專輯播放完畢
- 系統取得專輯最後播放的 5 首歌
- 創建基於這 5 首歌的 Station
- 自動開始播放 Station
- 進入 Station 模式（無法控制 S/R/A，只能 next/previous）
```

### 情境 2：播放播放清單後自動續播

```
使用者操作：
1. 開啟 auto-play (Ctrl+A)
2. 播放一個播放清單（20 首歌）
3. 全部聽完

系統行為：
- 播放清單播放完畢
- 系統取得最後播放的 5 首歌
- 創建 Station
- 無縫切換到 Station 繼續播放
```

### 情境 3：Shuffle 模式下的 Auto-play

```
使用者操作：
1. 開啟 shuffle (Ctrl+S)
2. 開啟 auto-play (Ctrl+A)
3. 播放專輯

系統行為：
- 專輯以隨機順序播放
- playedIndices 記錄實際播放順序
- 播放完畢後，取得最後 5 首（依實際播放順序）
- 創建 Station 繼續播放
```

### 情境 4：單曲播放後自動續播

```
使用者操作：
1. 開啟 auto-play (Ctrl+A)
2. 在 Layer 1 直接播放一首歌（single 模式）
3. 聽完這首歌

系統行為：
- 單曲播放完畢
- 系統取得這 1 首歌（playedIndices 只有一個）
- 創建基於這 1 首歌的 Station
- 自動開始播放 Station
```

### 情境 5：手動按下一首觸發 Auto-play

```
使用者操作：
1. 播放專輯（10 首歌）
2. 已經播放到最後一首（第 10 首）
3. 按 Ctrl+→ 嘗試跳到下一首

系統行為：
- 檢測到沒有下一首（nextIndex === null）
- 如果 auto-play 開啟且 repeat === 0
- 立即觸發 auto-play
- 創建 Station 並開始播放
```

```
使用者操作：
1. 開啟 shuffle (Ctrl+S)
2. 開啟 auto-play (Ctrl+A)
3. 播放專輯

系統行為：
- 專輯以隨機順序播放
- playedIndices 記錄實際播放順序
- 播放完畢後，取得最後 5 首（依實際播放順序）
- 創建 Station 繼續播放
```

## 錯誤處理

### 1. 無法創建 Station

**原因**：
- API 請求失敗
- 網路問題
- 授權問題（Music User Token 無效）

**處理**：
- 顯示錯誤訊息 "Failed to create station"
- 停止播放
- 清空佇列

### 2. 沒有最近播放的歌曲

**原因**：
- Queue 為空
- playedIndices 為空（理論上不應發生）

**處理**：
- 顯示訊息 "No recent tracks for auto-play"
- 停止播放
- 清空佇列

### 3. Station 播放失敗

**原因**：
- Station ID 無效
- Cider 播放失敗

**處理**：
- 由 `requestTrackChange()` 中的 Station 邏輯處理
- 顯示錯誤訊息並解鎖

## Station 模式特性

當 Auto-play 觸發後，系統會進入 Station 模式，此模式有以下特性：

1. ✅ **動態播放清單**：Station 內容由 Apple Music 動態生成
2. ✅ **無佇列控制**：無法查看或控制播放清單
3. ✅ **基本控制**：可以 next/previous，但由 Cider 管理
4. ✅ **隱藏播放模式**：S/R/A 圖示在 Player 中隱藏
5. ✅ **高亮顯示**：[Station] item 在 Layer 中以 cyan 高亮

詳細說明請參考 [STATION.md](./STATION.md)

## 與 Station 模式的整合

Auto-play 功能完全複用了現有的 Station 播放機制：

| 階段 | Auto-play | 手動播放 Station |
|------|-----------|------------------|
| 觸發 | 佇列結束時自動 | 使用者選擇 [Station] |
| Station ID 來源 | API 創建 (多 seeds) | 直接從 API 取得 |
| 播放邏輯 | `requestTrackChange(stationId, "stations")` | 同左 |
| 輪詢檢測 | ✅ | ✅ |
| Next/Previous | ✅ | ✅ |
| 鎖定機制 | ✅ | ✅ |

## 使用者體驗

### 視覺反饋

1. **創建 Station 時**：
   - 顯示 "Creating station from recent tracks..."
   
2. **開始播放時**：
   - 顯示 "Auto-playing station from N tracks..."
   - N = 實際使用的歌曲數量（1-5）

3. **失敗時**：
   - 顯示相應的錯誤訊息
   - 訊息會在 2 秒後自動消失

### 切換時機

- Auto-play 的切換是**無縫**的
- 不會有明顯的停頓或中斷
- 使用者可能不會察覺已經從佇列模式切換到 Station 模式

## 注意事項

1. **需要 Music User Token**：
   - `/v1/me/stations` API 需要用戶授權
   - 確保 Cider 已正確登入

2. **Seeds 數量限制**：
   - ~~理論上可以使用更多 seeds~~
   - ~~目前限制為 5 首（平衡推薦品質與多樣性）~~
   - **實際**: Apple Music API 不支援多 seed 自定義 Station
   - 系統使用最後播放的一首歌來獲取 Station（單 seed）

3. **單曲模式也會觸發**：
   - ~~`queue.mode === 'single'` 時不會觸發 auto-play~~
   - **現在支援**：單曲播放完畢也會創建 Station（基於該單曲）

4. **Repeat 優先級更高**：
   - 如果 repeat 開啟（1 或 2），不會觸發 auto-play
   - 使用者明確表示要重複播放時，尊重該選擇

## 相關文件

- [QUEUE.md](./QUEUE.md) - 播放佇列系統說明
- [STATION.md](./STATION.md) - Station 播放機制詳解
- [USAGE.md](./USAGE.md) - 使用說明

## 相關程式碼

- `src/services/api.ts` - `createStationFromSongs()` 方法
- `src/services/queue.ts` - `getRecentlyPlayedTracks()` 方法
- `src/App.tsx` - Auto-play 觸發邏輯（約第 387-450 行）
