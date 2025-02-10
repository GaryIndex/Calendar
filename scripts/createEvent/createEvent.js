/**
 * 创建事件对象
 * @param {Object} params - 事件参数
 * @param {string} params.date - 事件的日期（格式: YYYY-MM-DD）
 * @param {string} params.title - 事件标题
 * @param {string} [params.location=""] - 位置或视频通话（默认为空）
 * @param {boolean} [params.isAllDay=false] - 是否全天事件（默认为 false）
 * @param {string} [params.startTime=""] - 开始时间（格式: HH:mm:ss，默认为空）
 * @param {string} [params.endTime=""] - 结束时间（格式: HH:mm:ss，默认为空）
 * @param {string} [params.travelTime=""] - 行程时间（默认为空）
 * @param {string} [params.repeat=""] - 重复设置（默认为空）
 * @param {string} [params.alarm=""] - 提醒设置（默认为空）
 * @param {string} [params.attachment=""] - 附件（默认为空）
 * @param {string} [params.url=""] - URL（默认为空）
 * @param {string} [params.badge=""] - 角标（如“休”或“班”，默认为空）
 * @param {string} params.description - 事件描述（拼接的备注信息）
 * @param {number} [params.priority=0] - 事件优先级（数值越高，优先级越高，默认为 0）
 * 
 * @returns {Object} 事件对象
 */
export function createEvent({
  date,
  title,
  location = "",
  isAllDay = false,
  startTime = "",
  endTime = "",
  travelTime = "",
  repeat = "",
  alarm = "",
  attachment = "",
  url = "",
  badge = "",
  description,
  priority = 0 // 🔥 新增优先级字段，默认 0
}) {
  return {
    date,
    title,
    location,
    isAllDay,
    startTime,
    endTime,
    travelTime,
    repeat,
    alarm,
    attachment,
    url,
    badge,
    description,
    priority // 🔥 返回优先级字段
  };
}