document.addEventListener('DOMContentLoaded', function() {
  // 创建界面
  createPopupUI();
  
  // 绑定事件
  bindEvents();
});

function createPopupUI() {
  const container = document.querySelector('.container');
  container.innerHTML = `
    <div class="popup-header">
      <h1>📚 书签管理器</h1>
      <p class="subtitle">管理您的浏览器书签</p>
    </div>
    
    <div class="popup-actions">
      <div class="button-row">
        <button id="current-page-btn" class="secondary-btn" disabled>
          <span class="btn-icon">🔖</span>
          <span class="btn-text">添加到最近收藏</span>
        </button>
        <button id="open-manager-btn" class="primary-btn">
          <span class="btn-icon">📂</span>
          打开书签管理器
        </button>
      </div>
    </div>
    
    <div class="recent-section">
      <h3>📌 最近收藏</h3>
      <div id="recent-bookmarks" class="recent-list">
        <!-- 最近书签将通过JavaScript动态加载 -->
      </div>
    </div>
    
    <div class="stats-section">
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-number" id="total-count">0</div>
          <div class="stat-label">总书签</div>
        </div>
        <div class="stat-item">
          <div class="stat-number" id="folders-count">0</div>
          <div class="stat-label">文件夹</div>
        </div>
        <div class="stat-item">
          <div class="stat-number" id="recent-count">0</div>
          <div class="stat-label">今日添加</div>
        </div>
      </div>
    </div>
  `;
  
  // 检查当前页面并设置按钮状态
  checkCurrentPageAndSetButtonState();
  
  // 监听标签页更新（如果用户在popup打开时切换页面）
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.url) {
      checkCurrentPageAndSetButtonState();
    }
  });
  
  // 监听标签页激活事件
  chrome.tabs.onActivated.addListener(function(activeInfo) {
    checkCurrentPageAndSetButtonState();
  });
  
  // 加载最近书签和统计信息
  loadRecentBookmarks();
  loadStats();
}

function bindEvents() {
  // 打开书签管理器
  document.getElementById('open-manager-btn').addEventListener('click', function() {
    openBookmarkManager();
  });
  
  // 添加当前页面
  document.getElementById('current-page-btn').addEventListener('click', function() {
    // 如果按钮被禁用，则不执行操作
    if (this.disabled) {
      showNotification(this.title || '此页面无法收藏');
      return;
    }
    addCurrentPage();
  });
  
  // 事件委托：处理最近书签的点击
  document.getElementById('recent-bookmarks').addEventListener('click', function(e) {
    const recentItem = e.target.closest('.recent-item');
    if (!recentItem) return;
    
    if (e.target.closest('.delete-btn')) {
      // 处理删除按钮点击
      const deleteBtn = e.target.closest('.delete-btn');
      const bookmarkId = recentItem.dataset.bookmarkId;
      
      if (deleteBtn.classList.contains('confirm-delete')) {
        // 第二次点击 - 确认删除
        deleteRecentBookmark(bookmarkId, deleteBtn);
      } else {
        // 第一次点击 - 进入确认状态
        // 先重置其他所有删除按钮
        document.querySelectorAll('.delete-btn.confirm-delete').forEach(btn => {
          btn.classList.remove('confirm-delete');
          btn.innerHTML = '🗑️';
        });
        
        // 设置当前按钮为确认状态
        deleteBtn.classList.add('confirm-delete');
        deleteBtn.innerHTML = '✔️';
        deleteBtn.title = '再次点击确认删除';
        
        // 显示删除提示
        showDeleteHint('再次点击确认删除');
        
        // 3秒后自动恢复
        setTimeout(() => {
          if (deleteBtn.classList.contains('confirm-delete')) {
            deleteBtn.classList.remove('confirm-delete');
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.title = '删除';
            hideDeleteHint();
          }
        }, 3000);
      }
    } else {
      // 点击整行其他区域 - 打开书签
      const url = recentItem.dataset.bookmarkUrl;
      openBookmark(url);
    }
  });
}

function openBookmarkManager() {
  // 获取插件的URL
  const extensionURL = chrome.runtime.getURL('bookmarks.html');
  
  // 在新标签页中打开书签管理器
  chrome.tabs.create({ url: extensionURL });
  
  // 关闭弹出窗口
  window.close();
}

// 检查当前页面并设置按钮状态
async function checkCurrentPageAndSetButtonState() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      setButtonState('disabled', '无法获取页面信息');
      return;
    }
    
    const validationResult = validateUrlForBookmark(tab.url);
    setButtonState(validationResult.valid ? 'enabled' : 'disabled', validationResult.reason);
    
  } catch (error) {
    console.error('检查当前页面失败:', error);
    setButtonState('disabled', '页面检查失败');
  }
}

// 验证URL是否可以添加书签
function validateUrlForBookmark(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, reason: '无效的URL' };
  }
  
  // 转换为小写进行比较
  const lowerUrl = url.toLowerCase();
  
  // 过滤Chrome内部页面
  if (lowerUrl.startsWith('chrome://') || lowerUrl.startsWith('chrome-extension://')) {
    return { valid: false, reason: '不支持Chrome内部页面' };
  }
  
  // 过滤系统页面
  if (lowerUrl.startsWith('about:') && !lowerUrl.startsWith('about:blank')) {
    return { valid: false, reason: '不支持系统页面' };
  }
  
  // 特殊处理about:blank
  if (lowerUrl === 'about:blank') {
    return { valid: false, reason: '空白页面无法收藏' };
  }
  
  // 过滤data URL
  if (lowerUrl.startsWith('data:')) {
    return { valid: false, reason: '不支持Data URL' };
  }
  
  // 过滤文件系统
  if (lowerUrl.startsWith('file://')) {
    return { valid: false, reason: '不支持本地文件' };
  }
  
  // 过滤特殊协议
  const invalidProtocols = [
    'javascript:', 'mailto:', 'tel:', 'ftp:', 'ws:', 'wss:',
    'moz-extension:', 'edge:', 'opera:', 'vivaldi:'
  ];
  
  for (const protocol of invalidProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return { valid: false, reason: `不支持${protocol.replace(':', '').toUpperCase()}协议` };
    }
  }
  
  // 检查是否为有效的HTTP/HTTPS URL
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, reason: '只支持HTTP/HTTPS网页' };
    }
    
    // 检查是否为有效的域名
    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return { valid: false, reason: '无效的域名' };
    }
    
    // 检查是否为本地IP地址（可选）
    if (isLocalIP(urlObj.hostname)) {
      return { valid: false, reason: '不支持本地网络页面' };
    }
    
  } catch (error) {
    return { valid: false, reason: '无效的URL格式' };
  }
  
  return { valid: true, reason: '' };
}

// 检查是否为本地IP地址
function isLocalIP(hostname) {
  const localIPs = [
    /^localhost$/,
    /^127\.\d+\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/
  ];
  
  return localIPs.some(pattern => pattern.test(hostname));
}

// 设置按钮状态
function setButtonState(state, reason = '') {
  const button = document.getElementById('current-page-btn');
  const buttonText = button.querySelector('.btn-text');
  
  if (state === 'enabled') {
    button.disabled = false;
    button.classList.remove('disabled');
    button.title = '添加当前页面到最近收藏';
    if (buttonText) {
      buttonText.textContent = '添加到最近收藏';
    }
  } else {
    button.disabled = true;
    button.classList.add('disabled');
    button.title = reason || '此页面无法收藏';
    if (buttonText && reason) {
      buttonText.textContent = '无法收藏';
    }
  }
}

async function addCurrentPage() {
  try {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      showNotification('无法获取当前页面信息');
      return;
    }
    
    // 再次验证URL是否可以添加
    const validationResult = validateUrlForBookmark(tab.url);
    if (!validationResult.valid) {
      showNotification(validationResult.reason || '此页面无法收藏');
      return;
    }
    
    // 获取或创建「最近收藏」文件夹
    const recentFolderId = await getOrCreateRecentFolder();
    
    // 检查是否已存在相同的URL
    const isDuplicate = await checkDuplicateInRecentFolder(tab.url, recentFolderId);
    if (isDuplicate) {
      showNotification('已在「最近收藏」中！');
      return;
    }
    
    // 添加书签到最近收藏文件夹
    await chrome.bookmarks.create({
      title: tab.title || '无标题',
      url: tab.url,
      parentId: recentFolderId
    });
    
    // 显示成功消息
    showNotification('书签已添加到「最近收藏」！');
    
    // 刷新最近书签
    loadRecentBookmarks();
    loadStats();
    
  } catch (error) {
    console.error('添加书签失败:', error);
    showNotification('添加书签失败');
  }
}

// 获取或创建「最近收藏」文件夹
async function getOrCreateRecentFolder() {
  try {
    // 获取所有书签
    const bookmarkTree = await chrome.bookmarks.getTree();
    
    // 查找是否已存在「最近收藏」文件夹
    const recentFolder = findRecentFolder(bookmarkTree[0]);
    
    if (recentFolder) {
      return recentFolder.id;
    } else {
      // 创建「最近收藏」文件夹
      const newFolder = await chrome.bookmarks.create({
        title: '📌 最近收藏',
        parentId: '1' // 添加到书签栏
      });
      return newFolder.id;
    }
  } catch (error) {
    console.error('获取或创建最近收藏文件夹失败:', error);
    // 如果失败，返回根目录
    return '0';
  }
}

// 查找「最近收藏」文件夹
function findRecentFolder(node) {
  if (node.title === '📌 最近收藏' && !node.url) {
    return node;
  }
  
  if (node.children) {
    for (let child of node.children) {
      const found = findRecentFolder(child);
      if (found) {
        return found;
      }
    }
  }
  
  return null;
}

// quickAddDialog 函数已移除，简化用户界面


async function loadRecentBookmarks() {
  try {
    const container = document.getElementById('recent-bookmarks');
    
    // 获取「最近收藏」文件夹中的书签
    const recentFolderId = await getRecentFolderId();
    
    if (recentFolderId) {
      // 获取该文件夹中的书签
      const bookmarks = await chrome.bookmarks.getChildren(recentFolderId);
      
      if (bookmarks.length === 0) {
        container.innerHTML = '<p class="no-bookmarks">「最近收藏」文件夹为空</p>';
        return;
      }
      
      // 只显示最近5个，按添加时间排序
      const recentBookmarks = bookmarks
        .filter(b => b.url) // 只显示书签，不显示文件夹
        .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
        .slice(0, 5);
      
      container.innerHTML = '';
      recentBookmarks.forEach(bookmark => {
        const item = createRecentBookmarkItem(bookmark);
        container.appendChild(item);
      });
    } else {
      // 如果没有「最近收藏」文件夹，显示最近添加的书签
      const bookmarks = await chrome.bookmarks.getRecent(5);
      
      if (bookmarks.length === 0) {
        container.innerHTML = '<p class="no-bookmarks">暂无书签</p>';
        return;
      }
      
      container.innerHTML = '';
      bookmarks.forEach(bookmark => {
        const item = createRecentBookmarkItem(bookmark);
        container.appendChild(item);
      });
    }
    
  } catch (error) {
    console.error('加载最近书签失败:', error);
  }
}

// 获取「最近收藏」文件夹ID
async function getRecentFolderId() {
  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    const recentFolder = findRecentFolder(bookmarkTree[0]);
    return recentFolder ? recentFolder.id : null;
  } catch (error) {
    console.error('获取最近收藏文件夹ID失败:', error);
    return null;
  }
}

// 检查URL是否在「最近收藏」文件夹中已存在
async function checkDuplicateInRecentFolder(url, recentFolderId) {
  try {
    if (!recentFolderId) return false;
    
    const bookmarks = await chrome.bookmarks.getChildren(recentFolderId);
    return bookmarks.some(bookmark => bookmark.url === url);
    
  } catch (error) {
    console.error('检查重复书签失败:', error);
    return false;
  }
}

function createRecentBookmarkItem(bookmark) {
  const item = document.createElement('div');
  item.className = 'recent-item';
  item.dataset.bookmarkId = bookmark.id;
  item.dataset.bookmarkUrl = bookmark.url;
  
  const favicon = getFaviconUrl(bookmark.url);
  
  item.innerHTML = `
    <img class="recent-favicon" src="${favicon}" alt="favicon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiByeD0iMyIgZmlsbD0iI0U1RTVFNSIvPgo8cGF0aCBkPSJNOCAzQzUuMjQgMyAzIDUuMjQgMyA4QzMgMTAuNzYgNS4yNCAxMyA4IDEzQzEwLjc2IDEzIDEzIDEwLjc2IDEzIDhDMTMgNS4yNCAxMC43NiAzIDggM1oiIGZpbGw9IiM5OTk5OTkiLz4KPC9zdmc+'">
    <div class="recent-info">
      <div class="recent-title">${escapeHtml(bookmark.title)}</div>
      <div class="recent-url">${escapeHtml(bookmark.url)}</div>
    </div>
    <div class="recent-actions">
      <button class="action-btn delete-btn" title="删除">
        🗑️
      </button>
    </div>
  `;
  
  return item;
}

async function loadStats() {
  try {
    // 获取书签树
    const bookmarkTree = await chrome.bookmarks.getTree();
    const stats = calculateBookmarkStats(bookmarkTree[0]);
    
    // 获取「最近收藏」文件夹中今天添加的书签数量
    const todayInRecent = await getTodayInRecentCount();
    
    document.getElementById('total-count').textContent = stats.totalBookmarks;
    document.getElementById('folders-count').textContent = stats.totalFolders;
    document.getElementById('recent-count').textContent = todayInRecent;
    
  } catch (error) {
    console.error('加载统计信息失败:', error);
  }
}

function calculateBookmarkStats(node) {
  let totalBookmarks = 0;
  let totalFolders = 0;
  
  function traverse(node) {
    if (node.url) {
      totalBookmarks++;
    } else if (node.children) {
      totalFolders++;
      node.children.forEach(child => traverse(child));
    }
  }
  
  traverse(node);
  
  return { totalBookmarks, totalFolders };
}

// 获取「最近收藏」文件夹中今天添加的书签数量
async function getTodayInRecentCount() {
  try {
    const recentFolderId = await getRecentFolderId();
    if (!recentFolderId) return 0;
    
    const bookmarks = await chrome.bookmarks.getChildren(recentFolderId);
    const today = new Date().toDateString();
    
    return bookmarks.filter(bookmark => {
      if (!bookmark.url || !bookmark.dateAdded) return false;
      const addedDate = new Date(bookmark.dateAdded).toDateString();
      return addedDate === today;
    }).length;
    
  } catch (error) {
    console.error('获取今日添加数量失败:', error);
    return 0;
  }
}

function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  } catch (e) {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiByeD0iMyIgZmlsbD0iI0U1RTVFNSIvPgo8cGF0aCBkPSJNOCAzQzUuMjQgMyAzIDUuMjQgMyA4QzMgMTAuNzYgNS4yNCAxMyA4IDEzQzEwLjc2IDEzIDEzIDEwLjc2IDEzIDhDMTMgNS4yNCAxMC43NiAzIDggM1oiIGZpbGw9IiM5OTk5OTkiLz4KPC9zdmc+';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function openBookmark(url) {
  chrome.tabs.create({ url: url });
}

async function deleteRecentBookmark(bookmarkId, element) {
  try {
    await chrome.bookmarks.remove(bookmarkId);
    
    // 隐藏删除提示
    hideDeleteHint();
    
    // 添加删除动画效果
    const item = element.closest('.recent-item');
    item.style.transition = 'all 0.3s ease';
    item.style.opacity = '0';
    item.style.transform = 'translateX(-100%)';
    
    // 动画完成后重新加载
    setTimeout(() => {
      loadRecentBookmarks();
      loadStats();
    }, 300);
    
  } catch (error) {
    console.error('删除书签失败:', error);
    // 恢复按钮状态
    element.classList.remove('confirm-delete');
    element.innerHTML = '🗑️';
    element.title = '删除';
    hideDeleteHint();
  }
}

function showNotification(message) {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // 3秒后移除通知
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function showDeleteHint(message) {
  // 移除已存在的删除提示
  hideDeleteHint();
  
  // 创建删除提示元素
  const hint = document.createElement('div');
  hint.className = 'delete-hint';
  hint.textContent = message;
  hint.id = 'delete-hint';
  
  document.body.appendChild(hint);
}

function hideDeleteHint() {
  const hint = document.getElementById('delete-hint');
  if (hint) {
    hint.remove();
  }
}

// 获取所有书签
function getAllBookmarks(node) {
  let bookmarks = [];
  
  function traverse(node) {
    if (node.url) {
      bookmarks.push(node);
    } else if (node.children) {
      node.children.forEach(child => traverse(child));
    }
  }
  
  traverse(node);
  return bookmarks;
}

// 移除全局函数定义，现在使用事件委托