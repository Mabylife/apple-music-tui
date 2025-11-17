# Smart Sort

本文件會介紹 Smart Sort 的設計理念與實作細節。

## 功能概述

Smart Sort 會被用來排序跟整理 Lists Layer 裡面的項目，包含 `Recommandations` `Search Results` 等。
確保項目類型平衡，不會導致同類型項目過多

## 實作細節

- Recommendations（推薦） - 使用 API 預設排序 + 類型平衡 + 保證數量

```js
// Note: Recommendations API doesn't return individual songs, only collections
const typeQuotas: { [key: string]: number } = {
  stations: 0.2, // 20%
  playlists: 0.3, // 30%
  albums: 0.5, // 50%
};
```
