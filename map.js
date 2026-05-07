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
        const map = L.map('map').setView([lat, lon], 7); // 缩放级别7适合看省际大势

        // ESRI 的物理地形图，色调非常复古，适合历史阅读
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri',
            maxZoom: 8 // 地形图通常不支持太大的缩放级别
        }).addTo(map);

        // 2. 加载目标地点的复古朱批标记
        const ancientIcon = L.divIcon({
            className: 'custom-ancient-icon',
            html: `<div style="
                width: 14px; height: 14px; 
                background-color: #c0392b; 
                border: 2px solid #fbf8f1; 
                border-radius: 50%; 
                box-shadow: 0 0 5px rgba(0,0,0,0.5);
            "></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });
        L.marker([lat, lon], { icon: ancientIcon }).addTo(map);

        // ================= 新增：加载行政区划边界与文字 =================
        // 使用阿里云 DataV 提供的全国省份 GeoJSON
        fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
            .then(res => res.json())
            .then(data => {
                // 绘制省份边界（水墨线风格）
                L.geoJSON(data, {
                    style: {
                        color: "#e6d8b8", // 接近宣纸的淡黄色/墨线色
                        weight: 1.5,      // 线条粗细
                        opacity: 0.6,     // 半透明，不喧宾夺主
                        fillOpacity: 0,   // 内部不填充颜色，露出地形
                        dashArray: '5, 5' // 虚线效果，更像标注
                    }
                }).addTo(map);

                // 为每个省份添加古风文字标注
                data.features.forEach(feature => {
                    const props = feature.properties;
                    // 只要有中心点坐标和名字，就打上文字标签
                    if (props.centroid && props.centroid.length === 2 && props.name) {
                        const labelIcon = L.divIcon({
                            className: 'ancient-province-label',
                            // 去掉“省”、“市”等现代行政后缀，更有历史感
                            html: `<div>${props.name.replace(/(省|市|自治区|回族|壮族|维吾尔|特别行政区)/g, '')}</div>`,
                            iconSize: [40, 20],
                            iconAnchor: [20, 10]
                        });
                        L.marker([props.centroid[1], props.centroid[0]], { 
                            icon: labelIcon,
                            interactive: false // 文字不需要点击交互
                        }).addTo(map);
                    }
                });
            })
            .catch(err => console.log("加载行政区划失败", err));
            // ==============================================================
            
    }, 50);
}