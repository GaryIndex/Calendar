const validateDataStructure = (data, requiredFields) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;

  const values = Object.values(data).flatMap(outerValue => {
    // **如果 outerValue 是对象，遍历其中的键值**
    if (outerValue && typeof outerValue === 'object') {
      return Object.values(outerValue); // 提取第二层数据
    }
    return [];
  });

  // **检查 requiredFields 是否都存在**
  return values.every(entry =>
    requiredFields.every(field => entry[field] !== undefined && typeof entry[field] === 'string')
  );
};

module.exports = validateDataStructure;