const fs = require('fs');
const path = require('path');

// 日志文件路径
const logFilePath = path.join(__dirname, './data/error.log');

// 确保目录存在
const ensureDirectoryExistence = async (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
};

// 创建日志目录
ensureDirectoryExistence(logFilePath);

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
    
    // 动态导入 chalk
    const chalk = (await import('chalk')).default;
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
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logError(`❌ 文件不存在: ${filePath}`);
      return {};
    }

    console.log(`📂 读取文件: ${filePath}`);
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
        // 获取每个节气的 time 字段，提取出日期部分
        const time = event.time;
        if (!time) {
          logError(`❌ 节气数据缺少时间: ${JSON.stringify(event)}`);
          return;
        }

        // 提取日期部分（格式：YYYY-MM-DD）
        const date = time.split(' ')[0];

        // 填充节气的描述信息（可选，根据需要调整）
        const description = `节气: ${event.name}`;

        allEvents.push({
          date,
          title: event.name, // 节气名称
          startTime: time, // 完整时间
          isAllDay: false, // 设为非全天事件
          description, // 可选的描述信息
        });
      });
    });
  },

  // 处理时辰数据
  shichen: (records, allEvents) => {
    records.Reconstruction?.forEach(recon => {
      // 检查 recon.data 是否是数组
      if (Array.isArray(recon.data)) {
        recon.data.forEach(entry => {
          // 拼接描述信息
          const descParts = [
            `${entry.date} ${entry.hours}`,
            entry.yi !== '无' ? entry.yi : null,
            entry.ji,
            entry.chong,
            entry.sha,
            entry.nayin,
            entry.jiuxing
          ].filter(Boolean).join(' ');

          // 将时辰信息推送到 allEvents 数组
          allEvents.push({
            date: entry.date,
            title: entry.hour,  // 使用时辰名称作为标题
            isAllDay: true,
            description: descParts
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
      // 遍历每个节假日的日期
      Object.entries(item).forEach(([key, holiday]) => {
        const { date, name, isOffDay } = holiday;

        // 确保日期、节日名称和是否休假有效
        if (!date || !name || isOffDay === undefined) {
          logError(`❌ 节假日数据缺失关键字段: ${JSON.stringify(holiday)}`);
          return;
        }

        // 生成描述信息
        const descParts = Object.entries(holiday)
          .filter(([k]) => !['date', 'name', 'isOffDay'].includes(k))
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');

        allEvents.push({
          date, // 使用节假日的日期
          title: `${isOffDay ? '[休]' : '[班]'} ${name}`, // 标题显示休假或上班
          isAllDay: true, // 设为全天事件
          description: descParts // 描述包含其他信息
        });
      });
    });
  },

  // 处理带data数组的通用数据
common: (records, allEvents, fileKey) => {
  console.log(`📂 正在处理文件: ${fileKey}`);

  records.Reconstruction?.forEach(recon => {
    let entries = [];

    // 兼容 data 既可能是数组也可能是对象
    if (Array.isArray(recon.data)) {
      console.log(`✅ ${fileKey}: data 字段是数组，共 ${recon.data.length} 条数据`);
      entries = recon.data;
    } else if (typeof recon.data === 'object' && recon.data !== null) {
      console.log(`✅ ${fileKey}: data 字段是对象，已转换为数组`);
      entries = [recon.data]; // 转换为数组，统一处理
    } else {
      logError(`⚠️ ${fileKey}: data 既不是对象也不是数组: ${JSON.stringify(recon.data)}`);
      return;
    }

    // 遍历处理数据
    entries.forEach((entry, index) => {
      console.log(`🔍 处理第 ${index + 1} 条数据: ${JSON.stringify(entry)}`);

      const { date, name, range, zxtd, lunar, almanac } = entry;
      const { cnYear, cnMonth, cnDay, cyclicalYear, cyclicalMonth, cyclicalDay, zodiac } = lunar || {};
      const { yi, ji, chong, sha, jishenfangwei } = almanac || {};

      // 提取吉神方位
      const jishenfangweiStr = jishenfangwei 
        ? Object.entries(jishenfangwei).map(([key, value]) => `${key}: ${value}`).join(' ')
        : '';

      // 组装 description 字段
      const descParts = [
        name, range, zxtd, // 原本的字段
        `农历: ${cnYear}年 ${cnMonth}${cnDay} (${cyclicalYear}年 ${cyclicalMonth}月 ${cyclicalDay}日) ${zodiac}年`,
        `宜: ${yi}`, `忌: ${ji}`, `冲: ${chong}`, `煞: ${sha}`,
        `吉神方位: ${jishenfangweiStr}`
      ].filter(Boolean).join(' | ');

      console.log(`📝 生成事件 - 日期: ${date}, 标题: ${fileKey.toUpperCase()}, 描述: ${descParts}`);

      allEvents.push({
        date,
        title: fileKey.toUpperCase(),
        isAllDay: true,
        description: descParts
      });
    });

    console.log(`✅ ${fileKey}: 数据处理完成，共生成 ${entries.length} 个事件`);
  });
}
/*
  common: (records, allEvents, fileKey) => {
    records.Reconstruction?.forEach(recon => {
      // 检查 recon.data 是否是数组
      if (Array.isArray(recon.data)) {
        recon.data.forEach(entry => {
          const descParts = [
            entry.name,
            entry.range,
            entry.zxtd
          ].filter(Boolean).join(' ');

          allEvents.push({
            date: entry.date,
            title: fileKey.toUpperCase(),
            isAllDay: true,
            description: descParts
          });
        });
      } else {
        logError(`⚠️ 文件 ${fileKey} 中的 recon.data 不是数组: ${JSON.stringify(recon.data)}`);
      }
    });
  }
};


/**
 * 生成ICS事件内容
 */
const generateICSEvent = (event) => {
  if (!event.date) {
    logError(`❌ 事件缺少日期: ${JSON.stringify(event)}`);
    return ''; // 如果没有日期，跳过该事件
  }

  let dtstart;
  if (event.isAllDay) {
    dtstart = `DTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}`;
  } else {
    const dateObj = new Date(event.startTime);
    const formattedDate = [
      dateObj.getUTCFullYear(),
      String(dateObj.getUTCMonth() + 1).padStart(2, '0'),
      String(dateObj.getUTCDate()).padStart(2, '0')
    ].join('');
    dtstart = `DTSTART;VALUE=DATE:${formattedDate}`;
  }

  return [
    'BEGIN:VEVENT',
    dtstart,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    'END:VEVENT'
  ].join('\r\n');
};

/**
 * 生成ICS日历文件
 */
const generateICS = async () => {
  const allEvents = [];

  // 并行处理所有数据文件
  await Promise.all(Object.entries(dataPaths).map(async ([fileKey, filePath]) => {
    const jsonData = await readJsonData(path.resolve(__dirname, filePath));
    
    Object.values(jsonData).forEach(records => {
      if (fileKey === 'jieqi') processors.jieqi(records, allEvents);
      else if (fileKey === 'shichen') processors.shichen(records, allEvents);
      else if (fileKey === 'holidays') processors.holidays(records, allEvents);
      else processors.common(records, allEvents, fileKey);
    });
  }));

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...allEvents.map(generateICSEvent),
    'END:VCALENDAR'
  ].join('\r\n');

  try {
    await fs.promises.writeFile(icsFilePath, icsContent, 'utf-8');
    logInfo(`✅ 生成 ICS 文件: ${icsFilePath}`);
  } catch (err) {
    logError(`❌ 生成 ICS 文件失败: ${err.message}`);
  }
};

// 生成 ICS 文件
generateICS();