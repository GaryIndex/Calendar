const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');

const DATA_PATH = './data/Document';
const LOG_PATH = './data/error.log';
const START_DATE = '2025-02-08';

const FILES = ['calendar.json', 'astro.json', 'shichen.json', 'jieqi.json', 'holidays.json'];

// 📌 确保目录存在
const ensureDirectoryExists = (path) => {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
};

// 📌 记录日志
const logMessage = (message) => {
  const timestamp = moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  const logEntry = `[${timestamp}] ${message}\n`;
  try {
    ensureDirectoryExists(DATA_PATH);
    fs.appendFileSync(LOG_PATH, logEntry, 'utf8');
  } catch (error) {
    console.error(`[日志写入失败] ${error.message}`);
  }
};

// 📌 监听异常退出
process.on('exit', () => logMessage('🚨 进程已退出'));
process.on('SIGINT', () => {
  logMessage('🚨 进程被手动终止 (SIGINT)');
  process.exit();
});
process.on('uncaughtException', (error) => {
  logMessage(`🔥 未捕获异常: ${error.message}`);
  process.exit(1);
});

// 📌 读取 JSON 数据
const loadJson = (file) => {
  const filePath = `${DATA_PATH}/${file}`;
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
    } catch (error) {
      logMessage(`❌ 解析 ${file} 失败: ${error.message}`);
      return {};
    }
  }
  return {};
};

// 📌 加载所有数据
const loadExistingData = () => {
  ensureDirectoryExists(DATA_PATH);
  return FILES.reduce((acc, file) => {
    acc[file] = loadJson(file);
    return acc;
  }, {});
};

// 📌 保存数据（仅更新变化部分）
const saveData = (file, newData) => {
  ensureDirectoryExists(DATA_PATH);
  const filePath = `${DATA_PATH}/${file}`;

  const existingData = loadJson(file);
  const mergedData = { ...existingData, ...newData };

  try {
    fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2), 'utf8');
    logMessage(`✅ ${file} 更新成功: ${Object.keys(newData).length} 条记录`);
  } catch (error) {
    logMessage(`❌ 保存 ${file} 失败: ${error.message}`);
  }
};

// 📌 发送 API 请求
const fetchDataFromApi = async (url, params = {}) => {
  try {
    const response = await axios.get(url, { params });
    logMessage(`✅ API 请求成功: ${url} | 参数: ${JSON.stringify(params)}`);
    return response.data;
  } catch (error) {
    logMessage(`❌ API 请求失败: ${url} | 参数: ${JSON.stringify(params)} | 错误: ${error.message}`);
    return null;
  }
};

// 📌 数据抓取逻辑
const fetchData = async () => {
  logMessage('🚀 开始数据抓取...');
  ensureDirectoryExists(DATA_PATH);

  const existingData = loadExistingData();
  const today = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
  const startDate = moment(START_DATE).tz('Asia/Shanghai');

  for (let currentDate = startDate; currentDate.isSameOrBefore(today); currentDate.add(1, 'days')) {
    const dateStr = currentDate.format('YYYY-MM-DD');

    // 📌 跳过已存在数据
    if (FILES.every((file) => existingData[file][dateStr])) {
      logMessage(`⏩ 跳过 ${dateStr}，数据已存在`);
      continue;
    }

    logMessage(`📅 处理日期: ${dateStr}`);

    // 📌 获取各类数据
    const [calendarData, astroData, shichenData, jieqiData, holidaysData] = await Promise.all([
      fetchDataFromApi('https://api.timelessq.com/time', { datetime: dateStr }),
      fetchDataFromApi('https://api.timelessq.com/time/astro', { keyword: dateStr }),
      fetchDataFromApi('https://api.timelessq.com/time/shichen', { date: dateStr }),
      fetchDataFromApi('https://api.timelessq.com/time/jieqi', { year: dateStr.split('-')[0] }),
      fetchDataFromApi('https://api.jiejiariapi.com/v1/holidays/' + dateStr.split('-')[0])
    ]);

    // 📌 解析数据
    const newData = {};
    if (calendarData) newData['calendar.json'] = { [dateStr]: calendarData };
    if (astroData) newData['astro.json'] = { [dateStr]: astroData };
    if (shichenData) newData['shichen.json'] = { [dateStr]: shichenData };
    if (jieqiData) newData['jieqi.json'] = { [dateStr]: jieqiData };
    if (holidaysData) newData['holidays.json'] = { [dateStr]: holidaysData };

    // 📌 存储更新数据
    Object.keys(newData).forEach((file) => saveData(file, newData[file]));

    logMessage(`✅ ${dateStr} 数据保存成功`);
  }

  logMessage('🎉 所有数据抓取完成！');
};

// 📌 执行数据抓取
fetchData();