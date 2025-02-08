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
 * 📌 将嵌套的对象扁平化为一层
 */
const flattenObject = (obj, parentKey = '') => {
  let result = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        // 递归处理对象
        Object.assign(result, flattenObject(obj[key], newKey));
      } else {
        result[newKey] = obj[key];
      }
    }
  }

  return result;
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

      // 扁平化数据
      const flattenedCalendar = flattenObject(calendarData || {});
      const flattenedAstro = flattenObject(astroData || {});
      const flattenedShichen = flattenObject(shichenData || {});
      const flattenedJieqi = flattenObject(jieqiData || {});
      const flattenedHolidays = flattenObject(holidaysData || {});

      // 将扁平化后的数据按值提取
      const filteredData = {
        'calendar.json': { [dateStr]: { "Reconstruction": flattenedCalendar } },
        'astro.json': { [dateStr]: { "Reconstruction": flattenedAstro } },
        'shichen.json': { [dateStr]: { "Reconstruction": flattenedShichen } },
        'jieqi.json': { [dateStr]: { "Reconstruction": flattenedJieqi } },
        'holidays.json': { [dateStr]: { "Reconstruction": flattenedHolidays } }
      };

      // 清理空对象，移除 null 值
      Object.entries(filteredData).forEach(([file, content]) => {
        Object.entries(content).forEach(([key, value]) => {
          if (Object.keys(value).length === 0) {
            delete content[key];  // 删除空对象
          }
        });
      });

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