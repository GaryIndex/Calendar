const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');

const DATA_PATH = './data/Document';
const LOG_PATH = './data/error.log';
const START_DATE = '2025-02-08';
const MAX_RETRIES = 3; // 最大重试次数

/**
 * 📌 确保目录存在
 */
const ensureDirectoryExists = (path) => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
};

/**
 * 📌 记录日志
 */
const logMessage = (message) => {
  const timestamp = moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(logEntry.trim()); // 终端输出
  try {
    ensureDirectoryExists(DATA_PATH);
    fs.appendFileSync(LOG_PATH, logEntry, 'utf8');
  } catch (error) {
    console.error(`[日志写入失败] ${error.message}`);
  }
};

/**
 * 📌 读取已存储数据并返回数据
 */
const loadExistingData = () => {
  ensureDirectoryExists(DATA_PATH);
  const files = ['calendar.json', 'astro.json', 'shichen.json', 'jieqi.json', 'holidays.json'];
  const data = {};

  files.forEach((file) => {
    const filePath = `${DATA_PATH}/${file}`;
    if (fs.existsSync(filePath)) {
      try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const parsedData = JSON.parse(rawData);
        data[file] = parsedData;
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

/**
 * 📌 保存数据到文件（避免覆盖原数据）
 */
const saveData = (data) => {
  ensureDirectoryExists(DATA_PATH);
  Object.entries(data).forEach(([file, content]) => {
    const filePath = `${DATA_PATH}/${file}`;

    let existingContent = {};
    if (fs.existsSync(filePath)) {
      try {
        existingContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (error) {
        logMessage(`❌ 读取 ${file} 失败: ${error.message}`);
      }
    }

    const mergedData = { ...existingContent, ...content };

    try {
      fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2), 'utf8');
      logMessage(`✅ ${file} 保存成功: ${Object.keys(mergedData).length} 条记录`);
    } catch (error) {
      logMessage(`❌ 保存 ${file} 失败: ${error.message}`);
    }
  });
};

/**
 * 📌 发送 API 请求（带错误处理和重试机制）
 */
const fetchDataFromApi = async (url, params = {}, retries = MAX_RETRIES) => {
  try {
    const response = await axios.get(url, { params });
    if (typeof response.data !== 'object') {
      throw new Error(`API 返回的数据格式错误: ${JSON.stringify(response.data).slice(0, 100)}...`);
    }
    logMessage(`✅ API 请求成功: ${url}`);
    return response.data;
  } catch (error) {
    logMessage(`❌ API 请求失败: ${url} | 剩余重试次数: ${retries} | 错误: ${error.message}`);
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 延迟 2 秒再重试
      return fetchDataFromApi(url, params, retries - 1);
    }
    return {}; 
  }
};

/**
 * 📌 扁平化并重构数据
 */
const reconstructData = (rawData, dateStr) => {
  let reconstructed = {};

  Object.entries(rawData).forEach(([key, value]) => {
    let match = key.match(/^data\.(\d+)\.name$/);
    if (match) {
      let index = match[1];
      let name = value;
      let time = rawData[`data.${index}.time`];
      reconstructed[name] = time; // 将名字和时间作为键值对
    }
  });

  return {
    [dateStr]: {
      Reconstruction: reconstructed
    }
  };
};

/**
 * 📌 数据抓取逻辑
 */
const fetchData = async () => {
  logMessage('🚀 开始数据抓取...');
  ensureDirectoryExists(DATA_PATH);

  const existingData = loadExistingData();
  const today = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
  const startDate = moment(START_DATE).tz('Asia/Shanghai');

  // API对应的值
  const apiValues = {
    'calendar.json': 'null',
    'astro.json': 'null',
    'shichen.json': 'null',
    'jieqi.json': 'null',
    'holidays.json': 'null'
  };

  for (let currentDate = startDate; currentDate.isSameOrBefore(today); currentDate.add(1, 'days')) {
    const dateStr = currentDate.format('YYYY-MM-DD');

    if (
      existingData['calendar.json'][dateStr] ||
      existingData['astro.json'][dateStr] ||
      existingData['shichen.json'][dateStr] ||
      existingData['jieqi.json'][dateStr] ||
      existingData['holidays.json'][dateStr]
    ) {
      logMessage(`⏩ 跳过 ${dateStr}，数据已存在`);
      continue;
    }

    logMessage(`📅 处理日期: ${dateStr}`);

    try {
      const [calendarData, astroData, shichenData, jieqiData, holidaysData] = await Promise.all([
        fetchDataFromApi('https://api.timelessq.com/time', { datetime: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/astro', { keyword: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/shichen', { date: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/jieqi', { year: dateStr.split('-')[0] }),
        fetchDataFromApi('https://api.jiejiariapi.com/v1/holidays/' + dateStr.split('-')[0])
      ]);

      // 重构并按日期存储
      const calendarReconstructed = reconstructData(calendarData || {}, dateStr);
      const astroReconstructed = reconstructData(astroData || {}, dateStr);
      const shichenReconstructed = reconstructData(shichenData || {}, dateStr);
      const jieqiReconstructed = reconstructData(jieqiData || {}, dateStr);
      const holidaysReconstructed = reconstructData(holidaysData || {}, dateStr);

      // 保存数据
      const filteredData = {
        'calendar.json': calendarReconstructed,
        'astro.json': astroReconstructed,
        'shichen.json': shichenReconstructed,
        'jieqi.json': jieqiReconstructed,
        'holidays.json': holidaysReconstructed
      };

      saveData(filteredData);
      logMessage(`✅ ${dateStr} 数据保存成功`);
    } catch (error) {
      logMessage(`⚠️ ${dateStr} 处理失败: ${error.message}`);
    }
  }

  logMessage('🎉 所有数据抓取完成！');
};

/**
 * 📌 执行数据抓取
 */
fetchData().catch((error) => {
  logMessage(`🔥 任务失败: ${error.message}`);
  process.exit(1);
});