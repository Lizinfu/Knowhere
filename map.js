// 修复 Leaflet 在 Chrome 插件环境下的默认图标路径报错问题
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: chrome.runtime.getURL('leaflet/images/marker-icon-2x.png'),
    iconUrl: chrome.runtime.getURL('leaflet/images/marker-icon.png'),
    shadowUrl: chrome.runtime.getURL('leaflet/images/marker-shadow.png'),
});

// 从 URL 提取 content.js 传过来的经纬度
const urlParams = new URLSearchParams(window.location.search);
const lat = parseFloat(urlParams.get('lat'));
const lon = parseFloat(urlParams.get('lon'));

if (!isNaN(lat) && !isNaN(lon)) {
    const map = L.map('map').setView([lat, lon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // 在目标经纬度打上一个默认的蓝色图标
    L.marker([lat, lon]).addTo(map);
}