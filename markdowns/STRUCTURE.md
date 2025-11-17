# Apple Music TUI - Before development Structure

## What is this?

Apple Music TUI is a terminal user interface for Apple Music. Users can use keyboard to navigate, manage and play their Apple Music.

## Possible Development Structure

### Backend

| Repository                                                  | Description                     |
| ----------------------------------------------------------- | ------------------------------- |
| https://cider.sh/                                           | Closed Source Apple Music Client |
| [Cider RPC Documentation](./cider-rpc-document.md) | Endpoint for Apple Music API    |
| https://developer.apple.com/documentation/applemusicapi/    | Apple Music API                 |

### Frontend

| Repository                          | Description    |
| ----------------------------------- | -------------- |
| https://github.com/vadimdemedes/ink | React for CLIs |

### Features List

- [x] 基本播放功能
- [x] 播放清單瀏覽
- [x] 搜尋功能
- [x] 播放佇列管理
- [x] 播放器資訊顯示
- [x] 播放狀態管理 (shuffle, repeat, auto-play)
- [x] 專輯封面顯示
- [x] Station 支援
- [x] 樣式自訂與熱更新
- [x] Auto-play
- [x] 主頁顯示內容自訂

  - 顯示推薦內容 - 讓各類型各佔一定比例，不要出現全部都是`[album]`, `[playlist]`. `[station]`的情況
  - 顯示播放清單 - 顯示使用者的播放清單，並且應該要最佳化排序，讓使用者最有可能點擊到的播放清單出現在前面
  - 顯示最近播放 - 顯示使用者最近播放的歌曲或專輯，也要注意比例跟排序
  - 探索（待定） - 要找到與推薦內容頁面有什麼本質上的差異，或是說探索頁面應該要有什麼樣的內容
