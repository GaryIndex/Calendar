import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fs from 'fs';
// utils.js
//import fs from 'fs';
//import path from 'path';
export const ensureDirExists = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};
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
    logInfo(`📂 确保目录存在: ${dir}`);
  }
};

// **不能直接使用 await**，所以封装一个 `initLogDir` 函数
const initLogDir = async () => {
  await ensureDirectoryExistence(logFilePath);
  logInfo('📂 初始化日志目录');
};
initLogDir();

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
const icsFilePath = path.join(__dirname, '../calendar.ics');

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
import { createEvent } from '../scripts/createEvent/createEvent.js';
const processors = {
  // 处理节气数据
  jieqi: (records, allEvents) => {
    logInfo("🛠️ 开始处理节气数据");
    records.Reconstruction?.forEach(item => {
      item.data?.forEach(event => {
        const time = event.time; 
        if (!time) {
          logError(`❌ 节气数据缺少时间: ${JSON.stringify(event)}`);
          return;
        }
        const [date, startTime] = time.split(' ');
        const description = `节气: ${event.name}`;
        allEvents.push(
          createEvent({
            date,                // 日期 YYYY-MM-DD
            title: event.name,   // 标题 = 节气名称
            isAllDay: false,     // 节气事件带有具体时间，因此非全天
            startTime,           // 开始时间 HH:mm:ss
            description          // 备注：节气信息
          })
        );
      });
    });
    logInfo("✅ 节气数据处理完成");
  }
},
//export default processors;
// 处理时辰数据
const shichen: (records, allEvents) => {
  logInfo("🛠️ 开始处理时辰数据");
  records.Reconstruction?.forEach(recon => {
    if (Array.isArray(recon.data)) {
      recon.data.forEach(entry => {
        const hours = entry.hours;
        const hourRange = hours.split('-');
        // 判断时间范围是否合法
        if (hourRange.length !== 2) {
          logError(`❌ 时辰数据时间格式无效: ${JSON.stringify(entry)}`);
          return;
        }
        const startTime = hourRange[0];  // 开始时间
        const endTime = hourRange[1];    // 结束时间
        const hourTitle = entry.hour;    // 事件标题（时辰）
        // 组装描述信息
        const descriptionParts = [
          entry.yi ? `宜: ${entry.yi}` : null,
          entry.ji ? `忌: ${entry.ji}` : null,
          entry.chong ? `冲: ${entry.chong}` : null,
          entry.sha ? `煞: ${entry.sha}` : null,
          entry.nayin ? `纳音: ${entry.nayin}` : null,
          entry.jiuxing ? `九星: ${entry.jiuxing}` : null
        ].filter(Boolean).join(' | ');

        // 使用 createEvent 封装
        allEvents.push(createEvent({
          date: entry.date,
          title: hourTitle,
          isAllDay: false,
          startTime,
          endTime,
          description: descriptionParts
        }));
      });
    } else {
      logError(`⚠️ recon.data 不是数组: ${JSON.stringify(recon.data)}`);
    }
  });
  logInfo("✅ 时辰数据处理完成");
},
// 处理节假日数据
holidays: (records, allEvents) => {
  logInfo("🛠️ 开始处理节假日数据");
  records.Reconstruction?.forEach(item => {
    Object.entries(item).forEach(([key, holiday]) => {
      const { date, name, isOffDay } = holiday;
      if (!date || !name || isOffDay === undefined) {
        logError(`❌ 节假日数据缺失关键字段: ${JSON.stringify(holiday)}`);
        return;
      }
      // 组装描述信息，排除 `date`, `name`, `isOffDay`
      const description = Object.entries(holiday)
        .filter(([k]) => !['date', 'name', 'isOffDay'].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
      // 生成角标（休 or 班）
      const badge = isOffDay ? "休" : "班";
      // 使用 createEvent 封装
      allEvents.push(createEvent({
        date,
        title: name,                  // 事件标题 = 节假日名称
        isAllDay: true,               // 节假日是全天事件
        badge,                        // 角标，表示休息或上班
        description                   // 备注信息
      }));
    });
  });
  logInfo("✅ 节假日数据处理完成");
},
// 处理天文数据 (astro.json)
astro: (records, allEvents) => {
  logInfo("🛠️ 开始处理天文数据");
  records.Reconstruction?.forEach(entry => {
    if (!entry.data || !entry.data.range) {
      logError(`❌ astro.json 缺少有效数据: ${JSON.stringify(entry)}`);
      return;
    }
    const { data } = entry;
    const year = new Date().getFullYear(); // 获取当前年份
    // 解析 range 字段，提取起止日期
    const [start, end] = data.range.split("-").map(date => `${year}-${date.replace(".", "-")}`);
    // 提取其他所有字段值作为描述
    const description = Object.entries(data)
      .filter(([key]) => key !== "range") // 过滤掉 range
      .map(([_, value]) => (typeof value === "object" ? JSON.stringify(value) : value))
      .join(" | "); // 使用 `|` 作为分隔符
    // 计算日期范围
    let currentDate = new Date(start);
    const endDate = new Date(end);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0]; // 格式化 YYYY-MM-DD
      // 使用 `createEvent` 统一封装
      allEvents.push(createEvent({
        date: dateStr,
        title: "",           // 不设置标题
        isAllDay: true,      // 全天事件
        description          // 备注信息
      }));

      // 日期 +1 天
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  logInfo("✅ 天文数据处理完成");
},
// 处理 calendar.json
calendar: (records, allEvents) => {
  logInfo("🛠️ 开始处理日历数据");

  Object.entries(records).forEach(([date, record]) => {
    record.Reconstruction?.forEach(entry => {
      if (!entry.data) {
        logError(`❌ calendar.json 缺少有效数据: ${JSON.stringify(entry)}`);
        return;
      }

      const { data } = entry;

      // 提取标题
      const title = extractTitle(data);

      // 提取备注
      const description = extractDescription(data);

      // 生成事件对象
      allEvents.push(createEvent(date, title, description));
    });
  });

  logInfo("✅ 日历数据处理完成");
};

/**
 * 提取事件标题（festival）
 * @param {Object} data - 日历数据
 * @returns {string} 标题
 */
function extractTitle(data) {
  return (data.festivals && data.festivals.length > 0) ? data.festivals.join(", ") : "";
}

/**
 * 提取事件描述（备注）
 * @param {Object} data - 日历数据
 * @returns {string} 备注
 */
function extractDescription(data) {
  const extractFields = ["data", "lunar", "almanac", "jishenfangwei"];
  const values = extractFields.flatMap(field => data[field] ? Object.values(data[field]) : []);

  // 提取特定字段，顺序不能变
  ["liuyao", "jiuxing", "taisui"].forEach(key => {
    if (data.almanac?.[key]) values.push(data.almanac[key]);
  });

  // 处理 pengzubaiji（数组用 `, ` 连接）
  if (Array.isArray(data.almanac?.pengzubaiji)) {
    values.push(data.almanac.pengzubaiji.join(", ")); 
  }

  // 转换并用 `|` 连接
  return values
    .map(value => (typeof value === "object" ? JSON.stringify(value) : value))
    .join(" | ");
}

/**
 * 创建事件对象
 * @param {string} date - 事件日期
 * @param {string} title - 事件标题
 * @param {string} description - 事件描述
 * @returns {Object} 事件对象
 */
function createEvent(date, title, description) {
  return {
    date,
    title,
    isAllDay: true,
    description
  };
}
export default processors;
/**
 * 生成 ICS 文件
 */
const generateICS = async () => {
  const allEvents = [];
  const ensureEventDefaults = (event) => ({
    title: event.title || '',
    location: event.location || '',
    isAllDay: event.isAllDay ?? false,  // 默认为 false
    startTime: event.startTime || '',
    endTime: event.endTime || '',
    travelTime: event.travelTime || '',
    repeat: event.repeat || '',
    alarm: event.alarm || '',
    attachment: event.attachment || '',
    url: event.url || '',
    description: event.description || '',
});

// 处理 JSON 数据
await Promise.all(Object.entries(dataPaths).map(async ([fileKey, filePath]) => {
    const jsonData = await readJsonData(filePath);
    Object.values(jsonData).forEach(records => {
        if (processors[fileKey]) {
            processors[fileKey](records, allEvents);
        }
    });
}));

// 统一格式化所有事件
allEvents = allEvents.map(ensureEventDefaults);

// ✅ 记录到日志
logInfo(`📌 解析后的所有事件数据: ${JSON.stringify(allEvents, null, 2)}`);
  // 过滤无效事件
  const validEvents = allEvents.filter(event => event.date && event.description);
  if (validEvents.length === 0) {
    logError('❌ 没有有效的事件数据，无法生成 ICS 文件');
    return;
  }
  // 去重，防止相同日期的相同事件重复
const uniqueEvents = new Map();
validEvents.forEach(event => {
  const key = `${event.date}-${event.title}`;
  if (!uniqueEvents.has(key)) {
    uniqueEvents.set(key, event);
  }
});
const deduplicatedEvents = Array.from(uniqueEvents.values());

  // **合并相同日期的事件**
  const mergedEvents = Object.values(validEvents.reduce((acc, event) => {
    const key = event.date + (event.startTime ? `T${event.startTime.replace(/:/g, '')}` : ''); // 确保时间唯一
    if (!acc[key]) {
      acc[key] = { 
        date: event.date, 
        startTime: event.startTime || null, 
        title: event.title ? [event.title] : [], 
        description: event.description ? [event.description] : [] 
      };
    } else {
      if (event.title) acc[key].title.push(event.title);
      if (event.description) acc[key].description.push(event.description);
    }
    return acc;
  }, {})).map(event => ({
    date: event.date,
    startTime: event.startTime, // 可能为空
    title: event.title.join(' '),  // 用空格拼接标题
    description: event.description.join(' | ') // 用 `|` 拼接描述
  }));

  logInfo(`📅 合并后的事件数量: ${mergedEvents.length}`);
  mergedEvents.forEach(event => {
    logInfo(`📝 事件详情: 日期 - ${event.date}, 时间 - ${event.startTime || '全天'}, 标题 - ${event.title}, 备注 - ${event.description}`);
  });

  // 生成 ICS 内容
  const icsEvents = mergedEvents.map(event => {
    if (!event.date) {
        console.error(`❌ 缺少日期:`, event);
        return ''; // 跳过无效数据
    }

    const [year, month, day] = event.date.split('-').map(Number);

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
        console.error(`❌ 无效的日期格式: ${event.date}`);
        return ''; // 跳过错误数据
    }

    const dateFormatted = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    let dtstart = '', dtend = '';

    if (event.startTime) {
        // 解析时间
        const timeParts = event.startTime.split(':').map(Number);
        if (timeParts.length !== 3 || timeParts.some(isNaN)) {
            console.error(`❌ 无效的时间格式: ${event.startTime}`);
            return ''; // 跳过错误数据
        }

        const [hour, minute, second] = timeParts;
        const timeFormatted = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}${String(second).padStart(2, '0')}`;

        // 计算 +1 小时的结束时间
        const endTime = new Date(year, month - 1, day, hour + 1, minute, second);
        const endTimeFormatted = [
            String(endTime.getHours()).padStart(2, '0'),
            String(endTime.getMinutes()).padStart(2, '0'),
            String(endTime.getSeconds()).padStart(2, '0')
        ].join('');

        dtstart = `DTSTART;TZID=Asia/Shanghai:${dateFormatted}T${timeFormatted}`;
        dtend = `DTEND;TZID=Asia/Shanghai:${dateFormatted}T${endTimeFormatted}`;
    } else {
        // 全天事件
        const nextDay = new Date(year, month - 1, day + 1);
        const nextDateFormatted = `${nextDay.getFullYear()}${String(nextDay.getMonth() + 1).padStart(2, '0')}${String(nextDay.getDate()).padStart(2, '0')}`;
        
        dtstart = `DTSTART;VALUE=DATE:${dateFormatted}`;
        dtend = `DTEND;VALUE=DATE:${nextDateFormatted}`; // 全天事件加 DTEND
    }

    // 设置默认标题，避免空值
    const title = event.title && event.title.trim() ? event.title : '无标题';
    const description = event.description && event.description.trim() ? `DESCRIPTION:${event.description}` : '';

    return [
        'BEGIN:VEVENT',
        dtstart,
        dtend,
        `SUMMARY:${title}`,  // 确保标题存在
        description,          // 仅在有值时添加
        'END:VEVENT'
    ].filter(Boolean).join('\r\n'); // 过滤空字段
}).filter(Boolean); // 过滤无效数据

const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...icsEvents, // 确保不会重复添加
    'END:VCALENDAR'
].join('\r\n'); // 确保换行正确

console.log(icsContent); // 调试输出，检查 ICS 生成是否正确

  // ✅ 确保目录存在
  ensureDirExists(icsFilePath);

  // ✅ 记录目标 ICS 文件路径
  logInfo(`📂 目标 ICS 文件路径: ${path.resolve(icsFilePath)}`);

  // ✅ 使用同步写入，确保数据写入成功
  try {
    fs.writeFileSync(icsFilePath, icsContent, 'utf8');
    logInfo(`✅ ICS 文件同步写入成功: ${icsFilePath}`);

    // ✅ 读取 `.ics` 文件，确保写入正确
    if (fs.existsSync(icsFilePath)) {
      const writtenContent = fs.readFileSync(icsFilePath, 'utf8');
      logInfo(`📖 读取已写入的 ICS 文件内容:\n${writtenContent}`);
    } else {
      logError(`❌ 读取失败，ICS 文件未写入: ${icsFilePath}`);
    }
  } catch (err) {
    logError(`❌ 生成 ICS 文件失败: ${err.message}`);
  }
};

// 执行生成 ICS
generateICS();