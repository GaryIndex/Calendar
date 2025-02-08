const fs = require('fs');
const path = require('path');
const ics = require('ics');

// 📌 读取 JSON 目录
const jsonDir = path.join(__dirname, 'data'); // 假设 JSON 存在于 ./data 目录
const jsonFiles = ['holidays.json', 'jieqi.json', 'astro.json', 'calendar.json', 'shichen.json'];

// 📌 解析 JSON 并转换为 ICS 事件
function parseJsonToIcs() {
    let events = [];

    for (const file of jsonFiles) {
        const filePath = path.join(jsonDir, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ 文件不存在: ${filePath}`);
            continue;
        }

        try {
            const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            // 获取 `Reconstruction` 层数据
            const reconstructionData = jsonData.Reconstruction;
            if (!reconstructionData || typeof reconstructionData !== 'object') {
                console.warn(`⚠️ 无效数据结构: ${file}`);
                continue;
            }

            for (const date in reconstructionData) {
                const rawData = reconstructionData[date];
                if (typeof rawData !== 'object') continue;

                // 📌 **展开对象，转换为一层**
                const flatData = flattenObject(rawData);

                // 📌 **提取日期**
                const eventDates = extractDates(flatData);
                if (eventDates.length === 0) {
                    console.warn(`⚠️ 无有效日期: ${file} -> ${JSON.stringify(rawData)}`);
                    continue;
                }

                // 📌 **提取事件名称**
                const eventTitle = flatData["name"] || flatData["title"] || flatData["festival"] || flatData["holiday"] || "(无标题)";

                // 📌 **拼接 DESCRIPTION**
                const description = Object.entries(flatData)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(" ");

                // 📌 **转换日期格式**
                const [year, month, day] = eventDates[0].split('-').map(Number);
                
                events.push({
                    start: [year, month, day],
                    title: eventTitle,
                    description: description,
                    allDay: true
                });

                console.log(`✅ 事件添加: ${eventTitle} (${eventDates[0]})`);
            }

        } catch (err) {
            console.error(`❌ 解析错误: ${file}`, err);
        }
    }

    // 📌 **生成 ICS**
    if (events.length === 0) {
        console.warn("⚠️ 没有可导出的 ICS 事件");
        return;
    }

    ics.createEvents(events, (error, value) => {
        if (error) {
            console.error("❌ ICS 生成失败:", error);
            return;
        }
        const outputPath = path.join(__dirname, 'output.ics');
        fs.writeFileSync(outputPath, value);
        console.log(`🎉 ICS 文件已生成: ${outputPath}`);
    });
}

// 📌 **展开嵌套对象为一层**
function flattenObject(obj, parentKey = '', result = {}) {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const newKey = parentKey ? `${parentKey}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                flattenObject(obj[key], newKey, result);
            } else {
                result[newKey] = obj[key];
            }
        }
    }
    return result;
}

// 📌 **提取所有可能的日期字段**
function extractDates(flatData) {
    return Object.values(flatData).filter(value => {
        return typeof value === 'string' && /\d{4}-\d{1,2}-\d{1,2}/.test(value);
    });
}

// 📌 **运行代码**
parseJsonToIcs();