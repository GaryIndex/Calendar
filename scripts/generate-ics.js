const fs = require('fs');
const path = require('path');

const dataPaths = {
  holidays: './data/Document/holidays.json',
  jieqi: './data/Document/jieqi.json',
  astro: './data/Document/astro.json',
  calendar: './data/Document/calendar.json',
  shichen: './data/Document/shichen.json',
};

const icsFilePath = path.join(__dirname, './calendar.ics');

/**
 * 确保目录存在
 * @param {string} filePath
 */
const ensureDirectoryExists = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logToFile(`✅ 目录已创建: ${dir}`, 'INFO');
  }
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
      logToFile(`⚠️ 文件 ${filePath} 为空，跳过！`, 'ERROR');
      return [];
    }

    const data = JSON.parse(rawData);
    if (!data || typeof data !== 'object') {
      logToFile(`⚠️ 文件 ${filePath} 格式错误，跳过！`, 'ERROR');
      return [];
    }

    const reconstructionData = Object.values(data)
      .flatMap(entry => entry.Reconstruction || []);

    logToFile(`📂 读取文件: ${filePath}, 提取 ${reconstructionData.length} 条记录`, 'INFO');
    return reconstructionData;
  } catch (error) {
    logToFile(`❌ 读取文件失败: ${filePath} - 错误: ${error.message}`, 'ERROR');
    return [];
  }
};

/**
 * 处理数据，提取关键字段
 * @param {Array} data
 * @param {string} category
 * @returns {Object}
 */
const extractValidData = (data, category) => {
  const extractedData = {};

  data.forEach(record => {
    // 查找 `date` 字段
    const dateEntry = Object.entries(record).find(([key]) => key.includes('date'));
    const date = dateEntry ? dateEntry[1] : null;
    if (!date) return;

    // 查找 `name` 作为标题
    const nameEntry = Object.entries(record).find(([key]) => key.includes('name'));
    const name = nameEntry ? nameEntry[1] : null;
    if (!name) return;

    // 处理 `isOffDay`
    const isOffDayEntry = Object.entries(record).find(([key]) => key.includes('isOffDay'));
    const isOffDay = isOffDayEntry ? isOffDayEntry[1] : null;
    const workStatus = isOffDay !== null ? `[${isOffDay ? '休' : '班'}] ` : '';

    // 提取其他字段作为备注
    const description = Object.entries(record)
      .filter(([key, value]) => !key.includes('date') && !key.includes('name') && !key.includes('isOffDay') && value)
      .map(([_, value]) => value)
      .join(' ');

    extractedData[date] = {
      category,
      name,
      isOffDay,
      description: workStatus + description.trim()
    };
  });

  console.log(`📊 提取 ${category} 数据:`, extractedData);
  return extractedData;
};

/**
 * 生成 ICS 事件
 * @param {string} date
 * @param {Object} eventData
 * @returns {string}
 */
const generateICSEvent = (date, eventData) => {
  const summary = eventData.name;
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
  ensureDirectoryExists(icsFilePath);

  let allEvents = {};
  let invalidFiles = [];

  // 📌 读取并解析 JSON 数据
  for (const [key, filePath] of Object.entries(dataPaths)) {
    const jsonData = readJsonReconstruction(filePath);
    if (jsonData.length === 0) {
      logToFile(`⚠️ ${key}.json 读取失败或数据为空，跳过！`, 'ERROR');
      invalidFiles.push(key);
      continue;
    }

    const extractedData = extractValidData(jsonData, key);
    allEvents = { ...allEvents, ...extractedData };
  }

  console.log(`📅 解析出的所有事件:`, allEvents);
  if (Object.keys(allEvents).length === 0) {
    logToFile(`⚠️ 没有找到任何事件，ICS 文件未生成！`, 'ERROR');
    return;
  }

  // 📌 生成 ICS 内容
  let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyCalendar//EN\r\nCALSCALE:GREGORIAN\r\n';
  let eventCount = 0;

  for (const [date, eventData] of Object.entries(allEvents)) {
    const event = generateICSEvent(date, eventData);
    if (event.trim()) {
      icsContent += event;
      eventCount++;
    }
  }

  icsContent += 'END:VCALENDAR\r\n';

  console.log(`📄 生成的 ICS 内容:\n${icsContent}`);
  if (eventCount === 0) {
    logToFile(`⚠️ 没有可用的事件，ICS 文件未写入！`, 'ERROR');
    return;
  }

  // 📌 写入 ICS 文件
  try {
    fs.writeFileSync(icsFilePath, icsContent);
    logToFile(`✅ ICS 日历文件生成成功！共 ${eventCount} 个事件 (跳过无效 JSON: ${invalidFiles.join(', ')})`, 'INFO');
  } catch (error) {
    logToFile(`❌ 生成 ICS 文件失败: ${error.message}`, 'ERROR');
  }
};

/**
 * 日志记录
 * @param {string} message
 * @param {string} level
 */
const logToFile = (message, level = 'INFO') => {
  const logMessage = `[${new Date().toISOString()}] [${level}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync('./data/error.log', logMessage + '\n');
};

// 📌 执行 ICS 生成
generateICS();