const fs = require('fs');
const moment = require('moment-timezone');

// 📌 文件路径
const dataDir = './data/Document';
const paths = {
  holidays: `${dataDir}/holidays.json`,
  jieqi: `${dataDir}/jieqi.json`,
  astro: `${dataDir}/astro.json`,
  calendar: `${dataDir}/calendar.json`,
  shichen: `${dataDir}/shichen.json`,
};
const icsFilePath = './calendar.ics';
const errorLogPath = `${dataDir}/error.log`;

// 📌 确保目录存在
const ensureDirectoryExists = (filePath) => {
  const dirName = filePath.substring(0, filePath.lastIndexOf('/'));
  if (dirName && !fs.existsSync(dirName)) {
    try {
      fs.mkdirSync(dirName, { recursive: true });
      logToFile(`✅ 创建目录: ${dirName}`, 'INFO');
    } catch (error) {
      logToFile(`❌ 创建目录失败: ${error.message}`, 'ERROR');
    }
  }
};

// 📌 日志记录函数
const logToFile = (message, level = 'INFO') => {
  const timestamp = moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  const logMessage = `[${timestamp}] [${level}] ${message}\r\n`;
  try {
    fs.appendFileSync(errorLogPath, logMessage);
  } catch (error) {
    console.error(`[日志写入失败] ${error.message}`);
  }
};

// 📌 读取 JSON 文件
const readJson = (filePath) => {
  if (!fs.existsSync(filePath)) {
    logToFile(`⚠️ 文件 ${filePath} 不存在`, 'ERROR');
    return [];
  }
  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    logToFile(`⚠️ 解析 ${filePath} 失败: ${error.message}`, 'ERROR');
    return [];
  }
};

// 📌 验证 JSON 数据结构
const validateDataStructure = (data, requiredFields) => {
  return Array.isArray(data) && data.every(entry => requiredFields.every(field => entry[field] !== undefined));
};

// 📌 生成 ICS 事件格式
const generateICSEvent = (date, holidays, jieqi, astro, calendar, shichen) => {
  const formattedDate = moment(date).format('YYYYMMDD');

  // 📌 事件标题
  let summary = new Set();
  holidays.forEach(h => h.date === date && summary.add(h.name));
  jieqi.forEach(j => j.date === date && summary.add(j.term));

  if (summary.size === 0) summary.add('日程提醒');

  // 📌 查找详细信息
  const calendarData = calendar.find(c => c.date === date) || {};
  const astroData = astro.find(a => a.date === date) || {};
  const shichenData = shichen.find(s => s.date === date) || {};
  const jieqiData = jieqi.find(j => j.date === date) || {};

  // 📅 生成描述信息
  const description = [
    `📅 日期: ${date}`,
    calendarData.lunar ? `🌙 农历: ${calendarData.lunar}` : '',
    calendarData.tianGanDiZhi ? `天干地支: ${calendarData.tianGanDiZhi}` : '',
    calendarData.huangLi ? `黄历: ${calendarData.huangLi}` : '',
    jieqiData.term ? `🌾 节气: ${jieqiData.term}` : '',
    astroData.name ? `💫 星座: ${astroData.name} (${astroData.description || ''})` : '',
    shichenData.periods ? `🕒 十二时辰: ${shichenData.periods.map(p => `${p.name} (${p.start}-${p.end})`).join('，')}` : '',
  ].filter(Boolean).join('\\n');

  return `BEGIN:VEVENT\r\nSUMMARY:${[...summary].join('、')}\r\nDTSTART;VALUE=DATE:${formattedDate}\r\nDESCRIPTION:${description}\r\nX-ALT-DESC;FMTTYPE=text/html:${description.replace(/\\n/g, '<br>')}\r\nEND:VEVENT\r\n`;
};

// 📌 生成 ICS 文件
const generateICS = () => {
  ensureDirectoryExists(icsFilePath);

  // 📌 读取所有 JSON 文件
  const data = {};
  for (const [key, path] of Object.entries(paths)) {
    data[key] = readJson(path);
  }

  // 📌 验证数据结构
  const requiredFields = ['date'];
  for (const key of Object.keys(data)) {
    if (!validateDataStructure(data[key], requiredFields)) {
      logToFile(`⚠️ 无效的 ${key}.json 数据结构，无法生成 ICS！`, 'ERROR');
      return;
    }
  }

  // 📌 获取所有日期集合
  const allDates = new Set([
    ...data.holidays.map(h => h.date),
    ...data.jieqi.map(j => j.date),
    ...data.calendar.map(c => c.date),
  ]);

  let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyCalendar//EN\r\nCALSCALE:GREGORIAN\r\n';

  // 📌 生成 ICS 事件
  allDates.forEach(date => {
    icsContent += generateICSEvent(date, data.holidays, data.jieqi, data.astro, data.calendar, data.shichen);
  });

  icsContent += 'END:VCALENDAR\r\n';

  // 📌 写入 ICS 文件
  try {
    fs.writeFileSync(icsFilePath, icsContent);
    logToFile('✅ ICS 日历文件生成成功！', 'INFO');
  } catch (error) {
    logToFile(`❌ 生成 ICS 文件失败: ${error.message}`, 'ERROR');
  }
};

// 📌 执行 ICS 生成
generateICS();