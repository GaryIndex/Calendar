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
/*const processors = {
  // 处理节气数据
  jieqi: (records, allEvents) => {
    records.Reconstruction?.forEach(item => {
      const date = item.date || item.data?.date;
      if (!date) {
        logError(`❌ 节气数据缺少日期: ${JSON.stringify(item)}`);
        return;
      }

      allEvents.push({
        date,
        title: item.data?.name,
        startTime: item.data?.time,
        isAllDay: false,
        description: ''
      });
    });
  },
*/
const processors = {
  // 处理节气数据
  jieqi: (records, allEvents) => {
    records.Reconstruction?.forEach(item => {
      // 获取每个节气的 time 字段，提取出日期部分
      const time = item.data?.time;
      if (!time) {
        logError(`❌ 节气数据缺少时间: ${JSON.stringify(item)}`);
        return;
      }

      // 提取日期部分（格式：YYYY-MM-DD）
      const date = time.split(' ')[0];

      allEvents.push({
        date,
        title: item.data?.name,
        startTime: time,
        isAllDay: false,
        description: ''
      });
    });
  },
};


  // 处理时辰数据
  shichen: (records, allEvents) => {
    records.Reconstruction?.forEach(recon => {
      // 检查 recon.data 是否是数组
      if (Array.isArray(recon.data)) {
        recon.data.forEach(entry => {
          const descParts = [
            `${entry.date} ${entry.hours}`,
            entry.hour,
            entry.yi !== '无' ? entry.yi : null,
            entry.ji,
            entry.chong,
            entry.sha,
            entry.nayin,
            entry.jiuxing
          ].filter(Boolean).join(' ');

          allEvents.push({
            date: entry.date,
            title: '时辰信息',
            isAllDay: true,
            description: descParts
          });
        });
      } else {
        logError(`⚠️ 文件 ${fileKey} 中的 recon.data 不是数组: ${JSON.stringify(recon.data)}`);
      }
    });
  },
/*
  // 处理节假日数据
  holidays: (records, allEvents) => {
    records.Reconstruction?.forEach(item => {
      const descParts = item.data ? 
        Object.entries(item.data)
          .filter(([k]) => !['date', 'name', 'isOffDay'].includes(k))
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ') : '';

      allEvents.push({
        date: item.date,
        title: `${item.data?.isOffDay ? '[休]' : '[班]'} ${item.data?.name}`,
        isAllDay: true,
        description: descParts
      });
    });
  },
*/

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

  // 生成ICS内容
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chinese Calendar//EN',
    'CALSCALE:GREGORIAN',
    ...allEvents.map(event => generateICSEvent(event)),
    'END:VCALENDAR'
  ].join('\r\n');

  try {
    await fs.promises.writeFile(icsFilePath, icsContent);
    logInfo(`✅ ICS文件生成成功！共包含 ${allEvents.length} 个事件`);
    console.log('✅ ICS 文件成功写入:', icsFilePath); // 新增日志输出
  } catch (error) {
    logError(`❌ 写入ICS文件失败: ${error.message}`);
    console.log('❌ 写入 ICS 文件失败:', error.message); // 错误输出
  }
};

// 运行生成器
generateICS();