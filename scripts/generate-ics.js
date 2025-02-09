/*import path from 'path';
import chalk from 'chalk';
import fs from 'fs';

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
*/
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fs from 'fs';

// 计算 __dirname（ESM 方式）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
await ensureDirectoryExistence(logFilePath);

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
      item.data?.forEach(event => {
        const time = event.time;
        if (!time) {
          logError(`❌ 节气数据缺少时间: ${JSON.stringify(event)}`);
          return;
        }
        const date = time.split(' ')[0];
        const description = `节气: ${event.name}`;

        allEvents.push({
          date,
          title: event.name,
          startTime: time,
          isAllDay: false,
          description,
        });
      });
    });
  },

  // 处理时辰数据
  shichen: (records, allEvents) => {
    records.Reconstruction?.forEach(recon => {
      if (Array.isArray(recon.data)) {
        recon.data.forEach(entry => {
          const descParts = [
            `${entry.date} ${entry.hours}`,
            entry.yi !== '无' ? entry.yi : null,
            entry.ji,
            entry.chong,
            entry.sha,
            entry.nayin,
            entry.jiuxing
          ].filter(Boolean).join(' ');

          allEvents.push({
            date: entry.date,
            title: entry.hour,
            isAllDay: true,
            description: descParts
          });
        });
      } else {
        logError(`⚠️ recon.data 不是数组: ${JSON.stringify(recon.data)}`);
      }
    });
  },

  // 处理节假日数据
  holidays: (records, allEvents) => {
    records.Reconstruction?.forEach(item => {
      Object.entries(item).forEach(([key, holiday]) => {
        const { date, name, isOffDay } = holiday;

        if (!date || !name || isOffDay === undefined) {
          logError(`❌ 节假日数据缺失关键字段: ${JSON.stringify(holiday)}`);
          return;
        }

        const descParts = Object.entries(holiday)
          .filter(([k]) => !['date', 'name', 'isOffDay'].includes(k))
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');

        allEvents.push({
          date,
          title: `${isOffDay ? '[休]' : '[班]'} ${name}`,
          isAllDay: true,
          description: descParts
        });
      });
    });
  },

  // 处理通用数据
  common: (records, allEvents, fileKey) => {
    records.Reconstruction?.forEach(entry => {
      const { date, name, range, zxtd, lunar = {}, almanac = {} } = entry;
      const { cnYear, cnMonth, cnDay, cyclicalYear, cyclicalMonth, cyclicalDay, zodiac } = lunar;
      const { yi, ji, chong, sha, jishenfangwei } = almanac;

      const jishenfangweiStr = jishenfangwei 
        ? Object.entries(jishenfangwei).map(([key, value]) => `${key}: ${value}`).join(' ')
        : '';

      const descParts = [
        name, range, zxtd,
        `农历: ${cnYear}年 ${cnMonth}${cnDay} (${cyclicalYear}年 ${cyclicalMonth}月 ${cyclicalDay}日) ${zodiac}年`,
        `宜: ${yi}`, `忌: ${ji}`, `冲: ${chong}`, `煞: ${sha}`,
        `吉神方位: ${jishenfangweiStr}`
      ].filter(Boolean).join(' | ');

      allEvents.push({
        date,
        title: fileKey.toUpperCase(),
        isAllDay: true,
        description: descParts
      });
    });
  }
};

/**
 * 生成ICS文件
 */
const generateICS = async () => {
  const allEvents = [];

  await Promise.all(Object.entries(dataPaths).map(async ([fileKey, filePath]) => {
    const jsonData = await readJsonData(filePath);
    Object.values(jsonData).forEach(records => {
      processors[fileKey] ? processors[fileKey](records, allEvents) : processors.common(records, allEvents, fileKey);
    });
  }));
/*
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...allEvents.map(event => `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}\r\nSUMMARY:${event.title}\r\nDESCRIPTION:${event.description}\r\nEND:VEVENT`),
    'END:VCALENDAR'
  ].join('\r\n');
  */
const icsContent = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  ...allEvents.map(event => {
    // 如果 event.date 为 undefined 或为空，跳过此事件
    if (!event.date) {
      logError(`❌ 无效事件日期: ${JSON.stringify(event)}`);
      return ''; // 返回空字符串，避免生成无效事件
    }

    return `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}\r\nSUMMARY:${event.title}\r\nDESCRIPTION:${event.description}\r\nEND:VEVENT`;
  }).filter(Boolean), // 过滤掉空字符串
  'END:VCALENDAR'
].join('\r\n');

  await fs.promises.writeFile(icsFilePath, icsContent, 'utf-8');
  logInfo(`✅ 生成 ICS 文件: ${icsFilePath}`);
};

// 运行 ICS 生成
generateICS();