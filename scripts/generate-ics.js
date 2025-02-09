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

        allEvents.push({
          date,
          title: event.name,
          startTime: time,
          isAllDay: false,
          description,
        });
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

        allEvents.push({
          date,
          title: `${isOffDay ? '[休]' : '[班]'} ${name}`,
          isAllDay: true,
          description: descParts
        });
      });
    });
    logInfo("✅ 节假日数据处理完成");
  },

  //处理astro.json
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
        const description = Object.values(data)
          .map(value => (typeof value === "object" ? JSON.stringify(value) : value))
          .join(" | ");

        allEvents.push({
          date: dateStr,
          title: "",  // 不设置标题
          isAllDay: true,
          description, // 所有值写进备注
        });

        // 日期 +1 天
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    logInfo("✅ 天文数据处理完成");
  },

  //处理calendar.json
  calendar: (records, allEvents) => {
    logInfo("🛠️ 开始处理日历数据");
    Object.entries(records).forEach(([date, record]) => {
      record.Reconstruction?.forEach(entry => {
        if (!entry.data) {
          logError(`❌ calendar.json 缺少有效数据: ${JSON.stringify(entry)}`);
          return;
        }

        const { data } = entry;

        // 需要提取的对象字段
        const extractFields = ["data", "lunar", "almanac", "jishenfangwei"];

        // 提取数据并转换为数组
        const values = extractFields.flatMap(field => 
          data[field] ? Object.values(data[field]) : []
        );

        // 额外提取单个值
        ["liuyao", "jiuxing", "taisui"].forEach(key => {
          if (data.almanac?.[key]) values.push(data.almanac[key]);
        });

        // 将所有值拼接成字符串
        const description = values
          .map(value => (typeof value === "object" ? JSON.stringify(value) : value))
          .join(" | ");

        allEvents.push({
          date,  // 直接使用 JSON key 作为日期
          title: "",  // 不设置标题
          isAllDay: true,
          description, // 所有值写进备注
        });
      });
    });
    logInfo("✅ 日历数据处理完成");
  }
};

/**
 * 生成 ICS 文件
 */
const generateICS = async () => {
  const allEvents = [];

  // 读取和处理所有 JSON 数据
  await Promise.all(Object.entries(dataPaths).map(async ([fileKey, filePath]) => {
    const jsonData = await readJsonData(filePath);
    Object.values(jsonData).forEach(records => {
      if (processors[fileKey]) {
        processors[fileKey](records, allEvents);
      }
    });

    // 🔍 确保数据成功添加到 allEvents
    logInfo(`🔍 处理 ${fileKey} 后，当前 allEvents 事件数量: ${allEvents.length}`);
  }));

  // ✅ 记录所有事件数据
  logInfo(`📌 解析后的所有事件数据: ${JSON.stringify(allEvents, null, 2)}`);

  // 过滤出有效的事件
  const validEvents = allEvents.filter(event => event.date && event.description);
  logInfo(`📅 有效的事件数量: ${validEvents.length}`);

  if (validEvents.length === 0) {
    logError('❌ 没有有效的事件数据，跳过 ICS 文件生成');
    return;
  }

  // 逐个打印所有有效的事件
  validEvents.forEach(event => {
    logInfo(`📝 事件详情: 日期 - ${event.date}, 标题 - ${event.title}, 备注 - ${event.description}`);
  });

  // 生成 ICS 内容
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...validEvents.map(event => 
      `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}\r\nSUMMARY:${event.title}\r\nDESCRIPTION:${event.description}\r\nEND:VEVENT`
    ),
    'END:VCALENDAR'
  ].join('\r\n');

  // ✅ 确保 ICS 内容正确
  logInfo(`✅ 即将写入 ICS 文件内容:\n${icsContent}`);

  // ✅ 打印目标文件路径
  logInfo(`📂 目标 ICS 文件路径: ${icsFilePath}`);

  // 使用同步写入，确保数据写入成功
  try {
    fs.writeFileSync(icsFilePath, icsContent, 'utf8');
    logInfo(`✅ ICS 文件同步写入成功: ${icsFilePath}`);

    // 读取 `.ics` 文件，确保写入正确
    const writtenContent = fs.readFileSync(icsFilePath, 'utf8');
    logInfo(`📖 读取已写入的 ICS 文件内容:\n${writtenContent}`);
  } catch (err) {
    logError(`❌ 生成 ICS 文件失败: ${err.message}`);
  }
};

// 执行
generateICS();