/**
 * 智能收藏建议功能模块
 * 基于用户访问频率和模式，提供书签收藏建议
 */

class SuggestionManager {
  constructor() {
    this.initialized = false;
    this.settings = null;
    this.init();
  }

  /**
   * 初始化模块
   */
  async init() {
    if (this.initialized) return;
    
    try {
      // 获取设置
      const storage = await chrome.storage.local.get(['settings']);
      
      if (!storage.settings) {
        // 创建默认设置
        const defaultSettings = {
          visitThreshold: 5,     // 访问次数阈值
          dayRange: 10,          // 天数范围
          notificationEnabled: true,
          lastNotificationDate: null,
          notifiedUrls: {}
        };
        await chrome.storage.local.set({ settings: defaultSettings });
        this.settings = defaultSettings;
      } else {
        this.settings = storage.settings;
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('初始化收藏建议模块失败:', error);
    }
  }

  /**
   * 获取设置
   * @returns {Promise<Object>} 设置对象
   */
  async getSettings() {
    await this.init();
    return this.settings;
  }

  /**
   * 更新设置
   * @param {Object} newSettings - 新的设置对象
   * @returns {Promise<boolean>} 更新是否成功
   */
  async updateSettings(newSettings) {
    try {
      await this.init();
      
      // 合并设置
      const updatedSettings = { ...this.settings, ...newSettings };
      
      // 保存到存储
      await chrome.storage.local.set({ settings: updatedSettings });
      this.settings = updatedSettings;
      
      return true;
    } catch (error) {
      console.error('更新设置失败:', error);
      return false;
    }
  }

  /**
   * 分析需要收藏的URL
   * @param {number} [threshold] - 访问次数阈值，默认使用设置中的值
   * @param {number} [days] - 天数范围，默认使用设置中的值
   * @param {number} [limit] - 最大建议数量
   * @returns {Promise<Array>} URL建议数组
   */
  async analyzeUrlsForSuggestion(threshold = null, days = null, limit = 5) {
    try {
      await this.init();
      
      // 使用参数或默认设置
      const visitThreshold = threshold || this.settings.visitThreshold;
      const dayRange = days || this.settings.dayRange;
      
      // 获取URL访问记录
      const { urlVisits } = await chrome.storage.local.get(['urlVisits']);
      if (!urlVisits) return [];
      
      const suggestions = [];
      
      // 遍历所有访问过的URL
      for (const url in urlVisits) {
        // 计算指定天数内的访问次数
        const visits = this._countRecentVisits(urlVisits[url], dayRange);
        
        // 如果访问次数达到阈值
        if (visits >= visitThreshold) {
          // 检查是否已经收藏
          const isBookmarked = await this._isUrlBookmarked(url);
          
          // 检查是否已经提示过
          const isNotified = this.settings.notifiedUrls && this.settings.notifiedUrls[url];
          
          if (!isBookmarked && !isNotified) {
            suggestions.push({
              url: url,
              title: urlVisits[url].title || url,
              visits: visits,
              hostname: url
            });
          }
        }
      }
      
      // 按访问次数降序排序
      suggestions.sort((a, b) => b.visits - a.visits);
      
      // 限制结果数量
      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('分析URL收藏建议失败:', error);
      return [];
    }
  }

  /**
   * 显示书签收藏建议通知
   * @param {Object} suggestion - 建议对象，包含url和title
   * @returns {Promise<boolean>} 显示是否成功
   */
  async showSuggestionNotification(suggestion) {
    try {
      await this.init();
      
      // 检查今天是否已经显示过通知
      const today = new Date().toISOString().split('T')[0];
      if (this.settings.lastNotificationDate === today) {
        console.log('今天已经显示过通知，跳过');
        return false;
      }
      
      // 检查通知是否已启用
      if (!this.settings.notificationEnabled) {
        console.log('通知已禁用，跳过');
        return false;
      }
      
      // 创建通知
      return new Promise((resolve) => {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/icons/icon128.png',
          title: '书签推荐',
          message: `您似乎经常访问 ${suggestion.title || suggestion.url}，是否将其添加到书签？`,
          buttons: [
            { title: '添加到书签' },
            { title: '不再提醒此网站' }
          ]
        }, (notificationId) => {
          // 保存通知ID与URL的关联
          this._saveSuggestionNotification(notificationId, suggestion);
          
          // 更新最后通知日期
          this.settings.lastNotificationDate = today;
          chrome.storage.local.set({ settings: this.settings });
          
          resolve(true);
        });
      });
    } catch (error) {
      console.error('显示收藏建议通知失败:', error);
      return false;
    }
  }
  
  /**
   * 处理通知交互
   * @param {string} notificationId - 通知ID
   * @param {number} buttonIndex - 按钮索引
   * @returns {Promise<boolean>} 处理是否成功
   */
  async handleNotificationAction(notificationId, buttonIndex) {
    try {
      await this.init();
      
      // 获取通知关联的建议
      const { suggestionNotifications } = await chrome.storage.local.get(['suggestionNotifications']);
      if (!suggestionNotifications || !suggestionNotifications[notificationId]) {
        return false;
      }
      
      const suggestion = suggestionNotifications[notificationId];
      
      // 删除通知关联记录
      delete suggestionNotifications[notificationId];
      await chrome.storage.local.set({ suggestionNotifications });
      
      if (buttonIndex === 0) {
        // 添加到书签
        await this._addToBookmarks(suggestion);
      } else if (buttonIndex === 1) {
        // 忽略此网站（标记为已通知）
        if (!this.settings.notifiedUrls) {
          this.settings.notifiedUrls = {};
        }
        
        this.settings.notifiedUrls[suggestion.url] = true;
        await chrome.storage.local.set({ settings: this.settings });
      }
      
      return true;
    } catch (error) {
      console.error('处理通知交互失败:', error);
      return false;
    }
  }
  
  /**
   * 检查是否应该提供收藏建议
   * @returns {Promise<boolean>} 是否应该提供建议
   */
  async shouldSuggest() {
    await this.init();
    
    // 检查是否启用建议
    if (!this.settings.notificationEnabled) {
      return false;
    }
    
    // 检查今天是否已经显示过通知
    const today = new Date().toISOString().split('T')[0];
    if (this.settings.lastNotificationDate === today) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 清除已通知URL记录
   * @param {string} [url] - 要清除的特定URL，如果为空则清除所有
   * @returns {Promise<boolean>} 清除是否成功
   */
  async clearNotifiedUrls(url = null) {
    try {
      await this.init();
      
      if (url) {
        // 清除特定URL
        if (this.settings.notifiedUrls && this.settings.notifiedUrls[url]) {
          delete this.settings.notifiedUrls[url];
          await chrome.storage.local.set({ settings: this.settings });
        }
      } else {
        // 清除所有URL
        this.settings.notifiedUrls = {};
        await chrome.storage.local.set({ settings: this.settings });
      }
      
      return true;
    } catch (error) {
      console.error('清除已通知URL记录失败:', error);
      return false;
    }
  }

  /**
   * 保存通知与建议的关联
   * @param {string} notificationId - 通知ID
   * @param {Object} suggestion - 建议对象
   * @private
   */
  async _saveSuggestionNotification(notificationId, suggestion) {
    try {
      const { suggestionNotifications = {} } = await chrome.storage.local.get(['suggestionNotifications']);
      
      suggestionNotifications[notificationId] = suggestion;
      await chrome.storage.local.set({ suggestionNotifications });
    } catch (error) {
      console.error('保存通知关联失败:', error);
    }
  }

  /**
   * 将URL添加到书签
   * @param {Object} suggestion - 建议对象
   * @returns {Promise<boolean>} 添加是否成功
   * @private
   */
  async _addToBookmarks(suggestion) {
    try {
      // 尝试获取完整URL
      let fullUrl = suggestion.url;
      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        fullUrl = 'https://' + fullUrl;
      }
      
      // 创建书签
      await chrome.bookmarks.create({
        title: suggestion.title || suggestion.url,
        url: fullUrl
      });
      
      // 标记为已通知
      if (!this.settings.notifiedUrls) {
        this.settings.notifiedUrls = {};
      }
      
      this.settings.notifiedUrls[suggestion.url] = true;
      await chrome.storage.local.set({ settings: this.settings });
      
      return true;
    } catch (error) {
      console.error('添加到书签失败:', error);
      return false;
    }
  }
  
  /**
   * 检查URL是否已经收藏
   * @param {string} url - URL或主机名
   * @returns {Promise<boolean>} 是否已收藏
   * @private
   */
  async _isUrlBookmarked(url) {
    try {
      // 尝试使用不同的协议查找书签
      const httpBookmarks = await chrome.bookmarks.search({ url: `http://${url}*` });
      const httpsBookmarks = await chrome.bookmarks.search({ url: `https://${url}*` });
      
      return httpBookmarks.length > 0 || httpsBookmarks.length > 0;
    } catch (error) {
      console.error(`检查URL收藏状态失败: ${url}`, error);
      return false;
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
   * 检查并提供收藏建议
   * 通常由后台脚本定期调用
   * @returns {Promise<boolean>} 是否提供了建议
   */
  async checkAndSuggest() {
    if (!await this.shouldSuggest()) {
      return false;
    }
    
    const suggestions = await this.analyzeUrlsForSuggestion();
    
    if (suggestions.length > 0) {
      // 只显示第一个建议
      return await this.showSuggestionNotification(suggestions[0]);
    }
    
    return false;
  }
}

// 创建实例并导出
const suggestionManager = new SuggestionManager();

// 监听通知按钮点击事件
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  await suggestionManager.handleNotificationAction(notificationId, buttonIndex);
  chrome.notifications.clear(notificationId);
});

export default suggestionManager;
