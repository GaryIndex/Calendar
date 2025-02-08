const fs = require('fs');
const path = require('path');

// 日志文件路径
const logFilePath = path.join(__dirname, './data/error.log');

// 确保目录存在
const ensureDirectoryExistence = async (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
};

// 创建日志目录
ensureDirectoryExistence(logFilePath);

/**
 * 记录日志 (成功 + 错误)
 * @param {string} type "INFO" | "ERROR"
 * @param {string} message
 */
const writeLog = async (type, message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}\n`;

  try {
    await fs.promises.appendFile(logFilePath, logMessage, 'utf8');
    
    // **动态导入 chalk**
    const chalk = (await import('chalk')).default;
    console.log(type === "INFO" ? chalk.green(logMessage.trim()) : chalk.red(logMessage.trim()));
  } catch (err) {
    console.log(`❌ 写入日志失败: ${err.message}`);
  }
};

const logInfo = (message) => writeLog("INFO", message);
const logError = (message) => writeLog("ERROR", message);

// JSON 文件路径
const dataPaths = {
  holidays: './data/Document/holidays.json',
  jieqi: './data/Document/jieqi.json',
  astro: './data/Document/astro.json',
  calendar: './data/Document/calendar.json',
  shichen: './data/Document/shichen.json',
};

// ICS 文件路径
const icsFilePath = path.join(__dirname, './calendar.ics');

/**
 * 读取 JSON 并解析数据（支持异步）
 * @param {string} filePath
 * @returns {Promise<Object>}
 */
const readJsonData = async (filePath) => {
  try {
    logInfo(`📂 读取文件: ${filePath}`);
    const rawData = await fs.promises.readFile(filePath, 'utf-8');

    if (!rawData.trim()) {
      logError(`⚠️ 文件 ${filePath} 为空！`);
      return {};
    }

    const data = JSON.parse(rawData);
    logInfo(`✅ 成功解析 JSON: ${filePath}, 数据量: ${Object.keys(data).length}`);

    return data; // 返回原始数据
  } catch (error) {
    logError(`❌ 读取 JSON 失败: ${filePath} - ${error.message}`);
    return {};
  }
};

/**
 * 动态获取所有字段并提取有效数据
 * @param {Array} reconstructionData
 * @param {Object} existingData
 */
const extractValidData = (reconstructionData, existingData) => {
  logInfo(`🔍 处理 Reconstruction 数据，共 ${reconstructionData.length} 条`);

  reconstructionData.forEach(record => {
    // 获取日期（直接使用 "2025-02-08" 作为键）
    const date = record.date || record["data.date"] || null;
    if (!date) {
      logError(`⚠️ 无效记录（无日期）: ${JSON.stringify(record)}`);
      return;
    }

    // 提取必要的字段
    let description = '';
    let name = record["data.name"] || '(无标题)';
    let isOffDay = record["data.isOffDay"] !== undefined ? record["data.isOffDay"] : null;
    
    // 提取所有字段并构建描述
    Object.entries(record).forEach(([key, value]) => {
      if (key !== "date" && key !== "data.date" && key !== "data.name" && key !== "data.isOffDay") {
        description += `${key}: ${value} | `;
      }
    });

    const workStatus = isOffDay !== null ? `[${isOffDay ? '休' : '班'}] ` : '';

    logInfo(`📅 解析事件: ${date} - ${name} - ${description}`);

    // 组织数据结构
    if (!existingData[date]) {
      existingData[date] = {
        name,
        isOffDay,
        description: workStatus + description
      };
    } else {
      existingData[date].description += ` | ${workStatus}${description}`;
    }
  });
};

/**
 * 生成 ICS 事件
 * @param {string} date
 * @param {Object} eventData
 * @returns {string}
 */
const generateICSEvent = (date, eventData) => {
  logInfo(`📝 生成 ICS 事件: 日期=${date}, 名称=${eventData.name}`);

  return `
BEGIN:VEVENT
DTSTART;VALUE=DATE:${date.replace(/-/g, '')}
SUMMARY:${eventData.name || '(无标题)'}
DESCRIPTION:${eventData.description || ''}
END:VEVENT
`.trim();
};

/**
 * 生成 ICS 日历
 */
const generateICS = async () => {
  let allEvents = {};

  // 并行读取所有 JSON 文件
  await Promise.all(Object.entries(dataPaths).map(async ([fileKey, filePath]) => {
    const jsonData = await readJsonData(filePath);
    if (Object.keys(jsonData).length === 0) {
      logError(`⚠️ ${fileKey}.json 读取失败或数据为空，跳过！`);
      return;
    }

    // 处理每个文件的 reconstruction 数据
    for (const [date, records] of Object.entries(jsonData)) {
      if (!records.Reconstruction || records.Reconstruction.length === 0) {
        continue;
      }
      
      // 提取所有 Reconstruction 数据的字段
      extractValidData(records.Reconstruction, allEvents);
    }
  }));

  if (Object.keys(allEvents).length === 0) {
    logError("⚠️ 没有可用的事件数据，ICS 文件未生成！");
    return;
  }

  logInfo(`📅 生成 ICS，共 ${Object.keys(allEvents).length} 个事件`);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MyCalendar//EN',
    'CALSCALE:GREGORIAN',
    ...Object.entries(allEvents).sort().map(([date, eventData]) => generateICSEvent(date, eventData)),
    'END:VCALENDAR'
  ].join('\r\n');

  try {
    await fs.promises.writeFile(icsFilePath, icsContent);
    logInfo(`✅ ICS 日历文件生成成功！共 ${Object.keys(allEvents).length} 个事件`);
  } catch (error) {
    logError(`❌ 生成 ICS 文件失败: ${error.message}`);
  }
};

// **运行脚本**
generateICS();