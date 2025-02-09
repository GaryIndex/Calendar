import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fs from 'fs';

// 计算 __dirname（ESM 方式）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 日志文件路径
const logFilePath = path.join(__dirname, './data/error.log');

/**
 * 确保目录存在
 * @param {string} filePath - 目标文件路径
 */
const ensureDirectoryExistence = async (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
};

// **不能直接使用 await**，所以封装一个 `initLogDir` 函数
const initLogDir = async () => {
  await ensureDirectoryExistence(logFilePath);
};
initLogDir();

/**
 * 记录日志
 * @param {string} type "INFO" | "ERROR"
 * @param {string} message - 记录的消息
 */
const writeLog = async (type, message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}\n`;

  try {
    await fs.promises.appendFile(logFilePath, logMessage, 'utf8');
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
 * @param {string} filePath - JSON 文件路径
 * @returns {Promise<Object>} - 解析后的 JSON 对象
 */
const readJsonData = async (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      logError(`❌ 文件不存在: ${filePath}`);
      return {};
    }

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

        allEvents.push({
          date,
          title: event.name,
          isAllDay: false,
          description: `节气: ${event.name}`,
        });
      });
    });
  },

  // 处理时辰数据
  shichen: (records, allEvents) => {
    records.Reconstruction?.forEach(recon => {
      if (Array.isArray(recon.data)) {
        recon.data.forEach(entry => {
          allEvents.push({
            date: entry.date,
            title: entry.hour,
            isAllDay: true,
            description: `${entry.date} ${entry.hours} | ${entry.yi || ''} | ${entry.ji || ''}`,
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
          logError(`❌ 节假日数据缺失字段: ${JSON.stringify(holiday)}`);
          return;
        }

        allEvents.push({
          date,
          title: `${isOffDay ? '[休]' : '[班]'} ${name}`,
          isAllDay: true,
          description: `类型: ${isOffDay ? '休息日' : '工作日'}`,
        });
      });
    });
  },

  // 处理通用数据
  common: (records, allEvents, fileKey) => {
    records.Reconstruction?.forEach(entry => {
      if (!entry.date) {
        logError(`❌ 缺少日期: ${JSON.stringify(entry)}`);
        return;
      }
      allEvents.push({
        date: entry.date,
        title: fileKey.toUpperCase(),
        isAllDay: true,
        description: `信息: ${JSON.stringify(entry)}`,
      });
    });
  }
};

/**
 * 生成 ICS 文件
 */
const generateICS = async () => {
  const allEvents = [];

  // 读取所有 JSON 数据
  await Promise.all(Object.entries(dataPaths).map(async ([fileKey, filePath]) => {
    const jsonData = await readJsonData(filePath);

    // 遍历 JSON 数据并转换为事件
    Object.values(jsonData).forEach(records => {
      if (processors[fileKey]) {
        processors[fileKey](records, allEvents);
      } else {
        processors.common(records, allEvents, fileKey);
      }
    });
  }));

  logInfo(`📌 事件总数: ${allEvents.length}`);

  if (allEvents.length === 0) {
    logError("⚠️ 没有可写入的事件，ICS 文件将为空！");
    return;
  }

  // 生成 ICS 内容
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...allEvents.filter(event => event.date).map(event =>
      `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}\r\nSUMMARY:${event.title}\r\nDESCRIPTION:${event.description}\r\nEND:VEVENT`
    ),
    'END:VCALENDAR'
  ].join('\r\n');

  logInfo(`📂 生成 ICS 内容:\n${icsContent}`);

  // 写入 ICS 文件
  await fs.promises.writeFile(icsFilePath, icsContent, 'utf-8');
  logInfo(`✅ ICS 文件生成成功: ${icsFilePath}`);
};

// 运行 ICS 生成
generateICS();