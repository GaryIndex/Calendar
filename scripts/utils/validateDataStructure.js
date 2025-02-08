const validateDataStructure = (data, requiredFields) => {
  if (!data || typeof data !== 'object') return false;

  // 兼容 JSON 是对象或数组的情况
  const values = Array.isArray(data) ? data : Object.values(data);

  return values.every(entry =>
    requiredFields.every(field => entry[field] !== undefined && typeof entry[field] === 'string')
  );
};

module.exports = validateDataStructure;