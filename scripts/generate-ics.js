import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fs from 'fs';

/**
 * 创建事件对象
 * @param {Object} params - 事件参数
 * @param {string} params.date - 事件的日期（格式: YYYY-MM-DD）
 * @param {string} params.title - 事件标题
 * @param {string} [params.location=""] - 位置或视频通话（默认为空）
 * @param {boolean} [params.isAllDay=false] - 是否全天事件（默认为 false）
 * @param {string} [params.startTime=""] - 开始时间（格式: HH:mm:ss，默认为空）
 * @param {string} [params.endTime=""] - 结束时间（格式: HH:mm:ss，默认为空）
 * @param {string} [params.travelTime=""] - 行程时间（默认为空）
 * @param {string} [params.repeat=""] - 重复设置（默认为空）
 * @param {string} [params.alarm=""] - 提醒设置（默认为空）
 * @param {string} [params.attachment=""] - 附件（默认为空）
 * @param {string} [params.url=""] - URL（默认为空）
 * @param {string} [params.badge=""] - 角标（如“休”或“班”，默认为空）
 * @param {string} params.description - 事件描述（拼接的备注信息）
 * @param {number} [params.priority=0] - 事件优先级（数值越高，优先级越高，默认为 0）
 * 
 * @returns {Object} 事件对象
 */
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
  priority = 0 // 🔥 新增优先级字段，默认 0
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
    priority // 🔥 返回优先级字段
  };
}

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
    records.Reconstruction?.forEach(item => {
      item.data?.forEach(event => {
        const time = event.time;
        if (!time) {
          logError(`❌ 节气数据缺少时间: ${JSON.stringify(event)}`);
          return;
        }
        const date = time.split(' ')[0];
        const description = `节气: ${event.name}`;

        allEvents.push(createEvent({
          date,
          title: event.name,
          startTime: time,
          isAllDay: false,
          description,
        }));
      });
    });
    logInfo("✅ 节气数据处理完成");
  },

  // 处理时辰数据
  shichen: (records, allEvents) => {
    logInfo("🛠️ 开始处理时辰数据");
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

          allEvents.push(createEvent({
            date: entry.date,
            title: entry.hour,
            isAllDay: true,
            description: descParts
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

        const descParts = Object.entries(holiday)
          .filter(([k]) => !['date', 'name', 'isOffDay'].includes(k))
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');

        allEvents.push(createEvent({
          date,
          title: `${isOffDay ? '[休]' : '[班]'} ${name}`,
          isAllDay: true,
          description: descParts
        }));
      });
    });
    logInfo("✅ 节假日数据处理完成");
  },

  // 处理天文数据
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

      // 计算日期范围
      let currentDate = new Date(start);
      const endDate = new Date(end);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split("T")[0]; // 格式化 YYYY-MM-DD

        // 提取所有值，不要键名
        const description = Object.entries(data)
          .filter(([key]) => key !== "range")
          .map(([key, value]) => `${key}: ${value}`)
          .join(" | ");

        allEvents.push(createEvent({
          date: dateStr,
          title: entry.name,
          description,
          isAllDay: true
        }));

        currentDate.setDate(currentDate.getDate() + 1); // 增加一天
      }
    });
    logInfo("✅ 天文数据处理完成");
  }
},
// 处理万年历数据（calendar.json）
processors.calendar = (records, allEvents) => {
  logInfo("🛠️ 开始处理万年历数据");

  Object.entries(records).forEach(([date, data]) => {
    const reconstructions = data.Reconstruction || [];
    
    reconstructions.forEach(entry => {
      // 移除不需要的字段
      delete entry.errno;
      delete entry.errmsg;

      const title = entry.festivals || "万年历信息"; // 如果 festivals 为空，使用默认标题
      const description = Object.values(entry).filter(Boolean).join(" | "); // 仅保留值，不显示键

      allEvents.push(createEvent({
        date,
        title,
        isAllDay: true,
        description
      }));
    });
  });
  logInfo("✅ 万年历数据处理完成");
};

// 生成 ICS 文件
const generateICS = async (events) => {
  const icsData = events.map(event => `
BEGIN:VEVENT
SUMMARY:${event.title}
DTSTART:${event.date}T${event.startTime.replace(":", "")}00
DTEND:${event.date}T${event.endTime.replace(":", "")}00
DESCRIPTION:${event.description}
LOCATION:${event.location}
STATUS:${event.isAllDay ? 'ALL DAY' : 'CONFIRMED'}
ATTENDEE;CN="None":MAILTO:none@example.com
END:VEVENT`).join("\n");

  const icsContent = `BEGIN:VEVENT
BEGIN:VEVENT
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Your Company//NONSGML v1.0//EN
CALSCALE:GREGORIAN
BEGIN:VTIMEZONE
TZID:Asia/Shanghai
BEGIN:DAYLIGHT
TZOFFSETFROM:+0800
TZOFFSETTO:+0800
TZNAME:CST
DTSTART:19700101T000000
END:DAYLIGHT
END:VTIMEZONE
${icsData}
END:VEVENT
END:VCALENDAR`;

  try {
    await fs.promises.writeFile(icsFilePath, icsContent);
    logInfo(`✅ ICS 文件成功生成: ${icsFilePath}`);
  } catch (err) {
    logError(`❌ 生成 ICS 文件失败: ${err.message}`);
  }
};

(async () => {
  // 读取数据
  const allEvents = [];
  const [holidaysData, jieqiData, astroData, shichenData, calendarData] = await Promise.all(
  Object.values(dataPaths).map(readJsonData)
);

// 处理所有数据源
processors.holidays(holidaysData, allEvents);
processors.jieqi(jieqiData, allEvents);
processors.astro(astroData, allEvents);
processors.shichen(shichenData, allEvents);
processors.calendar(calendarData, allEvents); // ✅ 处理 calendar.json
  // 生成 ICS 文件
  await generateICS(allEvents);
})();