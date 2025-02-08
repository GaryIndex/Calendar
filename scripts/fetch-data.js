const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');

const DATA_PATH = './data/Document';
const LOG_PATH = './data/error.log';
const START_DATE = '2025-02-08';

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
 * 📌 监听异常
 */
process.on('exit', () => logMessage('🚨 进程已退出'));
process.on('SIGINT', () => {
  logMessage('🚨 进程被手动终止 (SIGINT)');
  process.exit();
});
process.on('uncaughtException', (error) => {
  logMessage(`🔥 未捕获异常: ${error.message}\n堆栈: ${error.stack}`);
  process.exit(1);
});

/**
 * 📌 读取已存储数据并提取最深层级内容
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

        // 提取最深层级的数据并存储到 Reconstruction
        const reconstructedData = Object.keys(parsedData).reduce((acc, key) => {
          acc[key] = extractDeepestLayer(parsedData[key]);
          return acc;
        }, {});
        data[file] = { Reconstruction: reconstructedData };
      } catch (error) {
        logMessage(`❌ 读取 ${file} 失败: ${error.message}`);
        data[file] = { Reconstruction: {} }; 
      }
    } else {
      data[file] = { Reconstruction: {} }; 
    }
  });

  return data;
};

/**
 * 📌 提取最深层级数据
 */
const extractDeepestLayer = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;

  const keys = Object.keys(obj);
  let currentLevel = obj;

  // 深度遍历，直到找到最深层级的数据
  while (keys.length > 0) {
    const nextKey = keys.find(key => typeof currentLevel[key] === 'object');
    if (!nextKey) break;

    currentLevel = currentLevel[nextKey];
  }

  return currentLevel;
};

/**
 * 📌 保存数据到文件（避免覆盖原数据）
 */
const saveData = (data) => {
  ensureDirectoryExists(DATA_PATH);
  Object.entries(data).forEach(([file, content]) => {
    const filePath = `${DATA_PATH}/${file}`;

    let existingContent = { Reconstruction: {} };
    if (fs.existsSync(filePath)) {
      try {
        existingContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (error) {
        logMessage(`❌ 读取 ${file} 失败: ${error.message}`);
      }
    }

    const mergedData = {
      Reconstruction: { ...existingContent.Reconstruction, ...content.Reconstruction }
    };

    try {
      fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2), 'utf8');
      logMessage(`✅ ${file} 保存成功: ${Object.keys(mergedData.Reconstruction).length} 条记录`);
    } catch (error) {
      logMessage(`❌ 保存 ${file} 失败: ${error.message}`);
    }
  });
};

/**
 * 📌 发送 API 请求（带错误处理）
 */
const fetchDataFromApi = async (url, params = {}, retries = 3) => {
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
      return fetchDataFromApi(url, params, retries - 1);
    }
    return {}; 
  }
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

      const filteredData = {
        'calendar.json': { [dateStr]: calendarData },
        'astro.json': { [dateStr]: astroData },
        'shichen.json': { [dateStr]: shichenData },
        'jieqi.json': { [dateStr]: jieqiData },
        'holidays.json': { [dateStr]: holidaysData }
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