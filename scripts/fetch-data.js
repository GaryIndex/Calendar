const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');

// 数据存储路径
const DATA_PATH = './data/data.json';
const LOG_PATH = './data/error.log';

// 确保 ./data 目录存在
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}

// ========== 日志记录函数 ==========
const logError = (message) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_PATH, `[${timestamp}] ${message}\n`);
};

const logBeijingTime = () => {
  const beijingTime = moment.tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  logError(`Current Beijing Time: ${beijingTime}`);
};

// ========== 读取已有数据 ==========
const loadExistingData = () => {
  if (fs.existsSync(DATA_PATH)) {
    try {
      const fileData = fs.readFileSync(DATA_PATH, 'utf8');
      return fileData ? JSON.parse(fileData) : [];
    } catch (error) {
      logError(`Error parsing data.json: ${error.message}`);
      return [];  // 解析失败时返回空数组
    }
  }
  return [];
};

// ========== 统一 API 请求函数 ==========
const fetchAPI = async (url, params) => {
  const startTime = new Date().toISOString();
  logError(`API Request: ${url} | Params: ${JSON.stringify(params)} | Start: ${startTime}`);

  try {
    const response = await axios.get(url, { params });
    const endTime = new Date().toISOString();
    logError(`API Success: ${url} | Status: ${response.status} | Time: ${endTime}`);
    return response.data;
  } catch (error) {
    const endTime = new Date().toISOString();
    logError(`API Error: ${url} | Time: ${endTime} | Message: ${error.message}`);

    if (error.response) {
      logError(`API Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }

    throw new Error(`API request failed for ${url}`);
  }
};

// ========== 抓取数据的主逻辑 ==========
async function fetchData() {
  try {
    console.log('Starting data fetch...');
    logBeijingTime();  // 记录北京时间

    // 获取从 2025-02-07 至今天的所有日期
    const startDate = moment.tz('2025-02-07', 'Asia/Shanghai');
    const today = moment.tz('now', 'Asia/Shanghai');
    const dates = [];

    for (let currentDate = startDate; currentDate <= today; currentDate.add(1, 'days')) {
      dates.push(currentDate.format('YYYY-MM-DD'));
    }

    // 读取已有数据，避免重复抓取
    const existingData = loadExistingData();

    // 逐日抓取数据
    for (const date of dates) {
      console.log(`Fetching data for ${date}...`);
      logBeijingTime();  // 记录抓取时间

      // 检查数据是否已存在，避免重复写入
      if (existingData.some(entry => entry.date === date)) {
        console.log(`Data for ${date} already exists. Skipping.`);
        logError(`Skipping ${date}, data already exists.`);
        continue;
      }

      try {
        // API 请求
        const calendarData = await fetchAPI('https://api.timelessq.com/time', { datetime: date });
        const astroData = await fetchAPI('https://api.timelessq.com/time/astro', { keyword: date });
        const shichenData = await fetchAPI('https://api.timelessq.com/time/shichen', { date });
        const jieqiData = await fetchAPI('https://api.timelessq.com/time/jieqi', { year: date.split('-')[0] });
        const holidaysData = await fetchAPI(`https://api.jiejiariapi.com/v1/holidays/${date.split('-')[0]}`);

        // 格式化当天的数据
        const dailyData = {
          date,
          calendar: calendarData,
          astro: astroData,
          shichen: shichenData,
          jieqi: jieqiData,
          holidays: holidaysData,
        };

        // 追加新数据
        existingData.push(dailyData);

        // 写入 JSON 文件
        fs.writeFileSync(DATA_PATH, JSON.stringify(existingData, null, 2));
        console.log(`Data for ${date} saved.`);
        logError(`Data saved for ${date}: ${JSON.stringify(dailyData, null, 2)}`);
      } catch (error) {
        logError(`Skipping data for ${date} due to error.`);
      }
    }
  } catch (error) {
    console.error('Error while fetching data:', error);
    logError(`Failed to fetch data: ${error.message}`);
  }
}

// 执行抓取
fetchData();