import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import fs from "fs/promises";

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
    console.error(chalk.red(`❌ 创建日志目录失败: ${error.message}`));
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
export const logError = (message) => writeLog("ERROR", message);

// **JSON 文件路径**
export const dataPaths = {
  holidays: path.resolve("data/Document/holidays.json"),
  jieqi: path.resolve("data/Document/jieqi.json"),
  astro: path.resolve("data/Document/astro.json"),
  calendar: path.resolve("data/Document/calendar.json"),
  shichen: path.resolve("data/Document/shichen.json"),
};

// **读取 JSON 文件**
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

// **批量加载所有 JSON**
export const loadAllJsonData = async () => {
  const entries = await Promise.all(
    Object.entries(dataPaths).map(async ([key, filePath]) => [key, await readJsonData(filePath)])
  );
  return Object.fromEntries(entries);
};

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