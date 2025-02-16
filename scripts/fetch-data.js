// 工具模块 - 通用配置和工具函数
import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import moment from 'moment-timezone';
import { HttpsProxyAgent } from 'https-proxy-agent';
import chalk from 'chalk';

// ===================== 全局配置 =====================
const CONFIG = {
  USE_PROXY: false,                // 是否启用代理模式
  REQUEST_TIMEOUT: 5000,           // 请求超时时间（5秒）
  MAX_RETRIES: 3,                  // 最大重试次数
  DATA_DIR: path.resolve(process.cwd(), 'Document'), // 数据存储目录
  LOG_FILE: 'Daily/Feedback.log',  // 日志文件路径
  INCREMENT_FILE: 'Daily/Increment.json', // 增量记录文件
  PROXY_POOL: [                    // 代理池配置（需要替换为真实代理）
    'http://user:pass@proxy1.example.com:8080',
    'http://user:pass@proxy2.example.com:8080',
    'http://user:pass@proxy3.example.com:8080'
  ]
};

// ===================== 工具函数模块 =====================
// 日志管理
export class Logger {
  static async write(level, module, message) {
    try {
      const timestamp = moment().tz('Asia/Shanghai').format();
      const logEntry = `[${timestamp}] [${level}] [${module}] ${message}\n`;
      await this.ensureFileExists(CONFIG.LOG_FILE);
      await fs.appendFile(path.join(CONFIG.DATA_DIR, CONFIG.LOG_FILE), logEntry);
      console.log(chalk.gray(logEntry.trim()));
    } catch (error) {
      console.error(chalk.red('日志写入失败:'), error);
    }
  }
  static async ensureFileExists(filePath) {
    const fullPath = path.join(CONFIG.DATA_DIR, filePath);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.access(fullPath);
    } catch {
      await fs.writeFile(fullPath, '');
    }
  }
}

// 文件操作
export class FileManager {
  static async readJSON(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  static async writeJSON(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }
}

// ===================== 数据处理模块 =====================
// 日期处理
export class DateUtils {
  static normalizeDate(dateStr) {
    return moment(dateStr).format('YYYY-MM-DD');
  }
  static isValidDate(dateStr) {
    return moment(dateStr, 'YYYY-MM-DD', true).isValid();
  }
}
// 数据转换
export class DataProcessor {
  static process(rawData, dateStr) {
    return {
      [dateStr]: {
        Reconstruction: [{
          errno: rawData.errno || 0,
          errmsg: rawData.errmsg || '',
          data: rawData
        }]
      }
    };
  }
}

// ===================== 网络请求模块 =====================
export class Fetcher {
  static async get(url, params = {}) {
    const options = {
      timeout: CONFIG.REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...'
      }
    };
    if (CONFIG.USE_PROXY) {
      const proxy = CONFIG.PROXY_POOL[Math.floor(Math.random() * CONFIG.PROXY_POOL.length)];
      options.httpsAgent = new HttpsProxyAgent(proxy);
    }
    try {
      const response = await axios.get(url, { params, ...options });
      await Logger.write('INFO', 'Fetcher', `请求成功: ${url}`);
      return response.data;
    } catch (error) {
      await Logger.write('ERROR', 'Fetcher', `请求失败: ${url} - ${error.message}`);
      throw error;
    }
  }
}

// ===================== 主业务逻辑模块 =====================
export class MainProcessor {
  static async fetchData() {
    await Logger.write('INFO', 'Main', '开始数据抓取流程');
    // 读取增量记录
    const incrementData = await this.loadIncrementData();
    const today = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
    // 按日期循环处理
    for (let date = moment('2025-02-11'); date.isSameOrBefore(today); date.add(1, 'd')) {
      const dateStr = date.format('YYYY-MM-DD');
      if (incrementData[dateStr]) continue;
      try {
        await this.processDate(dateStr);
        incrementData[dateStr] = true;
        await this.saveIncrementData(incrementData);
      } catch (error) {
        await Logger.write('ERROR', 'Main', `日期处理失败: ${dateStr} - ${error.message}`);
      }
    }
  }
  static async processDate(dateStr) {
    await Logger.write('INFO', 'Main', `处理日期: ${dateStr}`);
    // 并行请求数据
    const [calendar, astro, shichen, jieqi, holidays] = await Promise.all([
      Fetcher.get('https://api.timelessq.com/time', { datetime: dateStr }),
      Fetcher.get('https://api.timelessq.com/time/astro', { keyword: dateStr }),
      Fetcher.get('https://api.timelessq.com/time/shichen', { date: dateStr }),
      Fetcher.get('https://api.timelessq.com/time/jieqi', { year: dateStr.split('-')[0] }),
      Fetcher.get(`https://api.jiejiariapi.com/v1/holidays/${dateStr.split('-')[0]}`)
    ]);
    // 处理并保存数据
    await Promise.all([
      this.saveData('calendar.json', dateStr, calendar),
      this.saveData('astro.json', dateStr, astro),
      this.saveData('shichen.json', dateStr, shichen),
      this.saveData('jieqi.json', dateStr, jieqi),
      this.saveData('holidays.json', dateStr, holidays)
    ]);
  }
  static async saveData(filename, dateStr, rawData) {
    const processed = DataProcessor.process(rawData, dateStr);
    const year = dateStr.split('-')[0];
    const filePath = path.join(CONFIG.DATA_DIR, year, filename);
    // 合并数据
    const existing = await FileManager.readJSON(filePath) || {};
    const merged = { ...existing, ...processed };
    await FileManager.writeJSON(filePath, merged);
    await Logger.write('INFO', 'DataSave', `${filename} 更新成功`);
  }
  static async loadIncrementData() {
    const filePath = path.join(CONFIG.DATA_DIR, CONFIG.INCREMENT_FILE);
    return await FileManager.readJSON(filePath) || {};
  }
  static async saveIncrementData(data) {
    const filePath = path.join(CONFIG.DATA_DIR, CONFIG.INCREMENT_FILE);
    await FileManager.writeJSON(filePath, data);
  }
}

// ===================== 启动入口 =====================
(async () => {
  try {
    await Logger.write('INFO', 'Bootstrap', '应用程序启动');
    await MainProcessor.fetchData();
    await Logger.write('INFO', 'Bootstrap', '流程执行完成');
  } catch (error) {
    await Logger.write('ERROR', 'Bootstrap', `致命错误: ${error.message}`);
    process.exit(1);
  }
})();






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