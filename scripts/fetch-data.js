const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { format, addDays } = require("date-fns");

const dataFilePath = path.join(__dirname, "../data/data.json");

// **确保 data.json 存在且有效**
if (!fs.existsSync(dataFilePath) || fs.statSync(dataFilePath).size === 0) {
  console.log("data.json 文件不存在或为空，创建空文件...");
  fs.writeFileSync(dataFilePath, JSON.stringify({}, null, 2)); // 写入 {}
}

// **读取 JSON 数据，处理空文件或解析错误**
let data = {};
try {
  const fileContent = fs.readFileSync(dataFilePath, "utf-8").trim();
  data = fileContent ? JSON.parse(fileContent) : {};
} catch (error) {
  console.error("data.json 解析失败，初始化为空对象:", error.message);
  data = {};
}

const startDate = new Date("2020-01-01"); // 从 2020-01-01 开始
const endDate = new Date(); // 结束日期是今天

async function fetchAndSaveData(dateString) {
  if (data[dateString]) {
    console.log(`跳过 ${dateString}，数据已存在`);
    return;
  }

  console.log(`获取数据: ${dateString}`);

  try {
    const [lunarRes, astroRes, shichenRes, jieqiRes, holidaysRes] = await Promise.all([
      axios.get("https://api.timelessq.com/time", { params: { datetime: dateString } }),
      axios.get("https://api.timelessq.com/time/astro", { params: { keyword: dateString } }),
      axios.get("https://api.timelessq.com/time/shichen", { params: { date: dateString } }),
      axios.get("https://api.timelessq.com/time/jieqi", { params: { year: dateString.substring(0, 4) } }),
      axios.get(`https://api.jiejiariapi.com/v1/holidays/${dateString.substring(0, 4)}`)
    ]);

    data[dateString] = {
      lunar: lunarRes.data,
      horoscope: astroRes.data,
      shichen: shichenRes.data,
      jieqi: jieqiRes.data,
      holidays: holidaysRes.data
    };

    // **实时写入 JSON 文件**
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    console.log(`已存储 ${dateString} 的数据`);

  } catch (error) {
    console.error(`获取 ${dateString} 失败:`, error.message);
  }
}

async function fetchData() {
  console.log(`开始抓取数据: 从 ${format(startDate, "yyyy-MM-dd")} 到 ${format(endDate, "yyyy-MM-dd")}`);

  let currentDate = startDate;
  while (currentDate <= endDate) {
    const dateString = format(currentDate, "yyyy-MM-dd");
    await fetchAndSaveData(dateString);
    currentDate = addDays(currentDate, 1);
  }

  console.log("数据抓取完成");
}

fetchData();