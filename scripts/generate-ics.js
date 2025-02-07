const fs = require('fs');
const path = './data/data.json';
const holidaysKey = 'holidays';  // 用来获取假期数据的键名

// 生成日历文件的函数
const generateICS = () => {
  try {
    // 读取 data.json 中的数据
    const rawData = fs.readFileSync(path, 'utf8');
    const data = JSON.parse(rawData);

    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\n';

    // 遍历数据并生成日历事件
    data.forEach((entry) => {
      const date = entry.date;
      const holidays = entry[holidaysKey]; // 获取假期数据

      // 确保 holidays 是一个数组
      const holidayList = Array.isArray(holidays) 
        ? holidays.map(holiday => `${holiday.name} - ${holiday.date}`).join('\n')
        : '无假期';  // 如果 holidays 不是数组，使用 '无假期'

      icsContent += `
BEGIN:VEVENT
SUMMARY:假期信息
DTSTART:${date.replace(/-/g, '')}T000000
DESCRIPTION:${holidayList}
END:VEVENT
      `;
    });

    icsContent += '\nEND:VCALENDAR';

    // 保存为 .ics 文件
    fs.writeFileSync('./calendar.ics', icsContent);
    console.log('ICS file generated successfully!');
  } catch (error) {
    console.error('Error generating ICS file:', error);
  }
};

generateICS();