const fs = require('fs');
const path = require('path');

// 日志文件路径
const errorLogPath = path.join(__dirname, './data/error.log');

// 确保目录存在
const ensureDirectoryExistence = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 创建日志目录
ensureDirectoryExistence(errorLogPath);

/**
 * 写入错误日志
 * @param {string} message
 */
const logError = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  try {
    fs.appendFileSync(errorLogPath, logMessage, 'utf8');
    console.log(`📜 记录错误日志: ${logMessage.trim()}`);
  } catch (err) {
    console.log(`❌ 写入日志失败: ${err.message}`);
  }
};

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
    console.log(`📂 读取文件: ${filePath}`);
    const rawData = fs.readFileSync(filePath, 'utf-8');

    if (!rawData.trim()) {
      console.log(`⚠️ 文件 ${filePath} 为空！`);
      logError(`⚠️ 文件 ${filePath} 为空！`);
      return [];
    }

    const data = JSON.parse(rawData);
    console.log(`✅ 成功解析 JSON: ${filePath}, 数据量: ${Object.keys(data).length}`);

    if (!data || Object.keys(data).length === 0) {
      console.log(`⚠️ JSON 结构异常: ${filePath}`);
      return [];
    }

    const reconstructionData = Object.values(data).flatMap(entry => entry.Reconstruction || []);
    
    if (reconstructionData.length === 0) {
      console.log(`⚠️ ${filePath} 没有 Reconstruction 数据！`);
      logError(`⚠️ ${filePath} 没有 Reconstruction 数据！`);
    } else {
      console.log(`✅ ${filePath} 解析出 ${reconstructionData.length} 条 Reconstruction 数据`);
    }

    return reconstructionData;
  } catch (error) {
    console.log(`❌ 读取 JSON 失败: ${filePath} - ${error.message}`);
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
  data.forEach(record => {
    console.log("🔍 [调试] 当前记录:", JSON.stringify(record, null, 2));

    let date = record.date || record.day || null;
    if (!date) {
      const dateEntry = Object.entries(record).find(([key]) => key.toLowerCase().includes('date'));
      date = dateEntry ? dateEntry[1] : null;
    }

    if (!date) {
      console.log("⚠️ 无效记录，缺少日期:", JSON.stringify(record, null, 2));
      return;
    }

    console.log(`✅ 解析到日期: ${date}`);

    const name = record.name || record.title || '(无标题)';
    const isOffDay = record.isOffDay !== undefined ? record.isOffDay : null;
    const workStatus = isOffDay !== null ? `[${isOffDay ? '休' : '班'}] ` : '';

    const description = Object.entries(record)
      .filter(([key, value]) => !['date', 'day', 'name', 'title', 'isOffDay'].includes(key) && value)
      .map(([_, value]) => value)
      .join(' ');

    console.log(`📅 添加事件: ${date} - ${name} - ${description}`);

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

  console.log(`📊 处理 ${category} 数据，共 ${Object.keys(existingData).length} 个日期`);
};

/**
 * 生成 ICS 事件
 * @param {string} date
 * @param {Object} eventData
 * @returns {string}
 */
const generateICSEvent = (date, eventData) => {
  console.log(`📝 生成事件: 日期=${date}, 名称=${eventData.name}, 描述=${eventData.description}`);

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
      console.log(`⚠️ ${key}.json 读取失败或数据为空，跳过！`);
      logError(`⚠️ ${key}.json 读取失败或数据为空，跳过！`);
      invalidFiles.push(key);
      continue;
    }

    extractValidData(jsonData, key, allEvents);
  }

  if (Object.keys(allEvents).length === 0) {
    console.log("⚠️ 没有可用的事件数据，ICS 文件未生成！");
    logError("⚠️ 没有可用的事件数据，ICS 文件未生成！");
    return;
  }

  console.log(`📅 生成 ICS，共 ${Object.keys(allEvents).length} 个事件`);

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
    console.log(`✅ ICS 日历文件生成成功！共 ${eventCount} 个事件 (跳过无效 JSON: ${invalidFiles.join(', ')})`);
  } catch (error) {
    console.log(`❌ 生成 ICS 文件失败: ${error.message}`);
  }
};

// **运行脚本**
generateICS();