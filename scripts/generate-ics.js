// **处理数据**
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import fs from "fs/promises"; // 读取/写入文件
import { readJsonData, dataPaths, loadAllJsonData, logInfo, logError, createEvent } from './utils/utils.js';
// 在 ESM 环境中定义 __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const icsFilePath = path.join(__dirname, 'calendar.ics');
(async () => {
  try {
    logInfo("📂 开始加载所有 JSON 数据");
    const jsonData = await loadAllJsonData();
    logInfo("✅ 成功加载所有 JSON 数据");
    console.log(jsonData);
  } catch (error) {
    logError(`❌ 加载 JSON 数据失败: ${error.message}`);
  }
})();

 // **数据处理器**
const processors = {
  /**
   * **处理节假日数据**
   */
  holidays: (data, allEvents) => {
  logInfo("🛠️ 处理节假日数据...");
  // 检查 Reconstruction 是否存在
  if (!data || typeof data !== "object") {
    return logError("❌ holidays 数据格式错误！");
  }
  // 获取 Reconstruction 数组
  const reconstructionData = Object.values(data)[0]?.Reconstruction; // 取第一层对象的 Reconstruction
  if (!Array.isArray(reconstructionData)) {
    return logError(`❌ holidays Reconstruction 数据不存在！数据结构: ${JSON.stringify(data, null, 2)}`);
  }
  // 遍历 Reconstruction
  reconstructionData.forEach(entry => {
    if (!entry || typeof entry !== "object") return;
    Object.entries(entry).forEach(([date, holiday]) => {
      if (!holiday || typeof holiday !== "object") return;
      const { name, isOffDay } = holiday;
      if (!date || !name || isOffDay === undefined) {
        logError(`❌ 缺少必要字段: ${JSON.stringify(holiday)}`);
        return;
      }
      // 转换日期格式为 YYYYMMDD
      const formattedDate = date.replace(/-/g, '');  // 格式化为 YYYYMMDD
      // 生成描述，去除名称和假期信息
      const descParts = Object.entries(holiday)
        .filter(([k]) => !['name', 'isOffDay'].includes(k))
        .map(([_, v]) => `${v}`)
        .join(" | ");
      // 根据是否为假期设置标题
      const title = `${isOffDay ? "[休]" : "[班]"} ${name}`;
      // 生成并推送 ICS 事件
      allEvents.push(createEvent({
        date: formattedDate,
        title,
        isAllDay: true,
        description: descParts
      }));
      logInfo(`✅ 添加节假日事件: ${formattedDate} - ${name}`);
    });
  });
},
  /**
   * **处理节气数据**
   */
  jieqi: (data, allEvents) => {
  logInfo("🛠️ 处理节气数据...");
  // 确保 Reconstruction 存在并且是数组
  if (!Array.isArray(data.Reconstruction) || data.Reconstruction.length === 0) {
    return logError("❌ jieqi Reconstruction 数据不存在！");
  }
  // 遍历 Reconstruction 数组（过滤掉 errno 和 errmsg）
  data.Reconstruction.forEach(entry => {
    if (!entry || typeof entry !== "object" || !Array.isArray(entry.data)) {
      return logError(`❌ jieqi Reconstruction 数据格式错误: ${JSON.stringify(entry)}`);
    }
    entry.data.forEach(event => {
      if (!event.name || !event.time) {
        logError(`❌ jieqi 缺少 name 或 time: ${JSON.stringify(event)}`);
        return;
      }
      const [date, startTime] = event.time.split(" ");
      const formattedDate = date.replace(/-/g, ''); // 转换为 YYYYMMDD 格式
      // 确保 startTime 为 HHMM 格式
      let formattedStartTime = startTime ? startTime.replace(":", "") : "";
      // 创建 ICS 事件
      allEvents.push(createEvent({
        date: formattedDate,
        title: event.name,
        startTime: formattedStartTime,  // 格式化后的 startTime
        isAllDay: false,
        description: `节气: ${event.name}`
      }));
      logInfo(`✅ 添加节气事件: ${event.time} - ${event.name}`);
    });
  });
},
  /**
   * **处理天文数据**
   */
  astro: (data, allEvents) => {
  logInfo("🛠️ 处理天文数据...");
  Object.values(data).forEach(({ Reconstruction }) => {
    if (!Array.isArray(Reconstruction)) {
      return logError("❌ astro Reconstruction 数据不存在或格式错误！");
    }
    Reconstruction.forEach(({ data }) => {
      if (!data?.range) return;
      const { name, range, ...details } = data;
      // 解析 range，例如 "1.20-2.18"
      const [start, end] = range.split("-").map(d => d.replace(".", "-"));
      // 获取当前年份
      const year = new Date().getFullYear();
      const startDate = new Date(`${year}-${start}`);
      const endDate = new Date(`${year}-${end}`);
      // 组装 description（去除 range 以外的其他字段）
      const description = Object.values(details).join(" | ");
      // 遍历日期范围，确保每天都生成数据
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const eventDate = currentDate.toISOString().split("T")[0].replace(/-/g, ''); // 转换为 YYYYMMDD 格式
        allEvents.push(createEvent({
          date: eventDate,
          title: name || "天文事件",
          isAllDay: true,
          description
        }));
        logInfo(`✅ 添加天文事件: ${eventDate} - ${name}`);
        currentDate.setDate(currentDate.getDate() + 1); // 日期 +1
      }
    });
  });
},
  /**
   * **处理时辰数据**
   */
  shichen: (data, allEvents) => {
    logInfo("🛠️ 处理时辰数据...");
    // 遍历所有日期
    Object.entries(data).forEach(([date, value]) => {
        // 每个日期下有 Reconstruction 数组
        if (!value.Reconstruction || !Array.isArray(value.Reconstruction)) {
            return logError(`❌ ${date} 的 Reconstruction 数据格式错误，应该是数组！`);
        }
        
        value.Reconstruction.forEach(entry => {
            if (!entry || typeof entry !== "object" || !entry.data) {
                return logError(`❌ ${date} 无效的时辰数据！`, entry);
            }
            entry.data.forEach(event => {
                if (!event.hour || !event.hours) {
                    logError(`❌ ${date} 缺少 hour 或 hours: ${JSON.stringify(event)}`);
                    return;
                }
                // 修正为符合 ICS 的时间格式 HHMM
                let [startTime, endTime] = event.hours.split("-");
                // 确保时间是4位，使用 padStart 补充前导零（如果小时少于两位）
                startTime = startTime.padStart(4, "0");
                endTime = endTime.padStart(4, "0");
                const description = ["yi", "ji", "chong", "sha", "nayin", "jiuxing"]
                    .map(key => event[key] || "") // 只取值
                    .filter(Boolean)
                    .join(" "); // 用空格分隔
                // 检查 title 是否有效
                const title = event.hour || "时辰事件"; // 如果没有 hour，默认用“时辰事件”
                // 转换日期格式为 YYYYMMDD
                const eventDate = date.replace(/-/g, ''); // 将日期格式化为 YYYYMMDD
                allEvents.push(createEvent({
                    date: eventDate, // 直接使用 Reconstruction 的 key 作为日期，已格式化为 YYYYMMDD
                    title,
                    startTime,
                    endTime,
                    isAllDay: false,
                    description
                }));
            });
        });
    });
},
  /**
   * **处理万年历数据**
   */
  calendar: (data, allEvents) => {
    logInfo("🛠️ 处理万年历数据...");
    // 遍历日期键
    Object.entries(data).forEach(([date, obj]) => {
        if (!obj.Reconstruction || !Array.isArray(obj.Reconstruction)) {
            return logError(`❌ calendar ${date} 的 Reconstruction 数据不存在！`);
        }
        obj.Reconstruction.forEach(event => {
            if (!event || typeof event !== "object") return;
            // 过滤掉不需要的字段
            let description = Object.entries(event) // ✅ 改为 let，允许修改
                .filter(([key]) => !["errno", "errmsg", "weekInYear", "day", "dayInYear", "julianDay", "minute", "second", "year", "month", "maxDayInMonth", "enMonth", "enWeek"].includes(key))
                .map(([key, value]) => {
                    if (key === "pengzubaiji" && Array.isArray(value)) {
                        return value.join(", ");
                    }
                    return (Array.isArray(value) ? value.join(" | ") : value);
                })
                .join(" | ");
            // 生成事件标题
            let title = event.cnWeek || "万年历信息";
            if (event.festivals) title += ` ${event.festivals}`;
            // 处理闰年和闰月
            let leapYear = event.leapYear === true ? "闰年" : "";
            let leapMonth = event.leapMonth ? `闰${event.leapMonth}月` : "";
            if (leapYear || leapMonth) {
                description = `${leapYear} ${leapMonth} | ${description}`.trim(); // ✅ 现在 description 是 let，可以修改
            }
            // 转换日期格式为 YYYYMMDD
            const eventDate = date.replace(/-/g, ''); // 将日期格式化为 YYYYMMDD
            // 生成 ICS 事件
            allEvents.push(createEvent({
                date: eventDate, // 使用格式化后的日期 YYYYMMDD
                title,
                description,
                isAllDay: true
            }));
        });
    });
  }
};
/**
 * **处理所有数据**
 */
// 日志函数
import { readJsonData, dataPaths, loadAllJsonData, logInfo, logError, createEvent } from './utils/utils.js';
import path from 'path';
import fs from 'fs';

// 数据源优先级设置
const sourcePriority = {
  "calendar.json": 1,  // 低优先级
  "astro.json": 2,     // 中等优先级
  "shichen.json": 3    // 高优先级
};

// 日志函数
const logInfo1 = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [INFO 1] ${message}`);
};
const logError1 = (message) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [ERROR 1] ${message}`);
};
// 处理所有数据
const processAllData = (jsonData, allEvents) => {
  logInfo("📌 正在处理所有数据...");
  const eventsByDate = {}; // 用于按照日期合并事件数据
  // **先处理 Reconstruction**
  Object.entries(jsonData).forEach(([source, data]) => {
    if (data.Reconstruction) {
      logInfo(`📅 正在处理数据源: ${source}`);
      Object.entries(data.Reconstruction).forEach(([date, entries]) => {
        logInfo(`🎯 正在处理日期: ${date}`);
        entries.forEach(entry => {
          // 如果没有该日期的事件，初始化
          if (!eventsByDate[date]) {
            eventsByDate[date] = [];
          }
          // 处理合并的 title 和 description
          const existingEvent = eventsByDate[date].find(event => event.source === source);
          const title = entry.name || "无标题";
          const description = entry.description || "无描述";
          const isAllDay = entry.isAllDay !== undefined ? entry.isAllDay : true;
          // 合并：优先级高的数据展示在前面，且合并标题和描述
          let event;
          if (!existingEvent) {
            event = createEvent({
              date,
              title,
              description,
              isAllDay
            });
            event.source = source;  // 记录数据源
            eventsByDate[date].push(event);
          } else {
            // 更新事件，合并标题和备注
            const combinedTitle = existingEvent.title + " | " + title;
            const combinedDescription = existingEvent.description + " | " + description;
            existingEvent.title = combinedTitle;
            existingEvent.description = combinedDescription;
          }

          logInfo(`✅ 添加或更新事件: ${date} - ${title}`);
        });
      });
    }
  });

  // **按优先级排序所有事件**
  Object.entries(eventsByDate).forEach(([date, events]) => {
    // 按照源的优先级对事件进行排序
    events.sort((a, b) => sourcePriority[b.source] - sourcePriority[a.source]);
    // 将排序后的事件添加到 allEvents
    events.forEach(event => {
      allEvents.push(event);
    });
  });

  logInfo(`✅ 处理完成，共生成 ${allEvents.length} 个事件`);
};

// 生成 ICS 文件
const generateICS = async (events) => {
  logInfo(`📝 正在生成 ICS 文件...`);
  const icsData = events.map(event => {
    // 打印每个事件的详细数据
    logInfo(`🎯 生成 ICS 事件: ${JSON.stringify(event)}`);
    const startTimeFormatted = event.startTime ? event.startTime.replace(":", "") + "00" : "000000";  // 默认值
    const endTimeFormatted = event.endTime ? event.endTime.replace(":", "") + "00" : "235959";      // 默认值
    return `
BEGIN:VEVENT
SUMMARY:${event.title}
DTSTART:${event.date.replace(/-/g, '')}T${startTimeFormatted}
DTEND:${event.date.replace(/-/g, '')}T${endTimeFormatted}
DESCRIPTION:${typeof event.description === 'string' ? event.description : JSON.stringify(event.description)}
END:VEVENT`;
  }).join("\n");
  // 打印生成的 ICS 内容（调试用）
  logInfo(`生成的 ICS 数据: \n${icsData}`);
  const icsFilePath = path.join(__dirname, 'calendar.ics');
  await fs.promises.writeFile(icsFilePath, `BEGIN:VCALENDAR\nVERSION:2.0\n${icsData}\nEND:VCALENDAR`);
  logInfo(`✅ ICS 文件生成成功: ${icsFilePath}`);
};

// 加载所有 JSON 数据
const loadAllJsonData = async () => {
  logInfo("📂 正在加载 JSON 文件...");
  const jsonDataArray = await Promise.all(Object.values(dataPaths).map(async file => await readJsonData(file)));
  const jsonDatajust = Object.fromEntries(Object.keys(dataPaths).map((key, i) => [key, jsonDataArray[i]]));
  // 调试：打印 JSON 数据结构
  logInfo("✅ JSON 文件加载完成:", JSON.stringify(jsonDatajust, null, 2));
  return jsonDatajust;
};

// 主流程
const main = async () => {
  const allEvents = [];
  logInfo("📥 正在加载所有 JSON 数据...");
  const jsonData = await loadAllJsonData();
  if (!jsonData || Object.keys(jsonData).length === 0) {
    logError("❌ 没有可用的 JSON 数据！");
    return;
  }
  logInfo("✅ JSON 数据加载成功！");
  // 调试：打印 JSON 数据结构
  console.log("✅ jsonData:", JSON.stringify(jsonData, null, 2));
  logInfo("📌 开始处理所有数据...");
  processAllData(jsonData, allEvents);
  logInfo("🎉 所有数据处理完成！");
  await generateICS(allEvents);
};

// 执行流程
(async () => {
  try {
    await main();  // 执行主流程
  } catch (err) {
    logError(`❌ 程序运行失败: ${err.message}`);
  }
})();