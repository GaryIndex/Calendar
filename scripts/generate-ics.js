const fs = require('fs');
const path = require('path');

// 📌 JSON 数据路径
const dataPaths = {
  holidays: './data/Document/holidays.json',
  jieqi: './data/Document/jieqi.json',
  astro: './data/Document/astro.json',
  calendar: './data/Document/calendar.json',
  shichen: './data/Document/shichen.json',
};

// 📌 ICS 输出路径
const icsFilePath = path.join(__dirname, './calendar.ics');

/**
 * 确保目录存在
 * @param {string} filePath
 */
const ensureDirectoryExists = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * 读取 JSON 文件并解析 Reconstruction 层
 * @param {string} filePath
 * @returns {Object|null}
 */
const readJsonReconstruction = (filePath) => {
  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);
    
    if (!data.Reconstruction || Object.keys(data.Reconstruction).length === 0) {
      console.log(`⚠️ ${filePath} 中的 Reconstruction 为空`);
      return {};  // 返回空对象，避免 undefined
    }
    
    console.log(`✅ 成功读取 ${filePath}, Reconstruction 数据:`, Object.keys(data.Reconstruction));
    return data.Reconstruction;
  } catch (error) {
    logToFile(`❌ 读取文件失败: ${filePath} - 错误: ${error.message}`, 'ERROR');
    return null;
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

/**
 * 生成 ICS 事件
 * @param {string} date
 * @param {Object} dataByCategory
 * @returns {string}
 */
const generateICSEvent = (date, dataByCategory) => {
  let summary = [];
  let description = [];

  for (const [category, records] of Object.entries(dataByCategory)) {
    if (records[date]) {
      const record = records[date];
      summary.push(record.name || category);
      description.push(`${category.toUpperCase()} 信息:`);

      for (const [key, value] of Object.entries(record)) {
        description.push(`- ${key}: ${value}`);
      }
    }
  }

  if (summary.length === 0) {
    console.log(`⚠️ 跳过 ${date}，没有可用的事件`);
    return ''; // 避免返回空事件
  }

  return `
BEGIN:VEVENT
DTSTART;VALUE=DATE:${date.replace(/-/g, '')}
SUMMARY:${summary.join(' ')}
DESCRIPTION:${description.join('\\n')}
END:VEVENT
`;
};

/**
 * 生成 ICS 日历
 */
const generateICS = () => {
  ensureDirectoryExists(icsFilePath);

  const dataByCategory = {};
  const invalidFiles = [];

  // 📌 读取 JSON 数据
  for (const [key, filePath] of Object.entries(dataPaths)) {
    const jsonData = readJsonReconstruction(filePath);

    if (jsonData === null) {
      logToFile(`⚠️ ${key}.json 读取失败，跳过！`, 'ERROR');
      invalidFiles.push(key);
      continue;
    }

    dataByCategory[key] = jsonData;
  }

  // 📌 获取所有日期
  const allDates = new Set(
    Object.values(dataByCategory)
      .flatMap((categoryData) => Object.keys(categoryData))
  );

  console.log('📅 所有日期:', [...allDates]); // 确认日期集合

  if (allDates.size === 0) {
    logToFile('⚠️ 没有找到任何日期，ICS 文件不会被生成！', 'ERROR');
    return;
  }

  let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyCalendar//EN\r\nCALSCALE:GREGORIAN\r\n';

  let eventCount = 0;
  allDates.forEach(date => {
    const event = generateICSEvent(date, dataByCategory);
    if (event.trim()) {
      icsContent += event;
      eventCount++;
    }
  });

  icsContent += 'END:VCALENDAR\r\n';

  if (eventCount === 0) {
    logToFile('⚠️ 没有生成任何事件，ICS 文件将不会被写入！', 'ERROR');
    return;
  }

  try {
    fs.writeFileSync(icsFilePath, icsContent);
    logToFile(`✅ ICS 日历文件生成成功！ 共 ${eventCount} 个事件 (跳过无效 JSON: ${invalidFiles.join(', ')})`, 'INFO');
  } catch (error) {
    logToFile(`❌ 生成 ICS 文件失败: ${error.message}`, 'ERROR');
  }
};

// 📌 执行 ICS 生成
generateICS();