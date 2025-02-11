// **处理数据**
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import fs from "fs/promises"; // 读取/写入文件
import { readJsonData, dataPaths, loadAllJsonData, logInfo, createEvent } from './fetch-data.js';
// 在 ESM 环境中定义 __dirname
const icsFilePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'calendar.ics');
/*
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
*/

 // **数据处理器**
const processors = {
  /**
   * **处理节假日数据**
   */
  holidays: (data, allEvents) => {
  logInfo("🛠️ 处理节假日数据...");
  // 检查 Reconstruction 是否存在
  if (!data || typeof data !== "object") {
    return logInfo("❌ holidays 数据格式错误！");
  }
  // 获取 Reconstruction 数组
  const reconstructionData = Object.values(data)[0]?.Reconstruction; // 取第一层对象的 Reconstruction
  if (!Array.isArray(reconstructionData)) {
    return logInfo(`❌ holidays Reconstruction 数据不存在！数据结构: ${JSON.stringify(data, null, 2)}`);
  }
  // 遍历 Reconstruction
  reconstructionData.forEach(entry => {
    if (!entry || typeof entry !== "object") return;
    Object.entries(entry).forEach(([date, holiday]) => {
      if (!holiday || typeof holiday !== "object") return;
      const { name, isOffDay } = holiday;
      if (!date || !name || isOffDay === undefined) {
        logInfo(`❌ 缺少必要字段: ${JSON.stringify(holiday)}`);
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
    return logInfo("❌ jieqi Reconstruction 数据不存在！");
  }
  // 遍历 Reconstruction 数组（过滤掉 errno 和 errmsg）
  data.Reconstruction.forEach(entry => {
    if (!entry || typeof entry !== "object" || !Array.isArray(entry.data)) {
      return logInfo(`❌ jieqi Reconstruction 数据格式错误: ${JSON.stringify(entry)}`);
    }
    entry.data.forEach(event => {
      if (!event.name || !event.time) {
        logInfo(`❌ jieqi 缺少 name 或 time: ${JSON.stringify(event)}`);
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
      return logInfo("❌ astro Reconstruction 数据不存在或格式错误！");
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
            return logInfo(`❌ ${date} 的 Reconstruction 数据格式错误，应该是数组！`);
        }
        
        value.Reconstruction.forEach(entry => {
            if (!entry || typeof entry !== "object" || !entry.data) {
                return logInfo(`❌ ${date} 无效的时辰数据！`, entry);
            }
            entry.data.forEach(event => {
                if (!event.hour || !event.hours) {
                    logInfo(`❌ ${date} 缺少 hour 或 hours: ${JSON.stringify(event)}`);
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
            return logInfo(`❌ calendar ${date} 的 Reconstruction 数据不存在！`);
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
// **定义 ICS 文件路径**
//const icsFilePath = path.join(path.dirname(import.meta.url), 'calendar.ics');

// **处理所有数据**
// 直接使用 loadAllJsonData 来获取数据
const jsonData = await loadAllJsonData();
console.log(jsonData);
const processAllData = (jsonData, allEvents) => {
  logInfo("📌 正在处理所有数据...");
  logInfo("📂 加载的 JSON 数据:", JSON.stringify(jsonData, null, 2));
  const eventsByDate = {}; // 用于按照日期合并事件数据
  // 打印加载的 jsonData
  //logInfo("📂 加载的 JSON 数据:", JSON.stringify(jsonData, null, 2));
  // **先处理 Reconstruction**
  Object.entries(jsonData).forEach(([source, data]) => {
    logInfo(`🔍 正在处理数据源: ${source}`);
    if (data.Reconstruction) {
      logInfo(`🔸 数据源 "${source}" 包含 Reconstruction 数据...`);
      Object.entries(data.Reconstruction).forEach(([date, entries]) => {
        logInfo(`🎯 正在处理日期: ${date}, 条目数: ${entries.length}`);
        entries.forEach(entry => {
          logInfo(`🔹 处理条目: ${JSON.stringify(entry, null, 2)}`);
          // 如果没有该日期的事件，初始化
          if (!eventsByDate[date]) {
            eventsByDate[date] = [];
            logInfo(`✅ 初始化事件列表: ${date}`);
          }
          // 处理合并的 title 和 description
          const existingEvent = eventsByDate[date].find(event => event.source === source);
          const title = entry.name || "无标题";
          const description = entry.description || "无描述";
          const isAllDay = entry.isAllDay !== undefined ? entry.isAllDay : true;
          const attachment = entry.attachment || "";
          logInfo(`🔸 当前处理的事件数据: 标题 - ${title}, 描述 - ${description}`);
          // 合并：优先级高的数据展示在前面，且合并标题和描述
          let event;
          if (!existingEvent) {
            event = createEvent({
              date,
              title,
              description,
              isAllDay,
              attachment
            });
            event.source = source;  // 记录数据源
            eventsByDate[date].push(event);
            logInfo(`✅ 新事件添加: ${date} - ${title}`);
          } else {
            // 更新事件，合并标题和备注
            const combinedTitle = existingEvent.title + " | " + title;
            const combinedDescription = existingEvent.description + " | " + description;
            existingEvent.title = combinedTitle;
            existingEvent.description = combinedDescription;
            // 合并附件（如果存在）
            if (entry.attachment) {
              existingEvent.attachment = existingEvent.attachment ? existingEvent.attachment + " | " + entry.attachment : entry.attachment;
            }
            logInfo(`✅ 更新事件: ${date} - ${existingEvent.title}`);
          }
        });
      });
    } else {
      logInfo(`❌ 数据源 "${source}" 不包含 Reconstruction 数据`);
    }
  });
  // **按优先级排序所有事件**
  logInfo("📊 正在按优先级排序事件...");
  Object.entries(eventsByDate).forEach(([date, events]) => {
    logInfo(`🎯 正在排序日期: ${date}, 事件数: ${events.length}`);
    events.sort((a, b) => sourcePriority[b.source] - sourcePriority[a.source]);
    logInfo(`📅 排序后的事件: ${date}`);
    // 将排序后的事件添加到 allEvents
    events.forEach(event => {
      allEvents.push(event);
      logInfo(`📅 添加到所有事件: ${event.title} - ${event.date}`);
    });
  });
  logInfo(`✅ 处理完成，共生成 ${allEvents.length} 个事件`);
};
// **生成 ICS 文件**
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
ATTACHMENT:${event.attachment}
END:VEVENT`;
  }).join("\n");
  // 打印生成的 ICS 内容（调试用）
  logInfo(`生成的 ICS 数据: \n${icsData}`);
  await fs.writeFile(icsFilePath, `BEGIN:VCALENDAR\nVERSION:2.0\n${icsData}\nEND:VCALENDAR`);
  logInfo(`✅ ICS 文件生成成功: ${icsFilePath}`);
};

// **主流程**
const main = async () => {
  const allEvents = [];
  logInfo("📥 正在加载所有 JSON 数据...");
  const jsonData = await loadAllJsonData();
  logInfo("加载的 JSON 数据:", JSON.stringify(jsonData, null, 2));
  if (!jsonData || Object.keys(jsonData).length === 0) {
    logInfo("❌ 没有可用的 JSON 数据！");
    return;
  }
  logInfo("✅ JSON 数据加载成功！");
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
    logInfo(`❌ 程序运行失败: ${err.message}`);
  }
})();