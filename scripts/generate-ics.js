const fs = require('fs');
const path = require('path');

const dataPaths = {
  holidays: './data/Document/holidays.json',
  jieqi: './data/Document/jieqi.json',
  astro: './data/Document/astro.json',
  calendar: './data/Document/calendar.json',
  shichen: './data/Document/shichen.json',
};

// 🏆 **设定多个优先级文件**
const prioritySources = ["holidays", "jieqi"];  // 先尝试 `holidays`，再尝试 `jieqi`

const icsFilePath = path.join(__dirname, './calendar.ics');

/**
 * 读取 JSON 并解析 Reconstruction 层
 * @param {string} filePath
 * @returns {Array}
 */
const readJsonReconstruction = (filePath) => {
  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    if (!rawData.trim()) {
      console.log(`⚠️ 文件 ${filePath} 为空，跳过！`);
      return [];
    }

    const data = JSON.parse(rawData);
    return Object.values(data).flatMap(entry => entry.Reconstruction || []);
  } catch (error) {
    console.log(`❌ 读取文件失败: ${filePath} - 错误: ${error.message}`);
    return [];
  }
};

/**
 * 处理数据，提取关键字段
 * @param {Array} data
 * @param {string} category
 * @param {Object} existingData
 */
const extractValidData = (data, category, existingData) => {
  data.forEach(record => {
    const dateEntry = Object.entries(record).find(([key]) => key.includes('date'));
    const date = dateEntry ? dateEntry[1] : null;
    if (!date) return;

    const nameEntry = Object.entries(record).find(([key]) => key.includes('name'));
    const name = nameEntry ? nameEntry[1] : null;

    const isOffDayEntry = Object.entries(record).find(([key]) => key.includes('isOffDay'));
    const isOffDay = isOffDayEntry ? isOffDayEntry[1] : null;
    const workStatus = isOffDay !== null ? `[${isOffDay ? '休' : '班'}] ` : '';

    const description = Object.entries(record)
      .filter(([key, value]) => !key.includes('date') && !key.includes('name') && !key.includes('isOffDay') && value)
      .map(([_, value]) => value)
      .join(' ');

    if (!existingData[date]) {
      existingData[date] = {
        category,
        name: null, // 先不设置 `name`
        isOffDay,
        description: workStatus + description
      };
    } else {
      existingData[date].description += ` | ${workStatus}${description}`;
    }

    // 🏆 **如果当前文件是优先级文件，且 `name` 未赋值，则赋值**
    if (prioritySources.includes(category) && !existingData[date].name && name) {
      existingData[date].name = name;
    }
  });

  console.log(`📊 处理 ${category} 数据，共 ${Object.keys(existingData).length} 个日期`);
};

/**
 * 生成 ICS 事件
 * @param {string} date
 * @param {Object} eventData
 * @returns {string}
 */
const generateICSEvent = (date, eventData) => {
  const summary = eventData.name || '(无标题)';
  const description = eventData.description ? eventData.description : '';

  return `
BEGIN:VEVENT
DTSTART;VALUE=DATE:${date.replace(/-/g, '')}
SUMMARY:${summary}
DESCRIPTION:${description}
END:VEVENT
`;
};

/**
 * 生成 ICS 日历
 */
const generateICS = () => {
  let allEvents = {};
  let invalidFiles = [];

  for (const [key, filePath] of Object.entries(dataPaths)) {
    const jsonData = readJsonReconstruction(filePath);
    if (jsonData.length === 0) {
      console.log(`⚠️ ${key}.json 读取失败或数据为空，跳过！`);
      invalidFiles.push(key);
      continue;
    }

    extractValidData(jsonData, key, allEvents);
  }

  // 📌 生成 ICS 内容
  let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyCalendar//EN\r\nCALSCALE:GREGORIAN\r\n';
  let eventCount = 0;

  for (const [date, eventData] of Object.entries(allEvents)) {
    const event = generateICSEvent(date, eventData);
    if (event.trim()) {
      icsContent += event;
      eventCount++;
    }
  }

  icsContent += 'END:VCALENDAR\r\n';

  // 📌 写入 ICS 文件
  try {
    fs.writeFileSync(icsFilePath, icsContent);
    console.log(`✅ ICS 日历文件生成成功！共 ${eventCount} 个事件 (跳过无效 JSON: ${invalidFiles.join(', ')})`);
  } catch (error) {
    console.log(`❌ 生成 ICS 文件失败: ${error.message}`);
  }
};

// 📌 执行 ICS 生成
generateICS();