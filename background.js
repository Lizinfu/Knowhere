// 1. 简易本地字典（最高优先级，用于修复那些百科写法奇葩的特例）
const historyDict = {
    "长安": { lat: 34.2658, lon: 108.9541, name: "唐长安城（今西安）" },
    "大都": { lat: 39.9042, lon: 116.4074, name: "元大都（今北京）" }
};

// 2. 核心功能：从百度百科提取现代地名
async function getModernNameFromBaike(historicalName) {
    try {
        // 请求百度百科的词条页面
        const baikeUrl = `https://baike.baidu.com/item/${encodeURIComponent(historicalName)}`;
        console.log(`【后台爬虫】正在访问百度百科: ${baikeUrl}`);
        
        const response = await fetch(baikeUrl, {
            // 伪装成普通浏览器，防止被简单拦截
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        
        if (!response.ok) return null;

        const html = await response.text();

        // 使用正则提取网页头部的 <meta name="description" content="...">
        const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
        if (!descMatch) return null;
        
        const description = descMatch[1];
        console.log(`【后台爬虫】抓取到百科摘要: ${description}`);

        // 使用正则表达式寻找“今xxx”的句式
        // 匹配逻辑：找“今”，然后向后抓取 2到8个 中文字符，直到遇到标点符号或空格为止
        const modernMatch = description.match(/今([^，。；、！\s（]{2,8}(?:市|县|省|区|镇|村)?)/);
        
        if (modernMatch && modernMatch[1]) {
            let modernName = modernMatch[1];
            // 清理一些可能附带的多余词汇，如“今陕西省西安市” -> 提取核心即可
            console.log(`【后台爬虫】成功提取到现代地名: ${modernName}`);
            return modernName;
        }

        return null;
    } catch (error) {
        console.error("【后台爬虫】抓取百科失败:", error);
        return null;
    }
}

// 3. 将地名转换为经纬度 (请求 OSM 接口)
async function getCoordsFromOSM(placeName) {
    const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`;
    const response = await fetch(osmUrl);
    const data = await response.json();
    
    if (data && data.length > 0) {
        return { lat: data[0].lat, lon: data[0].lon, name: data[0].display_name };
    }
    return null;
}

// 4. 监听来自 content.js 的划词请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SEARCH_LOCATION") {
        const placeName = request.text;
        
        // 使用 async 立即执行函数来处理复杂的异步工作流
        (async () => {
            try {
                // 步骤一：查本地字典 (瞬间响应)
                if (historyDict[placeName]) {
                    console.log(`【后台】命中本地字典: ${placeName}`);
                    sendResponse({ success: true, source: 'dictionary', data: historyDict[placeName] });
                    return;
                }

                // 步骤二：尝试从百度百科推断现代地名
                let targetSearchName = placeName; // 默认用原词去搜
                let sourceNote = 'osm-direct';

                const modernName = await getModernNameFromBaike(placeName);
                if (modernName) {
                    targetSearchName = modernName; // 把搜索词替换成现代地名，比如把"涿郡"替换成"河北省涿州市"
                    sourceNote = `baike -> ${modernName}`;
                }

                // 步骤三：拿着最终确定的名字去请求 OSM 坐标
                console.log(`【后台】准备向地图引擎搜索: ${targetSearchName}`);
                const coords = await getCoordsFromOSM(targetSearchName);

                if (coords) {
                    sendResponse({ 
                        success: true, 
                        source: sourceNote, 
                        data: { lat: coords.lat, lon: coords.lon, name: coords.name } 
                    });
                } else {
                    // 如果用现代名没搜到，且之前替换过名字，作为最后的倔强，用原名再试一次
                    if (modernName) {
                        console.log(`【后台】现代名没搜到，退回使用原名搜索...`);
                        const fallbackCoords = await getCoordsFromOSM(placeName);
                        if (fallbackCoords) {
                            sendResponse({ success: true, source: 'osm-fallback', data: fallbackCoords });
                            return;
                        }
                    }
                    sendResponse({ success: false, error: "无法在地图上定位该位置" });
                }

            } catch (err) {
                console.error("【后台】主流程发生错误:", err);
                sendResponse({ success: false, error: err.message });
            }
        })();

        // 必须返回 true，告诉 Chrome 我们会异步调用 sendResponse
        return true; 
    }
});