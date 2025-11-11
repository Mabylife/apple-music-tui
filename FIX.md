# 修復 Home 畫面抖動問題

本文件會說明嘗試修復 Home 頁面畫面抖動問題時需要注意的地方。

閱讀本文件前，請先閱讀 `/FETCHING.md`

## 名詞解釋

### Home

Home 頁面是指首次啟動 TUI 時，預設進入的 `Layer 1 + Recommanation`

以及 `:Home` 指令執行後會到的地方。

從 `啟動TUI` / `:Home` 一直到 `SearchDone` 之間都稱作 `Home`

### SearchDone

為了本次修復而建立的快捷名詞，指使用 `Tab -> Type -> Enter` 後所進入的頁面，會回到 `Layer 1` 並且顯示搜尋結果

但凡是 `Tab -> Type -> Enter` 到下一次 `:Home` 之間，都稱作 `SearchDone`

### 畫面閃爍

畫面會先渲染在一個錯誤的位置 （垂直往上一點），然後再快速回正

## 問題報告

### 現狀

只要是在`Home`，進行以下動作會導致畫面閃爍：

1. Up/Down/Left/Right/Backspace/Del
2. Tab
3. 在 `SearchBar` 裡面打字

每做一個動作畫面就會閃爍一次

奇怪的是，只要進入 `SearchDone` （搜尋結果一顯示）一切就會穩定下來

### 已經發現的事實

1. 確認僅與 `Browser` 有關係，`CommandBar`, `Player` 可以先被排除，除非到了最後一步或是有合理且重大猜測。

2. 與 React memo 無關

3. **[AI Assistant - 2025-11-11 17:55 UTC - 失敗嘗試]** 嘗試用 `useMemo` 包裹 `Browser.tsx` 中的寬度計算邏輯，但這個修改對 Home 和 SearchDone 都生效，不符合「Home 會，SearchDone 不會」的關鍵差異，因此不可能是問題根源。**教訓：修改前必須先確認該邏輯是否為 Home 專屬。**

4. **[User - 2025-11-11 18:00 UTC - 關鍵發現]** 當在代碼中加入 `console.log` 時，SearchDone 也會開始閃爍，閃爍感覺跟 Home 一模一樣。這證明問題與 **console 輸出** 有關！

5. **[AI Assistant - 2025-11-11 18:05 UTC - 機制確認]** Ink 框架默認啟用 `patchConsole: true`，會攔截所有 console 輸出並觸發重新渲染。**假設：Home 時有某些代碼在持續輸出 console（可能是錯誤、警告或 debug 信息），導致持續重新渲染造成閃爍；而 SearchDone 時沒有這些輸出。需要找出 Home 專屬的 console 輸出來源。**

6. **[User - 2025-11-11 18:05 UTC - 問題根源找到！]** 禁用 patchConsole 後依然閃爍，但現在能看到 console 訊息了：**"Encounter two children with the same key"** - 這是 React 警告，只在 Home 出現！問題是 **Home 時有重複的 key 值，導致 React 持續警告並重新渲染。**

7. **[AI Assistant - 2025-11-11 18:08 UTC - 問題修復]** 根本原因：`getRecommendations()` 的雙層循環（遍歷多個 recommendation，每個又遍歷其 contents）會產生重複的 item.id。當 `Layer.tsx` 渲染時使用 `key={item.id}`，重複的 key 導致 React 警告，而 Ink 的 `patchConsole` 攔截這些警告並觸發重新渲染，造成閃爍。**解決方案：使用 `Set` 在 `getRecommendations()` 中過濾重複的 ID。**

8. **[User - 2025-11-11 18:07 UTC - 修復成功！]** 應用 ID 去重邏輯後，Home 畫面閃爍問題完全解決！

### 修復須知

1. 尋找問題是，應該要抓住 `Home會，SearchDone不會`這個關鍵去思考，去尋找他們之間的差異在哪

2. 不要去碰任何跟 Layout 有關的東西，例如`flex`, `width/height`，以確定這件事可以再不碰到 Layout 的情況解決。而且就如先前所述，`SearchDone` 和 `Home` 都使用一樣的 Layout 而這證明了 Layout 不可能是問題

3. 每當有重大發現，請更新`### 以發現的事實`區，並標記你的身分跟時間。

---

~~閱讀完本文件後，請按照你的需求探索本專案的結構與代碼~~

問題已解決
