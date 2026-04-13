let popupIframe = null; 

document.addEventListener('mouseup', function(event) {
    let selectedText = window.getSelection().toString().trim();

    if (selectedText.length > 0) {
        const mouseX = event.clientX;
        const mouseY = event.clientY;

        console.log(`【插件】划词: ${selectedText}，发送给后台处理...`);

        // 向 background.js 发送消息
        chrome.runtime.sendMessage(
            { type: "SEARCH_LOCATION", text: selectedText }, 
            function(response) {
                if (response && response.success) {
                    console.log(`【插件】获取成功 (来源: ${response.source}):`, response.data);
                    showMapPopup(response.data.lat, response.data.lon, mouseX, mouseY);
                } else {
                    console.warn(`【插件】查询失败:`, response ? response.error : '未知错误');
                }
            }
        );
    }
});

document.addEventListener('mousedown', function(event) {
    if (popupIframe && event.target !== popupIframe) {
        popupIframe.remove();
        popupIframe = null;
    }
});

function showMapPopup(lat, lon, x, y) {
    if (popupIframe) popupIframe.remove();

    popupIframe = document.createElement('iframe');
    const mapUrl = chrome.runtime.getURL(`map.html?lat=${lat}&lon=${lon}`);
    popupIframe.src = mapUrl;

    const popupWidth = 300;
    const popupHeight = 200;
    let leftPos = x + 10;
    let topPos = y + 10;

    if (leftPos + popupWidth > window.innerWidth) leftPos = window.innerWidth - popupWidth - 10;
    if (topPos + popupHeight > window.innerHeight) topPos = window.innerHeight - popupHeight - 10;

    popupIframe.style.cssText = `
        position: fixed !important;
        left: ${leftPos}px !important;
        top: ${topPos}px !important;
        width: ${popupWidth}px !important;
        height: ${popupHeight}px !important;
        z-index: 2147483647 !important;
        border: 1px solid #ccc !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        background: white !important;
        pointer-events: auto !important;
    `;

    document.body.appendChild(popupIframe);
}