const fs = require('fs');
const path = require('path');

// 写日志到文件
const logToFile = (message, level) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} [${level}] ${message}\n`;
  fs.appendFileSync('calendar.log', logMessage, 'utf-8');
};

// 读取 JSON 文件
const readJson = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);  // 确保 JSON 格式正确
  } catch (error) {
    logToFile(`❌ 读取文件失败: ${filePath} - 错误: ${error.message}`, 'ERROR');
    return null;  // 返回 null 表示读取失败
  }
};

// 确保目录存在，如果不存在则创建
const ensureDirectoryExists = (filePath) => {
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logToFile(`📂 创建目录: ${dirPath}`, 'INFO');
  }
};

module.exports = { logToFile, readJson, ensureDirectoryExists };