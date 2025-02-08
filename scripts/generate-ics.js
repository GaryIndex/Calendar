const fs = require('fs');
const path = require('path');

// 配置 JSON 数据路径
const dataPaths = {
  holidays: './data/Document/holidays.json',
  jieqi: './data/Document/jieqi.json',
  astro: './data/Document/astro.json',
  calendar: './data/Document/calendar.json',
  shichen: './data/Document/shichen.json',
};

// ICS 输出路径
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
 * 读取 JSON 文件
 * @param {string} filePath
 * @returns {Object|null}
 */
const readJson = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
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
  console.log(logMessage);  // ✅ 同时输出到终端
  fs.appendFileSync('./data/error.log', logMessage + '\n');
};

/**
 * 验证 JSON 数据是否包含指定字段
 * @param {Object} data
 * @param {Array<string>} requiredFields
 * @returns {boolean}
 */
const validateDataStructure = (data, requiredFields) => {
  if (typeof data !== 'object' || data === null) {
    logToFile(`⚠️ JSON 数据无效（不是对象或为空）: ${JSON.stringify(data)}`, 'ERROR');
    return false;
  }

  const missingFields = [];
  const isValid = Object.values(data).some((entry) => {
    const hasAllFields = requiredFields.every((field) => field in entry);
    if (!hasAllFields) missingFields.push(JSON.stringify(entry));
    return hasAllFields;
  });

  if (!isValid) {
    logToFile(`⚠️ JSON 结构错误，缺少字段: ${requiredFields.join(', ')} -> 错误数据示例: ${missingFields.slice(0, 3).join('; ')}`, 'ERROR');
  }

  return isValid;
};

/**
 * 生成 ICS 事件
 * @param {string} date
 * @param {Object} holidays
 * @param {Object} jieqi
 * @param {Object} astro
 * @param {Object} calendar
 * @param {Object} shichen
 * @returns {string}
 */
const generateICSEvent = (date, holidays, jieqi, astro, calendar, shichen) => {
  let summary = [];
  let description = [];

  if (holidays[date]) {
    summary.push(holidays[date].name);
    description.push(`节日: ${holidays[date].name}`);
  }
  if (jieqi[date]) {
    summary.push(jieqi[date].name);
    description.push(`节气: ${jieqi[date].name}`);
  }
  if (astro[date]) {
    description.push(`星座: ${astro[date].name} (${astro[date].fortune})`);
  }
  if (calendar[date]) {
    description.push(`农历: ${calendar[date].lunar}`);
  }
  if (shichen[date]) {
    description.push(`时辰: ${shichen[date].name}`);
  }

  // 确保 SUMMARY 不为空，避免 ICS 格式错误
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

  const data = {};
  const invalidFiles = [];

  // 读取 JSON 数据
  for (const [key, filePath] of Object.entries(dataPaths)) {
    const jsonData = readJson(filePath);

    if (jsonData === null) {
      logToFile(`⚠️ 文件 ${key}.json 读取失败，跳过！`, 'ERROR');
      invalidFiles.push(key);
      continue;
    }

    if (!validateDataStructure(jsonData, ['date'])) {
      logToFile(`⚠️ 无效的 ${key}.json 数据结构，跳过！`, 'ERROR');
      invalidFiles.push(key);
      continue;
    }

    data[key] = jsonData;
  }

  // 如果所有 JSON 数据都无效，终止生成
  if (Object.keys(data).length === 0) {
    logToFile('❌ 所有 JSON 文件都无效，无法生成 ICS！', 'ERROR');
    return;
  }

  // 获取所有日期（去除 undefined/null）
  const allDates = new Set(
    Object.values(data.holidays || {}).map(h => h.date)
      .concat(Object.values(data.jieqi || {}).map(j => j.date))
      .concat(Object.values(data.astro || {}).map(a => a.date))
      .concat(Object.values(data.calendar || {}).map(c => c.date))
      .concat(Object.values(data.shichen || {}).map(s => s.date))
      .filter(date => date) // 过滤掉 null/undefined
  );

  let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyCalendar//EN\r\nCALSCALE:GREGORIAN\r\n';

  // 遍历日期，生成 ICS 事件
  allDates.forEach(date => {
    icsContent += generateICSEvent(
      date,
      data.holidays || {},
      data.jieqi || {},
      data.astro || {},
      data.calendar || {},
      data.shichen || {}
    );
  });

  icsContent += 'END:VCALENDAR\r\n';

  try {
    fs.writeFileSync(icsFilePath, icsContent);
    logToFile(`✅ ICS 日历文件生成成功！ (跳过无效 JSON: ${invalidFiles.join(', ')})`, 'INFO');
  } catch (error) {
    logToFile(`❌ 生成 ICS 文件失败: ${error.message}`, 'ERROR');
  }
};

generateICS();