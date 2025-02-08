const generateICS = () => {
  ensureDirectoryExists(icsFilePath);

  const data = {};
  const invalidFiles = [];

  // 读取 JSON 数据
  for (const [key, filePath] of Object.entries(dataPaths)) {
    const jsonData = readJson(filePath);

    if (jsonData === null) {
      logToFile(`⚠️ 文件 ${key}.json 读取失败，跳过！`, 'ERROR');
      invalidFiles.push(key);
      continue;
    }

    if (!validateDataStructure(jsonData, ['date'])) {
      logToFile(`⚠️ 无效的 ${key}.json 数据结构，跳过！`, 'ERROR');
      invalidFiles.push(key);
      continue;
    }

    data[key] = jsonData;
  }

  // 如果所有 JSON 数据都无效，终止生成
  if (Object.keys(data).length === 0) {
    logToFile('❌ 所有 JSON 文件都无效，无法生成 ICS！', 'ERROR');
    return;
  }

  // 获取所有日期
  const allDates = new Set([
    ...Object.values(data.holidays || {}).map(h => h.date),
    ...Object.values(data.jieqi || {}).map(j => j.date),
    ...Object.values(data.calendar || {}).map(c => c.date),
    ...Object.values(data.shichen || {}).map(s => s.date),
  ]);

  let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MyCalendar//EN\r\nCALSCALE:GREGORIAN\r\n';

  // 遍历日期，生成 ICS 事件
  allDates.forEach(date => {
    icsContent += generateICSEvent(
      date,
      data.holidays || {},
      data.jieqi || {},
      data.astro || {},
      data.calendar || {},
      data.shichen || {}
    );
  });

  icsContent += 'END:VCALENDAR\r\n';

  try {
    fs.writeFileSync(icsFilePath, icsContent);
    logToFile(`✅ ICS 日历文件生成成功！ (跳过无效 JSON: ${invalidFiles.join(', ')})`, 'INFO');
  } catch (error) {
    logToFile(`❌ 生成 ICS 文件失败: ${error.message}`, 'ERROR');
  }
};