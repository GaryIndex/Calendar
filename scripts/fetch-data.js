const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');

const DATA_PATH = './data/data.json';
const LOG_PATH = './data/error.log';

// ✅ 记录日志到 error.log
const logMessage = (message) => {
  const timestamp = moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_PATH, logEntry);
  console.log(logEntry.trim());
};

// ✅ 记录 API 请求日志
const logApiSuccess = (url, params) => {
  logMessage(`✅ SUCCESS API Call: ${url} | Params: ${JSON.stringify(params)}`);
};
const logApiError = (url, params, error) => {
  logMessage(`❌ ERROR API Call: ${url} | Params: ${JSON.stringify(params)} | Message: ${error.message}`);
};

// ✅ 获取需要抓取的日期列表
const getDatesToFetch = () => {
  const startDate = moment.tz('2025-02-07', 'Asia/Shanghai'); // 固定起始日期
  const today = moment.tz('Asia/Shanghai'); // 当前时间

  let existingData = [];
  if (fs.existsSync(DATA_PATH)) {
    try {
      const fileData = fs.readFileSync(DATA_PATH, 'utf8');
      existingData = fileData ? JSON.parse(fileData) : [];
    } catch (error) {
      logMessage(`❌ 解析 data.json 失败: ${error.message}`);
    }
  }

  // 获取已保存数据的最后日期
  const lastSavedDate = existingData.length > 0 
    ? moment(existingData[existingData.length - 1].date) 
    : startDate.clone().subtract(1, 'days'); // 避免跳过第1天

  const dates = [];
  for (let currentDate = lastSavedDate.add(1, 'days'); currentDate <= today; currentDate.add(1, 'days')) {
    dates.push(currentDate.format('YYYY-MM-DD'));
  }

  if (dates.length === 0) {
    logMessage('所有数据已是最新，无需更新。');
  }

  return dates;
};

// ✅ 抓取 API 数据
const fetchDataFromApi = async (url, params) => {
  try {
    const response = await axios.get(url, { params });
    logApiSuccess(url, params);
    return response.data;
  } catch (error) {
    logApiError(url, params, error);
    return null; // 遇到错误返回 null
  }
};

// ✅ 处理单个日期数据
const fetchDailyData = async (date) => {
  logMessage(`📅 处理日期: ${date}`);

  const calendarData = await fetchDataFromApi('https://api.timelessq.com/time', { datetime: date });
  const astroData = await fetchDataFromApi('https://api.timelessq.com/time/astro', { keyword: date });
  const shichenData = await fetchDataFromApi('https://api.timelessq.com/time/shichen', { date });
  const jieqiData = await fetchDataFromApi('https://api.timelessq.com/time/jieqi', { year: date.split('-')[0] });
  const holidaysData = await fetchDataFromApi(`https://api.jiejiariapi.com/v1/holidays/${date.split('-')[0]}`, {});

  // 如果任何一个 API 失败，跳过这个日期
  if (!calendarData || !astroData || !shichenData || !jieqiData || !holidaysData) {
    logMessage(`⚠️ 跳过 ${date}，因为部分 API 请求失败`);
    return null;
  }

  return {
    date,
    calendar: calendarData,
    astro: astroData,
    shichen: shichenData,
    jieqi: jieqiData,
    holidays: holidaysData,
  };
};

// ✅ 处理所有需要抓取的日期
const fetchData = async () => {
  logMessage('🚀 开始数据抓取...');

  const dates = getDatesToFetch();
  if (dates.length === 0) return;

  let existingData = [];
  if (fs.existsSync(DATA_PATH)) {
    try {
      const fileData = fs.readFileSync(DATA_PATH, 'utf8');
      existingData = fileData ? JSON.parse(fileData) : [];
    } catch (error) {
      logMessage(`❌ 读取 data.json 失败: ${error.message}`);
    }
  }

  for (const date of dates) {
    const dailyData = await fetchDailyData(date);
    if (dailyData) {
      existingData.push(dailyData);
      fs.writeFileSync(DATA_PATH, JSON.stringify(existingData, null, 2));
      logMessage(`✅ 数据保存成功: ${date}`);
    }
  }

  logMessage('🎯 数据抓取完成！');
};

// ✅ 运行程序
fetchData();