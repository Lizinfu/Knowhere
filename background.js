// 1. 本地字典 (可留作备用，不过在使用大模型+朝代约束后，字典的作用会被削弱)
const historyDict = {
    "长安": { lat: 34.2658, lon: 108.9541, name: "唐长安城（今西安）", desc: "中国古代十三朝古都，唐代世界第一大城市。" }
};

// 2. API 配置 (保持你申请的 Key 不变)
// const API_KEY = "API"; 
// const API_URL = "https://api.siliconflow.cn/v1/chat/completions";
const PROXY_URL = "https://knowhere.liezileiyin.workers.dev/"; // 代理地址
// const MODEL_NAME = "Qwen/Qwen3-8B"; 

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
    let content = data.choices[0].message.content.trim();

    // 强力清洗：去除可能包含的 markdown json 标记
    content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
        // 先尝试标准解析
        return JSON.parse(content);
    } catch (e) {
        console.warn("【后台】标准解析失败，尝试正则表达式修复...");
        try {
            // 正则匹配 { ... } 部分
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                // 修复诸如 "111. 666" 这种非法数字格式（移除点号后的空格）
                let fixedContent = match[0].replace(/(\d+)\.\s+(\d+)/g, '$1.$2');
                return JSON.parse(fixedContent);
            }
        } catch (e2) {
            console.error("【后台】彻底解析失败:", content);
            throw new Error("AI 返回数据无法被解析");
        }
    }
}

// 4. 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SEARCH_LOCATION") {
        const { text, era } = request;
        
        console.log(`【后台】查询: ${text}, 朝代背景: ${era || '未指定'}`);

        queryLLMForLocation(text, era)
            .then(aiResult => {
                if (aiResult.lat && aiResult.lon) {
                    sendResponse({ success: true, source: 'ai', data: aiResult });
                } else {
                    throw new Error(aiResult.error || "未找到坐标");
                }
            })
            .catch(err => {
                sendResponse({ success: false, error: err.message });
            });

        return true; 
    }
});