# Smart Sort

本文件會介紹 Smart Sort 的設計理念與實作細節。

## 功能概述

Smart Sort 會被用來排序跟整理 Lists Layer 裡面的項目，包含 `Recommandations`、`Recently Played`、`PlayLists`、`Search Results` 等。

主要邏輯包含：

- 確保項目類型平衡，不會導致同類型項目過多
- 根據使用者的點擊可能性排序，透過時間或其他指標

Smart Sort 應該要一定程度的提供自定義。
