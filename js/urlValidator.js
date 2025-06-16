/**
 * URL有效性检查模块
 * 提供单个和批量检查URL有效性的功能
 */

class UrlValidator {
  constructor() {
    // 初始化缓存
    this.cache = {};
    this.cacheExpiration = 24 * 60 * 60 * 1000; // 24小时缓存过期时间
    this.ongoing = new Set(); // 存储正在检查中的URL
    
    // 从存储中恢复缓存
    this._initCache();
  }

  /**
   * 初始化缓存
   * @private
   */
  async _initCache() {
    try {
      const data = await chrome.storage.local.get(['urlValidityCache']);
      if (data.urlValidityCache) {
        this.cache = data.urlValidityCache;
        
        // 清除过期缓存
        const now = Date.now();
        for (const url in this.cache) {
          if (now - this.cache[url].timestamp > this.cacheExpiration) {
            delete this.cache[url];
          }
        }
      }
    } catch (error) {
      console.error('初始化URL有效性缓存失败:', error);
      this.cache = {};
    }
  }

  /**
   * 保存缓存到存储
   * @private
   */
  async _saveCache() {
    try {
      await chrome.storage.local.set({ urlValidityCache: this.cache });
    } catch (error) {
      console.error('保存URL有效性缓存失败:', error);
    }
  }

  /**
   * 检查单个URL有效性
   * @param {string} url - 要检查的URL
   * @param {Object} options - 检查选项
   * @param {boolean} options.useCache - 是否使用缓存结果，默认true
   * @param {number} options.timeout - 超时时间(毫秒)，默认5000
   * @returns {Promise<Object>} 检查结果
   */
  async checkUrl(url, options = {}) {
    const { useCache = true, timeout = 5000 } = options;
    
    // 标准化URL
    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    // 检查缓存
    if (useCache && this.cache[normalizedUrl] && 
        Date.now() - this.cache[normalizedUrl].timestamp < this.cacheExpiration) {
      return {
        ...this.cache[normalizedUrl].result,
        fromCache: true
      };
    }
    
    // 如果URL已经在检查中，则等待
    if (this.ongoing.has(normalizedUrl)) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.ongoing.has(normalizedUrl) && this.cache[normalizedUrl]) {
            clearInterval(checkInterval);
            resolve({
              ...this.cache[normalizedUrl].result,
              fromCache: true
            });
          }
        }, 100);
      });
    }
    
    // 标记URL为检查中
    this.ongoing.add(normalizedUrl);
    
    try {
      // 创建超时Promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('请求超时')), timeout);
      });
      
      // 创建请求Promise
      const fetchPromise = fetch(normalizedUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        redirect: 'follow'
      });
      
      // 竞争两个Promise
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      const result = {
        url: normalizedUrl,
        originalUrl: url,
        valid: response.ok,
        status: response.status,
        statusText: response.statusText,
        timestamp: Date.now()
      };
      
      // 根据状态代码确定错误类型
      if (!response.ok) {
        result.errorType = this._getErrorTypeByStatus(response.status);
      }
      
      // 缓存结果
      this.cache[normalizedUrl] = {
        result,
        timestamp: Date.now()
      };
      
      // 保存缓存
      this._saveCache();
      
      // 移除正在检查的标记
      this.ongoing.delete(normalizedUrl);
      
      return result;
    } catch (error) {
      const errorResult = {
        url: normalizedUrl,
        originalUrl: url,
        valid: false,
        error: error.message,
        errorType: this._getErrorTypeFromException(error),
        timestamp: Date.now()
      };
      
      // 缓存结果
      this.cache[normalizedUrl] = {
        result: errorResult,
        timestamp: Date.now()
      };
      
      // 保存缓存
      this._saveCache();
      
      // 移除正在检查的标记
      this.ongoing.delete(normalizedUrl);
      
      return errorResult;
    }
  }

  /**
   * 根据状态代码确定错误类型
   * @param {number} status - HTTP状态代码
   * @returns {string} 错误类型
   * @private
   */
  _getErrorTypeByStatus(status) {
    if (status >= 400 && status < 500) {
      if (status === 400) return 'BAD_REQUEST';
      if (status === 401) return 'UNAUTHORIZED';
      if (status === 403) return 'FORBIDDEN';
      if (status === 404) return 'NOT_FOUND';
      if (status === 429) return 'TOO_MANY_REQUESTS';
      return 'CLIENT_ERROR';
    }
    if (status >= 500) {
      if (status === 500) return 'SERVER_ERROR';
      if (status === 502) return 'BAD_GATEWAY';
      if (status === 503) return 'SERVICE_UNAVAILABLE';
      if (status === 504) return 'GATEWAY_TIMEOUT';
      return 'SERVER_ERROR';
    }
    return 'UNKNOWN';
  }

  /**
   * 从异常中确定错误类型
   * @param {Error} error - 错误对象
   * @returns {string} 错误类型
   * @private
   */
  _getErrorTypeFromException(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('timed out')) return 'TIMEOUT';
    if (message.includes('network') || message.includes('offline')) return 'NETWORK_ERROR';
    if (message.includes('refused') || message.includes('reset')) return 'CONNECTION_REFUSED';
    if (message.includes('forbidden')) return 'FORBIDDEN';
    if (message.includes('not found')) return 'NOT_FOUND';
    if (message.includes('cors')) return 'CORS_ERROR';
    
    return 'UNKNOWN';
  }

  /**
   * 批量检查URL有效性
   * @param {Array<string>} urls - URL数组
   * @param {Object} options - 检查选项
   * @param {boolean} options.useCache - 是否使用缓存，默认为true
   * @param {number} options.timeout - 超时时间(毫秒)，默认5000
   * @param {number} options.concurrency - 并发检查数量，默认5
   * @param {Function} options.progressCallback - 进度回调函数，接收(completed, total)参数
   * @returns {Promise<Array>} 检查结果数组
   */
  async checkUrls(urls, options = {}) {
    const {
      useCache = true,
      timeout = 5000,
      concurrency = 5,
      progressCallback = null
    } = options;
    
    // 结果数组
    const results = [];
    let completed = 0;
    const total = urls.length;
    
    // 批处理URL
    const batchProcess = async (batch) => {
      const batchPromises = batch.map(url => this.checkUrl(url, { useCache, timeout }));
      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        results.push(result);
        completed++;
        
        if (progressCallback) {
          progressCallback(completed, total);
        }
      }
    };
    
    // 按并发数量分批处理
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      await batchProcess(batch);
    }
    
    return results;
  }

  /**
   * 清除验证缓存
   * @param {string|Array<string>} [urlsToInvalidate] - 要清除缓存的URL，不提供则清除所有缓存
   */
  async clearCache(urlsToInvalidate) {
    try {
      if (!urlsToInvalidate) {
        // 清除所有缓存
        this.cache = {};
      } else if (Array.isArray(urlsToInvalidate)) {
        // 清除指定URL的缓存
        for (const url of urlsToInvalidate) {
          delete this.cache[url];
        }
      } else {
        // 清除单个URL的缓存
        delete this.cache[urlsToInvalidate];
      }
      
      // 保存到存储
      await this._saveCache();
      
      return true;
    } catch (error) {
      console.error('清除URL有效性缓存失败:', error);
      return false;
    }
  }
  
  /**
   * 获取针对URL错误类型的友好消息
   * @param {Object} result - 检查结果
   * @returns {string} 用户友好的错误消息
   */
  getErrorMessage(result) {
    if (result.valid) return '网址有效';
    
    switch (result.errorType) {
      case 'NOT_FOUND':
        return '页面不存在(404)';
      case 'FORBIDDEN':
        return '访问被禁止(403)';
      case 'UNAUTHORIZED':
        return '需要认证(401)';
      case 'SERVER_ERROR':
        return '服务器错误(' + (result.status || 500) + ')';
      case 'BAD_GATEWAY':
        return '网关错误(502)';
      case 'SERVICE_UNAVAILABLE':
        return '服务不可用(503)';
      case 'GATEWAY_TIMEOUT':
        return '网关超时(504)';
      case 'TIMEOUT':
        return '连接超时';
      case 'CONNECTION_REFUSED':
        return '连接被拒绝';
      case 'NETWORK_ERROR':
        return '网络错误';
      case 'CORS_ERROR':
        return '跨域请求被阻止';
      case 'TOO_MANY_REQUESTS':
        return '请求过于频繁(429)';
      default:
        return '未知错误' + (result.error ? ': ' + result.error : '');
    }
  }
  
  /**
   * 根据检查结果获取状态颜色
   * @param {Object} result - 检查结果
   * @returns {string} 颜色代码
   */
  getStatusColor(result) {
    if (result.valid) return '#4caf50'; // 绿色
    
    switch (result.errorType) {
      case 'NOT_FOUND':
        return '#f44336'; // 红色
      case 'FORBIDDEN':
      case 'UNAUTHORIZED':
        return '#ff9800'; // 橙色
      case 'SERVER_ERROR':
      case 'BAD_GATEWAY':
      case 'SERVICE_UNAVAILABLE':
      case 'GATEWAY_TIMEOUT':
        return '#ff5722'; // 深橙色
      case 'TIMEOUT':
        return '#ffc107'; // 琥珀色
      case 'CONNECTION_REFUSED':
      case 'NETWORK_ERROR':
        return '#e91e63'; // 粉色
      default:
        return '#9e9e9e'; // 灰色
    }
  }
}

// 创建单例实例并导出
const urlValidator = new UrlValidator();
export default urlValidator;
