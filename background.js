// 1. 简易本地字典（做最高优先级的缓存或拦截）
const historyDict = {
    "长安": { lat: 34.2658, lon: 108.9541, name: "唐长安城（今西安）" }
};

// ==========================================
// 2. AI 模型 API 配置 (请在这里填入你的配置)
// ==========================================
// 这里以硅基流动(SiliconFlow)的免费通义千问模型为例
const API_KEY = "sk-urxnxupewxzopbjovmdkuglafegpyfixdhbtixgxdldkgizn"; // 👉 填入你的 API Key (例如 "sk-xxxxxxx")
const API_URL = "https://api.siliconflow.cn/v1/chat/completions";
const MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct"; // 使用免费的 7B 模型

// 3. 封装请求 AI 的函数
async function queryLLMForLocation(placeName) {
    // 如果没有配置 API Key，直接报错退出
    if (!API_KEY) throw new Error("未配置 API Key");

    // 核心：系统提示词 (Prompt Engineering)
    // 强制要求 AI 扮演地理专家，并且【只】返回严格的 JSON 格式，不要任何废话。
    const systemPrompt = `
        你是一个精通中国和世界历史地理的专家。
        用户会给你一个地名（可能是古代或现代的）。
        请分析该地名对应的现代大致地理位置，并返回其中心点的经纬度。
        
        【严格要求】
        必须且只能返回一个合法的 JSON 对象，不要包含任何 markdown 标记（不要用 \`\`\`json 包裹），不要任何解释废话。
        格式如下：
        {"lat": 纬度数字, "lon": 经度数字, "name": "现代地名或说明"}
        
        如果完全不知道，请返回 {"error": "not found"}
    `;

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: placeName }
            ],
            temperature: 0.1 // 温度调低，保证结果严谨和稳定
        })
    });

    if (!response.ok) throw new Error(`AI 接口请求失败: ${response.status}`);
    
    const data = await response.json();
    let content = data.choices[0].message.content.trim();

    // 尝试解析 AI 返回的 JSON 字符串
    try {
        return JSON.parse(content);
    } catch (e) {
        console.error("【后台】AI 返回格式错误，非 JSON:", content);
        throw new Error("AI 返回数据格式解析失败");
    }
}

// 4. 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SEARCH_LOCATION") {
        const placeName = request.text;
        
        // 步骤一：查本地字典
        if (historyDict[placeName]) {
            console.log(`【后台】命中本地字典: ${placeName}`);
            sendResponse({ success: true, source: 'dictionary', data: historyDict[placeName] });
            return true; 
        }

        // 步骤二：查大模型
        console.log(`【后台】正在向 AI 查询历史地名: ${placeName} ...`);
        queryLLMForLocation(placeName)
            .then(aiResult => {
                if (aiResult.lat && aiResult.lon) {
                    console.log("【后台】AI 解析成功:", aiResult);
                    sendResponse({ success: true, source: 'ai', data: aiResult });
                } else {
                    throw new Error("AI 未能找到坐标");
                }
            })
            .catch(err => {
                console.warn(`【后台】AI 查询失败，降级使用 OSM: ${err.message}`);
                
                // 步骤三：Fallback (AI 失败或没填 Key 时，使用原有的 OSM 接口兜底)
                const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`;
                fetch(osmUrl)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.length > 0) {
                            sendResponse({ 
                                success: true, 
                                source: 'osm', 
                                data: { lat: data[0].lat, lon: data[0].lon, name: data[0].display_name } 
                            });
                        } else {
                            sendResponse({ success: false, error: "所有途径均未找到位置" });
                        }
                    })
                    .catch(e => sendResponse({ success: false, error: e.message }));
            });

        return true; // 保持异步消息通道
    }
});