const fs = require('fs');
const moment = require('moment-timezone');

// 文件路径
const holidayPath = './data/holidays.json';
const jieqiPath = './data/jieqi.json';
const astroPath = './data/astro.json';
const calendarPath = './data/calendar.json';
const shichenPath = './data/shichen.json';
const icsFilePath = './calendar.ics';
const errorLogPath = './data/error.log';

// 确保目录存在
const ensureDirectoryExists = (filePath) => {
  const dirName = filePath.substring(0, filePath.lastIndexOf('/'));
  if (dirName && !fs.existsSync(dirName)) {
    try {
      fs.mkdirSync(dirName, { recursive: true });
      logToFile(`✅ 创建目录: ${dirName}`);
    } catch (error) {
      const message = `❌ 创建目录失败: ${error.message}`;
      console.error(message);
      logToFile(message);
    }
  }
};

// 日志记录函数
const logToFile = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  try {
    fs.appendFileSync(errorLogPath, logMessage);
  } catch (error) {
    console.error(`❌ 日志写入失败: ${error.message}`);
  }
};

// 读取 JSON 文件
const readJson = (filePath) => {
  if (!fs.existsSync(filePath)) {
    const message = `⚠️ 文件 ${filePath} 不存在，无法读取！`;
    console.error(message);
    logToFile(message);
    return null;
  }
  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    const message = `⚠️ 解析 ${filePath} 失败: ${error.message}`;
    console.error(message);
    logToFile(message);
    return null;
  }
};

// 验证数据结构
const validateDataStructure = (data, expectedStructure) => {
  if (!Array.isArray(data)) return false;
  return data.every(entry => {
    return expectedStructure.every(field => entry[field]);
  });
};

// 生成 ICS 事件格式
const generateICSEvent = (entry, holidays, jieqi, astro, calendar, shichen) => {
  const date = moment(entry.date).format('YYYYMMDD');

  // 处理标题（假期、节气、补班）
  let summary = [];
  const holidayNames = holidays.filter(h => h.date === entry.date).map(h => h.name);
  if (holidayNames.length > 0) summary.push(holidayNames.join('、'));

  const jieqiTerm = jieqi.find(j => j.date === entry.date)?.term;
  if (jieqiTerm) summary.push(jieqiTerm);

  if (summary.length === 0) {
    summary.push('日程提醒');
  }

  // 处理详细描述
  const calendarData = calendar.find(c => c.date === entry.date);
  const astroData = astro.find(a => a.date === entry.date);
  const shichenData = shichen.find(s => s.date === entry.date);

  const description = [
    `📅 日期: ${entry.date}`,
    `🌙 农历: ${calendarData?.lunar || ''}`,
    `💫 星座: ${astroData?.name || ''} (${astroData?.description || ''})`,
    `🕒 十二时辰: ${shichenData?.periods.map(p => `${p.name} (${p.start}-${p.end})`).join('，') || ''}`,
    holidayNames.length > 0 ? `🏖️ 假期: ${holidayNames.join('，')}` : '',
    jieqiTerm ? `☀️ 节气: ${jieqiTerm}` : '',
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

  // 读取所有 JSON 文件
  const holidays = readJson(holidayPath);
  const jieqi = readJson(jieqiPath);
  const astro = readJson(astroPath);
  const calendar = readJson(calendarPath);
  const shichen = readJson(shichenPath);

  // 验证数据结构
  const expectedFields = ['date'];
  if (!holidays || !validateDataStructure(holidays, expectedFields) ||
      !jieqi || !validateDataStructure(jieqi, expectedFields) ||
      !astro || !validateDataStructure(astro, expectedFields) ||
      !calendar || !validateDataStructure(calendar, expectedFields) ||
      !shichen || !validateDataStructure(shichen, expectedFields)) {
    console.error('⚠️ 无效的 JSON 数据，无法生成 ICS！');
    logToFile('⚠️ 无效的 JSON 数据，无法生成 ICS！');
    return;
  }

  let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MyCalendar//EN\nCALSCALE:GREGORIAN\n';

  // 生成 ICS 事件
  holidays.forEach((entry) => {
    icsContent += generateICSEvent(entry, holidays, jieqi, astro, calendar, shichen);
  });

  icsContent += '\nEND:VCALENDAR';

  try {
    fs.writeFileSync(icsFilePath, icsContent);
    console.log('✅ ICS 日历文件生成成功！');
    logToFile('✅ ICS 日历文件生成成功！');
  } catch (error) {
    const message = `❌ 生成 ICS 文件失败: ${error.message}`;
    console.error(message);
    logToFile(message);
  }
};

// 运行生成 ICS 文件的函数
generateICS();