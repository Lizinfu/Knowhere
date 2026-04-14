// 修复 Leaflet 图标路径
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: chrome.runtime.getURL('leaflet/images/marker-icon-2x.png'),
    iconUrl: chrome.runtime.getURL('leaflet/images/marker-icon.png'),
    shadowUrl: chrome.runtime.getURL('leaflet/images/marker-shadow.png'),
});

// 辅助函数：切换显示的 UI 屏幕
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// 1. 获取 content.js 传过来的检索词
const urlParams = new URLSearchParams(window.location.search);
const queryText = urlParams.get('q');

if (queryText) {
    // 界面显示正在搜索的词
    document.getElementById('display-query').innerText = `检索: "${queryText}"`;

    // 2. 悬浮窗自己向 background.js 请求数据
    chrome.runtime.sendMessage({ type: "SEARCH_LOCATION", text: queryText }, function(response) {
        
        if (response && response.success) {
            // 3A. 成功查到数据：切换到地图屏幕
            showScreen('map-container');
            
            // 在顶部栏显示 AI 返回的具体解析名字（例如："元大都（今北京）"）
            document.getElementById('display-name').innerText = response.data.name || queryText;
            
            // 渲染地图
            initMap(response.data.lat, response.data.lon);
        } else {
            // 3B. 查询失败：切换到错误屏幕
            showScreen('screen-error');
            if (response && response.error) {
                document.getElementById('error-msg').innerText = `未能定位: ${response.error}`;
            }
        }
    });
} else {
    showScreen('screen-error');
    document.getElementById('error-msg').innerText = "未接收到有效的地名";
}

// 渲染 Leaflet 地图的函数
function initMap(lat, lon) {
    // 为了防止 iframe UI 闪烁，使用 setTimeout 微调地图渲染时机
    setTimeout(() => {
        const map = L.map('map').setView([lat, lon], 12); // 缩放级别调为 12，视野稍微大一点

        // 这里使用的是高德地图的瓦片，更有中文环境的熟悉感，加载速度也比 OSM 快
        L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
            subdomains: ["1", "2", "3", "4"],
            attribution: '&copy; 高德地图'
        }).addTo(map);

        L.marker([lat, lon]).addTo(map);
    }, 50);
}