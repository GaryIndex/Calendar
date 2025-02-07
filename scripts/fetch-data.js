const axios = require('axios');
const fs = require('fs');
const { format, addDays, subDays } = require('date-fns');

// 获取万年历数据
async function getLunarData(date) {
  const formattedDate = format(date, 'yyyy-MM-dd');
  const response = await axios.get(`https://api.timelessq.com/time?datetime=${formattedDate}`);
  return response.data;
}

// 获取星座数据
async function getHoroscopeData(date) {
  const formattedDate = format(date, 'yyyy-MM-dd');
  const response = await axios.get(`https://api.timelessq.com/time/astro?keyword=${formattedDate}`);
  return response.data;
}

// 获取十二时辰数据
async function getShichenData(date) {
  const formattedDate = format(date, 'yyyy-MM-dd');
  const response = await axios.get(`https://api.timelessq.com/time/shichen?date=${formattedDate}`);
  return response.data;
}

// 获取二十四节气数据
async function getJieqiData(year) {
  const response = await axios.get(`https://api.timelessq.com/time/jieqi?year=${year}`);
  return response.data;
}

// 获取假期数据
async function getHolidayData(year) {
  const response = await axios.get(`https://api.jiejiariapi.com/v1/holidays/${year}`);
  return response.data;
}

// 逐年获取数据并存储
async function getAllData() {
  const startDate = subDays(new Date(), 5 * 365); // 从5年前开始
  const endDate = new Date(); // 当前日期
  const data = {};

  // 遍历过去5年的每一天
  let currentDate = startDate;
  while (currentDate <= endDate) {
    const formattedDate = format(currentDate, 'yyyy-MM-dd');
    const year = format(currentDate, 'yyyy');

    console.log(`Fetching data for ${formattedDate}`);

    // 获取各类数据
    const lunarData = await getLunarData(currentDate);
    const horoscopeData = await getHoroscopeData(currentDate);
    const shichenData = await getShichenData(currentDate);
    const jieqiData = await getJieqiData(year);
    const holidayData = await getHolidayData(year);

    // 存储到数据对象
    data[formattedDate] = {
      lunar: lunarData,
      horoscope: horoscopeData,
      shichen: shichenData,
      jieqi: jieqiData,
      holidays: holidayData
    };

    // 将日期加1天
    currentDate = addDays(currentDate, 1);
  }

  // 将数据保存到文件
  fs.writeFileSync('data/data.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log('Data for past 5 years has been saved to data/data.json');
}

// 执行数据抓取
getAllData();