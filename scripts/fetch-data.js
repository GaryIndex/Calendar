const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');

const DATA_PATH = './data/data.json';
const LOG_PATH = './data/error.log';
const START_DATE = '2025-02-07'; // 初始抓取日期

// 📌 记录日志
const logMessage = (message) => {
  const timestamp = moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  const logEntry = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_PATH, logEntry, 'utf8');
  } catch (error) {
    console.error(`[日志写入失败] ${error.message}`);
  }
};

// 📌 记录进程终止信息
process.on('exit', () => logMessage('🚨 进程已退出'));
process.on('SIGINT', () => {
  logMessage('🚨 进程被手动终止 (SIGINT)');
  process.exit();
});
process.on('uncaughtException', (error) => {
  logMessage(`🔥 未捕获异常: ${error.message}`);
  process.exit(1);
});

// 📌 读取已存储数据，防止重复抓取
const loadExistingData = () => {
  if (!fs.existsSync(DATA_PATH)) return {};
  try {
    const rawData = fs.readFileSync(DATA_PATH, 'utf8');
    return rawData ? JSON.parse(rawData) : {};
  } catch (error) {
    logMessage(`❌ 读取 data.json 失败: ${error.message}`);
    return {};
  }
};

// 📌 保存数据到 data.json
const saveData = (data) => {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    logMessage(`✅ 数据成功保存: ${Object.keys(data).length} 条记录`);
  } catch (error) {
    logMessage(`❌ 保存数据失败: ${error.message}`);
  }
};

// 📌 发送 API 请求
const fetchDataFromApi = async (url, params = {}) => {
  try {
    const response = await axios.get(url, { params });
    logMessage(`✅ SUCCESS API Call: ${url} | Params: ${JSON.stringify(params)}`);
    return response.data;
  } catch (error) {
    logMessage(`❌ FAILED API Call: ${url} | Params: ${JSON.stringify(params)} | Error: ${error.message}`);
    return null; // 确保后续流程不会中断
  }
};

// 📌 处理数据抓取
const fetchData = async () => {
  logMessage('🚀 开始数据抓取...');

  const existingData = loadExistingData();
  const today = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
  const startDate = moment(START_DATE).tz('Asia/Shanghai');

  for (let currentDate = startDate; currentDate.isSameOrBefore(today); currentDate.add(1, 'days')) {
    const dateStr = currentDate.format('YYYY-MM-DD');

    // 📌 跳过已存在数据
    if (existingData[dateStr]) {
      logMessage(`⏩ 跳过 ${dateStr}，数据已存在`);
      continue;
    }

    logMessage(`📅 处理日期: ${dateStr}`);

    // 📌 获取各类数据
    const calendarData = await fetchDataFromApi('https://api.timelessq.com/time', { datetime: dateStr });
    const astroData = await fetchDataFromApi('https://api.timelessq.com/time/astro', { keyword: dateStr });
    const shichenData = await fetchDataFromApi('https://api.timelessq.com/time/shichen', { date: dateStr });
    const jieqiData = await fetchDataFromApi('https://api.timelessq.com/time/jieqi', { year: dateStr.split('-')[0] });
    const holidaysData = await fetchDataFromApi('https://api.jiejiariapi.com/v1/holidays/' + dateStr.split('-')[0]);

    // 📌 过滤无效数据，确保存储完整性
    if (!calendarData || !astroData || !shichenData || !jieqiData || !holidaysData) {
      logMessage(`⚠️ ${dateStr} 数据不完整，跳过存储`);
      continue;
    }

    // 📌 存储数据
    existingData[dateStr] = {
      date: dateStr,
      calendar: calendarData,
      astro: astroData,
      shichen: shichenData,
      jieqi: jieqiData,
      holidays: holidaysData,
    };

    saveData(existingData);
    logMessage(`✅ 数据保存成功: ${dateStr}`);
  }

  logMessage('🎉 所有数据抓取完成！');
};

// 执行数据抓取
fetchData();