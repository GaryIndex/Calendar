const validateDataStructure = (data, requiredFields) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;

  const values = Object.entries(data).map(([date, value]) => {
    if (value && typeof value === 'object') {
      // **如果有 `data` 字段，提取内部数据**
      if ('data' in value && typeof value.data === 'object') {
        return { date, ...value.data };
      }
      // **否则，直接展开对象**
      return { date, ...value };
    }
    return { date };
  });

  // **检查 requiredFields 是否都存在**
  return values.every(entry =>
    requiredFields.every(field => field in entry && typeof entry[field] === 'string')
  );
};

module.exports = validateDataStructure;