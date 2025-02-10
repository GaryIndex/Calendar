import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fs from 'fs';

// **计算 __dirname**
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// **日志文件路径**
const logFilePath = path.join(__dirname, './data/error.log');

// **日志记录**
const writeLog = async (type, message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}\n`;
  await fs.promises.appendFile(logFilePath, logMessage, 'utf8');
  console.log(type === "INFO" ? chalk.green(logMessage.trim()) : chalk.red(logMessage.trim()));
};

const logInfo = (message) => writeLog("INFO", message);
const logError = (message) => writeLog("ERROR", message);

// **JSON 文件路径**
const dataPaths = {
  holidays: path.join(process.cwd(), 'data/Document/holidays.json'),
  jieqi: path.join(process.cwd(), 'data/Document/jieqi.json'),
  astro: path.join(process.cwd(), 'data/Document/astro.json'),
  calendar: path.join(process.cwd(), 'data/Document/calendar.json'),
  shichen: path.join(process.cwd(), 'data/Document/shichen.json'),
};

// **读取 JSON**
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

    return JSON.parse(rawData);
  } catch (error) {
    logError(`❌ 读取 JSON 失败: ${filePath} - ${error.message}`);
    return {};
  }
};

// **批量加载所有 JSON**
// 只在这个函数中声明 jsonData，确保没有全局声明
const loadAllJsonData = async () => {
  const jsonData = {};  // 在这个函数中声明，不会影响其他地方
  for (const [key, filePath] of Object.entries(dataPaths)) {
    jsonData[key] = await readJsonData(filePath);
  }
  return jsonData;
};
// 如果你有其他函数需要访问 JSON 数据，可以将其传递给它们

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
  description = "",
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

// **处理数据**
// 处理所有数据
const processAllData = (jsonData, allEvents) => {
  logInfo("📌 正在处理所有数据...");

  // 处理不同数据源（如 astro.json, calendar.json 等）
  Object.entries(jsonData).forEach(([source, data]) => {
    if (processors[source]) {
      processors[source](data, allEvents); // 使用 processors 对象调用对应的处理函数
    } else {
      logError(`❌ 未知数据源: ${source}`);
    }
  });

  // 处理 Reconstruction 数据
  for (const [key, data] of Object.entries(jsonData)) {
    if (!data || Object.keys(data).length === 0) continue;

    for (const date in data.Reconstruction) {
      for (const entry of data.Reconstruction[date]) {
        const event = createEvent({
          date,
          title: entry.name || "无标题",
          description: Object.entries(entry).map(([k, v]) => `${k}: ${v}`).join(" "),
          isAllDay: true
        });

        allEvents.push(event);
      }
    }
  }

  logInfo(`✅ 处理完成，共生成 ${allEvents.length} 个事件`);
};

// **主流程**
const main = async () => {
  const allEvents = [];
  const jsonData = await loadAllJsonData();

  if (Object.values(jsonData).some(data => Object.keys(data).length > 0)) {
    processAllData(jsonData, allEvents);
    logInfo("🎉 所有数据处理完成！");
  } else {
    logError("❌ 没有可用的 JSON 数据！");
    process.exit(1);
  }
};

// **执行 `main()`**
await main();

/**
 * **数据处理器**
 */
// 处理节假日数据
const holidays = (records, allEvents) => {
  logInfo("🛠️ 开始处理节假日数据");
  if (Array.isArray(records.Reconstruction)) {
    records.Reconstruction.forEach(item => {
      Object.entries(item).forEach(([date, holiday]) => {
        logInfo(`处理节假日数据: ${JSON.stringify(holiday)}`);
        
        const { date: holidayDate, name, isOffDay } = holiday;
        // 检查是否缺少必要字段
        if (!holidayDate || !name || isOffDay === undefined) {
          logError(`❌ 节假日数据缺失关键字段: ${JSON.stringify(holiday)}`);
          return;
        }
        // 生成描述部分
        const descParts = Object.entries(holiday)
          .filter(([k]) => !['date', 'name', 'isOffDay'].includes(k))  // 排除关键字段
          .map(([k, v]) => `${v}`)  // 仅保留值部分
          .join(' | ');  // 用 | 分隔
        // 添加节假日事件到 allEvents
        allEvents.push({
          date: holidayDate,  // 使用节假日的日期
          title: `${isOffDay ? '[休]' : '[班]'} ${name}`,  // 标题包含休息/上班标识
          isAllDay: true,  // 设置为全天事件
          description: descParts  // 描述包含其他字段的值
        });
        logInfo(`添加节假日事件: ${holidayDate} - ${name}`);
      });
    });
    logInfo("✅ 节假日数据处理完成");
  } else {
    logError(`❌ records.Reconstruction 不是一个数组: ${JSON.stringify(records.Reconstruction)}`);
  }
};

// 处理节气数据
const jieqi = (records, allEvents) => {
  logInfo("🛠️ 处理节气数据...");
  if (Array.isArray(records.Reconstruction)) {
    records.Reconstruction.forEach(item => {
      if (!Array.isArray(item.data)) {
        logError(`❌ 数据格式错误，缺少 data 数组: ${JSON.stringify(item)}`);
        return;
      }

      item.data.forEach(event => {
        logInfo(`处理节气事件: ${JSON.stringify(event)}`);

        if (!event.time || !event.name) {
          logError(`❌ 缺少关键字段 (name 或 time): ${JSON.stringify(event)}`);
          return;
        }

        const date = event.time.split(' ')[0]; // 提取日期部分

        allEvents.push(createEvent({
          date,
          title: event.name, // 标题使用节气名称
          startTime: event.time, // 具体时间
          isAllDay: false, // 不是全天事件
          description: `节气: ${event.name}` // 描述添加节气名称
        }));

        logInfo(`✅ 添加节气事件: ${date} - ${event.name}`);
      });
    });

    logInfo("✅ 节气数据处理完成");
  } else {
    logError(`❌ records.Reconstruction 不是一个数组: ${JSON.stringify(records.Reconstruction)}`);
  }
};

// 处理天文数据
const astro = (records, allEvents) => {
  logInfo("🛠️ 处理天文数据...");
  if (Array.isArray(records.Reconstruction)) {
    records.Reconstruction.forEach(entry => {
      logInfo(`处理天文条目: ${JSON.stringify(entry)}`);
      // 确保有有效的 range 数据
      if (!entry.data || !entry.data.range) return;
      // 解析 range 为日期范围
      const [start, end] = entry.data.range.split("-").map(date => `2025-${date.replace(".", "-")}`);
      let currentDate = new Date(start);
      const endDate = new Date(end);
      // 处理日期范围内的每一天
      while (currentDate <= endDate) {
        // 构建备注，除了 range 之外的所有键值对作为备注，用 | 分割
        const descParts = Object.entries(entry.data)
          .filter(([key]) => key !== "range")
          .map(([key, value]) => `${value}`)
          .join(' | ');
        // 添加事件
        allEvents.push(createEvent({
          date: currentDate.toISOString().split("T")[0], // 格式化日期
          title: entry.data.name || "", // 使用 name 作为标题，若没有则为空
          isAllDay: true, // 全日事件
          description: `${descParts} | 日期范围: ${start} 到 ${end}` // 备注，加入日期范围
        }));
        // 增加日期
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    logInfo("✅ 天文数据处理完成");
  } else {
    logError(`❌ records.Reconstruction 不是一个数组，实际类型是: ${typeof records.Reconstruction}`);
  }
};

// 处理时辰数据
const shichen = (records, allEvents) => {
  logInfo("🛠️ 处理时辰数据...");
  if (!records.Reconstruction || !Array.isArray(records.Reconstruction)) {
    logError(`❌ 数据格式错误，Reconstruction 不是数组: ${JSON.stringify(records.Reconstruction)}`);
    return;
  }
  records.Reconstruction.forEach(recon => {
    if (!Array.isArray(recon.data)) {
      logError(`❌ 数据格式错误，缺少 data 数组: ${JSON.stringify(recon)}`);
      return;
    }
    recon.data.forEach(entry => {
      if (!entry.date || !entry.hour || !entry.hours) {
        logError(`❌ 缺少关键字段 (date, hour, hours): ${JSON.stringify(entry)}`);
        return;
      }
      // 解析 hours 为 startTime 和 endTime
      const [startTime, endTime] = entry.hours.split("-");
      if (!startTime || !endTime) {
        logError(`❌ hours 格式错误: ${entry.hours}`);
        return;
      }
      // 组装 description 备注信息
      const description = [
        entry.yi ? `宜: ${entry.yi}` : "",
        entry.ji ? `忌: ${entry.ji}` : "",
        entry.chong ? `冲: ${entry.chong}` : "",
        entry.sha ? `煞: ${entry.sha}` : "",
        entry.nayin ? `纳音: ${entry.nayin}` : "",
        entry.jiuxing ? `九星: ${entry.jiuxing}` : ""
      ].filter(Boolean).join(" "); // 过滤掉空值
      allEvents.push(createEvent({
        date: entry.date,
        title: entry.hour, // 事件标题
        startTime, // 开始时间
        endTime, // 结束时间
        isAllDay: false, // 只在 hours 范围内显示
        description
      }));
      logInfo(`✅ 添加时辰事件: ${entry.date} ${startTime}-${endTime} ${entry.hour}`);
    });
  });
  logInfo("✅ 时辰数据处理完成");
};

// 处理万年历数据
const calendar = (records, allEvents) => {
  logInfo("🛠️ 处理万年历数据...");

  Object.entries(records).forEach(([date, data]) => {
    if (!data.Reconstruction || !Array.isArray(data.Reconstruction)) {
      logError(`❌ 数据格式错误，Reconstruction 不是数组: ${JSON.stringify(data)}`);
      return;
    }

    logInfo(`📅 处理万年历日期: ${date}`);

    data.Reconstruction.forEach(entry => {
      if (!entry) {
        logError(`❌ 无效的万年历条目: ${JSON.stringify(entry)}`);
        return;
      }

      // 需要排除的键
      const excludeKeys = new Set(["errno", "errmsg", "festivals", "solarTerms", "cnWeek"]);

      // 拼接 description（去掉键名，只保留值）
      const description = Object.entries(entry)
        .filter(([key, value]) => value && !excludeKeys.has(key)) // 过滤掉空值和不需要的字段
        .map(([_, value]) => (Array.isArray(value) ? value.join("｜") : value)) // 数组转换为 `｜` 连接的字符串
        .join("｜"); // 连接所有字段

      // 拼接标题
      let title = entry.cnWeek || "万年历信息";
      if (entry.festivals) {
        title += ` ${entry.festivals}`; // 如果有节日，将节日作为额外标题
      }

      // 添加事件
      allEvents.push(createEvent({
        date,
        title,
        isAllDay: true,
        description
      }));

      logInfo(`✅ 添加万年历事件: ${date} - ${title}`);
    });
  });

  logInfo("✅ 万年历数据处理完成");
};

// 使用 processors 进行调用
const processors = {
  holidays,
  jieqi,
  astro,
  shichen,
  calendar
};
/*
// 处理所有数据
const processAllData = (jsonData, allEvents) => {
  Object.entries(jsonData).forEach(([source, data]) => {
    if (processors[source]) {
      processors[source](data, allEvents); // 使用 processors 对象调用对应的处理函数
    } else {
      logError(`❌ 未知数据源: ${source}`);
    }
  });
};
*/
// 运行处理逻辑
const jsonDatakok = await loadAllJsonData();
processAllData(jsonData, allEvents);
//processAllData(yourJsonData, allEvents);

/**
 * **生成 ICS 文件**
 */
const generateICS = async (events) => {
  const icsData = events.map(event => `
BEGIN:VEVENT
SUMMARY:${event.title}
DTSTART:${event.date.replace(/-/g, '')}T${event.startTime ? event.startTime.replace(/:/g, '') + '00' : '000000'}
DTEND:${event.date.replace(/-/g, '')}T${event.endTime ? event.endTime.replace(/:/g, '') + '00' : '235959'}
DESCRIPTION:${typeof event.description === 'string' ? event.description : JSON.stringify(event.description)}
END:VEVENT`).join("\n");

  //await fs.promises.writeFile(icsFilePath, `BEGIN:VCALENDAR\nVERSION:2.0\n${icsData}\nEND:VCALENDAR`);
  const icsFilePath = path.join(__dirname, 'calendar.ics');
  logInfo(`✅ ICS 文件生成成功: ${icsFilePath}`);
};

// **执行流程**
(async () => {
  const allEvents = [];
  //const [holidays, jieqi, astro, shichen, calendar] = await Promise.all(Object.values(dataPaths).map(readJsonData));
  const jsonDataArray = await Promise.all(Object.values(dataPaths).map(async file => await readJsonData(file)));
  const jsonDatajust = Object.fromEntries(Object.keys(dataPaths).map((key, i) => [key, jsonDataArray[i]]));
  //Object.values(processors).forEach(fn => fn({ Reconstruction: holidays }, allEvents));
  const jsonDataand = await loadAllJsonData();
  processAllData(jsonData, allEvents);
  await generateICS(allEvents);
})();