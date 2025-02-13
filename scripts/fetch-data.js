import path from "path";
import fs from "fs/promises";
import axios from "axios";
import moment from "moment-timezone";
import deepmerge from "deepmerge";
import chalk from 'chalk';
/*
const __dirname = path.dirname(new URL(import.meta.url).pathname);  // 在 ESM 中获取 __dirname
// 数据存储路径，使用仓库根目录作为基础路径
const ROOT_DIR = path.resolve(__dirname, '../../');  // 设定仓库根目录
const DATA_PATH = path.resolve(ROOT_DIR, 'Document'); // 以仓库根目录为基础的路径
const INCREMENT_FILE = path.join(DATA_PATH, 'Increment/Increment.json'); // 存储 Increment.json 文件的路径
const LOG_FILE = path.join(DATA_PATH, 'scripts/error.log'); // 使用仓库根目录路径定义 log 文件路径
*/
//const DATA_PATH = path.resolve(process.cwd(), 'Document');
//const INCREMENT_FILE = path.join(DATA_PATH, 'Increment/Increment.json');
//const LOG_FILE = path.join(DATA_PATH, 'scripts/error.log');
const DATA_PATH = path.resolve(process.cwd(), 'Document');  // 获取当前工作目录下的 'data' 文件夹的绝对路径
const INCREMENT_FILE = path.resolve(DATA_PATH, 'Document/Increment.json');  // 使用绝对路径来指向文件
const LOG_FILE = path.resolve(DATA_PATH, 'Document/file/error.log');  // 使用绝对路径来指向文件
// 输出路径以调试
console.log(DATA_PATH);
console.log(INCREMENT_FILE);
console.log(LOG_FILE);
// 确保目录和文件存在
const ensureFile = async (filePath, defaultContent = '') => {
  // 创建目录（如果不存在）
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  // 如果文件不存在，则创建并写入默认内容
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultContent, 'utf-8');
    console.log(`${path.basename(filePath)} 哇哈哈文件已创建。`);
  }
};
// 执行创建过程
await ensureFile(INCREMENT_FILE, JSON.stringify([])); // 创建 Increment.json 文件
await ensureFile(LOG_FILE, ''); // 创建 log 文件（如果没有的话）
export const logInfo = (message) => {
  console.log(message);  // 这里可以扩展为更复杂的日志管理
};

/*
// 获取当前模块的目录路径
const __dirname = path.dirname(new URL(import.meta.url).pathname);  // 在 ESM 中获取 __dirname
// 数据存储路径
export const logInfo = (message) => {
  console.log(message);  // 这里可以扩展为更复杂的日志管理
};
const DATA_PATH = path.resolve(__dirname, './data/Document');
const INCREMENT_FILE = path.join(DATA_PATH, 'Increment/Increment.json');
const LOG_FILE = path.join(process.cwd(), 'data/scripts/error.log');
console.log(DATA_PATH);
console.log(INCREMENT_FILE);
//export const logInfo = console.log;
// 确保目录和文件存在
const ensureFile = async (filePath, defaultContent = '') => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultContent, 'utf-8');
    console.log(`${path.basename(filePath)} 文件已创建。`);
  }
};
// 执行创建过程
await ensureFile(INCREMENT_FILE, JSON.stringify([]));
//await ensureFile(INCREMENT_FILE, '');
import fs from 'fs/promises';
import path from 'path';

// 日志文件路径
const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE_PATH = path.join(LOG_DIR, 'error.log');
*/
const ensureDirectoryExists = async (dir) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`[日志目录创建失败] ${error.message}`);
  }
}

// 写入日志
export const writeLog = async (level, message) => {
  try {
    await ensureDirectoryExists(DATA_PATH); // 确保 logs 目录存在
    const timestamp = new Date().toISOString(); // 获取当前时间
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    await fs.appendFile(LOG_FILE, logMessage); // 追加写入日志
    console.log(logMessage.trim()); // 控制台输出
  } catch (error) {
    console.error(`[日志写入失败] ${error.message}`);
  }
};
/*

const DATA_PATH = path.resolve(__dirname, './data/Document');  // 使用绝对路径
const INCREMENT_FILE = path.join(DATA_PATH, 'Increment/Increment.json');  // 增量文件路径
console.log(DATA_PATH);  // 输出存储路径，调试用
console.log(INCREMENT_FILE);  // 输出增量文件路径，调试用
export const logInfo = (message) => {
  console.log(message);  // 或者任何你想要的日志输出方式
};
// 确保目录存在
const dir = path.join(process.cwd(), "data");
const logFilePath = path.join(dir, "scripts/error.log");
const ensureDirectoryExists = async (dir) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`[目录创建失败] ${error.message}`);
  }
};

const writeLog = async (type, message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}\n`;
  // 确保日志文件所在目录存在
  await ensureDirectoryExists(path.dirname(logFilePath)); // 确保父目录存在
  // 写入日志文件
  await fs.appendFile(logFilePath, logMessage, 'utf8');
  // 控制台输出
  console.log(type === "INFO" ? chalk.green(logMessage.trim()) : chalk.red(logMessage.trim()));
};
*/
/*
// 调用
await writeLog("INFO", "这是一个信息日志");
await writeLog("ERROR", "这是一个错误日志");
*/
// 读取 JSON 文件
const readJsonFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {}; // 文件不存在则返回空对象
  }
};

// 数据按年份存储
const saveYearlyData = async (fileName, date, newData) => {
  const year = date.split('-')[0];  // 获取年份
  const filePath = path.join(DATA_PATH, fileName);
  // 仅对指定文件（如 jieqi.json、holidays.json）执行按年份存储逻辑
  if (fileName === 'jieqi.json' || fileName === 'holidays.json') {
    let existingData = await readJsonFile(filePath);
    // 检查是否已有相同年份的数据
    const existingYearData = Object.keys(existingData).find((key) => key.startsWith(year));
    if (existingYearData) {
      // 如果已有年份数据，覆盖该年份的内容
      existingData[existingYearData][date] = { Reconstruction: [newData] };
    } else {
      // 如果没有该年份的数据，则新增该年份的数据
      existingData[date] = { Reconstruction: [newData] };
    }
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2), 'utf8');
    await writeLog('INFO', `✅ ${fileName} (${date}) 数据保存成功`);
  } else {
    // 对其他文件不做修改，直接按原方式保存
    let existingData = await readJsonFile(filePath);
    existingData[date] = { Reconstruction: [newData] };
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2), 'utf8');
    await writeLog('INFO', `✅ ${fileName} (${date}) 数据保存成功`);
  }
};

// 读取增量数据
const readIncrementData = async () => {
  try {
    const data = await fs.readFile(INCREMENT_FILE, 'utf8');
    return JSON.parse(data); // 如果文件中没有数据，返回空对象
  } catch (error) {
    console.error('读取增量数据失败:', error);
    return {}; // 如果文件不存在则返回空对象
  }
};
// 保存增量数据
const saveIncrementData = async (date) => {
  const incrementData = await readIncrementData();
  incrementData[date] = true; // 将当前日期标记为已查询
  console.log('增量数据保存前:', incrementData);  // 日志输出查看数据
  await fs.writeFile(INCREMENT_FILE, JSON.stringify(incrementData, null, 2), 'utf8');
  console.log('增量数据保存后:', incrementData);  // 确认保存后的数据
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
// 扁平化 calendar 数据
const flattenCalendarData = (data) => {
  if (!data || typeof data !== 'object') return {};
  const { errno, errmsg, data: rawData } = data;
  if (!rawData) return {};
  const { lunar, almanac, ...flatData } = rawData;
  flatData.festivals = (rawData.festivals || []).join(',');
  flatData.pengzubaiji = (almanac?.pengzubaiji || []).join(',');
  flatData.liuyao = almanac?.liuyao || '';
  flatData.jiuxing = almanac?.jiuxing || '';
  flatData.taisui = almanac?.taisui || '';
  Object.assign(flatData, lunar, almanac);
  Object.assign(flatData, almanac?.jishenfangwei);
  delete flatData.jishenfangwei;
  return { errno, errmsg, ...flatData };
};

// 数据抓取
const fetchData = async () => {
  await writeLog('INFO', '🚀 开始数据抓取...');
  await ensureDirectoryExists(DATA_PATH);
  const today = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
  const startDate = moment('2025-02-11').tz('Asia/Shanghai');
  const incrementData = await readIncrementData();
  for (let currentDate = startDate; currentDate.isSameOrBefore(today); currentDate.add(1, 'days')) {
    const dateStr = currentDate.format('YYYY-MM-DD');
    if (incrementData[dateStr]) {
      await writeLog('INFO', `⏩ 跳过已查询的日期: ${dateStr}`);
      continue;
    }
    await writeLog('INFO', `📅 处理日期: ${dateStr}`);
    try {
      const [calendarData, astroData, shichenData, jieqiData, holidaysData] = await Promise.all([
        fetchDataFromApi('https://api.timelessq.com/time', { datetime: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/astro', { keyword: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/shichen', { date: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/jieqi', { year: dateStr.split('-')[0] }),
        fetchDataFromApi('https://api.jiejiariapi.com/v1/holidays/' + dateStr.split('-')[0])
      ]);
      const processedCalendarData = flattenCalendarData(calendarData);
      // 数据扁平化
      await saveYearlyData('jieqi.json', dateStr, jieqiData);
      await saveYearlyData('holidays.json', dateStr, holidaysData);
      await saveYearlyData('calendar.json', dateStr, processedCalendarData);
      await saveYearlyData('astro.json', dateStr, astroData);
      await saveYearlyData('shichen.json', dateStr, shichenData);
      // 记录已查询的日期
      await saveIncrementData(dateStr);
      await writeLog('INFO', `✅ ${dateStr} 数据保存成功`);
    } catch (error) {
      await writeLog('ERROR', `⚠️ ${dateStr} 处理失败: ${error.message}`);
    }
  }
  await writeLog('INFO', '🎉 所有数据抓取完成！');
};
// 执行数据抓取
fetchData().catch(async (error) => {
  await writeLog('ERROR', `🔥 数据抓取失败: ${error.message}`);
});
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