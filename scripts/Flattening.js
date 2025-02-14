// dataProcessor.js

// 处理 calendar 数据
export const processCalendarData = (originalData, dateStr) => {
  return {
    [dateStr]: {
      Reconstruction: [
        {
          errno: originalData.errno,
          errmsg: originalData.errmsg,
          data: originalData.data // 保持原始数据不变
        }
      ]
    }
  };
};

// 处理 astro 数据
export const processAstroData = (originalData, dateStr) => {
  return {
    [dateStr]: {
      Reconstruction: [
        {
          errno: originalData.errno,
          errmsg: originalData.errmsg,
          data: originalData.data // 保持原始数据不变
        }
      ]
    }
  };
};

// 处理 shichen 数据
export const processShichenData = (originalData, dateStr) => {
  return {
    [dateStr]: {
      Reconstruction: [
        {
          errno: originalData.errno,
          errmsg: originalData.errmsg,
          data: originalData.data // 保持原始数据不变
        }
      ]
    }
  };
};

// 处理 jieqi 数据
export const processJieqiData = (originalData, dateStr) => {
  return {
    [dateStr]: {
      Reconstruction: [
        {
          errno: originalData.errno,
          errmsg: originalData.errmsg,
          data: originalData.data // 保持原始数据不变
        }
      ]
    }
  };
};

// 处理 holidays 数据
export const processHolidaysData = (originalData, dateStr) => {
  return {
    [dateStr]: {
      Reconstruction: [
        {
          errno: originalData.errno,
          errmsg: originalData.errmsg,
          data: originalData.data // 保持原始数据不变
        }
      ]
    }
  };
};