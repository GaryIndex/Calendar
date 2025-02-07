const axios = require('axios');
const fs = require('fs');
const path = './data/data.json';
const logPath = './data/error.log';  // 错误日志文件路径

// 用于记录错误日志的函数
const logError = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logPath, logMessage);
};

// 用于存储数据的函数
async function fetchData() {
  try {
    console.log('Starting to fetch data...');
    
    // 设置从 2025-01-01 到今天的日期范围
    const startDate = new Date('2025-01-01');
    const today = new Date();
    const dates = [];

    // 按天生成日期列表
    for (let currentDate = startDate; currentDate <= today; currentDate.setDate(currentDate.getDate() + 1)) {
      dates.push(currentDate.toISOString().split('T')[0]);  // 格式化为 YYYY-MM-DD
    }

    // 获取万年历数据
    const fetchCalendarData = async (date) => {
      try {
        const response = await axios.get('https://api.timelessq.com/time', {
          params: { datetime: date }
        });
        console.log(`Fetched calendar data for ${date}`);  // 调试输出
        return response.data;
      } catch (error) {
        logError(`Failed to fetch calendar data for ${date}: ${error.message}`);
        throw new Error(`Calendar API error for ${date}`);
      }
    };

    // 获取星座数据
    const fetchAstroData = async (date) => {
      try {
        const response = await axios.get('https://api.timelessq.com/time/astro', {
          params: { keyword: date }
        });
        console.log(`Fetched astro data for ${date}`);  // 调试输出
        return response.data;
      } catch (error) {
        logError(`Failed to fetch astro data for ${date}: ${error.message}`);
        throw new Error(`Astro API error for ${date}`);
      }
    };

    // 获取十二时辰数据
    const fetchShichenData = async (date) => {
      try {
        const response = await axios.get('https://api.timelessq.com/time/shichen', {
          params: { date }
        });
        console.log(`Fetched shichen data for ${date}`);  // 调试输出
        return response.data;
      } catch (error) {
        logError(`Failed to fetch shichen data for ${date}: ${error.message}`);
        throw new Error(`Shichen API error for ${date}`);
      }
    };

    // 获取二十四节气数据
    const fetchJieqiData = async (year) => {
      try {
        const response = await axios.get('https://api.timelessq.com/time/jieqi', {
          params: { year }
        });
        console.log(`Fetched jieqi data for ${year}`);  // 调试输出
        return response.data;
      } catch (error) {
        logError(`Failed to fetch jieqi data for ${year}: ${error.message}`);
        throw new Error(`Jieqi API error for ${year}`);
      }
    };

    // 获取假期数据
    const fetchHolidaysData = async (year) => {
      try {
        const response = await axios.get(`https://api.jiejiariapi.com/v1/holidays/${year}`);
        console.log(`Fetched holidays data for ${year}`);  // 调试输出
        return response.data;
      } catch (error) {
        logError(`Failed to fetch holidays data for ${year}: ${error.message}`);
        throw new Error(`Holidays API error for ${year}`);
      }
    };

    // 逐天抓取数据并实时保存
    for (const date of dates) {
      console.log(`Fetching data for ${date}...`);

      try {
        const calendarData = await fetchCalendarData(date);
        const astroData = await fetchAstroData(date);
        const shichenData = await fetchShichenData(date);
        const jieqiData = await fetchJieqiData(date.split('-')[0]);  // 使用年份
        const holidaysData = await fetchHolidaysData(date.split('-')[0]);

        // 格式化当天的数据
        const dailyData = {
          date,
          calendar: calendarData,
          astro: astroData,
          shichen: shichenData,
          jieqi: jieqiData,
          holidays: holidaysData,
        };

        // 读取现有的 data.json 文件，如果文件为空，则初始化为空数组
        let existingData = [];
        if (fs.existsSync(path)) {
          const fileData = fs.readFileSync(path, 'utf8');
          
          // 检查文件内容是否有效
          if (fileData) {
            try {
              existingData = JSON.parse(fileData);  // 解析JSON数据
              console.log('Existing data loaded.');
            } catch (error) {
              console.error('Error parsing data.json:', error);
              existingData = [];  // 如果解析失败，初始化为空数组
            }
          } else {
            console.log('data.json is empty, initializing an empty array.');
            existingData = [];  // 如果文件为空，初始化为空数组
          }
        } else {
          console.log('data.json does not exist, initializing an empty array.');
          existingData = [];  // 如果文件不存在，初始化为空数组
        }

        // 将新数据添加到现有数据中
        existingData.push(dailyData);

        // 将合并后的数据实时保存到 data.json
        fs.writeFileSync(path, JSON.stringify(existingData, null, 2));
        console.log(`Data for ${date} saved to data.json`);

      } catch (error) {
        logError(`Skipping data for ${date} due to previous error.`);
      }
    }
    
  } catch (error) {
    console.error('Error while fetching data:', error);
    logError(`Failed to fetch data: ${error.message}`);
  }
}

// 执行数据抓取
fetchData();