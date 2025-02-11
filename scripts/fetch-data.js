import path from "path";
import fs from "fs/promises";
import axios from "axios";
import moment from "moment-timezone";
import deepmerge from "deepmerge";
import chalk from 'chalk';

// 数据存储路径
const DATA_PATH = './data';
const INCREMENT_FILE = path.join(DATA_PATH, 'Increment.json');

// 确保目录存在
const ensureDirectoryExists = async (dir) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`[目录创建失败] ${error.message}`);
  }
};

// 记录日志
const writeLog = async (type, message) => {
  await ensureLogDir();
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}\n`;
  await fs.appendFile(logFilePath, logMessage, "utf8");
  console.log(type === "INFO" ? chalk.green(logMessage.trim()) : chalk.red(logMessage.trim()));
};

// 确保日志目录存在
const ensureLogDir = async () => {
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch (error) {
    console.error(`❌ 创建日志目录失败: ${error.message}`);
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

// 直接使用 new URL 和 path.dirname 获取当前目录路径
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// 确保日志目录路径
const logDir = path.join(process.cwd(), "data");
const logFilePath = path.join(logDir, "error.log");

// API 请求，带重试机制
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

// 数据按年份存储
const saveYearlyData = async (fileName, date, newData) => {
  const year = date.split('-')[0];
  const filePath = path.join(DATA_PATH, `${fileName}`);
  let existingData = await readJsonFile(filePath);
  // 仅保留最新查询的同一年数据
  Object.keys(existingData).forEach((key) => {
    if (key.startsWith(year)) {
      delete existingData[key];
    }
  });
  existingData[date] = { Reconstruction: [newData] };
  await fs.writeFile(filePath, JSON.stringify(existingData, null, 2), 'utf8');
  await logMessage(`✅ ${fileName} (${date}) 数据保存成功`);
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
  await logMessage('🚀 开始数据抓取...');
  await ensureDirectoryExists(DATA_PATH);
  const today = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
  const startDate = moment('2025-02-11').tz('Asia/Shanghai');
  const incrementData = await readIncrementData();
  for (let currentDate = startDate; currentDate.isSameOrBefore(today); currentDate.add(1, 'days')) {
    const dateStr = currentDate.format('YYYY-MM-DD');
    if (incrementData[dateStr]) {
      await logMessage(`⏩ 跳过已查询的日期: ${dateStr}`);
      continue;
    }
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
      // 按年份存储 jieqi.json、holidays.json
      await saveYearlyData('jieqi.json', dateStr, jieqiData);
      await saveYearlyData('holidays.json', dateStr, holidaysData);
      // 其他数据存储
      await saveYearlyData('calendar.json', dateStr, processedCalendarData);
      await saveYearlyData('astro.json', dateStr, astroData);
      await saveYearlyData('shichen.json', dateStr, shichenData);
      // 记录已查询的日期
      await saveIncrementData(dateStr);
      await logMessage(`✅ ${dateStr} 数据保存成功`);
    } catch (error) {
      await logMessage(`⚠️ ${dateStr} 处理失败: ${error.message}`);
    }
  }
  await logMessage('🎉 所有数据抓取完成！');
};

// 执行数据抓取
fetchData().catch(async (error) => {
  await logMessage(`🔥 任务失败: ${error.message}`);
  process.exit(1);
});

// 加载所有 JSON 数据
const loadAllJsonData = async () => {
  const loadAllJsonDatadata = {};
  for (const [key, filePath] of Object.entries(dataPaths)) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      loadAllJsonDatadata[key] = JSON.parse(content);
      console.log(`${key} loadAllJsonData 数据加载成功`);
    } catch (error) {
      console.error(`加载loadAllJsonData ${key} 时出错: ${error.message}`);
    }
  }
  return loadAllJsonDatadata;
};

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