let popupIframe = null; 

document.addEventListener('mouseup', async function(event) {
    let selectedText = window.getSelection().toString().trim();

    if (selectedText.length > 0) {
        // 记录鼠标松开时的屏幕坐标
        const mouseX = event.clientX;
        const mouseY = event.clientY;

        const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(selectedText)}&format=json&limit=1`;

        try {
            console.log(`【插件】正在查询 "${selectedText}" 的坐标...`);
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const data = await response.json();

            if (data && data.length > 0) {
                const lat = data[0].lat;
                const lon = data[0].lon;
                console.log(`【插件】找到坐标：Lat: ${lat}, Lon: ${lon}，准备弹出地图！`);
                
                showMapPopup(lat, lon, mouseX, mouseY);
            } else {
                console.warn(`【插件】未找到 "${selectedText}" 的坐标。`);
            }
        } catch (error) {
            console.error("【插件】请求异常：", error.message);
        }
    }
});

// 点击网页空白处时关闭悬浮窗
document.addEventListener('mousedown', function(event) {
    if (popupIframe && event.target !== popupIframe) {
        popupIframe.remove();
        popupIframe = null;
    }
});

// 弹出悬浮窗的逻辑
function showMapPopup(lat, lon, x, y) {
    if (popupIframe) popupIframe.remove();

    popupIframe = document.createElement('iframe');
    const mapUrl = chrome.runtime.getURL(`map.html?lat=${lat}&lon=${lon}`);
    popupIframe.src = mapUrl;

    // 防止弹窗超出屏幕可视范围
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