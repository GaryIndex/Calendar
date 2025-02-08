const fs = require('fs');
const path = require('path');

// 读取 JSON 文件
const readJson = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`);
      return null;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ 读取 JSON 失败: ${error.message}`);
    return null;
  }
};

// 确保目录存在
const ensureDirectoryExists = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 记录日志
const logToFile = (message, type = 'INFO') => {
  const logMessage = `[${new Date().toISOString()}] [${type}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync('./data/error.log', logMessage + '\n');
};

module.exports = { readJson, ensureDirectoryExists, logToFile };