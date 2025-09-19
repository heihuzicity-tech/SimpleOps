/**
 * 格式化工具函数
 */

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * 格式化时长
 * @param seconds 秒数
 * @returns 格式化后的时长字符串
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}秒`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  
  if (minutes < 60) {
    return `${minutes}分${remainingSeconds}秒`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}时${remainingMinutes}分${remainingSeconds}秒`;
};

/**
 * 格式化百分比
 * @param ratio 比率 (0-1)
 * @param decimals 小数位数
 * @returns 格式化后的百分比字符串
 */
export const formatPercentage = (ratio: number, decimals: number = 1): string => {
  return `${(ratio * 100).toFixed(decimals)}%`;
};

/**
 * 格式化日期时间
 * @param date 日期字符串或Date对象
 * @param format 格式类型
 * @returns 格式化后的日期时间字符串
 */
export const formatDateTime = (
  date: string | Date, 
  format: 'full' | 'date' | 'time' | 'short' = 'full'
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  switch (format) {
    case 'date':
      return d.toLocaleDateString('zh-CN');
    case 'time':
      return d.toLocaleTimeString('zh-CN');
    case 'short':
      return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    case 'full':
    default:
      return d.toLocaleString('zh-CN');
  }
};

/**
 * 格式化数字
 * @param num 数字
 * @param decimals 小数位数
 * @returns 格式化后的数字字符串
 */
export const formatNumber = (num: number, decimals: number = 0): string => {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * 截断文本
 * @param text 文本
 * @param maxLength 最大长度
 * @param suffix 后缀
 * @returns 截断后的文本
 */
export const truncateText = (text: string, maxLength: number, suffix: string = '...'): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - suffix.length) + suffix;
};

/**
 * 格式化会话ID显示
 * @param sessionId 会话ID
 * @param length 显示长度
 * @returns 格式化后的会话ID
 */
export const formatSessionId = (sessionId: string, length: number = 8): string => {
  if (sessionId.length <= length) {
    return sessionId;
  }
  return sessionId.slice(0, length) + '...';
};

/**
 * 格式化压缩比显示
 * @param ratio 压缩比 (0-1)
 * @returns 格式化后的压缩比字符串
 */
export const formatCompressionRatio = (ratio: number): string => {
  const percentage = (ratio * 100).toFixed(1);
  const savings = ((1 - ratio) * 100).toFixed(1);
  return `${percentage}% (节省${savings}%)`;
};

/**
 * 格式化状态显示
 * @param status 状态
 * @returns 中文状态
 */
export const formatStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    recording: '录制中',
    completed: '已完成',
    failed: '失败',
    active: '活跃',
    inactive: '非活跃',
    online: '在线',
    offline: '离线',
    success: '成功',
    error: '错误',
    warning: '警告',
    info: '信息',
  };
  
  return statusMap[status] || status;
};

/**
 * 格式化终端尺寸
 * @param width 宽度
 * @param height 高度
 * @returns 格式化后的尺寸字符串
 */
export const formatTerminalSize = (width: number, height: number): string => {
  return `${width}×${height}`;
};

/**
 * 格式化数据传输速率
 * @param bytesPerSecond 每秒字节数
 * @returns 格式化后的传输速率
 */
export const formatDataRate = (bytesPerSecond: number): string => {
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let size = bytesPerSecond;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
};