const fs = require('fs');
const path = require('path');

const logInfo = console.log;
const logError = console.error;

const dataPaths = {
  holidays: path.join(__dirname, 'data/holidays.json'),
  jieqi: path.join(__dirname, 'data/jieqi.json'),
  astro: path.join(__dirname, 'data/astro.json'),
  calendar: path.join(__dirname, 'data/calendar.json'),
  shichen: path.join(__dirname, 'data/shichen.json'),
};

const icsFilePath = path.join(__dirname, 'calendar.ics');

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
    if (!data.Reconstruction) {
      logError(`⚠️ 文件 ${filePath} 缺少 Reconstruction 数据层`);
      return { Reconstruction: [] };
    }

    logInfo(`✅ 解析成功: ${filePath}, 数据量: ${Object.keys(data.Reconstruction).length}`);
    return data;
  } catch (error) {
    logError(`❌ 读取 JSON 失败: ${filePath} - ${error.message}`);
    return { Reconstruction: [] };
  }
};

const processors = {
  holidays: (records, allEvents) => {
    if (!records.Reconstruction) return;

    Object.values(records.Reconstruction).forEach(items => {
      items.forEach(item => {
        if (!item.date || !item.data?.name) return;

        const descParts = item.data
          ? Object.entries(item.data)
              .filter(([k]) => !['date', 'name', 'isOffDay'].includes(k))
              .map(([k, v]) => `${k}: ${v}`)
              .join(' | ')
          : '';

        allEvents.push({
          date: item.date,
          title: `${item.data?.isOffDay ? '[休]' : '[班]'} ${item.data?.name}`,
          isAllDay: true,
          description: descParts || '无描述信息',
        });
      });
    });
  },

  common: (records, allEvents, fileKey) => {
    if (!records.Reconstruction) return;

    Object.values(records.Reconstruction).forEach(items => {
      items.forEach(entry => {
        if (!entry.date || !entry.name) return;

        const descParts = [entry.name, entry.range, entry.zxtd].filter(Boolean).join(' ');

        allEvents.push({
          date: entry.date,
          title: fileKey.toUpperCase(),
          isAllDay: true,
          description: descParts || '无描述信息',
        });
      });
    });
  },
};

const generateICSEvent = (event) => {
  if (!event.date) return '';

  const dtstart = `DTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}`;
  const summary = event.title ? `SUMMARY:${event.title}` : 'SUMMARY:无标题事件';
  const description = event.description
    ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`
    : 'DESCRIPTION:无描述信息';

  return [
    'BEGIN:VEVENT',
    dtstart,
    summary,
    description,
    'END:VEVENT'
  ].join('\r\n');
};

const generateICS = async () => {
  const allEvents = [];

  await Promise.all(
    Object.entries(dataPaths).map(async ([fileKey, filePath]) => {
      const jsonData = await readJsonData(filePath);

      if (!jsonData.Reconstruction || !Object.values(jsonData.Reconstruction).length) {
        logError(`⚠️ ${filePath} 没有有效数据，跳过`);
        return;
      }

      if (fileKey === 'holidays') processors.holidays(jsonData, allEvents);
      else processors.common(jsonData, allEvents, fileKey);
    })
  );

  if (allEvents.length === 0) {
    logError(`❌ 没有有效事件数据，ICS 文件不会生成`);
    return;
  }

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chinese Calendar//EN',
    'CALSCALE:GREGORIAN',
    ...allEvents.map(event => generateICSEvent(event)).filter(Boolean),
    'END:VCALENDAR'
  ].join('\r\n');

  try {
    await fs.promises.writeFile(icsFilePath, icsContent);
    logInfo(`✅ ICS 文件生成成功！共包含 ${allEvents.length} 个事件`);
  } catch (error) {
    logError(`❌ 写入 ICS 文件失败: ${error.message}`);
  }
};

generateICS();