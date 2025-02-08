const validateDataStructure = (data, requiredFields) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    console.log("无效的结构: ", data); // 输出无效结构数据
    return false;
  }

  return Object.values(data).every(entry => {
    console.log("验证条目: ", entry); // 打印每个条目的内容
    return requiredFields.every(field => entry[field] !== undefined && typeof entry[field] === 'string');
  });
};

module.exports = validateDataStructure;