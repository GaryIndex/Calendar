const fs = require('fs');
const path = require('path');

const dataPaths = {
  holidays: './data/Document/holidays.json',
  jieqi: './data/Document/jieqi.json',
  astro: './data/Document/astro.json',
  calendar: './data/Document/calendar.json',
  shichen: './data/Document/shichen.json',
};

const icsFilePath = path.join(__dirname, '../calendar.ics');

/**
 * 确保目录存在
 * @param {string} filePath
 */
const ensureDirectoryExists = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logToFile(`✅ 目录已创建: ${dir}`, 'INFO');
  }
};

/**
 * 读取 JSON 文件并解析 Reconstruction 层
 * @param {string} filePath
 * @returns {Object}
 */
const readJsonReconstruction = (filePath) => {
  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    if (!rawData.trim()) {
      logToFile(`⚠️ 文件 ${filePath} 为空，跳过！`, 'ERROR');
      return [];
    }
    const data = JSON.parse(rawData);

    // 完整打印数据结构，避免截断
    logToFile(`📂 读取文件: ${filePath}，数据结构: ${JSON.stringify(data, null, 2)}`, 'INFO');

    // 返回 Reconstruction 中的所有数据（数组）
    return data.Reconstruction || [];
  } catch (error) {
    logToFile(`❌ 读取文件失败: ${filePath} - 错误: ${error.message}`, 'ERROR');
    return [];
  }
};

/**
 * 过滤无效数据
 * @param {Object} data
 * @returns {Object}
 */
const filterValidData = (data) => {
  const filteredData = {};
  // 遍历数据，确保每一项都是有效的
  data.forEach((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const { errno, errmsg, ...validFields } = item;

      // 输出有效字段的内容
      console.log('Filtered Valid Fields:', validFields);

      if (Object.keys(validFields).length > 0) {
        if (Array.isArray(validFields)) {
          validFields.forEach((record, index) => {
            if (record && typeof record === 'object') {
              filteredData[record.date || `data-${index}`] = record;
            }
          });
        } else {
          // 处理常规对象字段
          for (const [date, record] of Object.entries(validFields)) {
            if (record && typeof record === 'object') {
              filteredData[date] = record;
            }
          }
        }
      }
    }
  });
  console.log('Filtered Data:', filteredData);  // 打印过滤后的结果
  return filteredData;
};

/**
 * 日志记录
 * @param {string} message
 * @param {string} level
 */
const logToFile = (message, level = 'INFO') => {
  const logMessage = `[${new Date().toISOString()}] [${level}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync('./data/error.log', logMessage + '\n');
};

/**
 * 生成 ICS 事件
 * @param {string} date
 * @param {Object} dataByCategory
 * @returns {string}
 */
const generateICSEvent = (date, dataByCategory) => {
  let summary = '';
  let description = [];

  console.log(`📅 正在处理日期: ${date}`);

  for (const [category, records] of Object.entries(dataByCategory)) {
    records.forEach((record) => {
      if (record[date]) {
        console.log(`✅ ${date} 存在于 ${category}`);
        const recordData = record[date];

        // 设置 `SUMMARY`
        if (!summary && recordData.name) {
          summary = recordData.name;
        }

        description.push(`${category.toUpperCase()} 信息:\n${JSON.stringify(recordData, null, 2)}`);
      }
    });
  }

  if (!summary) {
    console.log(`⚠️ ${date} 没有有效事件`);
    return '';
  }

  console.log(`📌 生成事件: ${summary}`);

  return `
BEGIN:VEVENT
DTSTART;VALUE=DATE:${date.replace(/-/g, '')}
SUMMARY:${summary}
DESCRIPTION:${description.join('\\n')}
END:VEVENT
`;
};

/**
 * 生成 ICS 日历
 */
const generateICS = () => {
  ensureDirectoryExists(icsFilePath);

  const dataByCategory = {};
  const invalidFiles = [];

  // 📌 读取 JSON 数据
  for (const [key, filePath] of Object.entries(dataPaths)) {
    const jsonData = readJsonReconstruction(filePath);

    if (jsonData.length === 0) {
      logToFile(`⚠️ ${key}.json 读取失败或数据为空，跳过！`, 'ERROR');
      invalidFiles.push(key);
      continue;
    }

    dataByCategory[key] = jsonData.map((item) => filterValidData([item]));
  }

  // 📌 获取所有日期
  const allDates = new Set(
    Object.values(dataByCategory)
      .flatMap((categoryData) => categoryData.flatMap((item) => Object.keys(item)))
  );

  let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyCalendar//EN\r\nCALSCALE:GREGORIAN\r\n';
  let eventCount = 0;

  // 📌 遍历日期，生成 ICS 事件
  allDates.forEach((date) => {
    const event = generateICSEvent(date, dataByCategory);
    if (event.trim()) {
      icsContent += event;
      eventCount++;
    }
  });

  icsContent += 'END:VCALENDAR\r\n';

  try {
    fs.writeFileSync(icsFilePath, icsContent);
    logToFile(`✅ ICS 日历文件生成成功！ 共 ${eventCount} 个事件 (跳过无效 JSON: ${invalidFiles.join(', ')})`, 'INFO');
  } catch (error) {
    logToFile(`❌ 生成 ICS 文件失败: ${error.message}`, 'ERROR');
  }
};

// 📌 执行 ICS 生成
generateICS();