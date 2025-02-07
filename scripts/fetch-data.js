const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');

const path = './data/data.json';
const logPath = './data/error.log';

// 记录日志（成功或失败）
const logMessage = (status, queryDate, category, errorMessage = '') => {
  const runTime = moment.tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  let message = `[${runTime}] [查询日期: ${queryDate}] ${category} - ${status}`;
  if (errorMessage) message += ` - 错误: ${errorMessage}`;
  
  // 终端输出 & 写入日志文件
  console.log(message);
  fs.appendFileSync(logPath, message + '\n');
};

// 记录北京时间
const logBeijingTime = () => {
  const beijingTime = moment.tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  fs.appendFileSync(logPath, `[${beijingTime}] Beijing Time\n`);
};

// 读取现有数据（避免重复请求）
const loadExistingData = () => {
  if (fs.existsSync(path)) {
    try {
      const fileData = fs.readFileSync(path, 'utf8');
      return fileData ? JSON.parse(fileData) : [];
    } catch (error) {
      console.error('Error parsing data.json:', error);
      return [];
    }
  }
  return [];
};

// API 请求封装（并行执行）
const fetchDataFromApi = async (url, params, queryDate, category) => {
  try {
    const response = await axios.get(url, { params });
    logMessage('数据获取成功', queryDate, category);
    return response.data;
  } catch (error) {
    logMessage('数据获取失败', queryDate, category, error.message);
    return null; // 返回 null 代表获取失败
  }
};

// 主程序
async function fetchData() {
  try {
    console.log('Starting to fetch data...');
    logBeijingTime();

    const startDate = moment.tz('2025-02-07', 'Asia/Shanghai'); // 设定抓取起始时间
    const today = moment.tz('now', 'Asia/Shanghai');
    const existingData = loadExistingData();
    const existingDates = new Set(existingData.map(item => item.date)); // 存在的数据日期

    const dates = [];
    for (let currentDate = startDate; currentDate <= today; currentDate.add(1, 'days')) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      if (!existingDates.has(dateStr)) {
        dates.push(dateStr);
      }
    }

    if (dates.length === 0) {
      console.log('All data is already up to date.');
      return;
    }

    console.log(`Fetching data for dates: ${dates.join(', ')}`);

    let newData = [];
    for (const date of dates) {
      console.log(`Fetching data for ${date}...`);
      logBeijingTime();

      const year = date.split('-')[0];

      // 并行请求所有 API
      const [calendarData, astroData, shichenData, jieqiData, holidaysData] = await Promise.all([
        fetchDataFromApi('https://api.timelessq.com/time', { datetime: date }, date, '万年历'),
        fetchDataFromApi('https://api.timelessq.com/time/astro', { keyword: date }, date, '星座'),
        fetchDataFromApi('https://api.timelessq.com/time/shichen', { date }, date, '十二时辰'),
        fetchDataFromApi('https://api.timelessq.com/time/jieqi', { year }, date, '二十四节气'),
        fetchDataFromApi(`https://api.jiejiariapi.com/v1/holidays/${year}`, {}, date, '假期')
      ]);

      // 统计失败 API
      const failedApis = [];
      if (!calendarData) failedApis.push('万年历');
      if (!astroData) failedApis.push('星座');
      if (!shichenData) failedApis.push('十二时辰');
      if (!jieqiData) failedApis.push('二十四节气');
      if (!holidaysData) failedApis.push('假期');

      if (failedApis.length === 5) {
        logMessage('数据存储失败', date, '所有 API 请求失败，跳过该日期');
        continue;
      }

      // 组合当天数据（即使部分 API 失败，也存储可用数据）
      const dailyData = { date, calendar: calendarData, astro: astroData, shichen: shichenData, jieqi: jieqiData, holidays: holidaysData };
      newData.push(dailyData);
      logMessage('数据存储成功', date, '写入 data.json');

      // 记录失败 API
      if (failedApis.length > 0) {
        logMessage('部分数据获取失败', date, failedApis.join('，'));
      }
    }

    // 只有新数据存在时，才更新 data.json
    if (newData.length > 0) {
      const updatedData = [...existingData, ...newData];
      fs.writeFileSync(path, JSON.stringify(updatedData, null, 2));
      console.log('Data successfully updated.');
    }

  } catch (error) {
    console.error('Error while fetching data:', error);
    logMessage('程序运行失败', '全局', '全局错误', error.message);
  }
}

// 执行数据抓取
fetchData();