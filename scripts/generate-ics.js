const fs = require('fs');
const path = require('path');

// 日志文件路径
const logFilePath = path.join(__dirname, './data/error.log');

// 确保目录存在
const ensureDirectoryExistence = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 创建日志目录
ensureDirectoryExistence(logFilePath);

/**
 * 记录日志 (成功 + 错误)
 * @param {string} type "INFO" | "ERROR"
 * @param {string} message
 */
const writeLog = (type, message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}\n`;

  try {
    fs.appendFileSync(logFilePath, logMessage, 'utf8');
    console.log(logMessage.trim());
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
 * 读取 JSON 并解析 Reconstruction 层
 * @param {string} filePath
 * @returns {Array}
 */
const readJsonReconstruction = (filePath) => {
  try {
    logInfo(`📂 读取文件: ${filePath}`);
    const rawData = fs.readFileSync(filePath, 'utf-8');

    if (!rawData.trim()) {
      logError(`⚠️ 文件 ${filePath} 为空！`);
      return [];
    }

    const data = JSON.parse(rawData);
    logInfo(`✅ 成功解析 JSON: ${filePath}, 数据量: ${Object.keys(data).length}`);

    const reconstructionData = Object.values(data).flatMap(entry => entry.Reconstruction || []);

    if (reconstructionData.length === 0) {
      logError(`⚠️ ${filePath} 没有 Reconstruction 数据！`);
    }

    return reconstructionData;
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
    let date = record.date || record.day || null;
    if (!date) {
      const dateEntry = Object.entries(record).find(([key]) => key.toLowerCase().includes('date'));
      date = dateEntry ? dateEntry[1] : null;
    }

    if (!date) {
      logError(`⚠️ 无效记录（无日期）: ${JSON.stringify(record)}`);
      return;
    }

    const name = record.name || record.title || '(无标题)';
    const isOffDay = record.isOffDay !== undefined ? record.isOffDay : null;
    const workStatus = isOffDay !== null ? `[${isOffDay ? '休' : '班'}] ` : '';

    const description = Object.entries(record)
      .filter(([key, value]) => !['date', 'day', 'name', 'title', 'isOffDay'].includes(key) && value)
      .map(([_, value]) => value)
      .join(' ');

    logInfo(`📅 解析事件: ${date} - ${name} - ${description}`);

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

    if (prioritySources.includes(category) && !existingData[date].name && name) {
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

  const summary = eventData.name || '(无标题)';
  const description = eventData.description || '';

  return `
BEGIN:VEVENT
DTSTART;VALUE=DATE:${date.replace(/-/g, '')}
SUMMARY:${summary}
DESCRIPTION:${description}
END:VEVENT
`;
};

/**
 * 生成 ICS 日历
 */
const generateICS = () => {
  let allEvents = {};
  let invalidFiles = [];

  for (const [key, filePath] of Object.entries(dataPaths)) {
    const jsonData = readJsonReconstruction(filePath);
    if (jsonData.length === 0) {
      logError(`⚠️ ${key}.json 读取失败或数据为空，跳过！`);
      invalidFiles.push(key);
      continue;
    }

    extractValidData(jsonData, key, allEvents);
  }

  if (Object.keys(allEvents).length === 0) {
    logError("⚠️ 没有可用的事件数据，ICS 文件未生成！");
    return;
  }

  logInfo(`📅 生成 ICS，共 ${Object.keys(allEvents).length} 个事件`);

  let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyCalendar//EN\r\nCALSCALE:GREGORIAN\r\n';
  let eventCount = 0;

  const sortedDates = Object.keys(allEvents).sort();

  for (const date of sortedDates) {
    const eventData = allEvents[date];
    const event = generateICSEvent(date, eventData);
    if (event.trim()) {
      icsContent += event;
      eventCount++;
    }
  }

  icsContent += 'END:VCALENDAR\r\n';

  try {
    fs.writeFileSync(icsFilePath, icsContent);
    logInfo(`✅ ICS 日历文件生成成功！共 ${eventCount} 个事件 (跳过无效 JSON: ${invalidFiles.join(', ')})`);
  } catch (error) {
    logError(`❌ 生成 ICS 文件失败: ${error.message}`);
  }
};

// **运行脚本**
generateICS();