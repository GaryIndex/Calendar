const fs = require('fs');
const path = require('path');

// 日志文件路径
const errorLogPath = path.join(__dirname, './data/error.log');
const icsFilePath = path.join(__dirname, './calendar.ics');

// 确保日志目录存在
const ensureDirectoryExistence = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};
ensureDirectoryExistence(errorLogPath);

// 记录错误日志
const logError = (message) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(errorLogPath, `[${timestamp}] ${message}\n`, 'utf8');
};

// JSON 文件路径
const dataPaths = {
  holidays: './data/Document/holidays.json',
  jieqi: './data/Document/jieqi.json',
  astro: './data/Document/astro.json',
  calendar: './data/Document/calendar.json',
  shichen: './data/Document/shichen.json',
};
const prioritySources = ["holidays", "jieqi"];

/**
 * 读取 JSON 并解析 Reconstruction 层
 */
const readJsonReconstruction = (filePath) => {
  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    if (!rawData.trim()) {
      console.log(`⚠️ 文件 ${filePath} 为空，跳过！`);
      return [];
    }

    const data = JSON.parse(rawData);
    console.log("🔍 [调试] 读取的 JSON 数据:", data);

    if (!data || typeof data !== "object") {
      console.log(`⚠️ ${filePath} 解析 JSON 失败！`);
      return [];
    }

    return Object.values(data).flatMap(entry => entry.Reconstruction || []);
  } catch (error) {
    logError(`❌ 读取 JSON 失败: ${filePath} - ${error.message}`);
    return [];
  }
};

/**
 * 处理数据，提取关键字段
 */
const extractValidData = (data, category, existingData) => {
  data.forEach(record => {
    const date = record.date || record.Date || null;
    if (!date) return;

    const name = record.name || record.event || record.title || null;
    const isOffDay = record.isOffDay !== undefined ? record.isOffDay : null;
    const workStatus = isOffDay !== null ? `[${isOffDay ? '休' : '班'}] ` : '';

    // 过滤掉不必要的键
    const description = Object.entries(record)
      .filter(([key, value]) => !["date", "name", "title", "event", "isOffDay"].includes(key) && value)
      .map(([_, value]) => value)
      .join(' ');

    // 记录数据
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

    if (prioritySources.includes(category) && !existingData[date].name && name) {
      existingData[date].name = name;
    }
  });

  console.log("🔍 [调试] 提取的事件数据:", existingData);
};

/**
 * 生成 ICS 事件
 */
const generateICSEvent = (date, eventData) => {
  const formattedDate = date.replace(/-/g, ''); // 转换为 YYYYMMDD 格式
  const summary = eventData.name || '(无标题)';
  const description = eventData.description ? eventData.description : '';

  return `
BEGIN:VEVENT
DTSTART;VALUE=DATE:${formattedDate}
SUMMARY:${summary}
DESCRIPTION:${description}
END:VEVENT
  `.trim();
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

  // 确保有事件数据
  if (Object.keys(allEvents).length === 0) {
    logError("⚠️ 没有可用的事件数据，ICS 文件未生成！");
    return;
  }

  // 按日期排序
  const sortedDates = Object.keys(allEvents).sort();
  console.log("🔍 [调试] 所有事件:", allEvents);

  let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyCalendar//EN\r\nCALSCALE:GREGORIAN\r\n';
  let eventCount = 0;

  // 生成 ICS 事件
  for (const date of sortedDates) {
    const eventData = allEvents[date];
    const event = generateICSEvent(date, eventData);
    if (event.trim()) {
      icsContent += `\n${event}\n`;
      eventCount++;
    }
  }

  icsContent += 'END:VCALENDAR\r\n';

  console.log("🔍 [调试] 生成的 ICS 内容:\n", icsContent);

  // 确保 ICS 事件数量大于 0
  if (eventCount === 0) {
    logError("⚠️ ICS 文件生成失败，没有有效事件！");
    return;
  }

  // 写入 ICS 文件
  try {
    fs.writeFileSync(icsFilePath, icsContent);
    console.log(`✅ ICS 文件生成成功！共 ${eventCount} 个事件 (跳过无效 JSON: ${invalidFiles.join(', ')})`);
  } catch (error) {
    logError(`❌ 生成 ICS 文件失败: ${error.message}`);
  }
};

// 运行 ICS 生成
generateICS();