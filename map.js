delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: chrome.runtime.getURL('leaflet/images/marker-icon-2x.png'),
    iconUrl: chrome.runtime.getURL('leaflet/images/marker-icon.png'),
    shadowUrl: chrome.runtime.getURL('leaflet/images/marker-shadow.png'),
});

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

const urlParams = new URLSearchParams(window.location.search);
const queryText = urlParams.get('q');
const queryEra = urlParams.get('era') || ''; // 提取朝代

if (queryText) {
    const eraDisplay = queryEra ? `[${queryEra}] ` : '';
    document.getElementById('display-query').innerText = `检索: ${eraDisplay}"${queryText}"`;

    // 将 text 和 era 一同发给后台
    chrome.runtime.sendMessage({ type: "SEARCH_LOCATION", text: queryText, era: queryEra }, function(response) {
        if (response && response.success) {
            showScreen('map-container');
            
            document.getElementById('display-name').innerText = response.data.name || queryText;
            
            // 渲染底部介绍文本
            const descEl = document.getElementById('desc-bar');
            if (response.data.desc) {
                descEl.innerText = response.data.desc;
            } else {
                descEl.style.display = 'none'; // 如果AI没返回，就隐藏该区域
            }
            
            initMap(response.data.lat, response.data.lon);
        } else {
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

function initMap(lat, lon) {
    setTimeout(() => {
        const map = L.map('map').setView([lat, lon], 11);
        L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
            subdomains: ["1", "2", "3", "4"],
            attribution: '&copy; 高德地图'
        }).addTo(map);
        L.marker([lat, lon]).addTo(map);
    }, 50);
}