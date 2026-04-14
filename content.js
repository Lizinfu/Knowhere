let popupIframe = null; 

document.addEventListener('mouseup', function(event) {
    let selectedText = window.getSelection().toString().trim();

    // 过滤掉太长的句子，一般地名不会超过 15 个字
    if (selectedText.length > 0 && selectedText.length <= 15) {
        const mouseX = event.clientX;
        const mouseY = event.clientY;

        // 瞬间弹出 UI，把 selectedText 传给 map.html
        showMapPopup(selectedText, mouseX, mouseY);
    }
});

// 点击网页空白处时关闭悬浮窗
document.addEventListener('mousedown', function(event) {
    if (popupIframe && event.target !== popupIframe) {
        popupIframe.remove();
        popupIframe = null;
    }
});

function showMapPopup(text, x, y) {
    if (popupIframe) popupIframe.remove();

    popupIframe = document.createElement('iframe');
    
    // 注意这里：不再传 lat/lon，而是直接传查询词 q
    const mapUrl = chrome.runtime.getURL(`map.html?q=${encodeURIComponent(text)}`);
    popupIframe.src = mapUrl;

    // 稍微放大一点悬浮窗，让视觉更大气
    const popupWidth = 320;
    const popupHeight = 220;
    let leftPos = x + 15;
    let topPos = y + 15;

    if (leftPos + popupWidth > window.innerWidth) leftPos = window.innerWidth - popupWidth - 10;
    if (topPos + popupHeight > window.innerHeight) topPos = window.innerHeight - popupHeight - 10;

    popupIframe.style.cssText = `
        position: fixed !important;
        left: ${leftPos}px !important;
        top: ${topPos}px !important;
        width: ${popupWidth}px !important;
        height: ${popupHeight}px !important;
        z-index: 2147483647 !important;
        border: 1px solid #d4c4a8 !important; /* 复古边框色 */
        border-radius: 8px !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2) !important;
        background: #fbf8f1 !important; /* 羊皮纸底色 */
        pointer-events: auto !important;
        transition: opacity 0.2s ease-in-out !important;
    `;

    document.body.appendChild(popupIframe);
}