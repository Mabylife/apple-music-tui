# Style config for apple-music-tui

本文件會說明 apple-music-tui 的樣式設定，包括顏色、字體、間距等方面的配置，確保在不同終端環境下有一致且美觀的顯示效果。

## 熱更新檔案

以下檔案在啟動時會被監控，當檔案內容有變更時，會自動重新載入樣式設定，無需重啟應用程式：

- linux: `~/.config/apple-music-tui/style.css`

## 可更動的樣式

[info]背景色無法設定，會使用終端的背景色

### colors

- `foreground-color`：前景色

  - `selected-item-text`
  - `focusing SearchBar/CommandBar border/text`
  - `Player - info - track name`
  - `Player - info - time`

- `muted-foreground-color`：次要前景色 -

  - `unselected-item-text`
  - `unfocusing SearchBar/CommandBar border/text`
  - `Player - info - artist name`
  - `Player - info - album name`
  - `border-color`：邊框色

- `highlight-color`：高亮色

  - `playing-item-text`
  - `Player - info - R1/RP/S/A mode icon`

- `error-color`：錯誤訊息色
  - `unplayable-item-text`

#### format

- Hex: `#RRGGBB` (6 digits)
- Named colors: `Black`, `Red`, `Green`, `Yellow`, `Blue`, `Magenta`, `Cyan`, `White`

### borders

- `border-style`：邊框樣式
  - 全局同步

#### format

- single
- double
- round
- bold
- singleDouble
- doubleSingle
- classic
