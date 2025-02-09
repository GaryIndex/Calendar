const fs = require('fs');
const path = require('path');

// 日志文件路径
const logFilePath = path.join(__dirname, './data/error.log');

// 确保目录存在
const ensureDirectoryExistence = async (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
};

// 创建日志目录
ensureDirectoryExistence(logFilePath);

/**
 * 记录日志
 * @param {string} type "INFO" | "ERROR"
 * @param {string} message
 */
const writeLog = async (type, message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}\n`;

  try {
    await fs.promises.appendFile(logFilePath, logMessage, 'utf8');
    
    // 动态导入 chalk
    const chalk = (await import('chalk')).default;
    console.log(type === "INFO" ? chalk.green(logMessage.trim()) : chalk.red(logMessage.trim()));
  } catch (err) {
    console.log(`❌ 写入日志失败: ${err.message}`);
  }
};

const logInfo = (message) => writeLog("INFO", message);
const logError = (message) => writeLog("ERROR", message);

// 使用绝对路径从项目根目录开始
const dataPaths = {
  holidays: path.join(process.cwd(), 'data/Document/holidays.json'),
  jieqi: path.join(process.cwd(), 'data/Document/jieqi.json'),
  astro: path.join(process.cwd(), 'data/Document/astro.json'),
  calendar: path.join(process.cwd(), 'data/Document/calendar.json'),
  shichen: path.join(process.cwd(), 'data/Document/shichen.json'),
};

// ICS 文件路径
const icsFilePath = path.join(__dirname, './calendar.ics');

/**
 * 读取 JSON 数据
 * @param {string} filePath
 * @returns {Promise<Object>}
 */
const readJsonData = async (filePath) => {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logError(`❌ 文件不存在: ${filePath}`);
      return {};
    }

    console.log(`📂 读取文件: ${filePath}`);
    logInfo(`📂 读取文件: ${filePath}`);

    const rawData = await fs.promises.readFile(filePath, 'utf-8');
    
    if (!rawData.trim()) {
      logError(`⚠️ 文件 ${filePath} 为空！`);
      return {};
    }

    const data = JSON.parse(rawData);
    logInfo(`✅ 成功解析 JSON: ${filePath}, 数据量: ${Object.keys(data).length}`);
    return data;
  } catch (error) {
    logError(`❌ 读取 JSON 失败: ${filePath} - ${error.message}`);
    return {};
  }
};

/**
 * 处理不同文件类型的数据
 */
const processors = {
  // 处理节气数据
  jieqi: (records, allEvents) => {
    records.Reconstruction?.forEach(item => {
      const date = item.date || item.data?.date;
      if (!date) return;

      allEvents.push({
        date,
        title: item.data?.name,
        startTime: item.data?.time,
        isAllDay: false,
        description: ''
      });
    });
  },

  // 处理时辰数据
  shichen: (records, allEvents) => {
    records.Reconstruction?.forEach(recon => {
      recon.data?.forEach(entry => {
        const descParts = [
          `${entry.date} ${entry.hours}`,
          entry.hour,
          entry.yi !== '无' ? entry.yi : null,
          entry.ji,
          entry.chong,
          entry.sha,
          entry.nayin,
          entry.jiuxing
        ].filter(Boolean).join(' ');

        allEvents.push({
          date: entry.date,
          title: '时辰信息',
          isAllDay: true,
          description: descParts
        });
      });
    });
  },
/*
  // 处理节假日数据
  holidays: (records, allEvents) => {
    records.Reconstruction?.forEach(item => {
      const descParts = Object.entries(item.data)
        .filter(([k]) => !['date', 'name', 'isOffDay'].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');

      allEvents.push({
        date: item.date,
        title: `${item.data?.isOffDay ? '[休]' : '[班]'} ${item.data?.name}`,
        isAllDay: true,
        description: descParts
      });
    });
  },
  */

// 处理节假日数据
holidays: (records, allEvents) => {
  records.Reconstruction?.forEach(item => {
    const descParts = item.data ? 
      Object.entries(item.data)
        .filter(([k]) => !['date', 'name', 'isOffDay'].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ') : '';

    allEvents.push({
      date: item.date,
      title: `${item.data?.isOffDay ? '[休]' : '[班]'} ${item.data?.name}`,
      isAllDay: true,
      description: descParts
    });
  });
},

  // 处理带data数组的通用数据
  common: (records, allEvents, fileKey) => {
    records.Reconstruction?.forEach(recon => {
      recon.data?.forEach(entry => {
        const descParts = [
          entry.name,
          entry.range,
          entry.zxtd
        ].filter(Boolean).join(' ');

        allEvents.push({
          date: entry.date,
          title: fileKey.toUpperCase(),
          isAllDay: true,
          description: descParts
        });
      });
    });
  }
};

/**
 * 生成ICS事件内容
 */
const generateICSEvent = (event) => {
  let dtstart;
  if (event.isAllDay) {
    dtstart = `DTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}`;
  } else {
    const dateObj = new Date(event.startTime);
    const formattedDate = [
      dateObj.getUTCFullYear(),
      String(dateObj.getUTCMonth() + 1).padStart(2, '0'),
      String(dateObj.getUTCDate()).padStart(2, '0')
    ].join('');
    dtstart = `DTSTART;VALUE=DATE:${formattedDate}`;
  }

  return [
    'BEGIN:VEVENT',
    dtstart,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    'END:VEVENT'
  ].join('\r\n');
};

/**
 * 生成ICS日历文件
 */
const generateICS = async () => {
  const allEvents = [];

  // 并行处理所有数据文件
  await Promise.all(Object.entries(dataPaths).map(async ([fileKey, filePath]) => {
    const jsonData = await readJsonData(path.resolve(__dirname, filePath));
    
    Object.values(jsonData).forEach(records => {
      if (fileKey === 'jieqi') processors.jieqi(records, allEvents);
      else if (fileKey === 'shichen') processors.shichen(records, allEvents);
      else if (fileKey === 'holidays') processors.holidays(records, allEvents);
      else processors.common(records, allEvents, fileKey);
    });
  }));

  // 生成ICS内容
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chinese Calendar//EN',
    'CALSCALE:GREGORIAN',
    ...allEvents.map(event => generateICSEvent(event)),
    'END:VCALENDAR'
  ].join('\r\n');

  try {
    await fs.promises.writeFile(icsFilePath, icsContent);
    logInfo(`✅ ICS文件生成成功！共包含 ${allEvents.length} 个事件`);
  } catch (error) {
    logError(`❌ 写入ICS文件失败: ${error.message}`);
  }
};

// 运行生成器
generateICS();