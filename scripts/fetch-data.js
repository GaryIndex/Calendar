// utils.js - 工具模块
import path from 'path';
import fs from 'fs/promises';
import moment from 'moment-timezone';
import pkg from 'https-proxy-agent';
import chalk from 'chalk';
const { HttpsProxyAgent } = pkg;
//import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

// 常量定义
const DATA_DIR = path.resolve(process.cwd(), 'Document/Daily');
const INCREMENT_FILE = path.resolve(DATA_DIR, 'Increment.json');
const LOG_FILE = path.resolve(DATA_DIR, 'Feedback.log');
const PROXY_POOL = [
  '95.38.174.119:8080',
  '102.213.84.250:8080',
  '58.69.78.115:8081'
];

// 日志等级颜色映射
const LOG_COLORS = {
  INFO: 'green',
  WARN: 'yellow',
  ERROR: 'red',
  DEBUG: 'blue'
};

/**
 * 确保目录存在（递归创建）
 * @param {string} dirPath 目录路径
 */
export const ensureDirExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
};

/**
 * 写入格式化日志
 * @param {string} level 日志等级
 * @param {string} module 模块名称
 * @param {string} message 日志信息
 * @param {object} [metadata] 附加元数据
 */
export const writeLog = async (level, module, message, metadata = {}) => {
  const timestamp = moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss.SSS');
  const logEntry = {
    timestamp,
    level,
    module,
    message,
    ...metadata
  };
  // 添加颜色输出
  const color = LOG_COLORS[level] || 'white';
  console.log(chalk[color](`[${timestamp}] [${level}] [${module}] ${message}`));
  await ensureDirExists(DATA_DIR);
  await fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n');
};

/**
 * 读取增量记录文件
 */
export const readIncrementData = async () => {
  try {
    const data = await fs.readFile(INCREMENT_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
};
/**
 * 保存增量记录文件
 * @param {object} incrementData 增量数据
 */
export const saveIncrementData = async (incrementData) => {
  await fs.writeFile(INCREMENT_FILE, JSON.stringify(incrementData, null, 2));
};
// dataFetcher.js - 数据获取模块
/**
 * 带代理和重试机制的请求函数
 * @param {string} url 请求地址
 * @param {object} [params] 请求参数
 * @param {number} [retries=3] 重试次数
 */
export const fetchWithRetry = async (url, params = {}, retries = 3) => {
  const proxy = PROXY_POOL[Math.floor(Math.random() * PROXY_POOL.length)];
  const agent = new HttpsProxyAgent(proxy);
  const query = new URLSearchParams(params).toString();
  const requestUrl = url + (query ? `?${query}` : '');
  try {
    const response = await fetch(requestUrl, {
      agent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
        'Accept-Encoding': 'gzip, deflate'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error('Invalid content type received');
    }
    return response.json();
  } catch (error) {
    if (retries > 0) {
      await writeLog('WARN', 'fetchWithRetry', 
        `请求失败: ${error.message}, 剩余重试次数: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return fetchWithRetry(url, params, retries - 1);
    }
    throw error;
  }
};
// dataProcessor.js - 数据处理模块
/**
 * 标准化日期格式（YYYY-MM-DD）
 * @param {string} dateStr 原始日期字符串
 */
const normalizeDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

/**
 * 处理原始API数据
 * @param {object} rawData 原始数据
 * @param {string} dateStr 目标日期
 */
export const processData = (rawData, dateStr) => {
  if (!rawData || rawData.errno !== 0) {
    throw new Error(`API返回错误: ${rawData?.errmsg || '未知错误'}`);
  }
  return {
    [normalizeDate(dateStr)]: {
      metadata: {
        updatedAt: moment().tz('Asia/Shanghai').format(),
        dataSource: 'timelessq-api'
      },
      data: rawData.data
    }
  };
};

/**
 * 保存年度数据文件
 * @param {string} filename 文件名
 * @param {string} dateStr 日期字符串
 * @param {object} newData 新数据
 */
export const saveYearlyData = async (filename, dateStr, newData) => {
  const [year] = dateStr.split('-');
  const yearDir = path.join(DATA_DIR, year);
  await ensureDirExists(yearDir);
  const filePath = path.join(yearDir, filename);
  const existingData = await readJSONFile(filePath) || {};
  const mergedData = deepmerge(existingData, newData);
  // 按日期排序
  const sortedData = Object.keys(mergedData)
    .sort((a, b) => moment(a).diff(moment(b)))
    .reduce((acc, key) => {
      acc[key] = mergedData[key];
      return acc;
    }, {});
  await fs.writeFile(filePath, JSON.stringify(sortedData, null, 2));
  await writeLog('INFO', 'saveYearlyData', `数据保存成功: ${filename}`);
};
/**
 * 读取JSON文件
 * @param {string} filePath 文件路径
 */
const readJSONFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

/**
 * 主数据获取流程
 */
export const main = async () => {
  await writeLog('INFO', 'main', '🚀 启动数据抓取流程');
  try {
    const incrementData = await readIncrementData();
    const today = moment().tz('Asia/Shanghai');
    const startDate = moment('2025-02-11').tz('Asia/Shanghai');
    for (
      let current = startDate.clone();
      current.isSameOrBefore(today, 'day');
      current.add(1, 'day')
    ) {
      const dateStr = current.format('YYYY-MM-DD');
      if (incrementData[dateStr]) {
        await writeLog('INFO', 'main', `⏩ 跳过已处理日期: ${dateStr}`);
        continue;
      }
      try {
        await writeLog('INFO', 'main', `📅 开始处理日期: ${dateStr}`);
        // 并行获取所有数据
        const [calendar, astro, shichen, jieqi, holidays] = await Promise.all([
          fetchWithRetry('https://api.timelessq.com/time', { datetime: dateStr }),
          fetchWithRetry('https://api.timelessq.com/time/astro', { keyword: dateStr }),
          fetchWithRetry('https://api.timelessq.com/time/shichen', { date: dateStr }),
          fetchWithRetry('https://api.timelessq.com/time/jieqi', { year: current.year() }),
          fetchWithRetry(`https://api.jiejiariapi.com/v1/holidays/${current.year()}`)
        ]);
        // 并行处理保存
        await Promise.all([
          saveYearlyData('calendar.json', dateStr, processData(calendar, dateStr)),
          saveYearlyData('astro.json', dateStr, processData(astro, dateStr)),
          saveYearlyData('shichen.json', dateStr, processData(shichen, dateStr)),
          saveYearlyData('jieqi.json', dateStr, processData(jieqi, dateStr)),
          saveYearlyData('holidays.json', dateStr, processData(holidays, dateStr))
        ]);
        // 更新增量记录
        incrementData[dateStr] = true;
        await saveIncrementData(incrementData);
        await writeLog('INFO', 'main', `✅ 日期处理完成: ${dateStr}`);
      } catch (error) {
        await writeLog('ERROR', 'main', `❌ 日期处理失败: ${dateStr}`, {
          error: error.message
        });
      }
    }
    await writeLog('INFO', 'main', '🎉 所有数据处理完成');
  } catch (error) {
    await writeLog('ERROR', 'main', '🔥 主流程异常终止', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};
// 启动执行
main();






/*
import path from "path";
import fs from "fs/promises";
import axios from "axios";
import moment from "moment-timezone";
import deepmerge from "deepmerge";
import chalk from 'chalk';

// 获取当前模块的目录路径
const __dirname = path.dirname(new URL(import.meta.url).pathname);  // 在 ESM 中获取 __dirname
//import { flattenCalendarData, flattenAstroData, originalData } from './Flattening.js'; // 确保引入了必要的工具
// 数据存储路径
const DATA_PATH = path.resolve(process.cwd(), 'Document');  // 获取当前工作目录下的 'data' 文件夹的绝对路径
const INCREMENT_FILE = path.resolve(DATA_PATH, 'Daily/Increment.json');  // 使用绝对路径来指向文件
const LOG_FILE = path.resolve(DATA_PATH, 'Daily/Feedback.log');  // 使用绝对路径来指向文件

// 输出路径以调试
console.log(DATA_PATH);
console.log(INCREMENT_FILE);
export const logInfo = (message) => {
  console.log(message);  // 这里可以扩展为更复杂的日志管理
}
// 确保目录和文件存在
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`创建目录失败: ${dirPath}`, error);
  }
};

// 确保文件存在
const ensureFile = async (filePath, defaultContent = '') => {
  await ensureDirectoryExists(path.dirname(filePath));  // 确保目录存在
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultContent, 'utf-8');
    console.log(`${path.basename(filePath)} 文件已创建。`);
  }
};

// 执行创建过程
await ensureFile(INCREMENT_FILE, JSON.stringify([]));
await ensureFile(LOG_FILE, '');

// 写入日志
export const writeLog = async (level, filename, message) => {
  try {
    const timestamp = new Date().toISOString(); // 获取当前时间
    const logMessage = `[${timestamp}] [${level}] [${filename}] ${message}\n`;
    await fs.appendFile(LOG_FILE, logMessage); // 追加写入日志
    console.log(logMessage.trim()); // 控制台输出
  } catch (error) {
    console.error(`[日志写入失败] ${error.message}`);
  }
};



// API 请求，带重试机制
const fetchDataFromApi = async (url, params = {}, retries = 3) => {
  try {
    const response = await axios.get(url, { params });
    if (typeof response.data !== 'object') {
      throw new Error(`API 数据格式错误: ${JSON.stringify(response.data).slice(0, 100)}...`);
    }
    await writeLog('INFO', `✅ API 请求成功: ${url}`);
    return response.data;
  } catch (error) {
    await writeLog('ERROR', `❌ API 请求失败: ${url} | 剩余重试次数: ${retries} | 错误: ${error.message}`);
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return fetchDataFromApi(url, params, retries - 1);
    }
    return {};  // 失败时返回空对象
  }
};



// 读取 JSON 文件
const readJsonFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {}; // 文件不存在则返回空对象
  }
};

// 稳定序列化函数（解决键顺序问题）
const stableStringify = (obj) => {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  return JSON.stringify(obj, Object.keys(obj).sort());
};

// 日期格式标准化（兼容单数字月份/日期）
const normalizeDateKey = (key) => {
  const parts = key.split('-').map(part => part.padStart(2, '0'));
  return parts.slice(0, 3).join('-');
};

const saveYearlyData = async (fileName, date, startDate) => {
  const filePath = path.join(DATA_PATH, fileName);
  try {
    await writeLog('DEBUG', 'saveYearlyData', `开始处理 ${fileName}`, {
      inputDate: date,
      startDateType: typeof startDate
    });

    // 参数校验
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`非法日期参数格式: ${date}`);
    }
    // 读取并规范化现有数据
    let existingData = {};
    try {
      const rawData = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(rawData) || {};
      if (Array.isArray(existingData)) existingData = {};
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    // 深度数据挖掘器（带缓存机制）
    const digData = (inputData) => {
      const results = [];
      const processed = new WeakSet();
      const processItem = (item) => {
        if (!item || processed.has(item)) return;
        processed.add(item);
        // 发现有效日期键
        const dateKeys = Object.keys(item)
          .filter(k => /^\d{4}-\d{1,2}-\d{1,2}$/.test(k))
          .map(normalizeDateKey);
        if (dateKeys.length > 0) {
          dateKeys.forEach(dateKey => {
            const reconstruction = item[dateKey]?.Reconstruction;
            if (Array.isArray(reconstruction)) {
              results.push({
                targetDate: dateKey,
                data: reconstruction
              });
            }
          });
          return;
        }
        // 处理嵌套结构
        if (item.Reconstruction) {
          results.push({
            targetDate: normalizeDateKey(date),
            data: item.Reconstruction
          });
        } else if (item.errno !== undefined) {
          results.push({
            targetDate: normalizeDateKey(date),
            data: [item]
          });
        }
      };
      const traverse = (data) => {
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (typeof item === 'object' && item !== null) {
              processItem(item);
              traverse(item);
            }
          });
        } else if (typeof data === 'object' && data !== null) {
          processItem(data);
          Object.values(data).forEach(traverse);
        }
      };
      traverse(inputData);
      return results;
    };
    // 按文件类型清理旧数据
    const cleanStrategy = () => {
      if (['jieqi.json', 'holidays.json'].includes(fileName)) {
        const year = date.split('-')[0];
        Object.keys(existingData)
          .filter(k => k.startsWith(`${year}-`))
          .forEach(k => delete existingData[k]);
      } else if (fileName === 'astro.json') {
        const [year, month] = date.split('-');
        Object.keys(existingData)
          .filter(k => k.startsWith(`${year}-${month.padStart(2, '0')}`))
          .forEach(k => delete existingData[k]);
      }
    };
    cleanStrategy();
    // 处理新数据
    const normalizedData = digData(startDate);
    await writeLog('DEBUG', 'saveYearlyData', '解析结果', normalizedData);
    // 合并数据到正确位置（使用 Promise.all + map）
    const mergeStart = Date.now();
    await Promise.all(
      normalizedData.map(async ({ targetDate, data }) => {
        const validDate = normalizeDateKey(targetDate);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(validDate)) return;

        if (!existingData[validDate]) {
          existingData[validDate] = { Reconstruction: [] };
        }
        const targetArray = existingData[validDate].Reconstruction;
        const existingHashes = new Set(
          targetArray.map(item => stableStringify(item))
        );
        const flattenData = (items) => {
          return items.flatMap(item => {
            if (item?.Reconstruction) return flattenData(item.Reconstruction);
            if (Array.isArray(item)) return flattenData(item);
            return item?.errno === 0 ? item : null;
          }).filter(Boolean);
        };
        const newItems = flattenData(data)
          .filter(item => !existingHashes.has(stableStringify(item)));
        if (newItems.length > 0) {
          targetArray.push(...newItems);
          await writeLog('DEBUG', 'saveYearlyData', `新增 ${newItems.length} 条数据到 ${validDate}`);
        }
      })
    );
    await writeLog('PERF', 'saveYearlyData', `合并耗时: ${Date.now() - mergeStart}ms`);
    // 按日排序（1-31）并格式化日期键
    const sortStart = Date.now();
    const sortedKeys = Object.keys(existingData)
      .map(normalizeDateKey)
      .sort((a, b) => {
        const aDay = parseInt(a.split('-')[2], 10);
        const bDay = parseInt(b.split('-')[2], 10);
        return aDay - bDay || a.localeCompare(b);
      });
    const sortedData = sortedKeys.reduce((acc, key) => {
      acc[key] = existingData[key];
      return acc;
    }, {});
    await writeLog('PERF', 'saveYearlyData', `排序耗时: ${Date.now() - sortStart}ms`);
    // 写入文件
    await fs.writeFile(filePath, JSON.stringify(sortedData, null, 2));
    await writeLog('INFO', 'saveYearlyData', `✅ ${fileName} 更新完成，共 ${sortedKeys.length} 个日期项`);
  } catch (error) {
    await writeLog('ERROR', 'saveYearlyData', `💥 处理失败: ${error.message}`, {
      stack: error.stack,
      fileName,
      date
    });
    throw error;
  }
};
// 通用的处理原始数据的函数
export const processData = (originalData, dateStr) => {
  return {
    [dateStr]: {
      Reconstruction: [
        {
          errno: originalData.errno,
          errmsg: originalData.errmsg,
          data: originalData // 保持原始数据不变
        }
      ]
    }
  };
};

const path = require('path');
const fs = require('fs').promises;
const moment = require('moment-timezone');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch');

// 代理池配置（示例，需要替换为真实代理）
const PROXY_POOL = [
  'http://user:pass@proxy1.example.com:8080',
  'http://user:pass@proxy2.example.com:8080',
  'http://user:pass@proxy3.example.com:8080'
];

// 通用文件操作函数
const ensureDirExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
};

const writeLog = async (level, module, message) => {
  const logEntry = {
    timestamp: moment().tz('Asia/Shanghai').format(),
    level,
    module,
    message
  };
  await ensureDirExists(path.dirname(LOG_FILE));
  await fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n');
};

// 增量数据管理
const readIncrementData = async () => {
  try {
    await ensureDirExists(DATA_DIR);
    const data = await fs.readFile(INCREMENT_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
};
const saveIncrementData = async (incrementData) => {
  await fs.writeFile(INCREMENT_FILE, JSON.stringify(incrementData, null, 2));
};

// 带代理的请求函数
const fetchWithProxy = async (url, params = {}) => {
  const proxy = PROXY_POOL[Math.floor(Math.random() * PROXY_POOL.length)];
  const agent = new HttpsProxyAgent(proxy);
  const query = new URLSearchParams(params).toString();
  const requestUrl = url + (query ? `?${query}` : '');
  try {
    const response = await fetch(requestUrl, {
      agent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    await writeLog('ERROR', 'fetchWithProxy', `请求失败: ${error.message}`);
    throw error;
  }
};

// 数据存储函数
const saveYearlyData = async (filename, dateStr, data) => {
  const year = dateStr.split('-')[0];
  const yearDir = path.join(DATA_DIR, year);
  await ensureDirExists(yearDir);
  const filePath = path.join(yearDir, filename);
  const existingData = await readJSONFile(filePath) || {};
  const mergedData = { ...existingData, ...data };
  await fs.writeFile(filePath, JSON.stringify(mergedData, null, 2));
};
const readJSONFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};
// 改进后的主函数
const fetchData = async () => {
  await writeLog('INFO', 'fetchData', '🚀 开始数据抓取...');
  const incrementData = await readIncrementData();
  const today = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
  const startDate = moment('2025-02-11').tz('Asia/Shanghai');
  for (
    let current = startDate.clone();
    current.isSameOrBefore(today);
    current.add(1, 'days')
  ) {
    const dateStr = current.format('YYYY-MM-DD');
    if (incrementData[dateStr]) {
      await writeLog('INFO', 'fetchData', `⏩ 跳过已查询的日期: ${dateStr}`);
      continue;
    }
    try {
      await writeLog('INFO', 'fetchData', `📅 处理日期: ${dateStr}`);
      // 并行请求使用不同代理
      const [calendar, astro, shichen, jieqi, holidays] = await Promise.all([
        fetchWithProxy('https://api.timelessq.com/time', { datetime: dateStr }),
        fetchWithProxy('https://api.timelessq.com/time/astro', { keyword: dateStr }),
        fetchWithProxy('https://api.timelessq.com/time/shichen', { date: dateStr }),
        fetchWithProxy('https://api.timelessq.com/time/jieqi', { year: dateStr.split('-')[0] }),
        fetchWithProxy(`https://api.jiejiariapi.com/v1/holidays/${dateStr.split('-')[0]}`)
      ]);
      // 数据校验和处理
      const processors = {
        'calendar.json': calendar,
        'astro.json': astro,
        'shichen.json': shichen,
        'jieqi.json': jieqi,
        'holidays.json': holidays
      };
      await Promise.all(
        Object.entries(processors).map(async ([filename, data]) => {
          const processed = processData(data, dateStr);
          await saveYearlyData(filename, dateStr, processed);
          await writeLog('INFO', filename, `扁平化数据: ${JSON.stringify(processed)}`);
        })
      );
      // 更新增量记录
      incrementData[dateStr] = true;
      await saveIncrementData(incrementData);
      await writeLog('INFO', 'fetchData', `✅ ${dateStr} 数据保存成功`);
    } catch (error) {
      await writeLog('ERROR', 'fetchData', `⚠️ ${dateStr} 处理失败: ${error.message}`);
    }
  }
  await writeLog('INFO', 'fetchData', '🎉 所有数据抓取完成！');
};
// 启动抓取
fetchData().catch(async (error) => {
  await writeLog('ERROR', 'fetchData', `🔥 主流程异常: ${error.message}`);
  process.exit(1);
});
*/