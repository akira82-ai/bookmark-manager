// 初始化设置和数据
chrome.runtime.onInstalled.addListener(async () => {
  // 初始化存储
  const initSettings = {
    visitThreshold: 5,     // 访问次数阈值
    dayRange: 10,          // 天数范围
    notificationEnabled: true,
    autoCategories: {
      'social': ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com'],
      'news': ['news.google.com', 'bbc.com', 'cnn.com', 'nytimes.com'],
      'tech': ['github.com', 'stackoverflow.com', 'dev.to', 'medium.com'],
      'shopping': ['amazon.com', 'ebay.com', 'taobao.com', 'jd.com']
    },
    lastNotificationDate: null,
    notifiedUrls: {}
  };

  const storage = await chrome.storage.local.get(['settings', 'urlVisits']);
  if (!storage.settings) {
    await chrome.storage.local.set({ settings: initSettings });
  }
  if (!storage.urlVisits) {
    await chrome.storage.local.set({ urlVisits: {} });
  }
});

// 记录URL访问
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 只在页面完成加载时记录
  if (changeInfo.status === 'complete' && tab.url) {
    // 忽略浏览器内部页面和扩展页面
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('about:')) {
      return;
    }
    
    try {
      // 获取当前的URL访问记录
      const { urlVisits } = await chrome.storage.local.get(['urlVisits']);
      const url = new URL(tab.url).hostname;
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // 更新或创建URL访问记录
      if (!urlVisits[url]) {
        urlVisits[url] = {};
      }
      if (!urlVisits[url][today]) {
        urlVisits[url][today] = 0;
      }
      urlVisits[url][today]++;

      // 存储更新后的记录
      await chrome.storage.local.set({ urlVisits });

      // 检查是否需要提示收藏
      checkBookmarkSuggestion(url, tab.title);
    } catch (error) {
      console.error('Error recording URL visit:', error);
    }
  }
});

// 检查是否应该提示收藏
async function checkBookmarkSuggestion(url, title) {
  try {
    // 获取设置和访问记录
    const { settings, urlVisits } = await chrome.storage.local.get(['settings', 'urlVisits']);
    if (!settings.notificationEnabled || !urlVisits[url]) {
      return;
    }

    // 检查是否已经在书签中
    const bookmarks = await chrome.bookmarks.search({url: 'http://' + url + '*'});
    const bookmarks2 = await chrome.bookmarks.search({url: 'https://' + url + '*'});
    if (bookmarks.length > 0 || bookmarks2.length > 0) {
      return; // 已经收藏
    }

    // 检查是否已经通知过
    if (settings.notifiedUrls[url]) {
      return;
    }

    // 计算最近10天的访问次数
    const visits = countRecentVisits(urlVisits[url], settings.dayRange);
    
    // 如果达到阈值，显示通知
    if (visits >= settings.visitThreshold) {
      // 检查今天是否已经显示过通知
      const today = new Date().toISOString().split('T')[0];
      if (settings.lastNotificationDate !== today) {
        showBookmarkSuggestion(url, title);
        
        // 更新最后通知日期和已通知URLs
        settings.lastNotificationDate = today;
        settings.notifiedUrls[url] = true;
        await chrome.storage.local.set({ settings });
      }
    }
  } catch (error) {
    console.error('Error checking bookmark suggestion:', error);
  }
}

// 计算最近N天的访问次数
function countRecentVisits(dateVisits, days) {
  const today = new Date();
  let totalVisits = 0;
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    if (dateVisits[dateStr]) {
      totalVisits += dateVisits[dateStr];
    }
  }
  
  return totalVisits;
}

// 显示书签推荐通知
function showBookmarkSuggestion(url, title) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/icons/icon128.png',
    title: '书签推荐',
    message: `您似乎经常访问 ${title || url}，是否将其添加到书签？`,
    buttons: [
      { title: '添加到书签' },
      { title: '忽略' }
    ]
  });
}

// 处理通知点击事件
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  // 获取通知详情
  const notification = await chrome.notifications.get(notificationId);
  if (!notification) return;
  
  const url = notification.message.match(/您似乎经常访问 (.*?)，是否将其添加到书签？/)[1];
  
  if (buttonIndex === 0) {  // 添加到书签
    const tabs = await chrome.tabs.query({ url: '*://' + url + '*' });
    if (tabs.length > 0) {
      const tab = tabs[0];
      chrome.bookmarks.create({
        title: tab.title,
        url: tab.url
      });
    }
  }
  
  chrome.notifications.clear(notificationId);
});

// 检查URL有效性
async function checkUrlValidity(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
    return {
      url,
      valid: response.ok,
      status: response.status
    };
  } catch (error) {
    return {
      url,
      valid: false,
      error: error.message
    };
  }
}

// 批量检查URL有效性
async function checkUrlsValidity(urls) {
  const results = [];
  for (const url of urls) {
    results.push(await checkUrlValidity(url));
  }
  return results;
}

// 自动分类书签
async function categorizeBookmark(bookmark) {
  try {
    // 获取分类规则
    const { settings } = await chrome.storage.local.get(['settings']);
    const { autoCategories } = settings;
    
    if (!bookmark.url) return null; // 如果是文件夹则跳过
    
    const url = new URL(bookmark.url).hostname;
    
    // 检查URL是否匹配任何预定义类别
    for (const [category, domains] of Object.entries(autoCategories)) {
      if (domains.some(domain => url.includes(domain))) {
        return category;
      }
    }
    
    return null;  // 无法识别类别
  } catch (error) {
    console.error('Error categorizing bookmark:', error);
    return null;
  }
}

// 处理来自弹出页面的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getBookmarks':
      chrome.bookmarks.getTree().then(bookmarkTree => {
        sendResponse({ success: true, bookmarks: bookmarkTree });
      });
      return true;  // 异步响应

    case 'checkUrlValidity':
      checkUrlsValidity(request.urls).then(results => {
        sendResponse({ success: true, results });
      });
      return true;

    case 'getSuggestions':
      getSuggestedBookmarks().then(suggestions => {
        sendResponse({ success: true, suggestions });
      });
      return true;

    case 'addBookmark':
      chrome.bookmarks.create(request.bookmark).then(newBookmark => {
        // 尝试自动分类
        categorizeBookmark(newBookmark).then(category => {
          if (category) {
            // 查找或创建类别文件夹
            findOrCreateCategoryFolder(category).then(folderId => {
              // 移动书签到类别文件夹
              chrome.bookmarks.move(newBookmark.id, { parentId: folderId });
            });
          }
          sendResponse({ success: true, bookmark: newBookmark });
        });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'updateBookmark':
      chrome.bookmarks.update(request.id, request.changes).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'removeBookmark':
      chrome.bookmarks.remove(request.id).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'getSettings':
      chrome.storage.local.get(['settings']).then(data => {
        sendResponse({ success: true, settings: data.settings });
      });
      return true;

    case 'updateSettings':
      chrome.storage.local.get(['settings']).then(data => {
        const updatedSettings = { ...data.settings, ...request.settings };
        chrome.storage.local.set({ settings: updatedSettings }).then(() => {
          sendResponse({ success: true });
        });
      });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

// 获取经常访问但未收藏的网站
async function getSuggestedBookmarks() {
  try {
    // 获取设置和访问记录
    const { settings, urlVisits } = await chrome.storage.local.get(['settings', 'urlVisits']);
    if (!urlVisits) return [];
    
    const suggestions = [];
    
    // 遍历所有访问过的URL
    for (const [url, dateVisits] of Object.entries(urlVisits)) {
      // 计算最近N天的访问次数
      const visits = countRecentVisits(dateVisits, settings.dayRange);
      
      // 如果访问次数达到阈值
      if (visits >= settings.visitThreshold) {
        // 检查是否已经收藏
        const bookmarks = await chrome.bookmarks.search({url: 'http://' + url + '*'});
        const bookmarks2 = await chrome.bookmarks.search({url: 'https://' + url + '*'});
        
        if (bookmarks.length === 0 && bookmarks2.length === 0) {
          // 尝试从历史记录获取页面标题
          const history = await chrome.history.search({text: url, maxResults: 1});
          const title = history.length > 0 ? history[0].title : url;
          
          suggestions.push({
            url: url,
            title: title,
            visits: visits
          });
        }
      }
    }
    
    return suggestions;
  } catch (error) {
    console.error('Error getting suggested bookmarks:', error);
    return [];
  }
}

// 查找或创建类别文件夹
async function findOrCreateCategoryFolder(category) {
  try {
    // 首先尝试查找已有的文件夹
    const categoryFolders = await chrome.bookmarks.search({ title: category });
    
    // 过滤出实际是文件夹的结果
    const folders = categoryFolders.filter(bookmark => !bookmark.url);
    
    if (folders.length > 0) {
      // 返回找到的第一个文件夹
      return folders[0].id;
    } else {
      // 创建新文件夹
      const rootFolder = await chrome.bookmarks.search({ title: '智能分类' });
      let parentId;
      
      if (rootFolder.length > 0 && !rootFolder[0].url) {
        // 使用已存在的"智能分类"文件夹
        parentId = rootFolder[0].id;
      } else {
        // 创建"智能分类"文件夹
        const newRoot = await chrome.bookmarks.create({
          title: '智能分类',
          parentId: '1'  // 通常"1"是书签栏的ID
        });
        parentId = newRoot.id;
      }
      
      // 创建类别文件夹
      const newFolder = await chrome.bookmarks.create({
        title: category,
        parentId: parentId
      });
      
      return newFolder.id;
    }
  } catch (error) {
    console.error('Error finding or creating category folder:', error);
    // 默认返回书签栏ID
    return '1';
  }
}

// 清理过期的访问记录（每周执行一次）
chrome.alarms.create('cleanupVisitHistory', {
  periodInMinutes: 10080  // 一周 = 60分钟 * 24小时 * 7天 = 10080分钟
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupVisitHistory') {
    try {
      // 获取URL访问记录
      const { urlVisits } = await chrome.storage.local.get(['urlVisits']);
      
      // 计算30天前的日期（保留最近30天的数据）
      const date = new Date();
      date.setDate(date.getDate() - 30);
      const cutoffDate = date.toISOString().split('T')[0];
      
      // 清理过期记录
      for (const url in urlVisits) {
        for (const dateStr in urlVisits[url]) {
          if (dateStr < cutoffDate) {
            delete urlVisits[url][dateStr];
          }
        }
        
        // 如果URL没有任何访问记录，删除该条目
        if (Object.keys(urlVisits[url]).length === 0) {
          delete urlVisits[url];
        }
      }
      
      // 保存更新后的记录
      await chrome.storage.local.set({ urlVisits });
    } catch (error) {
      console.error('Error cleaning up visit history:', error);
    }
  }
});
