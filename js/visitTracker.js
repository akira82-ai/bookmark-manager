/**
 * 访问追踪功能模块
 * 记录和分析用户访问的页面，提供访问频率统计
 */

class VisitTracker {
  constructor() {
    // 初始化
    this.initialized = false;
    this.init();
  }

  /**
   * 初始化模块
   */
  async init() {
    if (this.initialized) return;
    this.initialized = true;

    // 确保存储结构合理
    const storage = await chrome.storage.local.get(['urlVisits']);
    if (!storage.urlVisits) {
      await chrome.storage.local.set({ urlVisits: {} });
    }
  }

  /**
   * 记录页面访问
   * @param {string} url - 访问的URL
   * @param {string} title - 页面标题
   * @returns {Promise<boolean>} 记录是否成功
   */
  async recordVisit(url, title) {
    try {
      await this.init();

      // 忽略浏览器内部页面和扩展页面
      if (url.startsWith('chrome://') || 
          url.startsWith('chrome-extension://') || 
          url.startsWith('about:')) {
        return false;
      }

      // 获取主机名
      let hostname;
      try {
        hostname = new URL(url).hostname;
      } catch (error) {
        console.error('无效的URL:', url);
        return false;
      }

      // 获取当前的URL访问记录
      const { urlVisits } = await chrome.storage.local.get(['urlVisits']);
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // 更新或创建URL访问记录
      if (!urlVisits[hostname]) {
        urlVisits[hostname] = {
          visits: {},
          title: title || hostname,
          lastVisit: today
        };
      }
      
      if (!urlVisits[hostname].visits[today]) {
        urlVisits[hostname].visits[today] = 0;
      }
      
      urlVisits[hostname].visits[today]++;
      urlVisits[hostname].title = title || urlVisits[hostname].title;
      urlVisits[hostname].lastVisit = today;

      // 存储更新后的记录
      await chrome.storage.local.set({ urlVisits });
      return true;
    } catch (error) {
      console.error('记录访问失败:', error);
      return false;
    }
  }

  /**
   * 获取URL的访问频率统计
   * @param {string} url - 要统计的URL，如果为空则统计所有URL
   * @param {string} period - 统计周期，可选值：'day'(天)、'week'(周)、'month'(月)
   * @param {number} limit - 限制返回的URL数量，默认为10
   * @returns {Promise<Array>} 访问统计结果
   */
  async getVisitStats(url = null, period = 'week', limit = 10) {
    try {
      await this.init();
      
      // 获取URL访问记录
      const { urlVisits } = await chrome.storage.local.get(['urlVisits']);
      
      // 如果指定了URL，只返回该URL的统计
      if (url) {
        let hostname;
        try {
          hostname = new URL(url).hostname;
        } catch (error) {
          hostname = url;
        }
        
        if (!urlVisits[hostname]) {
          return [];
        }
        
        const stats = this._calculateVisitStats(urlVisits[hostname], period);
        return [{ 
          url: hostname,
          title: urlVisits[hostname].title,
          visits: stats,
          totalVisits: this._sumVisits(stats)
        }];
      }
      
      // 计算所有URL的访问统计
      const results = [];
      
      for (const hostname in urlVisits) {
        const stats = this._calculateVisitStats(urlVisits[hostname], period);
        const totalVisits = this._sumVisits(stats);
        
        if (totalVisits > 0) {
          results.push({
            url: hostname,
            title: urlVisits[hostname].title,
            visits: stats,
            totalVisits: totalVisits
          });
        }
      }
      
      // 按访问次数排序
      results.sort((a, b) => b.totalVisits - a.totalVisits);
      
      // 限制结果数量
      return results.slice(0, limit);
    } catch (error) {
      console.error('获取访问统计失败:', error);
      return [];
    }
  }
  
  /**
   * 计算指定周期内的访问统计
   * @param {Object} urlData - URL的访问数据
   * @param {string} period - 统计周期
   * @returns {Object} 按日期统计的访问次数
   * @private
   */
  _calculateVisitStats(urlData, period) {
    const visits = urlData.visits || {};
    const result = {};
    const today = new Date();
    let days;
    
    // 根据统计周期设置天数
    switch (period) {
      case 'day':
        days = 1;
        break;
      case 'week':
        days = 7;
        break;
      case 'month':
        days = 30;
        break;
      default:
        days = 7; // 默认为一周
    }
    
    // 计算统计周期内每天的访问次数
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      result[dateStr] = visits[dateStr] || 0;
    }
    
    return result;
  }
  
  /**
   * 计算访问次数总和
   * @param {Object} visitStats - 访问统计数据
   * @returns {number} 访问总次数
   * @private
   */
  _sumVisits(visitStats) {
    return Object.values(visitStats).reduce((sum, count) => sum + count, 0);
  }
  
  /**
   * 获取用户经常访问但未收藏的URL
   * @param {number} threshold - 访问次数阈值
   * @param {number} days - 统计的天数范围
   * @param {number} limit - 限制返回的URL数量
   * @returns {Promise<Array>} 未收藏的常访问URL列表
   */
  async getFrequentlyVisitedNotBookmarked(threshold = 5, days = 10, limit = 10) {
    try {
      await this.init();
      
      const { urlVisits } = await chrome.storage.local.get(['urlVisits']);
      const results = [];
      
      // 遍历所有访问过的URL
      for (const hostname in urlVisits) {
        // 计算访问次数
        const recentVisits = this._countRecentVisits(urlVisits[hostname], days);
        
        if (recentVisits >= threshold) {
          // 检查是否已收藏
          const isBookmarked = await this._isUrlBookmarked(hostname);
          
          if (!isBookmarked) {
            results.push({
              url: hostname,
              title: urlVisits[hostname].title,
              visits: recentVisits,
              lastVisit: urlVisits[hostname].lastVisit
            });
          }
        }
      }
      
      // 按访问次数排序
      results.sort((a, b) => b.visits - a.visits);
      
      // 限制结果数量
      return results.slice(0, limit);
    } catch (error) {
      console.error('获取未收藏的常访问URL失败:', error);
      return [];
    }
  }
  
  /**
   * 计算最近N天的访问次数
   * @param {Object} urlData - URL的访问数据
   * @param {number} days - 天数范围
   * @returns {number} 访问次数
   * @private
   */
  _countRecentVisits(urlData, days) {
    const visits = urlData.visits || {};
    const today = new Date();
    let totalVisits = 0;
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (visits[dateStr]) {
        totalVisits += visits[dateStr];
      }
    }
    
    return totalVisits;
  }
  
  /**
   * 检查URL是否已经收藏
   * @param {string} hostname - 主机名
   * @returns {Promise<boolean>} 是否已收藏
   * @private
   */
  async _isUrlBookmarked(hostname) {
    try {
      // 尝试使用不同的协议查找书签
      const httpBookmarks = await chrome.bookmarks.search({ url: `http://${hostname}*` });
      const httpsBookmarks = await chrome.bookmarks.search({ url: `https://${hostname}*` });
      
      return httpBookmarks.length > 0 || httpsBookmarks.length > 0;
    } catch (error) {
      console.error(`检查URL收藏状态失败: ${hostname}`, error);
      return false;
    }
  }
  
  /**
   * 清除过期的访问记录
   * @param {number} days - 保留最近多少天的记录，默认30天
   * @returns {Promise<number>} 清除的记录数量
   */
  async cleanupVisitHistory(days = 30) {
    try {
      await this.init();
      
      const { urlVisits } = await chrome.storage.local.get(['urlVisits']);
      let cleanedCount = 0;
      
      // 计算过期日期
      const date = new Date();
      date.setDate(date.getDate() - days);
      const cutoffDate = date.toISOString().split('T')[0];
      
      // 遍历所有URL记录
      for (const hostname in urlVisits) {
        const visits = urlVisits[hostname].visits || {};
        
        // 清理过期记录
        for (const dateStr in visits) {
          if (dateStr < cutoffDate) {
            delete visits[dateStr];
            cleanedCount++;
          }
        }
        
        // 如果没有任何访问记录，删除该URL条目
        if (Object.keys(visits).length === 0) {
          delete urlVisits[hostname];
        } else {
          urlVisits[hostname].visits = visits;
        }
      }
      
      // 保存更新后的记录
      await chrome.storage.local.set({ urlVisits });
      
      return cleanedCount;
    } catch (error) {
      console.error('清理访问历史失败:', error);
      return 0;
    }
  }
  
  /**
   * 按访问频率排序URL列表
   * @param {Array<string>} urls - URL列表
   * @param {number} days - 统计的天数范围，默认为7天
   * @returns {Promise<Array>} 按访问频率排序的URL对象数组
   */
  async sortUrlsByVisitFrequency(urls, days = 7) {
    try {
      await this.init();
      
      const { urlVisits } = await chrome.storage.local.get(['urlVisits']);
      const results = [];
      
      // 处理每个URL
      for (const url of urls) {
        let hostname;
        try {
          hostname = new URL(url).hostname;
        } catch (error) {
          hostname = url;
        }
        
        // 获取访问次数
        let visits = 0;
        if (urlVisits[hostname]) {
          visits = this._countRecentVisits(urlVisits[hostname], days);
        }
        
        results.push({
          url: url,
          hostname: hostname,
          visits: visits
        });
      }
      
      // 按访问次数降序排序
      results.sort((a, b) => b.visits - a.visits);
      
      return results;
    } catch (error) {
      console.error('按访问频率排序URL失败:', error);
      return urls.map(url => ({ url, visits: 0 }));
    }
  }
  
  /**
   * 获取最近访问的URL
   * @param {number} limit - 限制返回的URL数量，默认为10
   * @returns {Promise<Array>} 最近访问的URL列表
   */
  async getRecentlyVisited(limit = 10) {
    try {
      await this.init();
      
      const { urlVisits } = await chrome.storage.local.get(['urlVisits']);
      const results = [];
      
      // 转换为数组并添加最后访问日期
      for (const hostname in urlVisits) {
        results.push({
          url: hostname,
          title: urlVisits[hostname].title,
          lastVisit: urlVisits[hostname].lastVisit
        });
      }
      
      // 按最后访问日期排序（降序）
      results.sort((a, b) => {
        if (b.lastVisit > a.lastVisit) return 1;
        if (b.lastVisit < a.lastVisit) return -1;
        return 0;
      });
      
      // 限制结果数量
      return results.slice(0, limit);
    } catch (error) {
      console.error('获取最近访问的URL失败:', error);
      return [];
    }
  }
}

// 导出访问追踪器的实例
const visitTracker = new VisitTracker();
export default visitTracker;
