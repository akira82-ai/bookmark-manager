// 后台脚本 - 智能书签提醒核心逻辑

// 智能提醒数据存储
let reminderData = {
  domainAccessData: new Map(), // 域名访问数据
  urlAccessData: new Map(), // URL访问数据
  snoozedDomains: new Map(), // 稍后提醒的域名
  snoozedUrls: new Map(), // 稍后提醒的URL
  dismissedDomains: new Set(), // 不再提醒的域名
  dismissedUrls: new Set(), // 不再提醒的URL
  reminderSettings: {
    domainThreshold: 5, // 域名提醒阈值
    urlThreshold: 3, // URL提醒阈值
    domainTimeWindow: 7 * 24 * 60 * 60 * 1000, // 7天
    urlTimeWindow: 3 * 24 * 60 * 60 * 1000, // 3天
    enabled: true // 是否启用提醒
  }
};

// 插件安装时的初始化
chrome.runtime.onInstalled.addListener(function(details) {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'addBookmark',
    title: '添加到书签管理器',
    contexts: ['page', 'link']
  });
  
  // 加载保存的提醒数据
  loadReminderData();
  
  // 启动定期检查
  setInterval(checkReminderConditions, 30000); // 每30秒检查一次
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
  } else if (request.action === 'snoozeReminder') {
    // 稍后提醒
    snoozeReminder(request.data.type, request.data.target);
    sendResponse({success: true});
  } else if (request.action === 'dismissReminder') {
    // 不再提醒
    dismissReminder(request.data.type, request.data.target);
    sendResponse({success: true});
  }
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url) {
    recordPageVisit(tab.url, tab.title);
  }
});

// 监听标签页激活事件
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (tab.url) {
      recordPageVisit(tab.url, tab.title);
    }
  });
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
    console.error('添加到最近收藏失败:', error);
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
    console.error('获取或创建最近收藏文件夹失败:', error);
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
    console.error('检查重复失败:', error);
    return false;
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

// 记录页面访问
function recordPageVisit(url, title) {
  if (!reminderData.reminderSettings.enabled) return;
  
  try {
    const domain = extractDomain(url);
    const now = Date.now();
    
    // 记录域名访问
    if (!reminderData.domainAccessData.has(domain)) {
      reminderData.domainAccessData.set(domain, []);
    }
    reminderData.domainAccessData.get(domain).push({
      time: now,
      title: title,
      url: url
    });
    
    // 记录URL访问
    if (!reminderData.urlAccessData.has(url)) {
      reminderData.urlAccessData.set(url, []);
    }
    reminderData.urlAccessData.get(url).push({
      time: now,
      title: title
    });
    
    // 保存数据
    saveReminderData();
    
  } catch (error) {
    console.error('记录页面访问失败:', error);
  }
}

// 提取域名
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (error) {
    return url;
  }
}

// 检查提醒条件
function checkReminderConditions() {
  if (!reminderData.reminderSettings.enabled) return;
  
  const now = Date.now();
  
  // 检查域名级别提醒
  for (const [domain, visits] of reminderData.domainAccessData) {
    if (reminderData.dismissedDomains.has(domain)) continue;
    
    const snoozeUntil = reminderData.snoozedDomains.get(domain);
    if (snoozeUntil && now < snoozeUntil) continue;
    
    const recentVisits = visits.filter(v => now - v.time < reminderData.reminderSettings.domainTimeWindow);
    if (recentVisits.length >= reminderData.reminderSettings.domainThreshold) {
      showDomainReminder(domain, recentVisits);
      break;
    }
  }
  
  // 检查URL级别提醒
  for (const [url, visits] of reminderData.urlAccessData) {
    if (reminderData.dismissedUrls.has(url)) continue;
    
    const snoozeUntil = reminderData.snoozedUrls.get(url);
    if (snoozeUntil && now < snoozeUntil) continue;
    
    const recentVisits = visits.filter(v => now - v.time < reminderData.reminderSettings.urlTimeWindow);
    if (recentVisits.length >= reminderData.reminderSettings.urlThreshold) {
      showUrlReminder(url, recentVisits);
      break;
    }
  }
}

// 显示域名级别提醒
function showDomainReminder(domain, visits) {
  const latestVisit = visits[visits.length - 1];
  const message = `您最近访问了 ${domain} ${visits.length} 次，是否要添加书签？`;
  
  // 发送消息到当前页面的content script
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'showReminder',
        data: {
          type: 'domain',
          domain: domain,
          url: `https://${domain}`,
          title: latestVisit.title,
          message: message
        }
      });
    }
  });
}

// 显示URL级别提醒
function showUrlReminder(url, visits) {
  const latestVisit = visits[visits.length - 1];
  const message = '您最近多次访问了这个页面，是否要添加书签？';
  
  // 发送消息到当前页面的content script
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'showReminder',
        data: {
          type: 'url',
          url: url,
          title: latestVisit.title,
          message: message
        }
      });
    }
  });
}

// 稍后提醒
function snoozeReminder(type, target) {
  const snoozeTime = Date.now() + 5 * 60 * 1000; // 5分钟后
  
  if (type === 'domain') {
    reminderData.snoozedDomains.set(target, snoozeTime);
  } else {
    reminderData.snoozedUrls.set(target, snoozeTime);
  }
  
  saveReminderData();
  showNotification('已设置为5分钟后提醒');
}

// 不再提醒
function dismissReminder(type, target) {
  if (type === 'domain') {
    reminderData.dismissedDomains.add(target);
  } else {
    reminderData.dismissedUrls.add(target);
  }
  
  saveReminderData();
  showNotification('不再提醒此网站');
}

// 保存提醒数据
function saveReminderData() {
  const dataToSave = {
    domainAccessData: Array.from(reminderData.domainAccessData.entries()),
    urlAccessData: Array.from(reminderData.urlAccessData.entries()),
    snoozedDomains: Array.from(reminderData.snoozedDomains.entries()),
    snoozedUrls: Array.from(reminderData.snoozedUrls.entries()),
    dismissedDomains: Array.from(reminderData.dismissedDomains),
    dismissedUrls: Array.from(reminderData.dismissedUrls),
    reminderSettings: reminderData.reminderSettings
  };
  
  chrome.storage.local.set({reminderData: dataToSave});
}

// 加载提醒数据
function loadReminderData() {
  chrome.storage.local.get(['reminderData'], function(result) {
    if (result.reminderData) {
      const data = result.reminderData;
      reminderData.domainAccessData = new Map(data.domainAccessData || []);
      reminderData.urlAccessData = new Map(data.urlAccessData || []);
      reminderData.snoozedDomains = new Map(data.snoozedDomains || []);
      reminderData.snoozedUrls = new Map(data.snoozedUrls || []);
      reminderData.dismissedDomains = new Set(data.dismissedDomains || []);
      reminderData.dismissedUrls = new Set(data.dismissedUrls || []);
      reminderData.reminderSettings = data.reminderSettings || reminderData.reminderSettings;
    }
  });
}