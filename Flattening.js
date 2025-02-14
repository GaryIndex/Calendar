//calendar扁平化
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