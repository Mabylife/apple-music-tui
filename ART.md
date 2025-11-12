# Alnum Art 實作須知

1. 請勿更動整理 Layout
2. 把 Player - Art 當作一個容器，把圖片內容放在 Art 中，模擬：

```html
<Player>
    <Art>
        <Image><Image>
    <Art>
</Player>

object-fit: cover;
overflow: hidden;
```

Image 應該要佔滿整個 Art

3. 圖片顯示請使用[ink-picture](https://github.com/endernoke/ink-picture?tab=readme-ov-file)中的 Half Block 顯示模式

## 名詞

wideMode -> 指終端機是寬的時候
這時候頁面右邊 35%會給 Player, Art 會佔據 Player 寬度的 100%並保持比例 1/1，位於 Player 上面

columnMode -> 終端機是窄的時候
這時候頁面上面會給 Player, Player 使用 100% 寬度 並保持 20/9 的比例，Art 會佔據 Player 100%的高度並保持 1/1，位於 Player 左邊
