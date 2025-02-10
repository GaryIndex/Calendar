import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fs from 'fs';

// 计算 __dirname（ESM 方式）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 日志文件路径
const logFilePath = path.join(__dirname, './data/error.log');

// **确保目录存在**
const ensureDirectoryExistence = async (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
    logInfo(`📂 目录创建成功: ${dir}`);
  }
};

// **日志记录函数**
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

// **初始化日志目录**
await ensureDirectoryExistence(logFilePath);
logInfo('📂 日志目录已初始化');

// **JSON 文件路径**
const dataPaths = {
  holidays: path.join(process.cwd(), 'data/Document/holidays.json'),
  jieqi: path.join(process.cwd(), 'data/Document/jieqi.json'),
  astro: path.join(process.cwd(), 'data/Document/astro.json'),
  calendar: path.join(process.cwd(), 'data/Document/calendar.json'),
  shichen: path.join(process.cwd(), 'data/Document/shichen.json'),
};

// **ICS 文件路径**
const icsFilePath = path.join(__dirname, '../calendar.ics');

// **创建事件对象**
export function createEvent({
  date,
  title,
  location = "",
  isAllDay = false,
  startTime = "",
  endTime = "",
  travelTime = "",
  repeat = "",
  alarm = "",
  attachment = "",
  url = "",
  badge = "",
  description,
  priority = 0 
}) {
  return {
    date,
    title,
    location,
    isAllDay,
    startTime,
    endTime,
    travelTime,
    repeat,
    alarm,
    attachment,
    url,
    badge,
    description,
    priority
  };
}

/**
 * **读取 JSON 数据**
 * @param {string} filePath - JSON 文件路径
 * @returns {Promise<Object>}
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
 * **数据处理器**
 */
// 处理节假日数据
const processors = {
  holidays: (records, allEvents) => {
    logInfo("🛠️ 开始处理节假日数据");
    
    if (Array.isArray(records.Reconstruction)) {
      records.Reconstruction.forEach(item => {
        logInfo(`处理节假日条目: ${JSON.stringify(item)}`);
        
        Object.entries(item).forEach(([key, holiday]) => {
          logInfo(`处理节假日数据: ${JSON.stringify(holiday)}`);
          
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
      logInfo("✅ 节假日数据处理完成");
    } else {
      logError(`❌ records.Reconstruction 不是一个数组: ${JSON.stringify(records.Reconstruction)}`);
    }
  },
  jieqi: (records, allEvents) => {
    logInfo("🛠️ 处理节气数据...");
    if (Array.isArray(records.Reconstruction)) {
      records.Reconstruction.forEach(item => {
        logInfo(`处理节气条目: ${JSON.stringify(item)}`);
        item.data?.forEach(event => {
          logInfo(`处理节气事件: ${JSON.stringify(event)}`);
          if (!event.time) return;
          const date = event.time.split(' ')[0];
          allEvents.push(createEvent({
            date,
            title: event.name,
            startTime: event.time,
            isAllDay: false,
            description: `节气: ${event.name}`
          }));
        });
      });
      logInfo("✅ 节气数据处理完成");
    } else {
      logError(`❌ records.Reconstruction 不是一个数组: ${JSON.stringify(records.Reconstruction)}`);
    }
  },
  astro: (records, allEvents) => {
  logInfo("🛠️ 处理天文数据...");
  // 遍历每个 Reconstruction 项
  records.Reconstruction?.forEach(entry => {
    logInfo(`处理天文数据条目: ${JSON.stringify(entry)}`);
    // 检查是否有 data 和 range
    if (entry.data && entry.data.range) {
      const [start, end] = entry.data.range.split("-").map(date => `2025-${date.replace(".", "-")}`);
      logInfo(`解析时间范围: ${start} - ${end}`);
      let currentDate = new Date(start);
      while (currentDate <= new Date(end)) {
        logInfo(`生成日期: ${currentDate.toISOString().split("T")[0]}`);
        allEvents.push(createEvent({
          date: currentDate.toISOString().split("T")[0],
          title: entry.data.name, // 使用 entry.data.name 获取星座名称
          isAllDay: true,
          description: JSON.stringify(entry.data)
        }));
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      logInfo("跳过条目，缺少 data 或 range");
    }
  });
  logInfo("✅ 天文数据处理完成");
},
shichen: (records, allEvents) => {
  logInfo("🛠️ 处理时辰数据...");
  // 遍历每个 Reconstruction 项
  records.Reconstruction?.forEach(recon => {
    logInfo(`处理时辰数据条目: ${JSON.stringify(recon)}`);
    recon.data?.forEach(entry => {
      logInfo(`处理时辰条目: ${JSON.stringify(entry)}`);
      allEvents.push(createEvent({
        date: entry.date,
        title: entry.hour,
        isAllDay: true,
        description: JSON.stringify(entry)
      }));
    });
  });
  logInfo("✅ 时辰数据处理完成");
},
calendar: (records, allEvents) => {
  logInfo("🛠️ 处理万年历数据...");
  
  // 遍历每个日期项
  Object.entries(records).forEach(([date, data]) => {
    logInfo(`处理万年历日期: ${date}`);
    
    data.Reconstruction?.forEach(entry => {
      logInfo(`处理万年历条目: ${JSON.stringify(entry)}`);
      
      allEvents.push(createEvent({
        date,
        title: entry.festivals || "万年历信息", // 使用 festivals 作为标题
        isAllDay: true,
        description: JSON.stringify(entry)
      }));
    });
  });
  logInfo("✅ 万年历数据处理完成");
}
};

export default processors;

/**
 * **生成 ICS 文件**
 */
const generateICS = async (events) => {
  const icsData = events.map(event => `
BEGIN:VEVENT
SUMMARY:${event.title}
DTSTART:${event.date.replace(/-/g, '')}T${event.startTime ? event.startTime.replace(/:/g, '') + '00' : '000000'}
DTEND:${event.date.replace(/-/g, '')}T${event.endTime ? event.endTime.replace(/:/g, '') + '00' : '235959'}
DESCRIPTION:${event.description}
END:VEVENT`).join("\n");

  await fs.promises.writeFile(icsFilePath, `BEGIN:VCALENDAR\nVERSION:2.0\n${icsData}\nEND:VCALENDAR`);
  logInfo(`✅ ICS 文件生成成功: ${icsFilePath}`);
};

// **执行流程**
(async () => {
  const allEvents = [];
  const [holidays, jieqi, astro, shichen, calendar] = await Promise.all(Object.values(dataPaths).map(readJsonData));
  Object.values(processors).forEach(fn => fn({ Reconstruction: holidays }, allEvents));
  await generateICS(allEvents);
})();