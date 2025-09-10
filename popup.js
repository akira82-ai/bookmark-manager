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
      <button id="open-manager-btn" class="primary-btn">
        <span class="btn-icon">📂</span>
        打开书签管理器
      </button>
      
      <div class="quick-actions">
        <button id="current-page-btn" class="secondary-btn">
          <span class="btn-icon">🔖</span>
          添加当前页面
        </button>
        <button id="quick-add-btn" class="secondary-btn">
          <span class="btn-icon">➕</span>
          快速添加
        </button>
      </div>
    </div>
    
    <div class="recent-section">
      <h3>最近添加的书签</h3>
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
    addCurrentPage();
  });
  
  // 快速添加
  document.getElementById('quick-add-btn').addEventListener('click', function() {
    showQuickAddDialog();
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

async function addCurrentPage() {
  try {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      alert('无法获取当前页面信息');
      return;
    }
    
    // 添加书签到根目录
    await chrome.bookmarks.create({
      title: tab.title || '无标题',
      url: tab.url
    });
    
    // 显示成功消息
    showNotification('书签添加成功！');
    
    // 刷新最近书签
    loadRecentBookmarks();
    loadStats();
    
  } catch (error) {
    console.error('添加书签失败:', error);
    alert('添加书签失败');
  }
}

function showQuickAddDialog() {
  const title = prompt('请输入书签标题:');
  if (!title) return;
  
  const url = prompt('请输入书签URL:');
  if (!url) return;
  
  // 添加书签
  chrome.bookmarks.create({
    title: title,
    url: url
  }).then(() => {
    showNotification('书签添加成功！');
    loadRecentBookmarks();
    loadStats();
  }).catch(error => {
    console.error('添加书签失败:', error);
    alert('添加书签失败');
  });
}

async function loadRecentBookmarks() {
  try {
    // 获取最近的书签
    const bookmarks = await chrome.bookmarks.getRecent(5);
    const container = document.getElementById('recent-bookmarks');
    
    if (bookmarks.length === 0) {
      container.innerHTML = '<p class="no-bookmarks">暂无书签</p>';
      return;
    }
    
    container.innerHTML = '';
    bookmarks.forEach(bookmark => {
      const item = createRecentBookmarkItem(bookmark);
      container.appendChild(item);
    });
    
  } catch (error) {
    console.error('加载最近书签失败:', error);
  }
}

function createRecentBookmarkItem(bookmark) {
  const item = document.createElement('div');
  item.className = 'recent-item';
  
  const favicon = getFaviconUrl(bookmark.url);
  
  item.innerHTML = `
    <img class="recent-favicon" src="${favicon}" alt="favicon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiByeD0iMyIgZmlsbD0iI0U1RTVFNSIvPgo8cGF0aCBkPSJNOCAzQzUuMjQgMyAzIDUuMjQgMyA4QzMgMTAuNzYgNS4yNCAxMyA4IDEzQzEwLjc2IDEzIDEzIDEwLjc2IDEzIDhDMTMgNS4yNCAxMC43NiAzIDggM1oiIGZpbGw9IiM5OTk5OTkiLz4KPC9zdmc+'">
    <div class="recent-info">
      <div class="recent-title">${escapeHtml(bookmark.title)}</div>
      <div class="recent-url">${escapeHtml(bookmark.url)}</div>
    </div>
    <div class="recent-actions">
      <button class="action-btn" onclick="openBookmark('${bookmark.url}')" title="打开">
        🔗
      </button>
      <button class="action-btn" onclick="deleteRecentBookmark('${bookmark.id}')" title="删除">
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
    
    document.getElementById('total-count').textContent = stats.totalBookmarks;
    document.getElementById('folders-count').textContent = stats.totalFolders;
    document.getElementById('recent-count').textContent = stats.todayAdded;
    
  } catch (error) {
    console.error('加载统计信息失败:', error);
  }
}

function calculateBookmarkStats(node) {
  let totalBookmarks = 0;
  let totalFolders = 0;
  let todayAdded = 0;
  const today = new Date().toDateString();
  
  function traverse(node) {
    if (node.url) {
      totalBookmarks++;
      if (node.dateAdded) {
        const addedDate = new Date(node.dateAdded).toDateString();
        if (addedDate === today) {
          todayAdded++;
        }
      }
    } else if (node.children) {
      totalFolders++;
      node.children.forEach(child => traverse(child));
    }
  }
  
  traverse(node);
  
  return { totalBookmarks, totalFolders, todayAdded };
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

async function deleteRecentBookmark(bookmarkId) {
  if (!confirm('确定要删除这个书签吗？')) {
    return;
  }
  
  try {
    await chrome.bookmarks.remove(bookmarkId);
    loadRecentBookmarks();
    loadStats();
  } catch (error) {
    console.error('删除书签失败:', error);
    alert('删除书签失败');
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

// 全局函数供HTML调用
window.openBookmark = openBookmark;
window.deleteRecentBookmark = deleteRecentBookmark;