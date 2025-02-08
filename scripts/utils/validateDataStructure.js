const validateDataStructure = (data, requiredFields) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  // 检查每个条目是否符合结构
  return Object.values(data).every(entry =>
    requiredFields.every(field => entry[field] !== undefined && typeof entry[field] === 'string')
  );
};

module.exports = validateDataStructure;