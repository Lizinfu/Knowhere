let popupIframe = null; 
let isPluginEnabled = true; 
let currentEra = ''; // 存储当前填写的朝代/年份

// 初始化悬浮控制面板
function createControlPanel() {
    const panel = document.createElement('div');
    panel.id = 'history-map-panel';
    panel.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        background: #fbf8f1; border: 1px solid #d4c4a8;
        padding: 8px 12px; border-radius: 12px;
        display: flex; gap: 10px; align-items: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 2147483647; font-family: 'PingFang SC', sans-serif;
        transition: opacity 0.3s; opacity: 0.5;
    `;

    panel.onmouseenter = () => panel.style.opacity = '1';
    panel.onmouseleave = () => { if(isPluginEnabled) panel.style.opacity = '0.5'; };

    // 1. 开关按钮
    const toggleBtn = document.createElement('div');
    toggleBtn.style.cssText = `cursor: pointer; font-size: 13px; font-weight: bold; color: #8b5a2b; user-select: none; white-space: nowrap;`;
    
    // 2. 朝代输入框 (使用 HTML5 datalist 实现既能下拉又能手打)
    const eraInputWrapper = document.createElement('div');
    eraInputWrapper.innerHTML = `
        <input type="text" id="history-era-input" list="dynasty-list" placeholder="朝代/年份 (不限)" 
               style="width: 110px; padding: 2px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; outline: none; background: white; color: #333;">
        <datalist id="dynasty-list">
            <option value="春秋战国"></option>
            <option value="秦汉"></option>
            <option value="三国"></option>
            <option value="两晋南北朝"></option>
            <option value="唐"></option>
            <option value="北宋"></option>
            <option value="南宋"></option>
            <option value="元"></option>
            <option value="明"></option>
            <option value="清"></option>
            <option value="民国"></option>
        </datalist>
    `;

    panel.appendChild(toggleBtn);
    panel.appendChild(eraInputWrapper);
    document.body.appendChild(panel);

    const eraInput = document.getElementById('history-era-input');

    // 读取存储的状态
    chrome.storage.local.get(['mapPluginEnabled', 'mapPluginEra'], function(result) {
        if (result.mapPluginEnabled !== undefined) isPluginEnabled = result.mapPluginEnabled;
        if (result.mapPluginEra !== undefined) {
            currentEra = result.mapPluginEra;
            eraInput.value = currentEra;
        }
        updateUI(toggleBtn, eraInput);
    });

    // 开关点击事件
    toggleBtn.onclick = () => {
        isPluginEnabled = !isPluginEnabled;
        chrome.storage.local.set({ mapPluginEnabled: isPluginEnabled });
        updateUI(toggleBtn, eraInput);
    };

    // 输入框内容改变事件 (实时保存)
    eraInput.addEventListener('change', (e) => {
        currentEra = e.target.value.trim();
        chrome.storage.local.set({ mapPluginEra: currentEra });
    });
}

function updateUI(btn, input) {
    if (isPluginEnabled) {
        btn.innerText = '🗺️ 划词：开';
        input.style.display = 'block'; // 开启时显示输入框
    } else {
        btn.innerText = '💤 划词：关';
        input.style.display = 'none';  // 关闭时隐藏输入框
    }
}

createControlPanel();

// ==========================================
// 划词与弹窗逻辑
// ==========================================
document.addEventListener('mouseup', function(event) {
    if (!isPluginEnabled) return;
    let selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 0 && selectedText.length <= 15) {
        // 如果是在输入框里点击和划词，不触发地图
        if (event.target.id === 'history-era-input') return;
        
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        showMapPopup(selectedText, currentEra, mouseX, mouseY);
    }
});

document.addEventListener('mousedown', function(event) {
    const panel = document.getElementById('history-map-panel');
    if (panel && panel.contains(event.target)) return;
    if (popupIframe && event.target !== popupIframe) {
        popupIframe.remove();
        popupIframe = null;
    }
});

// 新增参数 era 传入
function showMapPopup(text, era, x, y) {
    if (popupIframe) popupIframe.remove();
    popupIframe = document.createElement('iframe');
    
    // 将查询词和朝代一起拼到 URL 里传给 iframe
    const mapUrl = chrome.runtime.getURL(`map.html?q=${encodeURIComponent(text)}&era=${encodeURIComponent(era)}`);
    popupIframe.src = mapUrl;

    // 进一步调高弹窗，腾出下方区域显示文字描述
    const popupWidth = 420;
    const popupHeight = 360; 
    let leftPos = x + 15;
    let topPos = y + 15;

    if (leftPos + popupWidth > window.innerWidth) leftPos = window.innerWidth - popupWidth - 20;
    if (topPos + popupHeight > window.innerHeight) topPos = window.innerHeight - popupHeight - 20;

    popupIframe.style.cssText = `
        position: fixed !important; left: ${leftPos}px !important; top: ${topPos}px !important;
        width: ${popupWidth}px !important; height: ${popupHeight}px !important;
        z-index: 2147483647 !important; border: 1px solid #d4c4a8 !important; border-radius: 8px !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2) !important; background: #fbf8f1 !important;
        pointer-events: auto !important; transition: opacity 0.2s !important;
    `;
    document.body.appendChild(popupIframe);
}