const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');

const DATA_PATH = './data/data.json';
const LOG_PATH = './data/error.log';

// 记录日志（包含时间）
const logMessage = (message) => {
  const timestamp = moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_PATH, logEntry);
};

// 记录错误日志
const logError = (message) => {
  logMessage(`❌ ERROR: ${message}`);
};

// 记录 API 请求
const logApiCall = (endpoint, params, success) => {
  const status = success ? '✅ SUCCESS' : '❌ FAILED';
  logMessage(`${status} API Call: ${endpoint} | Params: ${JSON.stringify(params)}`);
};

// 获取日期范围
const getDatesToFetch = () => {
  const startDate = moment.tz('2025-02-07', 'Asia/Shanghai');
  const today = moment.tz('Asia/Shanghai');

  let existingData = [];
  if (fs.existsSync(DATA_PATH)) {
    try {
      const fileData = fs.readFileSync(DATA_PATH, 'utf8');
      existingData = fileData ? JSON.parse(fileData) : [];
    } catch (error) {
      logError(`Failed to parse data.json: ${error.message}`);
    }
  }

  const lastSavedDate = existingData.length > 0 ? moment(existingData[existingData.length - 1].date) : startDate;
  const dates = [];

  for (let currentDate = lastSavedDate.add(1, 'days'); currentDate <= today; currentDate.add(1, 'days')) {
    dates.push(currentDate.format('YYYY-MM-DD'));
  }

  if (dates.length === 0) {
    logMessage('所有数据已是最新，无需更新。');
  }

  return dates;
};

// API 请求函数
const fetchApiData = async (endpoint, params) => {
  try {
    const response = await axios.get(endpoint, { params });
    logApiCall(endpoint, params, true);
    return response.data;
  } catch (error) {
    logApiCall(endpoint, params, false);
    logError(`API Error: ${error.message}`);
    return null;
  }
};

// 抓取数据
const fetchData = async () => {
  logMessage('开始数据抓取...');
  const dates = getDatesToFetch();
  if (dates.length === 0) return;

  for (const date of dates) {
    logMessage(`📅 处理日期: ${date}`);

    const calendarData = await fetchApiData('https://api.timelessq.com/time', { datetime: date });
    const astroData = await fetchApiData('https://api.timelessq.com/time/astro', { keyword: date });
    const shichenData = await fetchApiData('https://api.timelessq.com/time/shichen', { date });
    const jieqiData = await fetchApiData('https://api.timelessq.com/time/jieqi', { year: date.split('-')[0] });
    const holidaysData = await fetchApiData(`https://api.jiejiariapi.com/v1/holidays/${date.split('-')[0]}`, {});

    if (!calendarData || !astroData || !shichenData || !jieqiData || !holidaysData) {
      logError(`数据抓取失败，跳过 ${date}`);
      continue;
    }

    const dailyData = {
      date,
      calendar: calendarData,
      astro: astroData,
      shichen: shichenData,
      jieqi: jieqiData,
      holidays: holidaysData,
    };

    let existingData = [];
    if (fs.existsSync(DATA_PATH)) {
      try {
        const fileData = fs.readFileSync(DATA_PATH, 'utf8');
        existingData = fileData ? JSON.parse(fileData) : [];
      } catch (error) {
        logError(`解析 data.json 失败: ${error.message}`);
      }
    }

    existingData.push(dailyData);
    try {
      fs.writeFileSync(DATA_PATH, JSON.stringify(existingData, null, 2));
      logMessage(`✅ 数据保存成功: ${date}`);
    } catch (error) {
      logError(`写入 data.json 失败: ${error.message}`);
    }
  }
};

fetchData();