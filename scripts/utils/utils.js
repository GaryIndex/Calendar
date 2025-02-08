const fs = require('fs');
const path = require('path');

// 确保目录存在
const ensureDirectoryExists = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 读取 JSON 文件
const readJson = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logToFile(`❌ 读取文件失败: ${filePath} - 错误: ${error.message}`, 'ERROR');
    return null;
  }
};

// 日志记录
const logToFile = (message, level = 'INFO') => {
  const logMessage = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  fs.appendFileSync('calendar.log', logMessage);
};

module.exports = {
  ensureDirectoryExists,  // 确保这里正确导出
  logToFile,
  readJson
};