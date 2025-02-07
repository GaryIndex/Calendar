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

// 读取 data.json 文件
const readData = () => {
  if (!fs.existsSync(dataPath)) {
    console.error('⚠️ data.json 文件不存在，无法生成日历！');
    return [];
  }
  try {
    const rawData = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('⚠️ 解析 data.json 失败:', error);
    return [];
  }
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
  if (data.length === 0) {
    console.error('⚠️ 没有数据，无法生成 ICS！');
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