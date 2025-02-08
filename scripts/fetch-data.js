const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');

// 配置常量
const DATA_PATH = './data/Document'; 
const LOG_PATH = './data/error.log';
const START_DATE = '2025-02-08'; 

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
  logMessage(`🔥 未捕获异常: ${error.message}\n堆栈: ${error.stack}`);
  process.exit(1);
});

// 📌 读取已存储数据
const loadExistingData = () => {
  ensureDirectoryExists(DATA_PATH);
  const files = ['calendar.json', 'astro.json', 'shichen.json', 'jieqi.json', 'holidays.json'];
  const data = {};

  files.forEach((file) => {
    const filePath = `${DATA_PATH}/${file}`;
    if (fs.existsSync(filePath)) {
      try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        data[file] = JSON.parse(rawData) || {}; 
      } catch (error) {
        logMessage(`❌ 读取 ${file} 失败: ${error.message}\n堆栈: ${error.stack}`);
        data[file] = {};
      }
    } else {
      data[file] = {};
    }
  });

  return data;
};

// 📌 处理节假日数据
const normalizeHolidays = (holidaysData) => {
  if (!holidaysData || typeof holidaysData !== 'object') return { data: {} };

  Object.keys(holidaysData).forEach((date) => {
    if (holidaysData[date] && typeof holidaysData[date] === 'object') {
      holidaysData[date].isOffDay = !!holidaysData[date].isOffDay; 
    }
  });

  return { data: holidaysData };
};

// 📌 保存数据到文件
const saveData = (data) => {
  ensureDirectoryExists(DATA_PATH);
  Object.keys(data).forEach((file) => {
    const filePath = `${DATA_PATH}/${file}`;

    let existingContent = {};
    if (fs.existsSync(filePath)) {
      try {
        existingContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (error) {
        logMessage(`❌ 读取 ${file} 失败: ${error.message}\n堆栈: ${error.stack}`);
        existingContent = { data: {} };
      }
    }

    let mergedData;
    try {
      mergedData = file === 'holidays.json' 
        ? normalizeHolidays({ ...existingContent.data, ...data[file].data })
        : { data: { ...existingContent.data, ...data[file].data } };

      fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2), 'utf8');
      logMessage(`✅ ${file} 保存成功: ${Object.keys(mergedData.data).length} 条记录`);
    } catch (error) {
      logMessage(`❌ 保存 ${file} 失败: ${error.message}\n堆栈: ${error.stack}`);
    }
  });
};

// 📌 发送 API 请求（带重试机制）
const fetchDataFromApi = async (url, params = {}, retries = 3) => {
  try {
    const response = await axios.get(url, { params });
    logMessage(`✅ API 请求成功: ${url} | 参数: ${JSON.stringify(params)}`);
    return response.data; // 直接返回响应数据对象，不再提取 data 层
  } catch (error) {
    if (retries > 0) {
      logMessage(`❌ API 请求失败，重试中... 剩余重试次数: ${retries} | 错误: ${error.message}`);
      return fetchDataFromApi(url, params, retries - 1); 
    }
    logMessage(`❌ API 请求失败: ${url} | 参数: ${JSON.stringify(params)} | 错误: ${error.message}\n堆栈: ${error.stack}`);
    return {}; // 返回空对象作为默认值
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
    if (
      existingData['calendar.json']?.data[dateStr] ||
      existingData['astro.json']?.data[dateStr] ||
      existingData['shichen.json']?.data[dateStr] ||
      existingData['jieqi.json']?.data[dateStr] ||
      existingData['holidays.json']?.data[dateStr]
    ) {
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

    // 📌 过滤无效数据
    if (!calendarData && !astroData && !shichenData && !jieqiData && !holidaysData) {
      logMessage(`⚠️ ${dateStr} 数据全部缺失，跳过存储`);
      continue;
    }

    // 📌 存储数据
    existingData['calendar.json'].data[dateStr] = calendarData;
    existingData['astro.json'].data[dateStr] = astroData;
    existingData['shichen.json'].data[dateStr] = shichenData;
    existingData['jieqi.json'].data[dateStr] = jieqiData;
    existingData['holidays.json'].data[dateStr] = holidaysData;

    saveData(existingData);
    logMessage(`✅ ${dateStr} 数据保存成功`);
  }

  logMessage('🎉 所有数据抓取完成！');
};

// 📌 执行数据抓取
fetchData();