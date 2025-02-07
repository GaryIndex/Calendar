const fs = require('fs');
const { format } = require('date-fns');

// 读取数据文件
const data = JSON.parse(fs.readFileSync('data/data.json', 'utf-8'));

// 生成 .ics 文件
function generateICS(date) {
  const formattedDate = format(date, 'yyyy-MM-dd');
  const dailyData = data[formattedDate];

  if (!dailyData) {
    console.log(`No data found for ${formattedDate}`);
    return;
  }

  const lunar = dailyData.lunar;
  const horoscope = dailyData.horoscope;
  const shichen = dailyData.shichen;
  const jieqi = dailyData.jieqi;
  const holidays = dailyData.holidays;

  // 假期数据
  const holidayList = holidays ? holidays.map(holiday => `${holiday.name} - ${holiday.date}`).join('\n') : '无假期';

  const icsContent = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Apple Inc.//NONSGML iCal 4.0//EN
BEGIN:VEVENT
SUMMARY:万年历 - ${lunar}
DTSTART;VALUE=DATE:${formattedDate.replace(/-/g, '')}
DTEND;VALUE=DATE:${formattedDate.replace(/-/g, '')}
DESCRIPTION:
  - 星座运势：${horoscope}
  - 十二时辰：${shichen}
  - 节气：${jieqi}
  - 假期：\n${holidayList}
END:VEVENT
END:VCALENDAR`;

  // 将 .ics 文件保存
  fs.writeFileSync('calendar.ics', icsContent, 'utf-8');
  console.log(`ICS file for ${formattedDate} has been generated.`);
}

// 生成一个指定日期的 .ics 文件
const today = new Date();
generateICS(today);