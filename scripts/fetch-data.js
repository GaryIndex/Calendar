import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import axios from "axios";
import moment from "moment-timezone";
import deepmerge from "deepmerge";
//import { readJsonData, dataPaths, loadAllJsonData, logInfo, createEvent } from './utils/utils.js';
// 在 ESM 环境中定义 __dirname
//import { loadAllJsonData, logInfo, createEvent } from './utils/utils.js';
// 在 ESM 环境中定义 __dirname
// **计算 __dirname**
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// **确保日志目录存在**
const logDir = path.join(process.cwd(), "data");
const logFilePath = path.join(logDir, "error.log");

// **日志记录**
const ensureLogDir = async () => {
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch (error) {
    console.error(`❌ 创建日志目录失败: ${error.message}`);
  }
};

const writeLog = async (type, message) => {
  await ensureLogDir();
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}\n`;
  await fs.appendFile(logFilePath, logMessage, "utf8");
  console.log(type === "INFO" ? chalk.green(logMessage.trim()) : chalk.red(logMessage.trim()));
};

export const logInfo = (message) => writeLog("INFO", message);
//export const logError = (message) => writeLog("ERROR", message);

// **JSON 文件路径**
const DATA_PATH = './data/Document';
const dataPaths = {
  holidays: path.resolve(`${DATA_PATH}/holidays.json`),
  jieqi: path.resolve(`${DATA_PATH}/jieqi.json`),
  astro: path.resolve(`${DATA_PATH}/astro.json`),
  calendar: path.resolve(`${DATA_PATH}/calendar.json`),
  shichen: path.resolve(`${DATA_PATH}/shichen.json`),
};
/*
// **读取 JSON 文件**
const readJsonData = async (filePath) => {
  try {
    await fs.access(filePath); // 检查文件是否存在
    logInfo(`📂 读取文件: ${filePath}`);
    const rawData = await fs.readFile(filePath, "utf-8");
    if (!rawData.trim()) {
      logError(`⚠️ 文件 ${filePath} 为空！`);
      return {};
    }
    return JSON.parse(rawData);
  } catch (error) {
    logError(`❌ 读取 JSON 失败: ${filePath} - ${error.message}`);
    return {};
  }
};
// **批量加载所有 JSON**
const loadAllJsonData = async () => {
  const entries = await Promise.all(
    Object.entries(dataPaths).map(async ([key, filePath]) => [key, await readJsonData(filePath)])
  );
  return Object.fromEntries(entries);
};
*/
// **确保目录存在**
const ensureDirectoryExists = async (path) => {
  try {
    await fs.mkdir(path, { recursive: true });
  } catch (error) {
    console.error(`[目录创建失败] ${error.message}`);
  }
};

// **发送 API 请求（带重试机制）**
const fetchDataFromApi = async (url, params = {}, retries = 3) => {
  try {
    const response = await axios.get(url, { params });
    if (typeof response.data !== 'object') {
      throw new Error(`API 数据格式错误: ${JSON.stringify(response.data).slice(0, 100)}...`);
    }
    await logMessage(`✅ API 请求成功: ${url}`);
    return response.data;
  } catch (error) {
    await logMessage(`❌ API 请求失败: ${url} | 剩余重试次数: ${retries} | 错误: ${error.message}`);
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return fetchDataFromApi(url, params, retries - 1);
    }
    return {};  // 失败时返回空对象，避免影响后续流程
  }
};

// **扁平化 calendar 数据**
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

// **处理并保存数据**
const saveData = async (data) => {
  await ensureDirectoryExists(DATA_PATH);
  for (const [file, content] of Object.entries(data)) {
    const filePath = `${DATA_PATH}/${file}`;
    let existingContent = {};
    try {
      existingContent = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {}
    const mergedData = deepmerge(existingContent, content);
    try {
      await fs.writeFile(filePath, JSON.stringify(mergedData, null, 2), 'utf8');
      await logMessage(`✅ ${file} 保存成功: ${Object.keys(mergedData).length} 条记录`);
    } catch (error) {
      await logMessage(`❌ 保存 ${file} 失败: ${error.message}`);
    }
  }
};

// **抓取数据**
const fetchData = async () => {
  await logMessage('🚀 开始数据抓取...');
  await ensureDirectoryExists(DATA_PATH);
  const today = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
  const startDate = moment('2025-02-10').tz('Asia/Shanghai');
  for (let currentDate = startDate; currentDate.isSameOrBefore(today); currentDate.add(1, 'days')) {
    const dateStr = currentDate.format('YYYY-MM-DD');
    await logMessage(`📅 处理日期: ${dateStr}`);
    try {
      const [calendarData, astroData, shichenData, jieqiData, holidaysData] = await Promise.all([
        fetchDataFromApi('https://api.timelessq.com/time', { datetime: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/astro', { keyword: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/shichen', { date: dateStr }),
        fetchDataFromApi('https://api.timelessq.com/time/jieqi', { year: dateStr.split('-')[0] }),
        fetchDataFromApi('https://api.jiejiariapi.com/v1/holidays/' + dateStr.split('-')[0])
      ]);
      const processedCalendarData = flattenCalendarData(calendarData);
      const filteredData = {
        'calendar.json': { [dateStr]: { "Reconstruction": [processedCalendarData] } },
        'astro.json': { [dateStr]: { "Reconstruction": [astroData] } },
        'shichen.json': { [dateStr]: { "Reconstruction": [shichenData] } },
        'jieqi.json': { [dateStr]: { "Reconstruction": [jieqiData] } },
        'holidays.json': { [dateStr]: { "Reconstruction": [holidaysData] } }
      };
      await saveData(filteredData);
      await logMessage(`✅ ${dateStr} 数据保存成功`);
    } catch (error) {
      await logMessage(`⚠️ ${dateStr} 处理失败: ${error.message}`);
    }
  }
  await logMessage('🎉 所有数据抓取完成！');
};
fetchData().catch(async (error) => {
  await logMessage(`🔥 任务失败: ${error.message}`);
  process.exit(1);
});

export { loadAllJsonData };
// **创建标准化事件对象**
export function createEvent({
  date,
  title,
  location = "",
  isAllDay = false,
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