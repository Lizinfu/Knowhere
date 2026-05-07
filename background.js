// 1. 本地字典 (可留作备用，不过在使用大模型+朝代约束后，字典的作用会被削弱)
const historyDict = {
    "长安": { lat: 34.2658, lon: 108.9541, name: "唐长安城（今西安）", desc: "中国古代十三朝古都，唐代世界第一大城市。" }
};

// 2. API 配置 (保持你申请的 Key 不变)
// const API_KEY = "API"; 
// const API_URL = "https://api.siliconflow.cn/v1/chat/completions";
const PROXY_URL = "https://knowhere.liezileiyin.workers.dev/"; // 代理地址
const MODEL_NAME = "LizinfuDAVinci-002"; // 模型名称，保持不变

// 3. 核心请求函数 (新增 era 参数)
async function queryLLMForLocation(placeName, era) {
    // if (!API_KEY) throw new Error("未配置 API Key");

    // const cleanApiKey = API_KEY.trim();

    const eraContext = era ? `用户当前阅读的历史背景是：【${era}】。` : `用户未提供具体历史背景，请根据地名自行推断最著名的历史时期。`;

    // 提示词升级：加入朝代限制，并要求输出 desc
    const systemPrompt = `
        你是一个精通世界历史地理的专家。
        ${eraContext}
        请严格结合该历史背景，分析地名“${placeName}”对应的现代地理位置。
        例如：背景为“北宋”，地名“东京”应指向“开封”而不是日本；背景为“三国”，地名“建业”应指向南京。
        
        【严格要求】
        必须且只能返回一个合法的 JSON 对象，不要包含任何 markdown 标记（不要用 \`\`\`json），不要废话。
        格式如下：
        {
            "lat": 地理纬度数字,
            "lon": 地理经度数字,
            "name": "该时期地名全称（今现代地名）",
            "desc": "一两句话的历史地理简介（结合历史背景，简明扼要说明该地在当时的地位或变迁）"
        }
        如果完全不知道，请返回 {"error": "not found"}
    `;

    const response = await fetch(PROXY_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: placeName }
            ],
            temperature: 0.1
        })
    });

    if (!response.ok) {
        const errorText = await response.text(); // 获取更详细的错误信息
        console.error("【后台】API 响应错误:", errorText);
        throw new Error(`API 请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    // 打印原始返回以便排查不同代理/模型的返回格式
    console.log('【后台】原始模型返回:', data);

    // 从常见字段中提取文本内容，兼容多种代理/模型返回格式
    let content = '';
    try {
        if (data && data.choices && data.choices.length > 0) {
            // OpenAI/类似格式
            if (data.choices[0].message && data.choices[0].message.content) content = data.choices[0].message.content;
            else if (data.choices[0].text) content = data.choices[0].text;
        } else if (data && typeof data.output === 'string') {
            content = data.output;
        } else if (data && typeof data.result === 'string') {
            content = data.result;
        } else if (typeof data === 'string') {
            content = data;
        } else if (data && (data.lat || data.longitude || data.lon)) {
            // 直接返回坐标对象的情况
            return {
                lat: parseFloat(data.lat || data.latitude || data.latitude),
                lon: parseFloat(data.lon || data.lonitude || data.longitude || data.lng),
                name: data.name || data.display_name || '' ,
                desc: data.desc || data.description || ''
            };
        } else {
            // 兜底：把整个对象序列化后尝试解析其中的 JSON
            content = JSON.stringify(data);
        }

        if (!content) content = '';

        // 强力清洗：去除可能包含的 markdown json 标记
        content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

        // 首先尝试直接解析整个内容
        try {
            const parsed = JSON.parse(content);
            // 确保 lat/lon 为数字
            if (parsed && (parsed.lat || parsed.latitude || parsed.latitude) && (parsed.lon || parsed.longitude || parsed.lng)) {
                return {
                    lat: parseFloat(parsed.lat || parsed.latitude || parsed.latitude),
                    lon: parseFloat(parsed.lon || parsed.longitude || parsed.lng),
                    name: parsed.name || parsed.display_name || '',
                    desc: parsed.desc || parsed.description || ''
                };
            }
            // 如果解析后不是期望的格式，继续后续处理
        } catch (e) {
            // 解析失败，继续尝试正则抽取
        }

        // 正则匹配 { ... } 部分并尝试修复常见格式问题
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
            let fixedContent = match[0].replace(/(\d+)\.\s+(\d+)/g, '$1.$2');
            try {
                const parsed2 = JSON.parse(fixedContent);
                if (parsed2 && (parsed2.lat || parsed2.latitude || parsed2.latitude) && (parsed2.lon || parsed2.longitude || parsed2.lng)) {
                    return {
                        lat: parseFloat(parsed2.lat || parsed2.latitude || parsed2.latitude),
                        lon: parseFloat(parsed2.lon || parsed2.longitude || parsed2.lng),
                        name: parsed2.name || parsed2.display_name || '',
                        desc: parsed2.desc || parsed2.description || ''
                    };
                }
            } catch (e2) {
                console.warn('【后台】正则提取到 JSON，但解析失败，内容：', fixedContent);
            }
        }

        // 最后尝试在序列化的对象中查找坐标键
        try {
            const lowered = content.toLowerCase();
            const latMatch = lowered.match(/"lat"\s*[:=]\s*([\d\.\-]+)/) || lowered.match(/"latitude"\s*[:=]\s*([\d\.\-]+)/);
            const lonMatch = lowered.match(/"lon"\s*[:=]\s*([\d\.\-]+)/) || lowered.match(/"longitude"\s*[:=]\s*([\d\.\-]+)/) || lowered.match(/"lng"\s*[:=]\s*([\d\.\-]+)/);
            if (latMatch && lonMatch) {
                return { lat: parseFloat(latMatch[1]), lon: parseFloat(lonMatch[1]), name: '', desc: '' };
            }
        } catch (e) {
            // ignore
        }

        // 如果最终仍然无法解析出坐标，抛出以触发兜底
        console.error('【后台】AI 返回无法解析为坐标的内容:', content);
        throw new Error('AI 返回数据无法被解析为坐标');

    } catch (finalErr) {
        console.error('【后台】处理模型返回时出错:', finalErr);
        throw finalErr;
    }
}

// 4. 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SEARCH_LOCATION") {
        const { text, era } = request;

        // 定义一个调用 OSM 的兜底函数
        const fallbackToOSM = () => {
            console.log("【后台】启动兜底 OSM 检索...");
            const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=1`;
            fetch(osmUrl)
                .then(res => res.json())
                .then(data => {
                    if (data && data.length > 0) {
                        sendResponse({ 
                            success: true, source: 'osm', 
                            data: { lat: data[0].lat, lon: data[0].lon, name: data[0].display_name, desc: "AI服务器繁忙，已自动切换为现代地理地图。" } 
                        });
                    } else {
                        sendResponse({ success: false, error: "未找到该地名。" });
                    }
                })
                .catch(e => sendResponse({ success: false, error: "网络异常。" }));
        };

        // 尝试调用你的 AI 核心函数
        queryLLMForLocation(text, era)
            .then(aiResult => {
                // 验证 AI 返回的数据是否有效（使用 != null 以接受字符串数字）
                if (aiResult && aiResult.lat != null && aiResult.lon != null) {
                    sendResponse({ success: true, source: 'ai', data: aiResult });
                } else if (aiResult && aiResult.error === "not found") {
                    sendResponse({ success: false, error: "AI表示找不到该历史地名。" });
                } else {
                    console.warn("【后台】AI 返回格式缺失 lat/lon，转入兜底:", aiResult);
                    fallbackToOSM();
                }
            })
            .catch(err => {
                console.error("【后台】AI 请求彻底失败:", err);
                // 捕获请求异常，触发兜底
                fallbackToOSM();
            });

        return true; // 保持异步响应通道打开
    }
});