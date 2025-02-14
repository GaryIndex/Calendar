import fs from 'fs';

// calendar 扁平化
const flattenCalendarData = (data, dateStr) => {
  if (!data || typeof data !== 'object') return {};
  const { errno, errmsg, data: rawData } = data;
  if (!rawData || !rawData.date) return {}; // 确保 rawData 和 rawData.date 存在
  // 提取所需的原始数据
  const { lunar, almanac, festivals, ...flatData } = rawData;
  // 处理字段中的默认值和拼接
  flatData.festivals = (festivals || []).join(',');
  flatData.pengzubaiji = (almanac?.pengzubaiji || []).join(',');
  flatData.liuyao = almanac?.liuyao || '';
  flatData.jiuxing = almanac?.jiuxing || '';
  flatData.taisui = almanac?.taisui || '';
  // 处理 lunar 和 almanac 的数据合并
  if (lunar) {
    Object.assign(flatData, lunar);
  }
  if (almanac) {
    Object.assign(flatData, almanac);
  }
  // 检查 jishenfangwei 是否存在
  if (almanac?.jishenfangwei) {
    Object.assign(flatData, almanac.jishenfangwei);
  }
  // 删除不需要的字段
  delete flatData.jishenfangwei;
  // 返回扁平化后的数据
  return {
    [dateStr]: { 
      Reconstruction: [
        {
          errno,
          errmsg,
          data: [
            {
              date: rawData.date || dateStr, // 使用 dateStr，或者 rawData 中的日期字段
              hour: rawData.hour,
              minute: rawData.minute,
              second: rawData.second,
              festivals: flatData.festivals,
              pengzubaiji: flatData.pengzubaiji,
              liuyao: flatData.liuyao,
              jiuxing: flatData.jiuxing,
              taisui: flatData.taisui,
              // 从 almanac 和 lunar 中提取的扁平化字段
              zodiac: flatData.zodiac,
              cnYear: flatData.cnYear,
              cnMonth: flatData.cnMonth,
              cnDay: flatData.cnDay,
              cyclicalYear: flatData.cyclicalYear,
              cyclicalMonth: flatData.cyclicalMonth,
              cyclicalDay: flatData.cyclicalDay,
              hourLunar: flatData.hour,
              maxDayInMonthLunar: flatData.maxDayInMonth,
              leapMonth: flatData.leapMonth,
              yuexiang: flatData.yuexiang,
              wuhou: flatData.wuhou,
              shujiu: flatData.shujiu,
              sanfu: flatData.sanfu,
              solarTerms: JSON.stringify(flatData.solarTerms),
              yi: flatData.yi,
              ji: flatData.ji,
              chong: flatData.chong,
              sha: flatData.sha,
              naYin: flatData.nayin,
              shiershen: flatData.shiershen,
              xingxiu: flatData.xingxiu,
              zheng: flatData.zheng,
              shou: flatData.shou,
              jishenfangwei: JSON.stringify(flatData.jishenfangwei),
            }
          ]
        }
      ]
    }
  };
};

// 扁平化 astro.json 数据的函数
const flattenAstroData = (astroData, dateStr) => {
  const data = astroData.data;
  // 创建一个包含扁平化数据的对象，符合目标结构
  return {
    [dateStr]: {
      "Reconstruction": [
        {
          "errno": astroData.errno,
          "errmsg": astroData.errmsg,
          "name": data.name,
          "range": data.range,
          "zxtd": data.zxtd,
          "sssx": data.sssx,
          "zggw": data.zggw,
          "yysx": data.yysx,
          "zdtz": data.zdtz,
          "zgxx": data.zgxx,
          "xyys": data.xyys,
          "jssw": data.jssw,
          "xyhm": data.xyhm,
          "kyjs": data.kyjs,
          "bx": data.bx,
          "yd": data.yd,
          "qd": data.qd,
          "jbtz": data.jbtz,
          "jttz": data.jttz,
          "xsfg": data.xsfg,
          "gxmd": data.gxmd,
          "zj": data.zj
        }
      ]
    }
  };
};

// Shichen 扁平化
const originalData = JSON.parse(fs.readFileSync('shichen.json', 'utf8'));
// 扁平化数据并构建新结构
let flattenedShichenData = originalData.data.reduce((acc, item) => {
  const dateStr = item.date.replace(/-/g, '.'); // 将日期格式转换为 YYYY.MM.DD 格式
  if (!acc[dateStr]) {
    acc[dateStr] = { Reconstruction: [] };
  }
  // 创建一个新的事件对象，并添加到 `Reconstruction` 数组中
  acc[dateStr].Reconstruction.push({
    date: item.date,
    hours: item.hours,
    hour: item.hour,
    yi: item.yi,
    ji: item.ji,
    chong: item.chong,
    sha: item.sha,
    nayin: item.nayin,
    jiuxing: item.jiuxing
  });
  return acc;
}, {});
// 导出函数和数据
export { flattenCalendarData, flattenAstroData, originalData };
console.log(flattenedShichenData);