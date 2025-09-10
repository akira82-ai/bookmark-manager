// 后台脚本 - 处理插件的核心逻辑

// 插件安装时的初始化
chrome.runtime.onInstalled.addListener(function(details) {
  console.log('Bookmark Manager extension installed');
  
  // 初始化存储
  chrome.storage.local.get(['bookmarks'], function(result) {
    if (!result.bookmarks) {
      chrome.storage.local.set({bookmarks: []});
    }
  });
  
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
  }
});

// 添加书签函数
function addBookmark(title, url) {
  chrome.storage.local.get(['bookmarks'], function(result) {
    const bookmarks = result.bookmarks || [];
    
    // 检查是否已存在
    const exists = bookmarks.some(bookmark => bookmark.url === url);
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
    
    bookmarks.push({
      id: Date.now(),
      title: title,
      url: url,
      createdAt: new Date().toISOString()
    });
    
    chrome.storage.local.set({bookmarks: bookmarks}, function() {
      // 通知用户添加成功
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '书签添加成功',
        message: `"${title}" 已添加到书签管理器`
      });
    });
  });
}

// 处理书签导入导出
function exportBookmarks() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bookmarks'], function(result) {
      resolve(result.bookmarks || []);
    });
  });
}

function importBookmarks(bookmarks) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bookmarks'], function(result) {
      const existingBookmarks = result.bookmarks || [];
      const mergedBookmarks = [...existingBookmarks, ...bookmarks];
      
      chrome.storage.local.set({bookmarks: mergedBookmarks}, function() {
        resolve({success: true, count: bookmarks.length});
      });
    });
  });
}

// 处理标签页更新
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url) {
    // 可以在这里添加页面加载完成后的逻辑
  }
});

// 处理插件启动
chrome.runtime.onStartup.addListener(function() {
  console.log('Bookmark Manager extension started');
});

// 处理插件唤醒
chrome.runtime.onSuspend.addListener(function() {
  console.log('Bookmark Manager extension suspended');
});