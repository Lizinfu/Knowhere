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

    // ========== 打印华丽的分割线，方便识别一次新的查询 ==========
    console.log(`%c[插件开始请求] %c准备检索地名: %c"${queryText}" %c(朝代: ${queryEra || '未指定'})`,
        "color: white; background: #28a745; padding: 2px 4px; border-radius: 3px;",
        "color: #333; font-weight: bold;",
        "color: #d35400; font-weight: bold;",
        "color: #7f8c8d;"
    );

    chrome.runtime.sendMessage({ type: "SEARCH_LOCATION", text: queryText, era: queryEra }, function(response) {
        
        // --- 新增：详细打印后台返回的核心状态 ---
        if (response && response.success) {
            console.log(`%c[后台响应成功] %c数据来源: %c${response.source.toUpperCase()}`,
                "color: white; background: #007bff; padding: 2px 4px; border-radius: 3px;",
                "color: #333; font-weight: bold;",
                "color: #e67e22; font-weight: bold;"
            );
            console.log("【解析出的具体数据】:", response.data);
            
            showScreen('map-container');
            document.getElementById('display-name').innerText = response.data.name || queryText;
            
            const descEl = document.getElementById('desc-bar');
            if (response.data.desc) {
                descEl.innerText = response.data.desc;
            } else {
                descEl.style.display = 'none';
            }
            // 确保坐标为数字类型
            const latNum = parseFloat(response.data.lat);
            const lonNum = parseFloat(response.data.lon);
            if (isNaN(latNum) || isNaN(lonNum)) {
                console.error('Invalid coordinates from backend:', response.data);
                showScreen('screen-error');
                document.getElementById('error-msg').innerText = '返回的坐标无效';
                return;
            }
            initMap(latNum, lonNum);
            
        } else {
            console.error(`%c[后台响应失败] %c原因: ${response ? response.error : '未知通信断裂'}`,
                "color: white; background: #dc3545; padding: 2px 4px; border-radius: 3px;",
                "color: #c0392b; font-weight: bold;"
            );
            
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