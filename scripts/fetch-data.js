import fs from 'fs/promises';
import axios from 'axios';
import moment from 'moment-timezone';
import deepmerge from 'deepmerge';

const DATA_PATH = './data/Document';
const LOG_PATH = './data/errors.log';
const START_DATE = '2025-02-10';
const MAX_RETRIES = 3;

/**
 * 📌 确保目录存在
 */
const ensureDirectoryExists = async (path) => {
  try {
    await fs.mkdir(path, { recursive: true });
  } catch (error) {
    console.error(`[目录创建失败] ${error.message}`);
  }
};

/**
 * 📌 记录日志
 */
const logMessage = async (message) => {
  const timestamp = moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(logEntry.trim());
  try {
    await ensureDirectoryExists(DATA_PATH);
    await fs.appendFile(LOG_PATH, logEntry, 'utf8');
  } catch (error) {
    console.error(`[日志写入失败] ${error.message}`);
  }
};

/**
 * 📌 读取 JSON 数据
 */
const loadExistingData = async () => {
  await ensureDirectoryExists(DATA_PATH);
  const files = ['calendar.json', 'astro.json', 'shichen.json', 'jieqi.json', 'holidays.json'];
  const data = {};
  for (const file of files) {
    const filePath = `${DATA_PATH}/${file}`;
    try {
      const rawData = await fs.readFile(filePath, 'utf8');
      data[file] = JSON.parse(rawData);
    } catch {
      data[file] = {};
    }
  }
  return data;
};

/**
 * 📌 保存数据（保留原始 JSON 结构）
 */
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

/**
 * 📌 发送 API 请求（带重试机制）
 */
const fetchDataFromApi = async (url, params = {}, retries = MAX_RETRIES) => {
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
    return {};
  }
};

/**
 * 📌 扁平化 `calendarData`
 */
const flattenCalendarData = (data) => {
  if (!data || typeof data !== 'object') return {};
  const { errno, errmsg, data: rawData } = data;
  if (!rawData) return {};
  const { lunar, almanac, ...flatData } = rawData;
  // 处理 `festivals` 和 `pengzubaiji`
  flatData.festivals = (rawData.festivals || []).join(',');
  flatData.pengzubaiji = (almanac?.pengzubaiji || []).join(',');
  // 处理 `liuyao`, `jiuxing`, `taisui`
  flatData.liuyao = almanac?.liuyao || '';
  flatData.jiuxing = almanac?.jiuxing || '';
  flatData.taisui = almanac?.taisui || '';
  // 提取 `lunar` 和 `almanac` 内的键值
  Object.assign(flatData, lunar, almanac);
  // 提取 `jishenfangwei` 内的键值
  Object.assign(flatData, almanac?.jishenfangwei);
  // 过滤空值或无用字段
  delete flatData.jishenfangwei;
  return { errno, errmsg, ...flatData };
};

/**
 * 📌 抓取数据
 */
const fetchData = async () => {
  await logMessage('🚀 开始数据抓取...');
  await ensureDirectoryExists(DATA_PATH);
  const existingData = await loadExistingData();
  const today = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
  const startDate = moment(START_DATE).tz('Asia/Shanghai');
  for (let currentDate = startDate; currentDate.isSameOrBefore(today); currentDate.add(1, 'days')) {
    const dateStr = currentDate.format('YYYY-MM-DD');
    if (existingData['calendar.json'][dateStr]) {
      await logMessage(`⏩ 跳过 ${dateStr}，数据已存在`);
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