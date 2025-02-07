const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');

const path = './data/data.json';
const logPath = './data/error.log';

// 记录普通日志
const logMessage = (message) => {
  const timestamp = moment.tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  const log = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logPath, log);
  console.log(log.trim());
};

// 记录错误日志
const logError = (message, error) => {
  const timestamp = moment.tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  const log = `[${timestamp}] ERROR: ${message} - ${error.message || error}\n`;
  fs.appendFileSync(logPath, log);
  console.error(log.trim());
};

// 读取现有数据，防止重复抓取
const loadExistingData = () => {
  if (fs.existsSync(path)) {
    try {
      const fileData = fs.readFileSync(path, 'utf8');
      return fileData ? JSON.parse(fileData) : [];
    } catch (error) {
      logError('Error parsing data.json', error);
      return [];
    }
  }
  return [];
};

// 通用 API 请求方法
const fetchDataFromApi = async (url, params, category, date) => {
  try {
    const response = await axios.get(url, { params });
    logMessage(`成功获取 ${category} 数据 - ${date}`);
    return response.data;
  } catch (error) {
    logError(`获取 ${category} 数据失败 - ${date}`, error);
    return null;
  }
};

// 主函数：抓取数据
async function fetchData() {
  try {
    logMessage('开始数据抓取...');
    const existingData = loadExistingData();
    const existingDates = new Set(existingData.map(item => item.date));

    const startDate = moment.tz('2025-02-07', 'Asia/Shanghai');
    const today = moment.tz('now', 'Asia/Shanghai');

    const dates = [];
    for (let currentDate = startDate; currentDate <= today; currentDate.add(1, 'days')) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      if (!existingDates.has(dateStr)) {
        dates.push(dateStr);
      }
    }

    if (dates.length === 0) {
      logMessage('所有数据已是最新，无需更新。');
      return;
    }

    logMessage(`即将抓取 ${dates.length} 天的数据: ${dates.join(', ')}`);

    let newData = [];
    for (const date of dates) {
      logMessage(`正在抓取 ${date} 的数据...`);
      const year = date.split('-')[0];

      // 并行请求所有 API
      const results = await Promise.allSettled([
        fetchDataFromApi('https://api.timelessq.com/time', { datetime: date }, '万年历', date),
        fetchDataFromApi('https://api.timelessq.com/time/astro', { keyword: date }, '星座', date),
        fetchDataFromApi('https://api.timelessq.com/time/shichen', { date }, '十二时辰', date),
        fetchDataFromApi('https://api.timelessq.com/time/jieqi', { year }, '二十四节气', date),
        fetchDataFromApi(`https://api.jiejiariapi.com/v1/holidays/${year}`, {}, '假期', date),
      ]);

      // 处理返回的数据
      const dailyData = {
        date,
        calendar: results[0].status === 'fulfilled' ? results[0].value : null,
        astro: results[1].status === 'fulfilled' ? results[1].value : null,
        shichen: results[2].status === 'fulfilled' ? results[2].value : null,
        jieqi: results[3].status === 'fulfilled' ? results[3].value : null,
        holidays: results[4].status === 'fulfilled' ? results[4].value : null,
      };

      // 检查是否所有 API 都失败
      if (!dailyData.calendar && !dailyData.astro && !dailyData.shichen && !dailyData.jieqi && !dailyData.holidays) {
        logError(`所有 API 请求均失败，跳过日期 ${date}`, '数据获取失败');
        continue;
      }

      newData.push(dailyData);
      logMessage(`成功获取并存储 ${date} 的数据`);
    }

    // 只有新数据时才写入
    if (newData.length > 0) {
      const updatedData = [...existingData, ...newData];
      fs.writeFileSync(path, JSON.stringify(updatedData, null, 2));
      logMessage(`数据已成功更新，共 ${newData.length} 条新数据`);
    }

  } catch (error) {
    logError('数据抓取过程中发生错误', error);
  }
}

// 执行数据抓取
fetchData();