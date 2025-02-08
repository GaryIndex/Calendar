const validateDataStructure = (data, requiredFields) => {
  if (!data || typeof data !== 'object') return false;

  // **如果 data 是对象（不是数组），转换成数组**
  const values = Array.isArray(data)
    ? data
    : Object.entries(data).map(([key, value]) => {
        // **如果数据包裹在 `data` 字段，取出 `data` 内的数据**
        if (value && typeof value === 'object' && 'data' in value) {
          return { date: key, ...value.data }; // 把 `date` 作为字段加入
        }
        return { date: key, ...value };
      });

  // **检查 requiredFields 是否都存在**
  return values.every(entry =>
    requiredFields.every(field => entry[field] !== undefined && typeof entry[field] === 'string')
  );
};

module.exports = validateDataStructure;