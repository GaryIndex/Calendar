/*
const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');
const deepmerge = require('deepmerge');
*/
import axios from 'axios';
import { promises as fs } from 'fs';          // 使用 fs 的 Promise 版本
import moment from 'moment-timezone';         // 保持 moment 的导入方式
import deepmerge from 'deepmerge';            // 使用 ES 模块导入 deepmerge

const DATA_PATH = './data/Document';
const LOG_PATH = './data/error.log';
const START_DATE = '2025-02-08';
const MAX_RETRIES = 3;

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
  console.log(logEntry.trim());
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
 * 📌 读取 JSON 数据
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
        data[file] = JSON.parse(rawData);
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
 * 📌 保存数据（保留原始 JSON 结构）
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

    const mergedData = deepmerge(existingContent, content);

    try {
      fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2), 'utf8');
      logMessage(`✅ ${file} 保存成功: ${Object.keys(mergedData).length} 条记录`);
    } catch (error) {
      logMessage(`❌ 保存 ${file} 失败: ${error.message}`);
    }
  });
};

/**
 * 📌 发送 API 请求（带重试机制）
 */
const fetchDataFromApi = async (url, params = {}, retries = MAX_RETRIES) => {
  try {
    const response = await axios.get(url, { params });
    if (typeof response.data !== 'object') {
      throw new Error(`API 数据格式错误: ${JSON.stringify(response.data).slice(0, 100)}...`);
    }
    logMessage(`✅ API 请求成功: ${url}`);
    return response.data;
  } catch (error) {
    logMessage(`❌ API 请求失败: ${url} | 剩余重试次数: ${retries} | 错误: ${error.message}`);
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return fetchDataFromApi(url, params, retries - 1);
    }
    return {};
  }
};

/**
 * 📌 抓取数据
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
        'calendar.json': { [dateStr]: { "Reconstruction": [calendarData] } },
        'astro.json': { [dateStr]: { "Reconstruction": [astroData] } },
        'shichen.json': { [dateStr]: { "Reconstruction": [shichenData] } },
        'jieqi.json': { [dateStr]: { "Reconstruction": [jieqiData] } },
        'holidays.json': { [dateStr]: { "Reconstruction": [holidaysData] } }
      };

      saveData(filteredData);
      logMessage(`✅ ${dateStr} 数据保存成功`);
    } catch (error) {
      logMessage(`⚠️ ${dateStr} 处理失败: ${error.message}`);
    }
  }

  logMessage('🎉 所有数据抓取完成！');
};

fetchData().catch((error) => {
  logMessage(`🔥 任务失败: ${error.message}`);
  process.exit(1);
});