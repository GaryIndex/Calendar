import path from "path";
import fs from "fs/promises";
import axios from "axios";
import moment from "moment-timezone";
import deepmerge from "deepmerge";
import chalk from 'chalk';

// 获取当前模块的目录路径
const __dirname = path.dirname(new URL(import.meta.url).pathname);  // 在 ESM 中获取 __dirname
import { flattenCalendarData, flattenAstroData, originalData } from './Flattening.js'; // 确保引入了必要的工具
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
/*
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
*/
// 写入日志的封装函数
const writeLog = async (level, filename, message) => {
  try {
    const timestamp = new Date().toISOString();  // 获取当前时间
    const logMessage = `[${timestamp}] [${level}] [${filename}] ${message}\n`;
    // 追加写入日志到文件
    await fs.promises.appendFile(LOG_FILE, logMessage);
    // 控制台输出日志
    console.log(logMessage.trim());
  } catch (error) {
    // 捕获并处理写入日志时的错误
    console.error(`[日志写入失败] ${error.message}`);
  }
};

// 读取增量同步文件
const readIncrementData = async () => {
  try {
    const data = await fs.readFile(INCREMENT_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {}; // 文件不存在则返回空对象
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

// 保存增量同步数据
const saveIncrementData = async (date) => {
  const incrementData = await readIncrementData();
  incrementData[date] = true;
  await fs.writeFile(INCREMENT_FILE, JSON.stringify(incrementData, null, 2), 'utf8');
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
/*
// 数据按年份存储
const saveYearlyData = async (fileName, date, startDate) => {
  const year = date.split('-')[0];  // 获取年份
  const filePath = path.join(DATA_PATH, fileName);  // 生成完整文件路径

  // 打印传递的三个值
  await writeLog('INFO', 'saveYearlyData', `接收到的文件名: ${fileName}`);
  await writeLog('INFO', 'saveYearlyData', `接收到的日期: ${date}`);
  await writeLog('INFO', 'saveYearlyData', `接收到的开始日期: ${startDate}`);
  await writeLog('INFO', 'saveYearlyData', `正在处理文件: ${filePath}`);

  // 读取现有数据
  let existingData = await readJsonFile(filePath);
  // 如果数据是空数组，则初始化为空对象
  if (Array.isArray(existingData) && existingData.length === 0) {
    existingData = {};
  }
  await writeLog('INFO', 'saveYearlyData', `读取现有数据: ${JSON.stringify(existingData, null, 2)}`);

  // 仅对指定文件（如 jieqi.json、holidays.json）执行按年份存储逻辑
  if (fileName === 'jieqi.json' || fileName === 'holidays.json') {
    await writeLog('INFO', 'saveYearlyData', `检查年份数据：${year} 在文件 ${filePath} 中`);
    // 检查是否已有相同年份的数据
    const existingYearData = Object.keys(existingData).find((key) => key.startsWith(year));
    if (existingYearData) {
      // 如果已有年份数据，比较日期，如果新日期比旧日期大，覆盖现有数据中最新的日期
      const existingDateKeys = Object.keys(existingData[existingYearData]);
      const latestExistingDate = existingDateKeys[existingDateKeys.length - 1]; // 获取现有数据中的最新日期
      // 比较现有日期与传入日期的大小
      if (new Date(date) > new Date(latestExistingDate)) {
        await writeLog('INFO', 'saveYearlyData', `找到年份数据，更新现有数据: ${existingYearData}`);
        existingData[existingYearData][date] = { Reconstruction: [startDate] };
      } else {
        await writeLog('INFO', 'saveYearlyData', `现有数据中的日期更新较新，跳过保存`);
      }
    } else {
      // 如果没有该年份的数据，则新增该年份的数据
      await writeLog('INFO', 'saveYearlyData', `未找到年份数据，新建年份数据: ${year}`);
      existingData[year] = { [date]: { Reconstruction: [startDate] } };
    }
    // 写入数据到文件
    await writeLog('INFO', 'saveYearlyData', `正在将数据写入文件 ${filePath}`);
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2), 'utf8');
    await writeLog('INFO', 'saveYearlyData', `✅ ${fileName} (${date}) 数据保存成功`);
  } else {
    // 对其他文件不做修改，直接按原方式保存
    await writeLog('INFO', 'saveYearlyData', `处理非特殊文件：${fileName}`);
    existingData[date] = { Reconstruction: [startDate] };
    // 写入数据到文件
    await writeLog('INFO', 'saveYearlyData', `正在将数据写入文件 ${filePath}`);
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2), 'utf8');
    await writeLog('INFO', 'saveYearlyData', `✅ ${fileName} (${date}) 数据保存成功`);
  }
  // 打印保存成功的信息
  await writeLog('INFO', 'saveYearlyData', `文件 ${filePath} 数据保存成功`);
};

// dataProcessor.js
*/
//const path = require('path');
//const fs = require('fs').promises;
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
    // 合并数据到正确位置
    const mergeStart = Date.now();
    normalizedData.forEach(({ targetDate, data }) => {
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
        const normalizedData = {};
        await writeLog('DEBUG', 'saveYearlyData', `新增 ${newItems.length} 条数据到 ${validDate}`);
      }
    });
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
          data: originalData.data // 保持原始数据不变
        }
      ]
    }
  };
};
//import { processData } from './dataProcessor.js';  // 导入通用处理函数
// 数据抓取
const fetchData = async () => {
  await writeLog('INFO', 'fetchData', '🚀 开始数据抓取...');
  await ensureDirectoryExists(DATA_PATH);
  const today = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
  const startDate = moment('2025-02-11').tz('Asia/Shanghai');
  const incrementData = await readIncrementData();
  for (let currentDate = startDate; currentDate.isSameOrBefore(today); currentDate.add(1, 'days')) {
    const dateStr = currentDate.format('YYYY-MM-DD');
    if (incrementData[dateStr]) {
      await writeLog('INFO', 'fetchData', `⏩ 跳过已查询的日期: ${dateStr}`);
      continue;
    }
    await writeLog('INFO', 'fetchData', `📅 处理日期: ${dateStr}`);
    try {
      // 并行获取五个文件的数据
      const [calendarData, astroData, shichenData, jieqiData, holidaysData] = await Promise.all([
        fetchDataFromApi('https://api.timelessq.com/time', { datetime: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/astro', { keyword: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/shichen', { date: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/jieqi', { year: dateStr.split('-')[0] }),
        fetchDataFromApi('https://api.jiejiariapi.com/v1/holidays/' + dateStr.split('-')[0])
      ]);
      // 使用通用的处理函数来处理原始数据
      const processedCalendarData = processData(calendarData, dateStr);
      const processedAstroData = processData(astroData, dateStr);
      const processedShichenData = processData(shichenData, dateStr);
      const processedJieqiData = processData(jieqiData, dateStr);
      const processedHolidaysData = processData(holidaysData, dateStr);
      // 打印扁平化后的数据
      await writeLog('INFO', 'calendar.json', `扁平化后的日历数据: ${JSON.stringify(processedCalendarData, null, 2)}`);
      await writeLog('INFO', 'astro.json', `扁平化后的星座数据: ${JSON.stringify(processedAstroData, null, 2)}`);
      await writeLog('INFO', 'shichen.json', `扁平化后的时辰数据: ${JSON.stringify(processedShichenData, null, 2)}`);
      await writeLog('INFO', 'jieqi.json', `扁平化后的节气数据: ${JSON.stringify(processedJieqiData, null, 2)}`);
      await writeLog('INFO', 'holidays.json', `扁平化后的节假日数据: ${JSON.stringify(processedHolidaysData, null, 2)}`);
      // 保存数据
      await saveYearlyData('jieqi.json', today, processedJieqiData);
      await saveYearlyData('holidays.json', today, processedHolidaysData);
      await saveYearlyData('calendar.json', today, processedCalendarData);
      await saveYearlyData('astro.json', today, processedAstroData);
      await saveYearlyData('shichen.json', today, processedShichenData);
      // 记录已查询的日期
      await saveIncrementData(dateStr);
      await writeLog('INFO', 'fetchData', `✅ ${dateStr} 数据保存成功`);
    } catch (error) {
      await writeLog('ERROR', 'fetchData', `⚠️ ${dateStr} 处理失败: ${error.message}`);
    }
  }
  await writeLog('INFO', 'fetchData', '🎉 所有数据抓取完成！');
};

// 执行数据抓取
fetchData().catch(async (error) => {
  await writeLog('ERROR', 'fetchData', `🔥 数据抓取失败: ${error.message}`);
});
/*
// 扁平化数据
const flattenCalendarData = (data, dateStr) => {
  if (!data || typeof data !== 'object') return {};
  const { errno, errmsg, data: rawData } = data;
  if (!rawData || !rawData.date) return {}; // 确保 rawData 和 rawData.date 存在
  const { lunar, almanac, festivals, ...flatData } = rawData;
  // 处理缺失字段的默认值
  flatData.festivals = (festivals || []).join(',');
  flatData.pengzubaiji = (almanac?.pengzubaiji || []).join(',');
  flatData.liuyao = almanac?.liuyao || '';
  flatData.jiuxing = almanac?.jiuxing || '';
  flatData.taisui = almanac?.taisui || '';
  // 处理 lunar 和 almanac 的数据合并
  if (lunar) {
    Object.assign(flatData, lunar);
  }
  if (almanac) {
    Object.assign(flatData, almanac);
  }
  // 检查 jishenfangwei 是否存在
  if (almanac?.jishenfangwei) {
    Object.assign(flatData, almanac.jishenfangwei);
  }
  // 删除不需要的字段
  delete flatData.jishenfangwei;
  // 确保数据中使用传入的 dateStr 作为键
  return {
    [dateStr]: { // 使用传入的 dateStr 而不是 rawData.date
      Reconstruction: [
        {
          errno,
          errmsg,
          data: [
            {
              date: rawData.date || dateStr, // 确保使用 dateStr，或者 rawData 中的日期字段
              hours: rawData.hours,
              hour: rawData.hour,
              yi: rawData.yi,
              ji: rawData.ji,
              chong: rawData.chong,
              sha: rawData.sha,
              festivals: flatData.festivals,
              pengzubaiji: flatData.pengzubaiji,
              liuyao: flatData.liuyao,
              jiuxing: flatData.jiuxing,
              taisui: flatData.taisui,
              //...flatData
            }
          ]
        }
      ]
    }
  };
};
// 数据抓取
const fetchData = async () => {
  await writeLog('INFO', 'fetchData', '🚀 开始数据抓取...');
  await ensureDirectoryExists(DATA_PATH);
  const today = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
  const startDate = moment('2025-02-11').tz('Asia/Shanghai');
  const incrementData = await readIncrementData();
  for (let currentDate = startDate; currentDate.isSameOrBefore(today); currentDate.add(1, 'days')) {
    const dateStr = currentDate.format('YYYY-MM-DD');
    if (incrementData[dateStr]) {
      await writeLog('INFO', 'fetchData', `⏩ 跳过已查询的日期: ${dateStr}`);
      continue;
    }
    await writeLog('INFO', 'fetchData', `📅 处理日期: ${dateStr}`);
    try {
      // 并行获取五个文件的数据
      const [calendarData, astroData, shichenData, jieqiData, holidaysData] = await Promise.all([
        fetchDataFromApi('https://api.timelessq.com/time', { datetime: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/astro', { keyword: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/shichen', { date: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/jieqi', { year: dateStr.split('-')[0] }),
        fetchDataFromApi('https://api.jiejiariapi.com/v1/holidays/' + dateStr.split('-')[0])
      ]);
      // 打印所有原始数据以确认数据是否已正确获取
      await writeLog('INFO', 'calendar.json', `原始calendar数据: ${JSON.stringify(calendarData, null, 2)}`);
      await writeLog('INFO', 'astro.json', `原始astro数据: ${JSON.stringify(astroData, null, 2)}`);
      await writeLog('INFO', 'shichen.json', `原始shichen数据: ${JSON.stringify(shichenData, null, 2)}`);
      await writeLog('INFO', 'jieqi.json', `原始jieqi数据: ${JSON.stringify(jieqiData, null, 2)}`);
      await writeLog('INFO', 'holidays.json', `原始holidays数据: ${JSON.stringify(holidaysData, null, 2)}`);
      // 扁平化数据
      const processedCalendarData = flattenCalendarData(calendarData, dateStr);
      const processedAstroData = flattenAstroData(astroData, dateStr);
      const processedShichenData = flattenShichenData(shichenData, dateStr);
      const processedJieqiData = flattenJieqiData(jieqiData, dateStr);
      const processedHolidaysData = flattenHolidaysData(holidaysData, dateStr);
      // 打印扁平化后的数据
      await writeLog('INFO', 'calendar.json', `扁平化后的日历数据: ${JSON.stringify(processedCalendarData, null, 2)}`);
      await writeLog('INFO', 'astro.json', `扁平化后的星座数据: ${JSON.stringify(processedAstroData, null, 2)}`);
      await writeLog('INFO', 'shichen.json', `扁平化后的时辰数据: ${JSON.stringify(processedShichenData, null, 2)}`);
      await writeLog('INFO', 'jieqi.json', `扁平化后的节气数据: ${JSON.stringify(processedJieqiData, null, 2)}`);
      await writeLog('INFO', 'holidays.json', `扁平化后的节假日数据: ${JSON.stringify(processedHolidaysData, null, 2)}`);
      // 保存数据
      await saveYearlyData('jieqi.json', dateStr, processedJieqiData);
      await saveYearlyData('holidays.json', dateStr, processedHolidaysData);
      await saveYearlyData('calendar.json', dateStr, processedCalendarData);
      await saveYearlyData('astro.json', dateStr, processedAstroData);
      await saveYearlyData('shichen.json', dateStr, processedShichenData);
      // 记录已查询的日期
      await saveIncrementData(dateStr);
      await writeLog('INFO', 'fetchData', `✅ ${dateStr} 数据保存成功`);
    } catch (error) {
      await writeLog('ERROR', 'fetchData', `⚠️ ${dateStr} 处理失败: ${error.message}`);
    }
  }
  await writeLog('INFO', 'fetchData', '🎉 所有数据抓取完成！');
};
// 执行数据抓取
fetchData().catch(async (error) => {
  await writeLog('ERROR', 'fetchData', `🔥 数据抓取失败: ${error.message}`);
});

*/

/*
// **创建标准化事件对象**
export function createEvent({
  date,
  title,
  location = "",
  isAllDay = true,
  startTime = "",
  endTime = "",
  travelTime = "",
  repeat = "",
  alarm = "",
  attachment = "",
  url = "",
  badge = "",
  description = "",
  priority = 0,
}) {
  return {
    date,
    title,
    location,
    isAllDay,
    startTime,
    endTime,
    travelTime,
    repeat,
    alarm,
    attachment,
    url,
    badge,
    description,
    priority,
  };
}
*/