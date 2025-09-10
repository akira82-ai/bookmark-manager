// 后台脚本 - 处理插件的核心逻辑

// 插件安装时的初始化
chrome.runtime.onInstalled.addListener(function(details) {
  console.log('Bookmark Manager extension installed');
  
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
    console.error('添加书签失败:', error);
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