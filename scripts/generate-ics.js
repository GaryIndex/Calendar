const fs = require('fs');
const moment = require('moment-timezone');

// 📌 文件路径
const dataDir = './data/Document';
const holidayPath = `${dataDir}/holidays.json`;
const jieqiPath = `${dataDir}/jieqi.json`;
const astroPath = `${dataDir}/astro.json`;
const calendarPath = `${dataDir}/calendar.json`;
const shichenPath = `${dataDir}/shichen.json`;
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
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;
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
    return null;  // 返回 null 而非空数组，更加明确地表示文件不存在
  }
  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    logToFile(`⚠️ 解析 ${filePath} 失败: ${error.message}`, 'ERROR');
    return null;
  }
};

// 📌 验证 JSON 数据结构
const validateDataStructure = (data, requiredFields) => {
  if (!Array.isArray(data)) return false;
  return data.every(entry => requiredFields.every(field => entry.hasOwnProperty(field)));
};

// 📌 生成 ICS 事件格式
const generateICSEvent = (entry, holidays, jieqi, astro, calendar, shichen) => {
  const date = moment(entry.date).format('YYYYMMDD');

  // 📌 处理标题（假期、节气、补班）
  let summary = new Set();
  holidays.forEach(h => h.date === entry.date && summary.add(h.name));
  jieqi.forEach(j => j.date === entry.date && summary.add(j.term));

  if (summary.size === 0) summary.add('日程提醒');

  // 📌 处理详细描述
  const calendarData = calendar.find(c => c.date === entry.date) || {};
  const astroData = astro.find(a => a.date === entry.date) || {};
  const shichenData = shichen.find(s => s.date === entry.date) || {};
  const jieqiData = jieqi.find(j => j.date === entry.date) || {};

  // 🏮 解析万年历（农历）信息
  const lunar = calendarData.lunar || '暂无农历';
  const tianGanDiZhi = calendarData.tianGanDiZhi || '暂无天干地支';
  const huangLi = calendarData.huangLi || '暂无黄历信息';

  // 📅 生成描述信息
  const description = [
    `📅 日期: ${entry.date}`,
    lunar ? `🌙 农历: ${lunar}` : '',
    tianGanDiZhi ? `天干地支: ${tianGanDiZhi}` : '',
    huangLi ? `黄历: ${huangLi}` : '',
    jieqiData.term ? `🌾 节气: ${jieqiData.term}` : '',
    astroData.name ? `💫 星座: ${astroData.name} (${astroData.description || ''})` : '',
    shichenData.periods ? `🕒 十二时辰: ${shichenData.periods.map(p => `${p.name} (${p.start}-${p.end})`).join('，')}` : '',
  ].filter(Boolean).join('\\n');

  return `
BEGIN:VEVENT
SUMMARY:${[...summary].join('、')}
DTSTART;VALUE=DATE:${date}
DESCRIPTION:${description}
X-ALT-DESC;FMTTYPE=text/html:${description.replace(/\\n/g, '<br>')}
END:VEVENT
  `;
};

// 📌 生成 ICS 文件
const generateICS = () => {
  // 确保目录存在
  ensureDirectoryExists(icsFilePath);

  // 📌 读取所有 JSON 文件
  const holidays = readJson(holidayPath);
  const jieqi = readJson(jieqiPath);
  const astro = readJson(astroPath);
  const calendar = readJson(calendarPath);
  const shichen = readJson(shichenPath);

  // 📌 如果有任何文件不存在或解析失败，停止生成 ICS
  if (![holidays, jieqi, astro, calendar, shichen].every(data => data !== null)) {
    logToFile('⚠️ 必要的 JSON 文件缺失或解析失败，无法生成 ICS！', 'ERROR');
    return;
  }

  // 📌 验证数据结构
  const requiredFields = ['date'];
  if (![holidays, jieqi, astro, calendar, shichen].every(data => validateDataStructure(data, requiredFields))) {
    logToFile('⚠️ 无效的 JSON 数据，无法生成 ICS！', 'ERROR');
    return;
  }

  let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MyCalendar//EN\nCALSCALE:GREGORIAN\n';

  // 📌 生成 ICS 事件
  holidays.forEach(entry => {
    icsContent += generateICSEvent(entry, holidays, jieqi, astro, calendar, shichen);
  });

  icsContent += '\nEND:VCALENDAR';

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