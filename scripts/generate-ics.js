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
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.Reconstruction || {}; 
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
      // 提取所有字段，并格式化输出
      const record = records[date];
      summary.push(record.name || category);
      description.push(`${category.toUpperCase()} 信息:`);

      for (const [key, value] of Object.entries(record)) {
        description.push(`- ${key}: ${value}`);
      }
    }
  }

  // 确保 `SUMMARY` 不为空，避免 ICS 格式错误
  if (summary.length === 0) summary.push('日历事件');

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

  let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyCalendar//EN\r\nCALSCALE:GREGORIAN\r\n';

  // 📌 遍历日期，生成 ICS 事件
  allDates.forEach(date => {
    icsContent += generateICSEvent(date, dataByCategory);
  });

  icsContent += 'END:VCALENDAR\r\n';

  try {
    fs.writeFileSync(icsFilePath, icsContent);
    logToFile(`✅ ICS 日历文件生成成功！ (跳过无效 JSON: ${invalidFiles.join(', ')})`, 'INFO');
  } catch (error) {
    logToFile(`❌ 生成 ICS 文件失败: ${error.message}`, 'ERROR');
  }
};

// 📌 执行 ICS 生成
generateICS();