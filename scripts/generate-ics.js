/**
 * 生成 ICS 事件
 * @param {string} date
 * @param {Object} dataByCategory
 * @returns {string}
 */
const generateICSEvent = (date, dataByCategory) => {
  let summary = [];
  let description = [];

  // 确保有数据可以生成 ICS 事件
  for (const [category, records] of Object.entries(dataByCategory)) {
    if (records[date]) {
      const record = records[date];
      summary.push(record.name || category);
      description.push(`${category.toUpperCase()} 信息:`);

      for (const [key, value] of Object.entries(record)) {
        description.push(`- ${key}: ${value}`);
      }
    }
  }

  if (summary.length === 0) summary.push('日历事件');

  return `
BEGIN:VEVENT
DTSTART;VALUE=DATE:${date.replace(/-/g, '')}
SUMMARY:${summary.join(' ')}
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

    if (jsonData === null) {
      logToFile(`⚠️ ${key}.json 读取失败，跳过！`, 'ERROR');
      invalidFiles.push(key);
      continue;
    }

    dataByCategory[key] = jsonData;
  }

  // 📌 获取所有日期
  const allDates = new Set(
    Object.values(dataByCategory)
      .flatMap((categoryData) => Object.keys(categoryData))
  );

  // Debug: 打印所有日期，确保加载了数据
  logToFile(`所有日期: ${[...allDates].join(', ')}`, 'INFO');

  let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyCalendar//EN\r\nCALSCALE:GREGORIAN\r\n';

  // 📌 遍历日期，生成 ICS 事件
  allDates.forEach(date => {
    icsContent += generateICSEvent(date, dataByCategory);
  });

  icsContent += 'END:VCALENDAR\r\n';

  try {
    fs.writeFileSync(icsFilePath, icsContent);
    logToFile(`✅ ICS 日历文件生成成功！ (跳过无效 JSON: ${invalidFiles.join(', ')})`, 'INFO');
  } catch (error) {
    logToFile(`❌ 生成 ICS 文件失败: ${error.message}`, 'ERROR');
  }
};

// 📌 执行 ICS 生成
generateICS();