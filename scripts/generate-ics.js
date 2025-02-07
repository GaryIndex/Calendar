const fs = require('fs');
const moment = require('moment-timezone');

const dataPath = './data/data.json';
const icsFilePath = './calendar.ics';
const logFilePath = './data/error.log';  // 错误日志文件

// 确保目录存在
const ensureDirectoryExists = (filePath) => {
  const dirName = filePath.substring(0, filePath.lastIndexOf('/'));
  if (dirName && !fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
};

// 写入日志文件
const logToFile = (message) => {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage, 'utf8');
};

// 读取 data.json 文件
const readData = () => {
  if (!fs.existsSync(dataPath)) {
    const message = '⚠️ data.json 文件不存在，无法生成日历！';
    console.error(message);
    logToFile(message);
    return [];
  }
  try {
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);

    // 检查数据是否为空
    if (data.length === 0) {
      const message = '⚠️ data.json 文件为空，无法生成日历！';
      console.error(message);
      logToFile(message);
      return [];
    }

    return data;
  } catch (error) {
    const message = `⚠️ 解析 data.json 失败: ${error.message}`;
    console.error(message);
    logToFile(message);
    return [];
  }
};

// 生成 ICS 事件格式
const generateICSEvent = (entry) => {
  const date = moment(entry.date).format('YYYYMMDD');

  // 处理角标（如休、班）
  let cornerMark = '';
  if (entry.holidays && entry.holidays.length > 0) {
    const holidayNames = entry.holidays.map(h => h.name);
    if (holidayNames.some(name => name.includes('假期'))) {
      cornerMark = '休';
    }
    if (holidayNames.some(name => name.includes('补班'))) {
      cornerMark = '班';
    }
  }

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
SUMMARY:${cornerMark ? `[${cornerMark}] ` : ''}${summary.join('、')}
DTSTART;VALUE=DATE:${date}
DESCRIPTION:${description}
X-ALT-DESC;FMTTYPE=text/html:${description.replace(/\\n/g, '<br>')}
END:VEVENT
  `;
};

// 从现有的 ICS 文件中读取事件，确保没有重复
const readExistingICS = () => {
  if (!fs.existsSync(icsFilePath)) {
    return [];
  }
  const rawICS = fs.readFileSync(icsFilePath, 'utf8');
  const events = rawICS.split('BEGIN:VEVENT').slice(1).map(event => {
    const dateMatch = event.match(/DTSTART;VALUE=DATE:(\d{8})/);
    return dateMatch ? dateMatch[1] : null;
  }).filter(Boolean);

  return events;
};

// 生成 ICS 文件
const generateICS = () => {
  ensureDirectoryExists(icsFilePath);
  
  const data = readData();
  if (data.length === 0) {
    const message = '⚠️ 没有数据，无法生成 ICS！';
    logToFile(message);
    return;
  }

  const existingEvents = readExistingICS();

  let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MyCalendar//EN\nCALSCALE:GREGORIAN\n';

  data.forEach((entry) => {
    const date = moment(entry.date).format('YYYYMMDD');
    if (!existingEvents.includes(date)) {
      icsContent += generateICSEvent(entry);
    }
  });

  icsContent += '\nEND:VCALENDAR';

  fs.writeFileSync(icsFilePath, icsContent);
  const message = '✅ ICS 日历文件生成成功！';
  console.log(message);
  logToFile(message);
};

generateICS();