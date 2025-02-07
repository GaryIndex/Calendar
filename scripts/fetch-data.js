const axios = require('axios');
const fs = require('fs');
const { format, subYears } = require('date-fns');

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

// 检查数据文件是否存在，若不存在则初始化
function initializeDataFile() {
  if (!fs.existsSync('data/data.json')) {
    fs.writeFileSync('data/data.json', JSON.stringify({}, null, 2), 'utf-8');
  }
}

// 获取数据并保存
async function fetchAndSaveData(date, year) {
  const formattedDate = format(date, 'yyyy-MM-dd');

  // 获取各类数据
  const lunarData = await getLunarData(date);
  const horoscopeData = await getHoroscopeData(date);
  const shichenData = await getShichenData(date);
  const jieqiData = await getJieqiData(year);
  const holidayData = await getHolidayData(year);

  // 读取现有数据
  let data = {};
  if (fs.existsSync('data/data.json') && fs.readFileSync('data/data.json', 'utf-8').trim()) {
    try {
      data = JSON.parse(fs.readFileSync('data/data.json', 'utf-8'));
    } catch (error) {
      console.error("Error parsing JSON data:", error);
      return;
    }
  }

  // 如果该日期的数据已经存在，则跳过
  if (data[formattedDate]) {
    console.log(`Data for ${formattedDate} already exists. Skipping...`);
    return;
  }

  // 将新数据添加到现有数据中
  data[formattedDate] = {
    lunar: lunarData,
    horoscope: horoscopeData,
    shichen: shichenData,
    jieqi: jieqiData,
    holidays: holidayData
  };

  // 保存更新后的数据
  fs.writeFileSync('data/data.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Data for ${formattedDate} has been saved to data/data.json`);
}

// 主函数：抓取五年数据并保存
async function fetchData() {
  initializeDataFile(); // 初始化数据文件（若不存在）

  const currentDate = new Date();
  const today = format(currentDate, 'yyyy-MM-dd');
  const fiveYearsAgo = subYears(currentDate, 5);

  let currentYear = format(currentDate, 'yyyy');
  let currentDateIter = fiveYearsAgo;

  console.log(`Starting to fetch data from ${fiveYearsAgo} to today (${today})`);

  // 遍历过去五年到今天的每一天
  while (format(currentDateIter, 'yyyy-MM-dd') <= today) {
    await fetchAndSaveData(currentDateIter, currentYear);

    // 递增日期
    currentDateIter = new Date(currentDateIter.setDate(currentDateIter.getDate() + 1));
  }

  console.log("All data fetched and saved successfully!");
}

// 执行抓取数据
fetchData();