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

// **优先级数据源**
const prioritySources = ["holidays", "jieqi"];

// ICS 文件路径
const icsFilePath = path.join(__dirname, './calendar.ics');

/**
 * 读取 JSON 并解析 Reconstruction 层（支持异步）
 * @param {string} filePath
 * @returns {Promise<Array>}
 */
const readJsonReconstruction = async (filePath) => {
  try {
    logInfo(`📂 读取文件: ${filePath}`);
    const rawData = await fs.promises.readFile(filePath, 'utf-8');

    if (!rawData.trim()) {
      logError(`⚠️ 文件 ${filePath} 为空！`);
      return [];
    }

    const data = JSON.parse(rawData);
    logInfo(`✅ 成功解析 JSON: ${filePath}, 数据量: ${Object.keys(data).length}`);

    // 提取 Reconstruction 层
    return Object.values(data)
      .flatMap(entry => entry.Reconstruction || [])
      .filter(entry => Object.keys(entry).length > 0); // 过滤空对象
  } catch (error) {
    logError(`❌ 读取 JSON 失败: ${filePath} - ${error.message}`);
    return [];
  }
};

/**
 * 处理数据，提取关键字段
 * @param {Array} data
 * @param {string} category
 * @param {Object} existingData
 */
const extractValidData = (data, category, existingData) => {
  logInfo(`🔍 处理 ${category} 数据，共 ${data.length} 条`);

  data.forEach(record => {
    // 解析日期
    const date = record.date || record.day || null;
    if (!date) {
      logError(`⚠️ 无效记录（无日期）: ${JSON.stringify(record)}`);
      return;
    }

    // 解析名称
    const name = record.name || record.title || record["data.name"] || '(无标题)';

    // 解析 isOffDay 状态
    const isOffDay = record.isOffDay !== undefined ? record.isOffDay : null;
    const workStatus = isOffDay !== null ? `[${isOffDay ? '休' : '班'}] ` : '';

    // 解析描述信息
    const description = Object.entries(record)
      .filter(([key, value]) => !['date', 'day', 'name', 'title', 'isOffDay'].includes(key) && value)
      .map(([key, value]) => `${key.replace(/^data\./, '')}: ${value}`)
      .join(' | ');

    logInfo(`📅 解析事件: ${date} - ${name} - ${description}`);

    // 组织数据结构
    if (!existingData[date]) {
      existingData[date] = {
        category,
        name,
        isOffDay,
        description: workStatus + description
      };
    } else {
      existingData[date].description += ` | ${workStatus}${description}`;
    }

    // 优先级数据源覆盖 name
    if (prioritySources.includes(category) && name) {
      existingData[date].name = name;
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
  let invalidFiles = [];

  // 并行读取所有 JSON 文件
  await Promise.all(Object.entries(dataPaths).map(async ([key, filePath]) => {
    const jsonData = await readJsonReconstruction(filePath);
    if (jsonData.length === 0) {
      logError(`⚠️ ${key}.json 读取失败或数据为空，跳过！`);
      invalidFiles.push(key);
      return;
    }

    extractValidData(jsonData, key, allEvents);
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
    logInfo(`✅ ICS 日历文件生成成功！共 ${Object.keys(allEvents).length} 个事件 (跳过无效 JSON: ${invalidFiles.join(', ')})`);
  } catch (error) {
    logError(`❌ 生成 ICS 文件失败: ${error.message}`);
  }
};

// **运行脚本**
generateICS();