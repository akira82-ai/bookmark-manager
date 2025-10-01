// 后台脚本 - 核心功能

// 插件安装时的初始化
chrome.runtime.onInstalled.addListener(function(details) {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'addBookmark',
    title: '添加到书签管理器',
    contexts: ['page', 'link']
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId === 'addBookmark') {
    let title, url;
    
    if (info.linkUrl) {
      // 如果是链接
      title = info.linkText || info.linkUrl;
      url = info.linkUrl;
    } else {
      // 如果是页面
      title = tab.title;
      url = tab.url;
    }
    
    addBookmark(title, url);
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'quickAddBookmark') {
    addBookmark(request.data.title, request.data.url);
    sendResponse({success: true});
  } else if (request.action === 'addBookmarkFromReminder') {
    // 从提醒弹窗添加书签
    addBookmarkToRecent(request.data.title, request.data.url);
    sendResponse({success: true});
  } else if (request.action === 'getDomainHistory') {
    // 获取指定主域名的历史记录
    getDomainHistory(request.mainDomain, request.startTime).then(results => {
      sendResponse({results: results});
    }).catch(error => {
      sendResponse({results: []});
    });
    return true; // 保持消息通道开放以支持异步响应
  } else if (request.action === 'checkUrlInBookmarks') {
    // 检查URL是否在收藏夹中
    checkUrlInBookmarks(request.url).then(isInBookmarks => {
      sendResponse({isInBookmarks: isInBookmarks});
    }).catch(error => {
      // 采用保守策略：检查失败时返回true（表示在收藏夹中，避免提醒）
      sendResponse({isInBookmarks: true});
    });
    return true; // 保持消息通道开放以支持异步响应
  } else if (request.action === 'addDomainToBlacklist') {
    // 添加域名到黑名单
    addDomainToBlacklist(request.domain).then(() => {
      sendResponse({success: true});
    }).catch(error => {
      console.error('添加域名到黑名单失败:', error);
      sendResponse({success: false, error: error.message});
    });
    return true; // 保持消息通道开放以支持异步响应
  } else if (request.action === 'checkDomainInBlacklist') {
    // 检查域名是否在黑名单中
    checkDomainInBlacklist(request.domain).then(isBlacklisted => {
      sendResponse({isBlacklisted: isBlacklisted});
    }).catch(error => {
      console.error('检查黑名单失败:', error);
      sendResponse({isBlacklisted: false});
    });
    return true; // 保持消息通道开放以支持异步响应
  }
});

// 添加书签函数 - 使用Chrome书签API
async function addBookmark(title, url) {
  try {
    // 检查是否已存在
    const bookmarks = await chrome.bookmarks.getTree();
    const exists = await bookmarkExists(bookmarks[0], url);
    
    if (exists) {
      // 通知用户书签已存在
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '书签已存在',
        message: '该书签已经在您的书签列表中'
      });
      return;
    }
    
    // 添加书签到根目录
    await chrome.bookmarks.create({
      title: title,
      url: url
    });
    
    // 通知用户添加成功
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '书签添加成功',
      message: `"${title}" 已添加到书签管理器`
    });
    
  } catch (error) {
      }
}

// 检查书签是否已存在
async function bookmarkExists(node, url) {
  if (node.url === url) {
    return true;
  }
  
  if (node.children) {
    for (let child of node.children) {
      if (await bookmarkExists(child, url)) {
        return true;
      }
    }
  }
  
  return false;
}

// 添加书签到「最近收藏」
async function addBookmarkToRecent(title, url) {
  try {
    // 获取或创建「最近收藏」文件夹
    const recentFolderId = await getOrCreateRecentFolder();
    
    // 检查是否已存在相同的URL
    const isDuplicate = await checkDuplicateInRecentFolder(url, recentFolderId);
    if (isDuplicate) {
      showNotification('已在「最近收藏」中！');
      return;
    }
    
    // 添加书签到最近收藏文件夹
    await chrome.bookmarks.create({
      title: title || '无标题',
      url: url,
      parentId: recentFolderId
    });
    
    // 显示成功消息
    showNotification('书签已添加到「最近收藏」！');
    
  } catch (error) {
        showNotification('添加失败，请重试');
  }
}

// 获取或创建「最近收藏」文件夹
async function getOrCreateRecentFolder() {
  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    const recentFolder = findRecentFolder(bookmarkTree[0]);
    
    if (recentFolder) {
      return recentFolder.id;
    } else {
      const newFolder = await chrome.bookmarks.create({
        title: '📌 最近收藏',
        parentId: '1'
      });
      return newFolder.id;
    }
  } catch (error) {
        return '1';
  }
}

// 查找「最近收藏」文件夹
function findRecentFolder(node) {
  if (node.title === '📌 最近收藏' && !node.url) {
    return node;
  }
  
  if (node.children) {
    for (const child of node.children) {
      const found = findRecentFolder(child);
      if (found) return found;
    }
  }
  
  return null;
}

// 检查URL是否在「最近收藏」文件夹中已存在
async function checkDuplicateInRecentFolder(url, recentFolderId) {
  try {
    if (!recentFolderId) return false;
    
    const bookmarks = await chrome.bookmarks.getChildren(recentFolderId);
    return bookmarks.some(bookmark => bookmark.url === url);
  } catch (error) {
        return false;
  }
}


// 获取指定主域名的历史记录
async function getDomainHistory(mainDomain, startTime) {
  try {
    // 获取近3天的所有历史记录
    const historyResults = await new Promise((resolve, reject) => {
      chrome.history.search({
        text: '', // 空字符串获取所有历史记录
        startTime: startTime,
        maxResults: 10000 // 获取更多记录以确保准确性
      }, (results) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(results);
        }
      });
    });

    // 过滤出匹配主域名的记录
    const filteredResults = historyResults.filter(item => {
      // 跳过特殊页面
      if (item.url.startsWith('chrome://') ||
          item.url.startsWith('chrome-extension://') ||
          item.url.startsWith('moz-extension://') ||
          item.url.startsWith('edge://') ||
          item.url.startsWith('about:')) {
        return false;
      }

      // 提取主域名并比较
      const itemMainDomain = getMainDomainFromUrl(item.url);
      return itemMainDomain === mainDomain;
    });

    return filteredResults;
  } catch (error) {
        return [];
  }
}

// 从URL提取主域名
function getMainDomainFromUrl(url) {
  try {
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }
    const urlObj = new URL(url);
    const domainParts = urlObj.hostname.split('.');

    if (domainParts.length >= 2) {
      return domainParts.slice(-2).join('.');
    }
    return urlObj.hostname;
  } catch (error) {
    return '';
  }
}

// 检查URL是否在收藏夹中
async function checkUrlInBookmarks(url) {
  try {
    if (!url) {
      throw new Error('URL为空');
    }

    // 使用chrome.bookmarks.search进行完全匹配查询
    const bookmarks = await new Promise((resolve, reject) => {
      chrome.bookmarks.search({ url: url }, (results) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(results);
        }
      });
    });

    // 完全匹配：只要找到相同URL的书签就返回true
    return bookmarks.length > 0;
  } catch (error) {
    // 查询失败时抛出错误，由调用方处理
    throw error;
  }
}

// 显示通知
function showNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: '书签管理器',
    message: message
  });
}

// 添加域名到黑名单
async function addDomainToBlacklist(domain) {
  try {
    if (!domain) {
      throw new Error('域名为空');
    }

    // 获取当前黑名单
    const result = await chrome.storage.local.get(['blacklistedDomains']);
    const blacklistedDomains = result.blacklistedDomains || [];

    // 检查是否已存在
    if (!blacklistedDomains.includes(domain)) {
      blacklistedDomains.push(domain);
      await chrome.storage.local.set({ blacklistedDomains: blacklistedDomains });
    }

    return true;
  } catch (error) {
    console.error('添加域名到黑名单失败:', error);
    throw error;
  }
}

// 检查域名是否在黑名单中
async function checkDomainInBlacklist(domain) {
  try {
    if (!domain) {
      return false;
    }

    const result = await chrome.storage.local.get(['blacklistedDomains']);
    const blacklistedDomains = result.blacklistedDomains || [];

    return blacklistedDomains.includes(domain);
  } catch (error) {
    console.error('检查黑名单失败:', error);
    return false;
  }
}