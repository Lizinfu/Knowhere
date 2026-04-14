let popupIframe = null; 
let isPluginEnabled = true; // 插件全局开关状态

// ==========================================
// 1. 初始化并在网页右下角创建一个控制开关
// ==========================================
function createToggleButton() {
    const btn = document.createElement('div');
    btn.id = 'history-map-toggle-btn';
    
    // 初始化按钮样式 (固定在右下角，半透明，鼠标移入清晰)
    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #fbf8f1;
        border: 1px solid #d4c4a8;
        color: #8b5a2b;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: bold;
        cursor: pointer;
        z-index: 2147483647;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
        opacity: 0.6;
        user-select: none;
        font-family: 'PingFang SC', sans-serif;
    `;

    // 鼠标交互效果
    btn.onmouseenter = () => btn.style.opacity = '1';
    btn.onmouseleave = () => { if(isPluginEnabled) btn.style.opacity = '0.6'; };

    // 读取本地存储中的开关状态
    chrome.storage.local.get(['mapPluginEnabled'], function(result) {
        if (result.mapPluginEnabled !== undefined) {
            isPluginEnabled = result.mapPluginEnabled;
        }
        updateButtonUI(btn);
    });

    // 点击切换状态
    btn.onclick = () => {
        isPluginEnabled = !isPluginEnabled;
        chrome.storage.local.set({ mapPluginEnabled: isPluginEnabled }); // 记住用户选择
        updateButtonUI(btn);
    };

    document.body.appendChild(btn);
}

// 辅助函数：更新按钮文字和颜色
function updateButtonUI(btn) {
    if (isPluginEnabled) {
        btn.innerText = '🗺️ 划词地图：开启';
        btn.style.background = '#fbf8f1';
        btn.style.opacity = '0.6';
    } else {
        btn.innerText = '💤 划词地图：关闭';
        btn.style.background = '#e0e0e0';
        btn.style.opacity = '0.4';
    }
}

// 执行创建按钮
createToggleButton();


// ==========================================
// 2. 划词逻辑（受开关控制）
// ==========================================
document.addEventListener('mouseup', function(event) {
    // 【核心拦截】：如果开关关了，直接什么都不做
    if (!isPluginEnabled) return;

    let selectedText = window.getSelection().toString().trim();

    if (selectedText.length > 0 && selectedText.length <= 15) {
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        showMapPopup(selectedText, mouseX, mouseY);
    }
});

document.addEventListener('mousedown', function(event) {
    // 点击开关按钮时不关闭弹窗，点击其他地方才关闭
    if (event.target.id === 'history-map-toggle-btn') return;

    if (popupIframe && event.target !== popupIframe) {
        popupIframe.remove();
        popupIframe = null;
    }
});


// ==========================================
// 3. 弹窗展示逻辑（尺寸已放大）
// ==========================================
function showMapPopup(text, x, y) {
    if (popupIframe) popupIframe.remove();

    popupIframe = document.createElement('iframe');
    const mapUrl = chrome.runtime.getURL(`map.html?q=${encodeURIComponent(text)}`);
    popupIframe.src = mapUrl;

    // 【修改点】：放大了悬浮窗的尺寸
    const popupWidth = 420;  // 从 320 放大到 420
    const popupHeight = 300; // 从 220 放大到 300
    
    let leftPos = x + 15;
    let topPos = y + 15;

    // 边界检测：防止大弹窗超出屏幕
    if (leftPos + popupWidth > window.innerWidth) leftPos = window.innerWidth - popupWidth - 20;
    if (topPos + popupHeight > window.innerHeight) topPos = window.innerHeight - popupHeight - 20;

    popupIframe.style.cssText = `
        position: fixed !important;
        left: ${leftPos}px !important;
        top: ${topPos}px !important;
        width: ${popupWidth}px !important;
        height: ${popupHeight}px !important;
        z-index: 2147483647 !important;
        border: 1px solid #d4c4a8 !important;
        border-radius: 8px !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2) !important;
        background: #fbf8f1 !important;
        pointer-events: auto !important;
        transition: opacity 0.2s ease-in-out !important;
    `;

    document.body.appendChild(popupIframe);
}