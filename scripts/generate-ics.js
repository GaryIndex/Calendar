const fs = require('fs');
const moment = require('moment-timezone');

const dataPath = './data/data.json';
const icsFilePath = './calendar.ics';

// 确保ICS目录存在
const ensureDirectoryExists = (filePath) => {
  const dirName = filePath.substring(0, filePath.lastIndexOf('/'));
  if (dirName && !fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
};

// 读取数据并验证数据结构
const validateDataStructure = (data) => {
  if (!Array.isArray(data)) {
    return false;
  }

  // 确保每个条目都包含必要的字段
  return data.every((entry, index) => {
    if (!entry.holidays || !Array.isArray(entry.holidays)) {
      logToFile(`⚠️ data.json 数据格式不正确：第${index + 1}项缺少 "holidays" 或 "holidays" 不是数组`);
      return false;
    }
    if (!entry.jieqi || !entry.jieqi.term) {
      logToFile(`⚠️ data.json 数据格式不正确：第${index + 1}项缺少 "jieqi" 或 "jieqi.term"`);
      return false;
    }
    if (!entry.calendar || !entry.calendar.lunar) {
      logToFile(`⚠️ data.json 数据格式不正确：第${index + 1}项缺少 "calendar" 或 "calendar.lunar"`);
      return false;
    }
    if (!entry.astro || !entry.astro.name) {
      logToFile(`⚠️ data.json 数据格式不正确：第${index + 1}项缺少 "astro" 或 "astro.name"`);
      return false;
    }
    if (!entry.shichen || !Array.isArray(entry.shichen.periods)) {
      logToFile(`⚠️ data.json 数据格式不正确：第${index + 1}项缺少 "shichen" 或 "shichen.periods" 不是数组`);
      return false;
    }
    return true;
  });
};

const readData = () => {
  if (!fs.existsSync(dataPath)) {
    const message = '⚠️ data.json 文件不存在，无法生成日历！';
    console.error(message);
    logToFile(message);
    return null;
  }
  try {
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);

    // 检查数据结构
    if (!validateDataStructure(data)) {
      const message = '⚠️ data.json 文件结构不符合预期！';
      console.error(message);
      return null;
    }

    return data;
  } catch (error) {
    const message = `⚠️ 解析 data.json 失败: ${error.message}`;
    console.error(message);
    logToFile(message);
    return null;
  }
};

// 日志记录
const logToFile = (message) => {
  const errorLogPath = './data/error.log';
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;

  fs.appendFileSync(errorLogPath, logMessage, 'utf8');
};

// 生成 ICS 事件格式
const generateICSEvent = (entry) => {
  const date = moment(entry.date).format('YYYYMMDD');

  // 处理标题（假期、节气、补班）
  let summary = [];
  if (entry.holidays && entry.holidays.length > 0) {
    summary.push(entry.holidays.map(h => h.name).join('、'));
  }
  if (entry.jieqi && entry.jieqi.term) {
    summary.push(entry.jieqi.term);
  }
  if (summary.length === 0) {
    summary.push('日程提醒');
  }

  // 处理详细描述
  const description = [
    `📅 日期: ${entry.date}`,
    `🌙 农历: ${entry.calendar.lunar}`,
    `💫 星座: ${entry.astro.name} (${entry.astro.description})`,
    `🕒 十二时辰: ${entry.shichen.periods.map(p => `${p.name} (${p.start}-${p.end})`).join('，')}`,
    entry.holidays ? `🏖️ 假期: ${entry.holidays.map(h => `${h.name} (${h.date})`).join('，')}` : '',
    entry.jieqi ? `☀️ 节气: ${entry.jieqi.term} (${entry.jieqi.date})` : '',
  ].filter(Boolean).join('\\n');

  return `
BEGIN:VEVENT
SUMMARY:${summary.join('、')}
DTSTART;VALUE=DATE:${date}
DESCRIPTION:${description}
X-ALT-DESC;FMTTYPE=text/html:${description.replace(/\\n/g, '<br>')}
END:VEVENT
  `;
};

// 生成 ICS 文件
const generateICS = () => {
  ensureDirectoryExists(icsFilePath);
  
  const data = readData();
  if (!data) {
    const message = '⚠️ 无效的 data.json 数据，无法生成 ICS！';
    console.error(message);
    logToFile(message);
    return;
  }

  let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MyCalendar//EN\nCALSCALE:GREGORIAN\n';

  data.forEach((entry) => {
    icsContent += generateICSEvent(entry);
  });

  icsContent += '\nEND:VCALENDAR';

  fs.writeFileSync(icsFilePath, icsContent);
  console.log('✅ ICS 日历文件生成成功！');
};

generateICS();