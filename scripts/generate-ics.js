import fs from 'fs/promises'; // 使用 fs/promises 来处理文件读取
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { logInfo, createEvent } from './friends.js'; // 确保引入了必要的工具
// 确保 icsFilePath 已经定义，指定输出文件路径
const icsFilePath = './calendar.ics';
// 使用 import.meta.url 获取当前模块的路径并转换为 __dirname
// 获取项目根目录
//const __dirname = path.dirname(new URL(import.meta.url).pathname);  // 在 ESM 中获取 __dirname
//const ROOT_DIR = path.resolve(__dirname, '../../');  // 向上两级目录
// 数据路径基于项目根目录
//const DATA_PATH = path.join(ROOT_DIR, 'Document');  // 假设 Document 文件夹在根目录下
//const DATA_PATH = './Document';  // 指向仓库根目录下的 'data' 文件夹
const DATA_PATH = path.resolve(process.cwd(), 'Document');  // 获取当前工作目录下的 'data' 文件夹的绝对路径
export const dataPaths = {
  holidays: path.resolve(DATA_PATH, 'holidays.json'),
  jieqi: path.resolve(DATA_PATH, 'jieqi.json'),
  astro: path.resolve(DATA_PATH, 'astro.json'),
  calendar: path.resolve(DATA_PATH, 'calendar.json'),
  shichen: path.resolve(DATA_PATH, 'shichen.json'),
};
// 打印所有目录
logInfo("打印所有目录:");
Object.entries(dataPaths).forEach(([key, value]) => {
  logInfo(`${key}: ${value}`);
});
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
          description: descParts,
          priority: 1
        }));
        logInfo(`✅ 添加节假日事件: ${formattedDate} - ${name}`);
      });
    });
    // 打印 allEvents
    //console.log("Jiejiari allEvents：", allEvents);
  },
  /**
   * **处理节气数据**
   */
  jieqi: (data, allEvents) => {
  logInfo("🛠️ 处理节气数据...");
  // 遍历所有日期键
  Object.keys(data).forEach(dateKey => {
    const reconstructionData = data[dateKey]?.Reconstruction;
    // 确保 Reconstruction 存在并且是数组
    if (!Array.isArray(reconstructionData) || reconstructionData.length === 0) {
      return logInfo(`❌ jieqi ${dateKey} Reconstruction 数据不存在！`);
    }
    // 遍历 Reconstruction 数组（过滤掉 errno 和 errmsg）
    reconstructionData.forEach(entry => {
      if (!entry || typeof entry !== "object" || !Array.isArray(entry.data)) {
        return logInfo(`❌ jieqi ${dateKey} Reconstruction 数据格式错误: ${JSON.stringify(entry)}`);
      }
      entry.data.forEach(event => {
        if (!event.name || !event.time) {
          logInfo(`❌ jieqi ${dateKey} 缺少 name 或 time: ${JSON.stringify(event)}`);
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
          isAllDay: true,
          description: event.name,
          priority: 2
        }));
        logInfo(`✅ 添加节气事件: ${event.time} - ${event.name}`);
      });
    });
  });
  // 打印 allEvents
  //console.log("Jieqi allEvents：", allEvents);
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
      // 处理 description（去除 range 以外的其他字段）
      let description = Object.keys(details)
        .map(key => {
          let value = details[key];
          if (value.length > 10) {
            return value + "\r\n";  // 在值后添加换行符
          }
          return value;
        })
        .join(" ");  // 使用 " | " 分隔各个值
      // 遍历日期范围，确保每天都生成数据
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const eventDate = currentDate.toISOString().split("T")[0].replace(/-/g, ''); // 转换为 YYYYMMDD 格式
        allEvents.push(createEvent({
          date: eventDate,
          title: name || " ",
          isAllDay: true,
          description,
          priority: 3
        }));
        logInfo(`✅ 添加天文事件: ${eventDate} - ${name}`);
        currentDate.setDate(currentDate.getDate() + 1); // 日期 +1
      }
    });
  });
  // 打印 allEvents
  //console.log("Astro allEvents：", allEvents);
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
                const title = event.hour || " "; // 如果没有 hour，默认用“时辰事件”
                // 转换日期格式为 YYYYMMDD
                const eventDate = date.replace(/-/g, ''); // 将日期格式化为 YYYYMMDD
                allEvents.push(createEvent({
                    date: eventDate, // 直接使用 Reconstruction 的 key 作为日期，已格式化为 YYYYMMDD
                    title,
                    startTime,
                    endTime,
                    isAllDay: true,
                    description,
                    priority: 4
                }));
            });
        });
    });
    // 打印 allEvents
    //console.log("Shichen allEvents：", allEvents);
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
                    return (Array.isArray(value) ? value.join(" ") : value);
                })
                .join(" | ");
            // 生成事件标题
            let title = event.cnWeek || " ";
            if (event.festivals) title += ` ${event.festivals}`;
            // 处理闰年和闰月
            let leapYear = event.leapYear === true ? "闰年" : "平年";
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
                isAllDay: true,
                priority: 5
            }));
        });
    });
    // 打印 allEvents
    //console.log("calendar allEvents：", allEvents);
  }
};
// 异步加载所有 JSON 文件的数据
const loadData = async () => {
  try {
    // 使用 fs.promises.readFile 来读取 JSON 文件
    const holidaysData = JSON.parse(await fs.readFile(dataPaths.holidays, 'utf8'));
    const jieqiData = JSON.parse(await fs.readFile(dataPaths.jieqi, 'utf8'));
    const astroData = JSON.parse(await fs.readFile(dataPaths.astro, 'utf8'));
    const calendarData = JSON.parse(await fs.readFile(dataPaths.calendar, 'utf8'));
    const shichenData = JSON.parse(await fs.readFile(dataPaths.shichen, 'utf8'));
    // 初始化 allEvents 数组
    const allEvents = [];
    // 处理各类数据
    processors.holidays(holidaysData, allEvents);
    processors.jieqi(jieqiData, allEvents);
    processors.astro(astroData, allEvents);
    processors.shichen(shichenData, allEvents);
    processors.calendar(calendarData, allEvents);
    // 打印合并后的 allEvents
    console.log("合并后的 allEvents：", allEvents);
    return allEvents;  // 返回合并后的 allEvents 数组
  } catch (error) {
    console.error('Error reading or processing data:', error);
  }
};


// 合并事件数据，按日期合并相同日期的事件
const mergeEvents = (events) => {
  const mergedEvents = {};
  events.forEach(event => {
    // 如果该日期还没有记录，初始化一个新的事件
    if (!mergedEvents[event.date]) {
      mergedEvents[event.date] = {
        date: event.date,
        title: event.title,
        location: event.location,
        isAllDay: event.isAllDay,
        startTime: event.startTime,
        endTime: event.endTime,
        travelTime: event.travelTime,
        repeat: event.repeat,
        alarm: event.alarm,
        attachment: event.attachment,
        url: event.url,
        badge: event.badge,
        description: event.description,
        priority: event.priority,
      };
    } else {
      // 如果该日期已有记录，则合并标题和备注
      const mergedEvent = mergedEvents[event.date];
      // 合并标题，使用 `|` 连接
      mergedEvent.title = `${mergedEvent.title}|${event.title}`;
      // 合并描述
      mergedEvent.description = `${mergedEvent.description}|${event.description}`;
      // 比较优先级，优先级越小，越优先
      if (event.priority < mergedEvent.priority) {
        mergedEvent.priority = event.priority;
      }
    }
  });
  // 返回合并后的事件数据
  return Object.values(mergedEvents);
};
// 生成 ICS 文件
const generateICS = async (events) => {
  logInfo(`📝 正在生成 ICS 文件...`);
  // 先合并事件
  const mergedEvents = mergeEvents(events);
  // 生成 ICS 内容
  const icsData = mergedEvents.map(event => {
    // 打印每个事件的详细数据
    logInfo(`🎯 生成 ICS 事件: ${JSON.stringify(event)}`);
    // 格式化时间，确保即使没有值也能正常处理
    const startTimeFormatted = event.startTime ? event.startTime.replace(":", "") + "00" : "000000";  // 默认值
    const endTimeFormatted = event.endTime ? event.endTime.replace(":", "") + "00" : "235959";      // 默认值
    // 生成 ICS 事件内容
    return `
BEGIN:VEVENT
SUMMARY:${event.title}
LOCATION:${event.location || ''}  // 添加 location 字段
DTSTART:${event.date.replace(/-/g, '')}T${startTimeFormatted}
DTEND:${event.date.replace(/-/g, '')}T${endTimeFormatted}
DESCRIPTION:${typeof event.description === 'string' ? event.description : JSON.stringify(event.description)}
ATTACHMENT:${event.attachment || ''}  // 确保处理 attachment 字段
URL:${event.url || ''}  // 添加 url 字段
BADGE:${event.badge || ''}  // 添加 badge 字段
ISALLDAY:${event.isAllDay || false}  // 添加 isAllDay 字段
TRAVELTIME:${event.travelTime || ''}  // 添加 travelTime 字段
REPEAT:${event.repeat || ''}  // 添加 repeat 字段
ALARM:${event.alarm || ''}  // 添加 alarm 字段
END:VEVENT`;
  }).join("\n");
  // 打印生成的 ICS 内容（调试用）
  logInfo(`生成的 ICS 数据: \n${icsData}`);
  // 将 ICS 数据写入文件
  await fs.writeFile(icsFilePath, `BEGIN:VCALENDAR\nVERSION:2.0\n${icsData}\nEND:VCALENDAR`);
  logInfo(`✅ ICS 文件生成成功: ${icsFilePath}`);
};
// 调用数据加载和 ICS 生成过程
const main = async () => {
  const allEvents = await loadData();  // 获取合并后的 allEvents
  if (allEvents) {
    await generateICS(allEvents);  // 生成 ICS 文件
  }
};
main();  // 执行














/*
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
// 调用数据加载和 ICS 生成过程
const main = async () => {
  const allEvents = await loadData();  // 获取合并后的 allEvents
  if (allEvents) {
    await generateICS(allEvents);  // 生成 ICS 文件
  }
};
main();  // 执行
*/