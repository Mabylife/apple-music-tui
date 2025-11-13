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
