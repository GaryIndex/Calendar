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
    return null;
  }
  try {
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);

    // 检查数据是否为数组
    if (!Array.isArray(data)) {
      const message = `⚠️ data.json 格式错误，数据不是数组！实际数据类型: ${typeof data}`;
      console.error(message);
      logToFile(message);
      return null;
    }

    // 检查数据是否为空
    if (data.length === 0) {
      const message = '⚠️ data.json 文件为空，无法生成日历！';
      console.error(message);
      logToFile(message);
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

// 读取现有的 ICS 文件，防止重复添加
const readExistingICS = () => {
  if (fs.existsSync(icsFilePath)) {
    const icsContent = fs.readFileSync(icsFilePath, 'utf8');
    const events = icsContent.match(/DTSTART;VALUE=DATE:(\d{8})/g);
    return events ? events.map(event => event.split(':')[1]) : [];
  }
  return [];
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
    const message = '⚠️ 没有有效的数据，无法生成 ICS！';
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