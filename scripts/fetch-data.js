const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');

const DATA_PATH = './data/Document'; // 存储目录
const LOG_PATH = './data/error.log';
const START_DATE = '2025-02-08'; // 初始抓取日期
const FILES = ['calendar.json', 'astro.json', 'shichen.json', 'jieqi.json', 'holidays.json'];

// 📌 确保目录存在
const ensureDirectoryExists = (path) => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
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
const loadExistingData = () => {
  ensureDirectoryExists(DATA_PATH);
  const data = {};

  FILES.forEach((file) => {
    const filePath = `${DATA_PATH}/${file}`;
    if (fs.existsSync(filePath)) {
      try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const parsedData = JSON.parse(rawData);
        data[file] = parsedData || {}; // 确保数据为对象
      } catch (error) {
        logMessage(`❌ 读取 ${file} 失败: ${error.message}`);
        data[file] = {};
      }
    } else {
      data[file] = {};
    }
  });

  return data;
};

// 📌 统一 `holidays.json` 的 `isOffDay` 逻辑
const normalizeHolidays = (holidaysData) => {
  const result = {};
  for (const date in holidaysData) {
    const holiday = holidaysData[date];
    result[date] = {
      ...holiday,
      isOffDay: holiday.isOffDay !== undefined ? holiday.isOffDay : false, // 默认 false
    };
  }
  return result;
};

// 📌 保存数据（合并存储，避免覆盖）
const saveData = (data) => {
  ensureDirectoryExists(DATA_PATH);

  Object.keys(data).forEach((file) => {
    const filePath = `${DATA_PATH}/${file}`;

    let existingContent = {};
    if (fs.existsSync(filePath)) {
      try {
        existingContent = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
      } catch (error) {
        logMessage(`❌ 读取 ${file} 失败: ${error.message}`);
        existingContent = {};
      }
    }

    let mergedData;
    if (file === 'holidays.json') {
      mergedData = normalizeHolidays({ ...existingContent, ...data[file] });
    } else {
      mergedData = { ...existingContent, ...data[file] };
    }

    try {
      fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2), 'utf8');
      logMessage(`✅ ${file} 保存成功: ${Object.keys(mergedData).length} 条记录`);
    } catch (error) {
      logMessage(`❌ 保存 ${file} 失败: ${error.message}`);
    }
  });
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

// 📌 抓取数据
const fetchData = async () => {
  logMessage('🚀 开始数据抓取...');
  ensureDirectoryExists(DATA_PATH);

  const existingData = loadExistingData();
  const today = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
  const startDate = moment(START_DATE).tz('Asia/Shanghai');

  for (let currentDate = startDate; currentDate.isSameOrBefore(today); currentDate.add(1, 'days')) {
    const dateStr = currentDate.format('YYYY-MM-DD');

    // 📌 跳过已存在的数据
    if (FILES.some((file) => existingData[file][dateStr])) {
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
      fetchDataFromApi('https://api.jiejiariapi.com/v1/holidays/' + dateStr.split('-')[0]),
    ]);

    // 📌 过滤无效数据
    if (!calendarData && !astroData && !shichenData && !jieqiData && !holidaysData) {
      logMessage(`⚠️ ${dateStr} 数据全部缺失，跳过存储`);
      continue;
    }

    // 📌 存储数据
    if (calendarData) existingData['calendar.json'][dateStr] = calendarData;
    if (astroData) existingData['astro.json'][dateStr] = astroData;
    if (shichenData) existingData['shichen.json'][dateStr] = shichenData;
    if (jieqiData) existingData['jieqi.json'][dateStr] = jieqiData;
    if (holidaysData) existingData['holidays.json'][dateStr] = holidaysData;

    saveData(existingData);
    logMessage(`✅ ${dateStr} 数据保存成功`);
  }

  logMessage('🎉 所有数据抓取完成！');
};

// 📌 执行数据抓取
fetchData();