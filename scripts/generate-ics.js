const fs = require('fs');
const path = require('path');

// 日志文件路径
const errorLogPath = path.join(__dirname, './data/error.log');

// 检查并创建缺失的目录
const ensureDirectoryExistence = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 在写入日志前，确保目录存在
ensureDirectoryExistence(errorLogPath);

/**
 * 写入错误日志到 error.log 文件
 * @param {string} message
 */
const logError = (message) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(errorLogPath, `[${timestamp}] ${message}\n`, 'utf8');
};

const dataPaths = {
  holidays: './data/Document/holidays.json',
  jieqi: './data/Document/jieqi.json',
  astro: './data/Document/astro.json',
  calendar: './data/Document/calendar.json',
  shichen: './data/Document/shichen.json',
};

// 🏆 **设定多个优先级文件**
const prioritySources = ["holidays", "jieqi"];

const icsFilePath = path.join(__dirname, './calendar.ics');

/**
 * 写入错误日志到 error.log 文件
 * @param {string} message
 */
const logError = (message) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(errorLogPath, `[${timestamp}] ${message}\n`, 'utf8');
};

/**
 * 读取 JSON 并解析 Reconstruction 层
 * @param {string} filePath
 * @returns {Array}
 */
const readJsonReconstruction = (filePath) => {
  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    if (!rawData.trim()) {
      const message = `⚠️ 文件 ${filePath} 为空，跳过！`;
      console.log(message);
      logError(message);
      return [];
    }

    const data = JSON.parse(rawData);
    return Object.values(data).flatMap(entry => entry.Reconstruction || []);
  } catch (error) {
    const message = `❌ 读取文件失败: ${filePath} - 错误: ${error.message}`;
    console.log(message);
    logError(message);
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
  data.forEach(record => {
    const dateEntry = Object.entries(record).find(([key]) => key.includes('date'));
    const date = dateEntry ? dateEntry[1] : null;
    if (!date) return;

    const nameEntry = Object.entries(record).find(([key]) => key.includes('name'));
    const name = nameEntry ? nameEntry[1] : null;

    const isOffDayEntry = Object.entries(record).find(([key]) => key.includes('isOffDay'));
    const isOffDay = isOffDayEntry ? isOffDayEntry[1] : null;
    const workStatus = isOffDay !== null ? `[${isOffDay ? '休' : '班'}] ` : '';

    const description = Object.entries(record)
      .filter(([key, value]) => !key.includes('date') && !key.includes('name') && !key.includes('isOffDay') && value)
      .map(([_, value]) => value)
      .join(' ');

    if (!existingData[date]) {
      existingData[date] = {
        category,
        name: null,
        isOffDay,
        description: workStatus + description
      };
    } else {
      existingData[date].description += ` | ${workStatus}${description}`;
    }

    // **优先级文件处理**
    if (prioritySources.includes(category) && !existingData[date].name && name) {
      existingData[date].name = name;
    }
  });

  console.log(`📊 处理 ${category} 数据，共 ${Object.keys(existingData).length} 个日期`);
};

/**
 * 生成 ICS 事件
 * @param {string} date
 * @param {Object} eventData
 * @returns {string}
 */
const generateICSEvent = (date, eventData) => {
  const summary = eventData.name || '(无标题)';
  const description = eventData.description ? eventData.description : '';

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

  // 📌 读取并解析所有 JSON 数据
  for (const [key, filePath] of Object.entries(dataPaths)) {
    const jsonData = readJsonReconstruction(filePath);
    if (jsonData.length === 0) {
      const message = `⚠️ ${key}.json 读取失败或数据为空，跳过！`;
      console.log(message);
      logError(message);
      invalidFiles.push(key);
      continue;
    }

    extractValidData(jsonData, key, allEvents);
  }

  // **📌 按日期升序排序**
  const sortedDates = Object.keys(allEvents).sort();

  // 📌 生成 ICS 内容
  let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyCalendar//EN\r\nCALSCALE:GREGORIAN\r\n';
  let eventCount = 0;

  // **按日期生成 ICS 事件**
  for (const date of sortedDates) {
    const eventData = allEvents[date];
    const event = generateICSEvent(date, eventData);
    if (event.trim()) {
      icsContent += event;
      eventCount++;
    }
  }

  icsContent += 'END:VCALENDAR\r\n';

  // 📌 写入 ICS 文件
  try {
    fs.writeFileSync(icsFilePath, icsContent);
    const message = `✅ ICS 日历文件生成成功！共 ${eventCount} 个事件 (跳过无效 JSON: ${invalidFiles.join(', ')})`;
    console.log(message);
    logError(message);
  } catch (error) {
    const message = `❌ 生成 ICS 文件失败: ${error.message}`;
    console.log(message);
    logError(message);
  }
};

// 📌 执行 ICS 生成
generateICS();