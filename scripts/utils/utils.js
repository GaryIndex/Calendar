import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import fs from "fs/promises";

// **计算 __dirname**
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// **日志文件路径**
const logFilePath = path.join(__dirname, "./data/error.log");

/**
 * **日志记录**
 * @param {string} type 日志类型 ("INFO" | "ERROR")
 * @param {string} message 日志内容
 */
const writeLog = async (type, message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}\n`;
  
  try {
    await fs.appendFile(logFilePath, logMessage, "utf8");
  } catch (error) {
    console.error(chalk.red(`❌ 写入日志失败: ${error.message}`));
  }

  console.log(type === "INFO" ? chalk.green(logMessage.trim()) : chalk.red(logMessage.trim()));
};

export const logInfo = (message) => writeLog("INFO", message);
export const logError = (message) => writeLog("ERROR", message);

// **JSON 文件路径**
const dataPaths = {
  holidays: path.resolve("data/Document/holidays.json"),
  jieqi: path.resolve("data/Document/jieqi.json"),
  astro: path.resolve("data/Document/astro.json"),
  calendar: path.resolve("data/Document/calendar.json"),
  shichen: path.resolve("data/Document/shichen.json"),
};

/**
 * **读取 JSON 文件**
 * @param {string} filePath 文件路径
 * @returns {Promise<Object>} 解析后的 JSON 数据
 */
export const readJsonData = async (filePath) => {
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

/**
 * **批量加载所有 JSON**
 * @returns {Promise<Object>} 包含所有 JSON 数据的对象
 */
export const loadAllJsonData = async () => {
  const entries = await Promise.all(
    Object.entries(dataPaths).map(async ([key, filePath]) => [key, await readJsonData(filePath)])
  );

  return Object.fromEntries(entries);
};

/**
 * **创建标准化事件对象**
 * @param {Object} event 事件数据
 * @returns {Object} 格式化后的事件对象
 */
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