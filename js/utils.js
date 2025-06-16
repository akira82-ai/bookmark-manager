/**
 * utils.js - 工具函数模块
 * 提供各种通用工具函数
 */

/**
 * ==========================
 * URL解析和处理函数
 * ==========================
 */

/**
 * 解析URL，返回URL各部分
 * @param {string} url - 要解析的URL
 * @returns {Object} 解析后的URL对象
 */
export function parseUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash,
      port: urlObj.port,
      origin: urlObj.origin
    };
  } catch (error) {
    console.error('解析URL失败:', error);
    return null;
  }
}

/**
 * 规范化URL（添加协议前缀）
 * @param {string} url - 输入的URL
 * @returns {string} 规范化后的URL
 */
export function normalizeUrl(url) {
  if (!url) return '';
  
  // 去除首尾空格
  url = url.trim();
  
  // 如果没有协议前缀，添加https://
  if (!url.startsWith('http://') && !url.startsWith('https://') && 
      !url.startsWith('ftp://') && !url.startsWith('file://')) {
    url = 'https://' + url;
  }
  
  return url;
}

/**
 * 提取URL的域名
 * @param {string} url - 输入的URL
 * @returns {string} 域名
 */
export function getDomain(url) {
  try {
    const urlObj = new URL(normalizeUrl(url));
    return urlObj.hostname;
  } catch (error) {
    // 简单的回退提取方式
    const match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/img);
    return match ? match[0].replace(/^(?:https?:\/\/)?(?:www\.)?/i, "") : url;
  }
}

/**
 * 生成网站图标URL
 * @param {string} url - 网站URL
 * @returns {string} 图标URL
 */
export function getFaviconUrl(url) {
  try {
    const domain = getDomain(url);
    return `https://www.google.com/s2/favicons?domain=${domain}`;
  } catch (error) {
    console.error('获取图标URL失败:', error);
    return '';
  }
}

/**
 * 判断URL是否有效
 * @param {string} url - 要检查的URL
 * @returns {boolean} 是否有效
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * ==========================
 * 日期格式化函数
 * ==========================
 */

/**
 * 格式化日期为YYYY-MM-DD格式
 * @param {Date|number|string} date - 日期对象、时间戳或日期字符串
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期时间为YYYY-MM-DD HH:MM:SS格式
 * @param {Date|number|string} date - 日期对象、时间戳或日期字符串
 * @returns {string} 格式化后的日期时间字符串
 */
export function formatDateTime(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 获取相对时间描述（例如：刚刚、5分钟前）
 * @param {Date|number|string} date - 日期对象、时间戳或日期字符串
 * @returns {string} 相对时间描述
 */
export function getRelativeTime(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const now = new Date();
  const diff = now - d;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  if (months < 12) return `${months}个月前`;
  return `${years}年前`;
}

/**
 * 计算两个日期之间的天数差
 * @param {Date|number|string} date1 - 第一个日期
 * @param {Date|number|string} date2 - 第二个日期
 * @returns {number} 天数差
 */
export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  
  // 将日期重置为午夜时间，以确保只计算天数
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  // 计算毫秒差并转换为天数
  const diffMs = Math.abs(d2 - d1);
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * ==========================
 * 通用存储操作辅助函数
 * ==========================
 */

/**
 * 保存数据到Chrome存储
 * @param {Object} data - 要保存的数据对象
 * @param {string} [storageArea='local'] - 存储区域，可选值：'local', 'sync', 'session'
 * @returns {Promise<void>}
 */
export async function saveToStorage(data, storageArea = 'local') {
  try {
    if (storageArea === 'local') {
      await chrome.storage.local.set(data);
    } else if (storageArea === 'sync') {
      await chrome.storage.sync.set(data);
    } else if (storageArea === 'session') {
      await chrome.storage.session.set(data);
    }
  } catch (error) {
    console.error('保存数据到存储失败:', error);
    throw error;
  }
}

/**
 * 从Chrome存储获取数据
 * @param {string|Array<string>|null} keys - 要获取的键名，null获取所有数据
 * @param {string} [storageArea='local'] - 存储区域，可选值：'local', 'sync', 'session'
 * @returns {Promise<Object>} 获取的数据
 */
export async function getFromStorage(keys = null, storageArea = 'local') {
  try {
    if (storageArea === 'local') {
      return await chrome.storage.local.get(keys);
    } else if (storageArea === 'sync') {
      return await chrome.storage.sync.get(keys);
    } else if (storageArea === 'session') {
      return await chrome.storage.session.get(keys);
    }
  } catch (error) {
    console.error('从存储获取数据失败:', error);
    throw error;
  }
}

/**
 * 从Chrome存储删除数据
 * @param {string|Array<string>} keys - 要删除的键名
 * @param {string} [storageArea='local'] - 存储区域，可选值：'local', 'sync', 'session'
 * @returns {Promise<void>}
 */
export async function removeFromStorage(keys, storageArea = 'local') {
  try {
    if (storageArea === 'local') {
      await chrome.storage.local.remove(keys);
    } else if (storageArea === 'sync') {
      await chrome.storage.sync.remove(keys);
    } else if (storageArea === 'session') {
      await chrome.storage.session.remove(keys);
    }
  } catch (error) {
    console.error('从存储删除数据失败:', error);
    throw error;
  }
}

/**
 * 清空Chrome存储
 * @param {string} [storageArea='local'] - 存储区域，可选值：'local', 'sync', 'session'
 * @returns {Promise<void>}
 */
export async function clearStorage(storageArea = 'local') {
  try {
    if (storageArea === 'local') {
      await chrome.storage.local.clear();
    } else if (storageArea === 'sync') {
      await chrome.storage.sync.clear();
    } else if (storageArea === 'session') {
      await chrome.storage.session.clear();
    }
  } catch (error) {
    console.error('清空存储失败:', error);
    throw error;
  }
}

/**
 * ==========================
 * 防抖和节流函数
 * ==========================
 */

/**
 * 防抖函数 - 延迟执行，多次调用只执行最后一次
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖处理后的函数
 */
export function debounce(func, wait = 300) {
  let timeout;
  
  return function(...args) {
    const context = this;
    
    clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * 节流函数 - 按时间间隔执行，确保函数在一段时间内只执行一次
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 节流处理后的函数
 */
export function throttle(func, wait = 300) {
  let timeout = null;
  let lastRun = 0;
  
  return function(...args) {
    const context = this;
    const now = Date.now();
    
    if (now - lastRun >= wait) {
      lastRun = now;
      func.apply(context, args);
    } else {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        lastRun = now;
        func.apply(context, args);
      }, wait - (now - lastRun));
    }
  };
}

/**
 * ==========================
 * 消息通信辅助函数
 * ==========================
 */

/**
 * 发送消息到后台脚本
 * @param {Object} message - 消息对象
 * @returns {Promise<any>} 响应数据
 */
export async function sendMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    console.error('发送消息失败:', error);
    throw error;
  }
}

/**
 * 发送消息到指定标签页
 * @param {number} tabId - 标签页ID
 * @param {Object} message - 消息对象
 * @returns {Promise<any>} 响应数据
 */
export async function sendMessageToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.error(`向标签页 ${tabId} 发送消息失败:`, error);
    throw error;
  }
}

/**
 * 向所有标签页广播消息
 * @param {Object} message - 消息对象
 * @returns {Promise<Array>} 响应数据数组
 */
export async function broadcastMessage(message) {
  try {
    const tabs = await chrome.tabs.query({});
    const promises = tabs.map(tab => {
      return chrome.tabs.sendMessage(tab.id, message)
        .catch(err => {
          console.warn(`向标签页 ${tab.id} 发送消息失败:`, err);
          return null;
        });
    });
    
    return await Promise.all(promises);
  } catch (error) {
    console.error('广播消息失败:', error);
    throw error;
  }
}

/**
 * ==========================
 * 错误处理和日志函数
 * ==========================
 */

// 日志级别
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// 当前日志级别
let currentLogLevel = LogLevel.INFO;

/**
 * 设置日志级别
 * @param {number} level - 日志级别
 */
export function setLogLevel(level) {
  currentLogLevel = level;
}

/**
 * 记录调试日志
 * @param {string} message - 日志消息
 * @param {...any} args - 附加参数
 */
export function logDebug(message, ...args) {
  if (currentLogLevel <= LogLevel.DEBUG) {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
}

/**
 * 记录信息日志
 * @param {string} message - 日志消息
 * @param {...any} args - 附加参数
 */
export function logInfo(message, ...args) {
  if (currentLogLevel <= LogLevel.INFO) {
    console.info(`[INFO] ${message}`, ...args);
  }
}

/**
 * 记录警告日志
 * @param {string} message - 日志消息
 * @param {...any} args - 附加参数
 */
export function logWarning(message, ...args) {
  if (currentLogLevel <= LogLevel.WARN) {
    console.warn(`[WARNING] ${message}`, ...args);
  }
}

/**
 * 记录错误日志
 * @param {string} message - 日志消息
 * @param {Error|any} [error] - 错误对象
 * @param {...any} args - 附加参数
 */
export function logError(message, error, ...args) {
  if (currentLogLevel <= LogLevel.ERROR) {
    console.error(`[ERROR] ${message}`, error, ...args);
  }
}

/**
 * 格式化错误对象为字符串
 * @param {Error|any} error - 错误对象
 * @returns {string} 格式化后的错误字符串
 */
export function formatError(error) {
  if (!error) return 'Unknown error';
  
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\nStack: ${error.stack || 'No stack trace'}`;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return JSON.stringify(error);
}

/**
 * 异常捕获装饰器（用于包装函数）
 * @param {Function} func - 要包装的函数
 * @param {string} [functionName] - 函数名称
 * @returns {Function} 包装后的函数
 */
export function tryCatch(func, functionName = 'unknown') {
  return function(...args) {
    try {
      return func.apply(this, args);
    } catch (error) {
      logError(`Error in function ${functionName}:`, error);
      // 可以在这里添加其他错误处理逻辑
      throw error;
    }
  };
}

/**
 * ==========================
 * 数据验证函数
 * ==========================
 */

/**
 * 检查值是否为空（null、undefined、空字符串、空数组、空对象）
 * @param {any} value - 要检查的值
 * @returns {boolean} 是否为空
 */
export function isEmpty(value) {
  if (value == null) return true; // null或undefined
  
  if (typeof value === 'string') return value.trim() === '';
  
  if (Array.isArray(value)) return value.length === 0;
  
  if (typeof value === 'object') return Object.keys(value).length === 0;
  
  return false;
}

/**
 * 检查字符串是否为有效的电子邮件地址
 * @param {string} email - 电子邮件地址
 * @returns {boolean} 是否有效
 */
export function isValidEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

/**
 * 验证字符串长度是否在指定范围内
 * @param {string} str - 要检查的字符串
 * @param {number} [minLength=0] - 最小长度
 * @param {number} [maxLength=Infinity] - 最大长度
 * @returns {boolean} 是否在范围内
 */
export function isValidLength(str, minLength = 0, maxLength = Infinity) {
  if (typeof str !== 'string') return false;
  
  const len = str.length;
  return len >= minLength && len <= maxLength;
}

/**
 * 检查对象是否包含指定的所有属性
 * @param {Object} obj - 要检查的对象
 * @param {Array<string>} props - 要检查的属性名数组
 * @returns {boolean} 是否包含所有属性
 */
export function hasProperties(obj, props) {
  if (!obj || typeof obj !== 'object') return false;
  
  return props.every(prop => prop in obj);
}

/**
 * ==========================
 * DOM操作辅助函数
 * ==========================
 */

/**
 * 创建DOM元素
 * @param {string} tagName - 标签名
 * @param {Object} [attributes] - 元素属性
 * @param {Object} [styles] - 元素样式
 * @param {string} [textContent] - 文本内容
 * @param {Array<Element>} [children] - 子元素
 * @returns {Element} 创建的元素
 */
export function createElement(tagName, attributes = {}, styles = {}, textContent = '', children = []) {
  const element = document.createElement(tagName);
  
  // 设置属性
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else {
      element.setAttribute(key, value);
    }
  });
  
  // 设置样式
  Object.entries(styles).forEach(([property, value]) => {
    element.style[property] = value;
  });
  
  // 设置文本内容
  if (textContent) {
    element.textContent = textContent;
  }
  
  // 添加子元素
  children.forEach(child => {
    element.appendChild(child);
  });
  
  return element;
}

/**
 * 查找元素
 * @param {string} selector - CSS选择器
 * @param {Element} [parent=document] - 父元素
 * @returns {Element|null} 找到的元素
 */
export function findElement(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * 查找多个元素
 * @param {string} selector - CSS选择器
 * @param {Element} [parent=document] - 父元素
 * @returns {Array<Element>} 找到的元素数组
 */
export function findElements(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * 添加事件监听器
 * @param {Element} element - 目标元素
 * @param {string} eventType - 事件类型
 * @param {Function} handler - 事件处理函数
 * @param {Object} [options] - 选项对象
 */
export function addEvent(element, eventType, handler, options = {}) {
  element.addEventListener(eventType, handler, options);
}

/**
 * 移除事件监听器
 * @param {Element} element - 目标元素
 * @param {string} eventType - 事件类型
 * @param {Function} handler - 事件处理函数
 * @param {Object} [options] - 选项对象
 */
export function removeEvent(element, eventType, handler, options = {}) {
  element.removeEventListener(eventType, handler, options);
}

/**
 * 显示元素
 * @param {Element} element - 目标元素
 * @param {string} [displayType='block'] - display属性值
 */
export function showElement(element, displayType = 'block') {
  element.style.display = displayType;
}

/**
 * 隐藏元素
 * @param {Element} element - 目标元素
 */
export function hideElement(element) {
  element.style.display = 'none';
}

/**
 * 切换元素显示状态
 * @param {Element} element - 目标元素
 * @param {string} [displayType='block'] - 显示时的display属性值
 * @returns {boolean} 元素当前是否显示
 */
export function toggleElement(element, displayType = 'block') {
  if (element.style.display === 'none') {
    element.style.display = displayType;
    return true;
  } else {
    element.style.display = 'none';
    return false;
  }
}

/**
 * 判断元素是否包含指定类名
 * @param {Element} element - 目标元素
 * @param {string} className - 类名
 * @returns {boolean} 是否包含
 */
export function hasClass(element, className) {
  return element.classList.contains(className);
}

/**
 * 添加类名
 * @param {Element} element - 目标元素
 * @param {...string} classNames - 要添加的类名
 */
export function addClass(element, ...classNames) {
  element.classList.add(...classNames);
}

/**
 * 移除类名
 * @param {Element} element - 目标元素
 * @param {...string} classNames - 要移除的类名
 */
export function removeClass(element, ...classNames) {
  element.classList.remove(...classNames);
}

/**
 * 切换类名
 * @param {Element} element - 目标元素
 * @param {string} className - 类名
 * @returns {boolean} 类名是否被添加
 */
export function toggleClass(element, className) {
  return element.classList.toggle(className);
}

/**
 * 获取或设置元素数据属性
 * @param {Element} element - 目标元素
 * @param {string} key - 数据键名
 * @param {string} [value] - 要设置的值，不提供则为获取操作
 * @returns {string|undefined} 获取操作时返回属性值
 */
export function dataAttr(element, key, value) {
  if (value === undefined) {
    return element.dataset[key];
  }
  
  element.dataset[key] = value;
}

/**
 * 获取元素相对于视口的位置
 * @param {Element} element - 目标元素
 * @returns {DOMRect} 元素的边界矩形
 */
export function getElementRect(element) {
  return element.getBoundingClientRect();
}

/**
 * 滚动到元素位置
 * @param {Element} element - 目标元素
 * @param {Object} [options] - 滚动选项
 */
export function scrollToElement(element, options = { behavior: 'smooth', block: 'start' }) {
  element.scrollIntoView(options);
}

/**
 * 处理表单数据
 * @param {HTMLFormElement} form - 表单元素
 * @returns {Object} 表单数据对象
 */
export function getFormData(form) {
  const formData = new FormData(form);
  const data = {};
  
  for (const [key, value] of formData.entries()) {
    data[key] = value;
  }
  
  return data;
}
