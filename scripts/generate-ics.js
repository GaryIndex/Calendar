import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fs from 'fs';
import { createEvent } from '../scripts/createEvent/createEvent.js';
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
const processors = {
  // 处理节气数据
  jieqi: (records, allEvents) => {
    logInfo("🛠️ 开始处理节气数据");

    if (!Array.isArray(records.Reconstruction)) {
      logInfo(`❌ Reconstruction 不是数组: ${JSON.stringify(records)}`);
      return;
    }

    records.Reconstruction.forEach(item => {
      if (!Array.isArray(item.data)) {
        logInfo(`⚠️ Reconstruction 数据异常: ${JSON.stringify(item)}`);
        return;
      }

      item.data.forEach(event => {
        const time = event.time;
        if (!time) {
          logInfo(`❌ 节气数据缺少时间: ${JSON.stringify(event)}`);
          return;
        }
        const [date, startTime] = time.split(' ');
        const description = `节气: ${event.name}`;

        // 记录即将插入的数据
        console.log("📌 插入节气事件:", { date, title: event.name, startTime, description });

        allEvents.push(
          createEvent({
            date,              
            title: event.name,  
            isAllDay: false,    
            startTime,          
            description         
          })
        );
      });
    });
    logInfo("✅ 节气数据处理完成");
  },

  // 处理节假日数据
  holidays: (records, allEvents) => {
    logInfo("🛠️ 开始处理节假日数据");

    if (!Array.isArray(records.Reconstruction)) {
      logInfo(`❌ Reconstruction 不是数组: ${JSON.stringify(records)}`);
      return;
    }

    records.Reconstruction.forEach(item => {
      // item 是对象，遍历它的值
      const holidaysArray = Object.values(item);
      holidaysArray.forEach(holiday => {
        const { date, name, isOffDay } = holiday;
        if (!date || !name || isOffDay === undefined) {
          logInfo(`❌ 节假日数据缺失关键字段: ${JSON.stringify(holiday)}`);
          return;
        }

        // 组装描述信息，排除 `date`, `name`, `isOffDay`
        const description = Object.entries(holiday)
          .filter(([k]) => !['date', 'name', 'isOffDay'].includes(k))
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');

        // 生成角标（休 or 班）
        const badge = isOffDay ? "休" : "班";

        console.log("📌 插入节假日事件:", { date, title: name, badge, description });

        allEvents.push(createEvent({
          date,
          title: name,         
          isAllDay: true,      
          badge,              
          description          
        }));
      });
    });
    logInfo("✅ 节假日数据处理完成");
  },

  // 处理天文数据 (astro.json)
  astro: (records, allEvents) => {
    logInfo("🛠️ 开始处理天文数据");

    if (!Array.isArray(records.Reconstruction)) {
      logInfo(`❌ Reconstruction 不是数组: ${JSON.stringify(records)}`);
      return;
    }

    records.Reconstruction.forEach(entry => {
      if (!entry.data || !entry.data.range) {
        logInfo(`❌ astro.json 缺少有效数据: ${JSON.stringify(entry)}`);
        return;
      }

      const { data } = entry;
      const year = new Date().getFullYear();

      // 处理 range 字段，并正确转换日期
      const [start, end] = data.range.split("-").map(date => `${year}-${date.replace(".", "-")}`);

      // 提取值而非键
      const description = Object.values(data)
        .filter(value => value !== data.range)  // 排除 range 字段
        .map(value => (typeof value === "object" ? JSON.stringify(value) : value))
        .join(" | ");

      let currentDate = new Date(start);
      const endDate = new Date(end);

      // 持续插入日期，直到结束日期
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split("T")[0];

        console.log("📌 插入天文事件:", { date: dateStr, description });

        allEvents.push(createEvent({
          date: dateStr,
          title: "",         
          isAllDay: true,    
          description        
        }));

        // 日期递增
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    logInfo("✅ 天文数据处理完成");
  },

  // 处理 calendar.json
  calendar: (records, allEvents) => {
  logInfo("🛠️ 开始处理日历数据");

  if (!records || typeof records !== "object") {
    logInfo(`❌ records 数据格式错误: ${JSON.stringify(records)}`);
    return;
  }

  Object.entries(records).forEach(([date, record]) => {
    if (!record?.Reconstruction || !Array.isArray(record.Reconstruction)) {
      logInfo(`⚠️ Reconstruction 数据异常: ${JSON.stringify(record)}`);
      return;
    }

    // 过滤掉无效 Reconstruction 数据
    const validEntries = record.Reconstruction
      .map(entry => entry.data || entry) // 直接解包 `data`
      .filter(data => data && typeof data === "object" && Object.keys(data).length > 0);

    if (validEntries.length === 0) {
      logInfo(`⚠️ 过滤后无有效 Reconstruction 数据: ${JSON.stringify(record.Reconstruction)}`);
      return;
    }

    validEntries.forEach(data => {
      // 确保 `festivals` 是字符串
      if (typeof data.festivals !== "string") {
        logInfo(`❌ festivals 数据格式错误: ${JSON.stringify(data.festivals)}`);
      }

      // 确保 `pengzubaiji` 是字符串
      if (Array.isArray(data.pengzubaiji)) {
        data.pengzubaiji = data.pengzubaiji.join(",");
      } else if (typeof data.pengzubaiji !== "string") {
        logInfo(`❌ pengzubaiji 数据格式错误: ${JSON.stringify(data.pengzubaiji)}`);
      }

      // 确保 `liuyao`、`jiuxing`、`taisui` 是字符串
      ["liuyao", "jiuxing", "taisui"].forEach(key => {
        if (typeof data[key] !== "string") {
          logInfo(`❌ ${key} 数据格式错误: ${JSON.stringify(data[key])}`);
        }
      });

      // 提取标题和描述
      const title = processors.extractTitle(data);
      const description = processors.extractDescription(data);

      // 插入日历事件
      console.log("📌 插入日历事件:", { date, title, description });

      allEvents.push(
        createEvent({
          date,
          title,
          description,
          isAllDay: true,
        })
      );
    });
  });

  logInfo("✅ 日历数据处理完成");
},

/**
 * 提取事件标题（festival）
 * @param {Object} data - 日历数据
 * @returns {string} 标题
 */
extractTitle: (data) => {
  return (data.festivals && typeof data.festivals === "string") ? data.festivals : "";
},

/**
 * 提取事件描述（备注）
 * @param {Object} data - 日历数据
 * @returns {string} 备注
 */
extractDescription: (data) => {
  const extractFields = ["year", "leapYear", "month", "maxDayInMonth", "enMonth", "astro", "cnWeek", "enWeek", "weekInYear", "day", "dayInYear", "julianDay", "hour", "minute", "second", "lunar", "almanac"];
  
  // 提取普通字段，排除空对象
  const values = extractFields.flatMap(field => {
    const fieldValue = data[field];
    return (fieldValue && typeof fieldValue === "object" && Object.keys(fieldValue).length === 0) 
      ? [] // 过滤掉空对象 `{}` 
      : Object.values(fieldValue || {}); // 处理非空对象
  });

  // 处理 `jishenfangwei` 字段：只要值，不要键
  if (data.almanac?.jishenfangwei) {
    values.push(...Object.values(data.almanac.jishenfangwei));
  }

  // 处理其他特殊字段
  ["liuyao", "jiuxing", "taisui"].forEach(key => {
    if (data.almanac?.[key]) values.push(data.almanac[key]);
  });
  
  // 处理 `pengzubaiji`
  if (Array.isArray(data.almanac?.pengzubaiji)) {
    values.push(data.almanac.pengzubaiji.join(", ")); 
  }
  return values
    .map(value => (typeof value === "object" && Object.keys(value).length === 0 ? "" : value)) // 确保空对象不会被加入
    .filter(value => value !== "") // 过滤掉空字符串
    .join(" | ");
}

// export { calendar };
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
allEvents.forEach((event, index) => {
    allEvents[index] = ensureEventDefaults(event);
});
//let allEvents = [...];  // 确保 allEvents 是用 let 声明的
//allEvents = allEvents.map(ensureEventDefaults);

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
export default processors;