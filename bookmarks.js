/**
 * 链接检测器类
 */
class LinkChecker {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24小时缓存
    this.timeout = 10000; // 10秒超时
  }

  /**
   * 检查单个链接
   */
  async check(url) {
    // 检查缓存
    const cached = this.getFromCache(url);
    if (cached) {
      return cached;
    }

    try {
      const startTime = Date.now();
      const result = await this.performCheck(url);
      const responseTime = Date.now() - startTime;

      const finalResult = {
        ...result,
        responseTime,
        checkedAt: Date.now()
      };

      // 存入缓存
      this.setToCache(url, finalResult);
      
      return finalResult;
    } catch (error) {
      const errorResult = {
        status: 'timeout',
        error: error.message,
        responseTime: this.timeout,
        checkedAt: Date.now()
      };

      // 错误结果也缓存，但时间较短
      this.setToCache(url, errorResult, 5 * 60 * 1000); // 5分钟
      
      return errorResult;
    }
  }

  /**
   * 执行实际的链接检查
   */
  async performCheck(url) {
    try {
      // 使用 CORS 代理或者尝试直接请求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      clearTimeout(timeoutId);

      // 由于 no-cors 模式限制，我们无法读取真实状态码
      // 这里使用一些启发式方法判断状态
      if (response.type === 'opaque') {
        // opaque 响应通常意味着跨域成功但无法读取详情
        return {
          status: 'valid',
          statusCode: 200,
          url: url,
          finalUrl: url
        };
      }

      return {
        status: 'valid',
        statusCode: response.status || 200,
        url: url,
        finalUrl: response.url || url
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        return {
          status: 'timeout',
          statusCode: 0,
          error: '请求超时',
          url: url,
          finalUrl: url
        };
      }

      if (error.name === 'TypeError') {
        // 通常是由于 CORS 或网络错误
        return {
          status: 'invalid',
          statusCode: 0,
          error: '无法访问',
          url: url,
          finalUrl: url
        };
      }

      return {
        status: 'invalid',
        statusCode: 0,
        error: error.message,
        url: url,
        finalUrl: url
      };
    }
  }

  /**
   * 从缓存获取
   */
  getFromCache(url) {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.checkedAt < this.cacheTimeout) {
      return cached;
    }
    return null;
  }

  /**
   * 存入缓存
   */
  setToCache(url, result, customTimeout = null) {
    this.cache.set(url, result);
    
    // 设置过期清理
    const timeout = customTimeout || this.cacheTimeout;
    setTimeout(() => {
      this.cache.delete(url);
    }, timeout);
  }
}

/**
 * 批量处理器类
 */
class BatchProcessor {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.activeRequests = 0;
    this.queue = [];
  }

  /**
   * 处理批量任务
   */
  async process(items, processor) {
    return new Promise((resolve, reject) => {
      const results = [];
      let completed = 0;
      let hasError = false;

      const processNext = async () => {
        if (completed >= items.length || hasError) {
          if (completed >= items.length) {
            resolve(results);
          }
          return;
        }

        if (this.activeRequests >= this.maxConcurrent) {
          setTimeout(processNext, 100);
          return;
        }

        const item = items[completed];
        this.activeRequests++;

        try {
          const result = await processor(item);
          results[completed] = result;
        } catch (error) {
          console.error(`处理项目 ${completed} 失败:`, error);
          results[completed] = {
            status: 'error',
            error: error.message
          };
          // 不设置 hasError，继续处理其他项目
        } finally {
          this.activeRequests--;
          completed++;
          setTimeout(processNext, 50); // 小延迟避免过快请求
        }
      };

      // 启动多个并发处理器
      for (let i = 0; i < Math.min(this.maxConcurrent, items.length); i++) {
        setTimeout(processNext, i * 100);
      }
    });
  }
}

class BookmarkManager {
  constructor() {
    this.currentFolder = null;
    this.bookmarks = [];
    this.folders = [];
    this.searchTerm = '';
    this.searchTimeout = null;
    
    // 智能检测相关属性
    this.linkChecker = new LinkChecker();
    this.checkResults = new Map(); // 存储检测结果
    this.isChecking = false;
    this.isCheckMode = false; // 检测模式状态
    this.checkStats = {
      total: 0,
      processed: 0,
      valid: 0,
      invalid: 0,
      redirect: 0,
      timeout: 0
    };
    
    // 显示模式状态
    this.isGroupedView = false; // false=正常显示, true=分组显示
    
    this.init();
  }

  init() {
    this.bindEvents();
    // 初始化搜索按钮状态
    this.updateSearchButtonVisibility('');
    this.loadBookmarks();
  }

  bindEvents() {
    // 事件委托：处理书签卡片的按钮点击
    document.getElementById('bookmarks-grid').addEventListener('click', (e) => {
      const card = e.target.closest('.bookmark-card');
      if (!card) return;
      
      if (e.target.closest('.open-btn')) {
        const url = card.dataset.bookmarkUrl;
        this.openBookmark(url);
      } else if (e.target.closest('.edit-btn')) {
        const bookmarkId = card.dataset.bookmarkId;
        this.editBookmark(bookmarkId);
      } else if (e.target.closest('.delete-btn')) {
        const bookmarkId = card.dataset.bookmarkId;
        this.deleteBookmark(bookmarkId);
      }
    });

    // 智能检测工具栏事件
    this.bindToolbarEvents();

    // 搜索相关事件
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    // 点击搜索按钮进行搜索或清空
    searchBtn.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query === '') {
        // 如果搜索框为空，不执行任何操作
        return;
      } else {
        // 如果搜索框有内容，清空搜索框
        this.clearSearch();
      }
    });
    
    // 回车键搜索
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });

    // 实时搜索（带防抖）
    searchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      const query = e.target.value.trim();
      
      // 根据搜索框内容控制按钮显示
      this.updateSearchButtonVisibility(query);
      
      if (query === '') {
        // 如果搜索框为空，清除搜索
        this.clearSearch();
      } else {
        // 防抖处理，400ms后执行搜索
        this.searchTimeout = setTimeout(() => {
          this.performSearch();
        }, 400);
      }
    });
    
    // 移除展开所有按钮相关代码

    // 模态框事件
    document.getElementById('modal-close').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('save-btn').addEventListener('click', () => {
      this.saveBookmark();
    });

    // 点击外部关闭上下文菜单
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) {
        this.hideContextMenu();
      }
    });

    // 点击模态框外部关闭模态框
    document.getElementById('edit-modal').addEventListener('click', (e) => {
      if (e.target.id === 'edit-modal') {
        this.closeModal();
      }
    });
  }

  async loadBookmarks() {
    this.showLoading();
    
    try {
      // 获取所有书签
      const bookmarkTree = await chrome.bookmarks.getTree();
      this.processBookmarkTree(bookmarkTree[0]);
      
      this.renderFolderTree();
      this.renderBookmarks();
      this.updateStats();
      
      this.hideLoading();
    } catch (error) {
      console.error('加载书签失败:', error);
      this.hideLoading();
    }
  }

  processBookmarkTree(node) {
    if (node.url) {
      // 这是一个书签
      this.bookmarks.push({
        id: node.id,
        title: node.title || '无标题',
        url: node.url,
        parentId: node.parentId,
        dateAdded: node.dateAdded
      });
    } else if (node.children) {
      // 这是一个文件夹
      this.folders.push({
        id: node.id,
        title: node.title || '无标题文件夹',
        parentId: node.parentId,
        children: node.children
      });
      
      // 递归处理子节点
      node.children.forEach(child => {
        this.processBookmarkTree(child);
      });
    }
  }

  renderFolderTree() {
    const folderTree = document.getElementById('folder-tree');
    folderTree.innerHTML = '';
    
    // 显示所有文件夹（包括所有层级的文件夹）
    const allFolders = this.folders.filter(f => f.id !== '0'); // 过滤掉根目录
    
    // 将「最近收藏」文件夹放在最前面
    const recentFolder = allFolders.find(f => f.title === '📌 最近收藏');
    const otherFolders = allFolders.filter(f => f.title !== '📌 最近收藏');
    
    // 其他文件夹按标题排序
    otherFolders.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
    
    // 先添加最近收藏文件夹（如果存在）
    if (recentFolder) {
      const recentFolderElement = this.createFolderElement(recentFolder);
      folderTree.appendChild(recentFolderElement);
    }
    
    // 然后添加其他文件夹
    otherFolders.forEach(folder => {
      const folderElement = this.createFolderElement(folder);
      folderTree.appendChild(folderElement);
    });
  }

  createFolderElement(folder) {
    const folderElement = document.createElement('div');
    folderElement.className = 'folder-item';
    folderElement.dataset.folderId = folder.id;
    
    const folderIcon = document.createElement('span');
    folderIcon.className = 'folder-icon';
    folderIcon.textContent = '📁';
    
    const folderName = document.createElement('span');
    folderName.className = 'folder-name';
    folderName.textContent = folder.title;
    
    // 计算该文件夹内的书签数量
    const childBookmarks = this.bookmarks.filter(b => b.parentId === folder.id);
    
    const folderCount = document.createElement('span');
    folderCount.className = 'folder-count';
    folderCount.textContent = childBookmarks.length;
    
    folderElement.appendChild(folderIcon);
    folderElement.appendChild(folderName);
    folderElement.appendChild(folderCount);
    
    // 点击文件夹
    folderElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFolder(folder.id, folder.title);
    });
    
    return folderElement;
  }

  
  selectFolder(folderId, folderTitle) {
    // 如果当前在搜索状态，先退出搜索
    if (this.searchTerm) {
      this.exitSearchState();
    }
    
    // 如果当前在检测模式，先退出检测模式
    if (this.isCheckMode) {
      this.exitCheckMode();
    }
    
    // 更新当前文件夹
    this.currentFolder = folderId;
    
    // 更新侧边栏状态
    document.querySelectorAll('.folder-item').forEach(item => {
      item.classList.remove('active');
    });
    
    const selectedFolder = document.querySelector(`[data-folder-id="${folderId}"]`);
    if (selectedFolder) {
      selectedFolder.classList.add('active');
    }
    
    // 渲染书签
    this.renderBookmarks();
  }

  // 面包屑导航功能已移除

  renderBookmarks() {
    const grid = document.getElementById('bookmarks-grid');
    grid.innerHTML = '';
    
    // 如果有搜索词，显示搜索结果
    if (this.searchTerm) {
      this.renderSearchResults();
      return;
    }
    
    // 获取当前文件夹的书签
    let bookmarks;
    if (this.currentFolder === null) {
      // 显示根目录书签（parentId为"0"或书签栏/其他书签栏的根节点）
      bookmarks = this.bookmarks.filter(b => b.parentId === "0" || b.parentId === "1" || b.parentId === "2");
    } else {
      bookmarks = this.bookmarks.filter(b => b.parentId === this.currentFolder);
    }
    
    // 按标题排序（默认）
    bookmarks = this.sortBookmarksArray(bookmarks);
    
    if (bookmarks.length === 0) {
      this.showEmptyState();
      return;
    }
    
    this.hideEmptyState();
    
    bookmarks.forEach(bookmark => {
      const card = this.createBookmarkCard(bookmark, { mode: 'normal' });
      grid.appendChild(card);
    });
  }

  /**
 * 创建统一的书签卡片
 * @param {Object} bookmark - 书签对象
 * @param {Object} options - 配置选项
 * @param {string} options.mode - 显示模式: 'normal'(默认) | 'search'
 * @param {string} options.searchTerm - 搜索关键词(仅search模式)
 * @returns {HTMLElement} 书签卡片元素
 */
createBookmarkCard(bookmark, options = {}) {
  const { mode = 'normal', searchTerm = '' } = options;
  
  const card = document.createElement('div');
  card.className = 'bookmark-card';
  card.dataset.bookmarkId = bookmark.id;
  card.dataset.bookmarkUrl = bookmark.url;
  card.dataset.bookmarkTitle = bookmark.title;
  
  // 获取favicon
  const favicon = this.getFaviconUrl(bookmark.url);
  
  // 处理文本内容（支持搜索高亮）
  let titleContent = this.escapeHtml(bookmark.title);
  let urlContent = this.escapeHtml(bookmark.url);
  
  if (mode === 'search' && searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    const lowerTitle = bookmark.title.toLowerCase();
    const lowerUrl = bookmark.url.toLowerCase();
    
    if (lowerTitle.includes(searchLower)) {
      titleContent = this.highlightText(bookmark.title, searchTerm);
    }
    if (lowerUrl.includes(searchLower)) {
      urlContent = this.highlightText(bookmark.url, searchTerm);
    }
  }
  
  card.innerHTML = `
    <div class="bookmark-header">
      <img class="bookmark-favicon" src="${favicon}" alt="favicon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI0U1RTVFNSIvPgo8cGF0aCBkPSJNMTIgN0M5LjI0IDcgNyA5LjI0IDcgMTJDMiAxNC43NiA5LjI0IDE3IDEyIDE3QzE0Ljc2IDE3IDE3IDE0Ljc2IDE3IDEyQzE3IDkuMjQgMTQuNzYgNyAxMiA3WiIgZmlsbD0iIzk5OTk5OSIvPgo8L3N2Zz4K'">
      <div class="bookmark-title">${titleContent}</div>
    </div>
    <div class="bookmark-url">${urlContent}</div>
    <div class="bookmark-actions">
      <button class="bookmark-action-btn edit-btn">编辑</button>
      <button class="bookmark-action-btn delete-btn">删除</button>
    </div>
  `;
  
  // 绑定事件监听器
  this.bindCardEvents(card, bookmark);
  
  // 添加点击选择功能（用于批量操作）
  card.addEventListener('click', (e) => {
    // 如果按住Ctrl键，切换选择状态
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      card.classList.toggle('selected');
    }
  });
  
  return card;
}

/**
 * 为书签卡片绑定事件监听器
 * @param {HTMLElement} card - 书签卡片元素
 * @param {Object} bookmark - 书签对象
 */
bindCardEvents(card, bookmark) {
  // 右键菜单
  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    this.showContextMenu(e, bookmark);
  });
  
  // 单击打开书签（点击卡片空白区域）
  card.addEventListener('click', (e) => {
    // 如果点击的是按钮区域，不触发跳转
    if (e.target.closest('.bookmark-actions')) {
      return;
    }
    // 如果卡片处于编辑模式，不触发跳转
    if (card.classList.contains('editing')) {
      return;
    }
    this.openBookmark(bookmark.url);
  });
  
  // 按钮事件
  const editBtn = card.querySelector('.edit-btn');
  const deleteBtn = card.querySelector('.delete-btn');
  
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleEditMode(card, bookmark);
    });
  }
  
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteBookmark(bookmark.id);
    });
  }
}

  getFaviconUrl(url) {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch (e) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI0U1RTVFNSIvPgo8cGF0aCBkPSJNMTIgN0M5LjI0IDcgNyA5LjI0IDcgMTJDMiAxNC43NiA5LjI0IDE3IDEyIDE3QzE0Ljc2IDE3IDE3IDE0Ljc2IDE3IDEyQzE3IDkuMjQgMTQuNzYgNyAxMiA3WiIgZmlsbD0iIzk5OTk5OSIvPgo8L3N2Zz4K';
    }
  }

  openBookmark(url) {
    chrome.tabs.create({ url: url });
  }

  editBookmark(bookmarkId) {
    const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
    if (!bookmark) return;
    
    // 填充表单
    document.getElementById('edit-title').value = bookmark.title;
    document.getElementById('edit-url').value = bookmark.url;
    
    // 填充文件夹选项
    const folderSelect = document.getElementById('edit-folder');
    folderSelect.innerHTML = '';
    
    // 添加根目录选项
    const rootOption = document.createElement('option');
    rootOption.value = '0';
    rootOption.textContent = '🏠 根目录';
    folderSelect.appendChild(rootOption);
    
    // 添加其他文件夹选项
    this.folders.forEach(folder => {
      const option = document.createElement('option');
      option.value = folder.id;
      option.textContent = folder.title;
      option.selected = folder.id === bookmark.parentId;
      folderSelect.appendChild(option);
    });
    
    // 显示模态框
    document.getElementById('edit-modal').style.display = 'flex';
    
    // 保存当前编辑的书签ID
    this.editingBookmarkId = bookmarkId;
  }

  /**
   * 切换书签卡片的编辑模式
   * @param {HTMLElement} card - 书签卡片元素
   * @param {Object} bookmark - 书签对象
   */
  toggleEditMode(card, bookmark) {
    const isEditing = card.classList.contains('editing');
    
    if (isEditing) {
      // 保存编辑
      this.saveInlineEdit(card, bookmark);
    } else {
      // 进入编辑模式
      this.enterEditMode(card, bookmark);
    }
  }

  /**
   * 进入编辑模式
   * @param {HTMLElement} card - 书签卡片元素
   * @param {Object} bookmark - 书签对象
   */
  enterEditMode(card, bookmark) {
    const titleElement = card.querySelector('.bookmark-title');
    const urlElement = card.querySelector('.bookmark-url');
    const editBtn = card.querySelector('.edit-btn');
    
    // 保存原始值
    card.dataset.originalTitle = bookmark.title;
    card.dataset.originalUrl = bookmark.url;
    
    // 替换标题为输入框
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'bookmark-title-input';
    titleInput.value = bookmark.title;
    titleInput.placeholder = '请输入书签标题';
    titleElement.innerHTML = '';
    titleElement.appendChild(titleInput);
    
    // 替换URL为输入框
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.className = 'bookmark-url-input';
    urlInput.value = bookmark.url;
    urlInput.placeholder = '请输入书签URL';
    urlElement.innerHTML = '';
    urlElement.appendChild(urlInput);
    
    // 更改按钮文本
    editBtn.textContent = '保存';
    editBtn.classList.add('save-btn');
    
    // 添加编辑模式样式
    card.classList.add('editing');
    
    // 聚焦到标题输入框
    titleInput.focus();
    titleInput.select();
    
    // 绑定回车键保存
    const saveOnEnter = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.saveInlineEdit(card, bookmark);
        titleInput.removeEventListener('keydown', saveOnEnter);
        urlInput.removeEventListener('keydown', saveOnEnter);
      }
    };
    
    titleInput.addEventListener('keydown', saveOnEnter);
    urlInput.addEventListener('keydown', saveOnEnter);
  }

  /**
   * 保存内联编辑
   * @param {HTMLElement} card - 书签卡片元素
   * @param {Object} bookmark - 书签对象
   */
  async saveInlineEdit(card, bookmark) {
    const titleInput = card.querySelector('.bookmark-title-input');
    const urlInput = card.querySelector('.bookmark-url-input');
    
    const newTitle = titleInput.value.trim();
    const newUrl = urlInput.value.trim();
    
    // 验证输入
    if (!newTitle) {
      alert('请输入书签标题');
      titleInput.focus();
      return;
    }
    
    if (!newUrl) {
      alert('请输入书签URL');
      urlInput.focus();
      return;
    }
    
    // 验证URL格式
    try {
      new URL(newUrl);
    } catch (e) {
      alert('请输入有效的URL');
      urlInput.focus();
      return;
    }
    
    // 检查是否有实际变化
    if (newTitle === bookmark.title && newUrl === bookmark.url) {
      // 没有变化，直接退出编辑模式
      this.exitEditMode(card, bookmark);
      return;
    }
    
    try {
      // 更新书签
      await chrome.bookmarks.update(bookmark.id, { 
        title: newTitle, 
        url: newUrl 
      });
      
      // 更新本地数据
      const localBookmark = this.bookmarks.find(b => b.id === bookmark.id);
      if (localBookmark) {
        localBookmark.title = newTitle;
        localBookmark.url = newUrl;
      }
      
      // 退出编辑模式
      this.exitEditMode(card, bookmark, newTitle, newUrl);
      
    } catch (error) {
      console.error('保存书签失败:', error);
      alert('保存书签失败，请重试');
    }
  }

  /**
   * 退出编辑模式
   * @param {HTMLElement} card - 书签卡片元素
   * @param {Object} bookmark - 书签对象
   * @param {string} [newTitle] - 新标题（可选）
   * @param {string} [newUrl] - 新URL（可选）
   */
  exitEditMode(card, bookmark, newTitle, newUrl) {
    const titleElement = card.querySelector('.bookmark-title');
    const urlElement = card.querySelector('.bookmark-url');
    const editBtn = card.querySelector('.edit-btn');
    
    // 恢复标题显示
    const finalTitle = newTitle || bookmark.title;
    const finalUrl = newUrl || bookmark.url;
    
    titleElement.innerHTML = this.escapeHtml(finalTitle);
    urlElement.innerHTML = this.escapeHtml(finalUrl);
    
    // 恢复按钮文本
    editBtn.textContent = '编辑';
    editBtn.classList.remove('save-btn');
    
    // 移除编辑模式样式
    card.classList.remove('editing');
    
    // 清理数据
    delete card.dataset.originalTitle;
    delete card.dataset.originalUrl;
  }

  async saveBookmark() {
    const bookmarkId = this.editingBookmarkId;
    const title = document.getElementById('edit-title').value.trim();
    const url = document.getElementById('edit-url').value.trim();
    const parentId = document.getElementById('edit-folder').value;
    
    if (!title || !url) {
      alert('请填写标题和URL');
      return;
    }
    
    try {
      await chrome.bookmarks.update(bookmarkId, { title, url });
      await chrome.bookmarks.move(bookmarkId, { parentId });
      
      // 重新加载书签
      this.loadBookmarks();
      this.closeModal();
      
    } catch (error) {
      console.error('保存书签失败:', error);
      alert('保存书签失败');
    }
  }

  async deleteBookmark(bookmarkId) {
    if (!confirm('确定要删除这个书签吗？')) {
      return;
    }
    
    try {
      await chrome.bookmarks.remove(bookmarkId);
      
      // 从数组中移除
      this.bookmarks = this.bookmarks.filter(b => b.id !== bookmarkId);
      
      // 重新渲染
      this.renderBookmarks();
      this.updateStats();
      
    } catch (error) {
      console.error('删除书签失败:', error);
      alert('删除书签失败');
    }
  }

  closeModal() {
    document.getElementById('edit-modal').style.display = 'none';
    this.editingBookmarkId = null;
  }

  showContextMenu(e, bookmark) {
    const menu = document.getElementById('context-menu');
    menu.style.display = 'block';
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    
    // 绑定菜单项事件
    const menuItems = menu.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      item.onclick = () => {
        const action = item.dataset.action;
        switch (action) {
          case 'open':
            this.openBookmark(bookmark.url);
            break;
          case 'edit':
            this.editBookmark(bookmark.id);
            break;
          case 'delete':
            this.deleteBookmark(bookmark.id);
            break;
          case 'copy':
            this.copyToClipboard(bookmark.url);
            break;
        }
        this.hideContextMenu();
      };
    });
  }

  hideContextMenu() {
    document.getElementById('context-menu').style.display = 'none';
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      // 可以添加一个提示
      console.log('链接已复制到剪贴板');
    } catch (err) {
      console.error('复制失败:', err);
    }
  }

  sortBookmarksArray(bookmarks) {
    return bookmarks.sort((a, b) => {
      const aValue = a.title.toLowerCase();
      const bValue = b.title.toLowerCase();
      
      if (aValue < bValue) return -1;
      if (aValue > bValue) return 1;
      return 0;
    });
  }

  
  updateStats() {
    const totalBookmarks = this.bookmarks.length;
    const totalFolders = this.folders.length;
    
    document.getElementById('total-bookmarks').textContent = totalBookmarks;
    document.getElementById('total-folders').textContent = totalFolders;
  }

  showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('bookmarks-grid').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';
  }

  hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('bookmarks-grid').style.display = 'grid';
  }

  showEmptyState() {
    document.getElementById('empty-state').style.display = 'block';
    document.getElementById('bookmarks-grid').style.display = 'none';
  }

  hideEmptyState() {
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('bookmarks-grid').style.display = 'grid';
  }

  // 退出搜索状态
  exitSearchState() {
    this.searchTerm = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // 更新搜索按钮显示状态
    this.updateSearchButtonVisibility('');
    
    // 恢复原来的网格布局
    const grid = document.getElementById('bookmarks-grid');
    grid.style.display = '';
    grid.style.flexDirection = '';
    grid.style.gridTemplateColumns = '';
    
    // 移除搜索结果头部
    const searchHeader = document.querySelector('.search-results-header');
    if (searchHeader) {
      searchHeader.remove();
    }
    
    // 移除搜索结果容器
    const searchContainer = document.querySelector('.search-results-container');
    if (searchContainer) {
      searchContainer.remove();
    }
  }

  // 更新搜索按钮显示状态
  updateSearchButtonVisibility(query) {
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      if (query) {
        searchBtn.classList.add('visible');
        searchBtn.innerHTML = '✕';
        searchBtn.title = '清空搜索';
      } else {
        searchBtn.classList.remove('visible');
        searchBtn.innerHTML = '🔍';
        searchBtn.title = '搜索';
      }
    }
  }

  // 搜索功能方法
  performSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    this.searchTerm = searchInput.value.trim();
    
    // 更新搜索按钮显示状态
    this.updateSearchButtonVisibility(this.searchTerm);
    
    if (!this.searchTerm) {
      this.clearSearch();
      return;
    }
    
    // 给搜索按钮一个反馈效果
    searchBtn.style.transform = 'translateY(-50%) scale(0.9)';
    setTimeout(() => {
      searchBtn.style.transform = 'translateY(-50%) scale(1)';
    }, 100);
    
    this.renderBookmarks();
  }

  renderSearchResults() {
    const grid = document.getElementById('bookmarks-grid');
    grid.innerHTML = '';
    
    // 临时移除网格布局，改用flex布局实现水平排列
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.gridTemplateColumns = 'none';
    
    // 全局搜索过滤所有书签，添加匹配信息
    const allBookmarks = this.bookmarks.map(bookmark => {
      const title = bookmark.title.toLowerCase();
      const url = bookmark.url.toLowerCase();
      const searchLower = this.searchTerm.toLowerCase();
      
      const titleMatch = title.includes(searchLower);
      const urlMatch = url.includes(searchLower);
      
      if (titleMatch || urlMatch) {
        return {
          ...bookmark,
          matchType: titleMatch && urlMatch ? 'both' : (titleMatch ? 'title' : 'url'),
          matchScore: this.calculateMatchScore(bookmark.title, bookmark.url, this.searchTerm)
        };
      }
      return null;
    }).filter(Boolean);
    
    if (allBookmarks.length === 0) {
      this.showSearchEmptyState();
      return;
    }
    
    // 按匹配度排序
    allBookmarks.sort((a, b) => b.matchScore - a.matchScore);
    
    // 显示搜索统计
    const statsDiv = document.createElement('div');
    statsDiv.className = 'search-results-header';
    statsDiv.innerHTML = `
      <div class="search-results-title">搜索结果</div>
      <div class="search-results-meta">
        <span class="search-results-count">已搜索到 <strong>${allBookmarks.length}</strong> 个结果</span>
        <div class="search-results-actions">
          <button class="clear-search-btn" onclick="bookmarkManager.clearSearch()">清除搜索</button>
        </div>
      </div>
    `;
    grid.appendChild(statsDiv);
    
    // 创建水平排列的容器
    const containerDiv = document.createElement('div');
    containerDiv.className = 'search-results-container';
    
    // 按文件夹分组
    const groupedResults = this.groupBookmarksByFolder(allBookmarks);
    
    // 按文件夹名称排序
    const sortedFolderIds = Object.keys(groupedResults).sort((a, b) => {
      const folderA = this.folders.find(f => f.id === a);
      const folderB = this.folders.find(f => f.id === b);
      const nameA = folderA ? folderA.title : '其他';
      const nameB = folderB ? folderB.title : '其他';
      return nameA.localeCompare(nameB, 'zh-CN');
    });
    
    // 渲染每个分组
    sortedFolderIds.forEach((folderId, index) => {
      const folder = this.folders.find(f => f.id === folderId);
      const folderName = folder ? folder.title : '其他';
      const bookmarks = groupedResults[folderId];
      
      // 创建文件夹区域（可展开/收起）
      const folderSection = this.createSearchResultSection(folderId, folderName, bookmarks);
      containerDiv.appendChild(folderSection);
    });
    
    grid.appendChild(containerDiv);
  }

  groupBookmarksByFolder(bookmarks) {
    const grouped = {};
    
    bookmarks.forEach(bookmark => {
      const folderId = bookmark.parentId;
      if (!grouped[folderId]) {
        grouped[folderId] = [];
      }
      grouped[folderId].push(bookmark);
    });
    
    // 对每个文件夹内的书签按匹配度和名称排序
    Object.keys(grouped).forEach(folderId => {
      grouped[folderId].sort((a, b) => {
        // 首先按匹配度排序
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;
        }
        // 匹配度相同则按名称排序
        return a.title.localeCompare(b.title, 'zh-CN');
      });
    });
    
    return grouped;
  }

  createSearchResultSection(folderId, folderName, bookmarks) {
    const section = document.createElement('div');
    section.className = 'search-result-group';
    section.dataset.folderId = folderId;
    
    // 创建可折叠的文件夹标题
    const header = document.createElement('div');
    header.className = 'search-group-header';
    header.innerHTML = `
      <div class="folder-info">
        <span class="folder-icon">📁</span>
        <span class="folder-name">${this.escapeHtml(folderName)}</span>
      </div>
      <div class="result-info">
        <span class="result-count">${bookmarks.length}</span>
        <span class="collapse-icon">▼</span>
      </div>
    `;
    
    // 点击标题展开/收起
    header.addEventListener('click', () => {
      this.toggleSearchSection(section);
    });
    
    section.appendChild(header);
    
    // 创建书签网格容器
    const bookmarksGrid = document.createElement('div');
    bookmarksGrid.className = 'search-bookmarks-grid';
    
    // 创建书签网格（横向布局）
    bookmarks.forEach(bookmark => {
      const card = this.createSearchResultCard(bookmark);
      bookmarksGrid.appendChild(card);
    });
    
    section.appendChild(bookmarksGrid);
    
    return section;
  }

  toggleSearchSection(section) {
    const isCollapsed = section.classList.contains('collapsed');
    const collapseIcon = section.querySelector('.collapse-icon');
    const grid = section.querySelector('.search-bookmarks-grid');
    
    if (isCollapsed) {
      section.classList.remove('collapsed');
      collapseIcon.textContent = '▼';
      grid.style.display = 'flex';
    } else {
      section.classList.add('collapsed');
      collapseIcon.textContent = '▶';
      grid.style.display = 'none';
    }
  }

  /**
 * 创建搜索结果书签卡片（统一函数的便捷方法）
 * @param {Object} bookmark - 书签对象
 * @returns {HTMLElement} 书签卡片元素
 */
createSearchResultCard(bookmark) {
  return this.createBookmarkCard(bookmark, { 
    mode: 'search', 
    searchTerm: this.searchTerm 
  });
}

  clearSearch() {
    this.exitSearchState();
    this.renderBookmarks();
  }

  showSearchEmptyState() {
    const grid = document.getElementById('bookmarks-grid');
    const emptyState = document.createElement('div');
    emptyState.className = 'search-empty-state';
    emptyState.innerHTML = `
      <div class="search-empty-icon">🔍</div>
      <h3>未找到匹配的书签</h3>
      <p>尝试使用不同的关键词进行搜索</p>
      <button class="clear-search-btn" onclick="bookmarkManager.clearSearch()">清空搜索</button>
    `;
    
    grid.appendChild(emptyState);
  }

  // 高亮文本中的关键词
  highlightText(text, query) {
    if (!query) return this.escapeHtml(text);
    
    const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<mark class="highlight">$1</mark>');
  }

  // 转义正则表达式特殊字符
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 计算匹配度分数
  calculateMatchScore(title, url, query) {
    const lowerQuery = query.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const lowerUrl = url.toLowerCase();
    
    let score = 0;
    
    // 标题完全匹配
    if (lowerTitle === lowerQuery) {
      score += 100;
    }
    // 标题开头匹配
    else if (lowerTitle.startsWith(lowerQuery)) {
      score += 80;
    }
    // 标题包含匹配
    else if (lowerTitle.includes(lowerQuery)) {
      score += 60;
    }
    
    // URL完全匹配
    if (lowerUrl === lowerQuery) {
      score += 70;
    }
    // URL开头匹配
    else if (lowerUrl.startsWith(lowerQuery)) {
      score += 50;
    }
    // URL包含匹配
    else if (lowerUrl.includes(lowerQuery)) {
      score += 30;
    }
    
    // 匹配位置因素（越靠前越相关）
    const titleMatchIndex = lowerTitle.indexOf(lowerQuery);
    if (titleMatchIndex !== -1) {
      score += Math.max(0, 20 - titleMatchIndex);
    }
    
    return score;
  }

  // ==================== 智能检测相关方法 ====================
  
  /**
   * 绑定工具栏事件
   */
  bindToolbarEvents() {
    // 健康检查按钮
    document.getElementById('check-all-btn').addEventListener('click', () => {
      this.startCheckAll();
    });

    // 选中检查按钮
    document.getElementById('check-selected-btn').addEventListener('click', () => {
      this.startCheckSelected();
    });

    // 显示无效按钮
    document.getElementById('show-invalid-btn').addEventListener('click', () => {
      this.toggleInvalidFilter();
    });

    // 清理无效按钮
    document.getElementById('cleanup-btn').addEventListener('click', () => {
      this.cleanupInvalidBookmarks();
    });

    
    // 退出检测模式按钮
    document.getElementById('exit-check-mode-btn').addEventListener('click', () => {
      this.exitCheckMode();
    });
  }

  /**
   * 开始检查所有书签
   */
  async startCheckAll() {
    if (this.isChecking) {
      this.showMessage('检测正在进行中，请稍候...');
      return;
    }

    const bookmarksToCheck = this.getCurrentBookmarks();
    if (bookmarksToCheck.length === 0) {
      this.showMessage('当前文件夹没有书签需要检查');
      return;
    }

    // 进入检测模式
    this.isCheckMode = true;

    const folderName = this.getCurrentFolderName();
    const rangeText = folderName ? `当前分类"${folderName}"` : '所有书签';
    this.showMessage(`开始检测 ${rangeText} 中的 ${bookmarksToCheck.length} 个书签...`);

    await this.performBatchCheck(bookmarksToCheck);
  }

  /**
   * 开始检查选中的书签
   */
  async startCheckSelected() {
    if (this.isChecking) {
      this.showMessage('检测正在进行中，请稍候...');
      return;
    }

    const selectedCards = document.querySelectorAll('.bookmark-card.selected');
    if (selectedCards.length === 0) {
      this.showMessage('请先选择要检查的书签');
      return;
    }

    // 进入检测模式
    this.isCheckMode = true;

    const selectedBookmarks = Array.from(selectedCards).map(card => ({
      id: card.dataset.bookmarkId,
      url: card.dataset.bookmarkUrl,
      title: card.dataset.bookmarkTitle
    }));

    await this.performBatchCheck(selectedBookmarks);
  }

  /**
   * 执行批量检查
   */
  async performBatchCheck(bookmarks) {
    this.isChecking = true;
    this.checkStats = {
      total: bookmarks.length,
      processed: 0,
      valid: 0,
      invalid: 0,
      redirect: 0,
      timeout: 0
    };

    this.showProgress();
    this.updateProgress();

    try {
      const batchProcessor = new BatchProcessor(3); // 限制并发数为3
      
      await batchProcessor.process(bookmarks, async (bookmark) => {
        const result = await this.linkChecker.check(bookmark.url);
        this.processCheckResult(bookmark, result);
        this.checkStats.processed++;
        this.updateProgress();
        this.updateBookmarkCardStatus(bookmark.id, result);
      });

      this.showCheckComplete();
      this.showFilterToolbar();
      
    } catch (error) {
      console.error('批量检测失败:', error);
      this.showMessage('检测过程中出现错误: ' + error.message);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 处理检测结果
   */
  processCheckResult(bookmark, result) {
    this.checkResults.set(bookmark.id, {
      ...bookmark,
      ...result,
      checkedAt: Date.now()
    });

    // 更新统计
    switch (result.status) {
      case 'valid':
        this.checkStats.valid++;
        break;
      case 'invalid':
        this.checkStats.invalid++;
        break;
      case 'redirect':
        this.checkStats.redirect++;
        break;
      case 'timeout':
        this.checkStats.timeout++;
        break;
    }
  }

  /**
   * 显示进度条
   */
  showProgress() {
    const progressContainer = document.getElementById('check-progress');
    progressContainer.style.display = 'block';
    
    // 隐藏筛选器
    document.getElementById('filter-toolbar').style.display = 'none';
  }

  /**
   * 更新进度
   */
  updateProgress() {
    const { total, processed, valid, invalid, redirect, timeout } = this.checkStats;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

    document.getElementById('progress-count').textContent = `${processed}/${total}`;
    document.getElementById('progress-percent').textContent = `(${percentage}%)`;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
    document.getElementById('valid-count').textContent = valid;
    document.getElementById('redirect-count').textContent = redirect;
    document.getElementById('invalid-count').textContent = invalid;
  }

  /**
   * 显示检测完成
   */
  showCheckComplete() {
    setTimeout(() => {
      document.getElementById('check-progress').style.display = 'none';
      const { valid, invalid, redirect, timeout } = this.checkStats;
      this.showMessage(`检测完成！有效: ${valid}, 无效: ${invalid}, 重定向: ${redirect}, 超时: ${timeout}`);
      
      // 自动切换到分组显示模式
      if (this.checkResults.size > 0) {
        this.switchToGroupedView();
      }
    }, 2000);
  }

  /**
   * 显示筛选工具栏
   */
  showFilterToolbar() {
    document.getElementById('filter-toolbar').style.display = 'flex';
  }

  /**
   * 更新书签卡片状态
   */
  updateBookmarkCardStatus(bookmarkId, result) {
    const card = document.querySelector(`[data-bookmark-id="${bookmarkId}"]`);
    if (!card) return;

    // 移除检测状态类（保留selected等交互类）
    card.classList.remove('checking');
    
    // 更新或添加状态标签
    let statusBadge = card.querySelector('.status-badge');
    if (!statusBadge) {
      statusBadge = document.createElement('div');
      statusBadge.className = 'status-badge';
      card.appendChild(statusBadge);
    }
    
    statusBadge.className = `status-badge ${result.status}`;
    
    const statusTexts = {
      valid: '有效',
      invalid: '无效',
      redirect: '重定向',
      timeout: '超时'
    };
    
    statusBadge.textContent = statusTexts[result.status] || '未知';
  }

  /**
   * 切换无效链接筛选
   */
  toggleInvalidFilter() {
    const showInvalid = document.getElementById('filter-invalid').checked;
    document.getElementById('filter-invalid').checked = !showInvalid;
    this.applyFilters();
  }

  /**
   * 应用筛选器
   */
  applyFilters() {
    const showValid = document.getElementById('filter-valid').checked;
    const showRedirect = document.getElementById('filter-redirect').checked;
    const showTimeout = document.getElementById('filter-timeout').checked;
    const showInvalid = document.getElementById('filter-invalid').checked;

    const cards = document.querySelectorAll('.bookmark-card');
    cards.forEach(card => {
      const status = this.getCardStatus(card);
      let shouldShow = false;

      if (status === 'valid' && showValid) shouldShow = true;
      if (status === 'redirect' && showRedirect) shouldShow = true;
      if (status === 'timeout' && showTimeout) shouldShow = true;
      if (status === 'invalid' && showInvalid) shouldShow = true;

      card.style.display = shouldShow ? 'block' : 'none';
    });
  }

  /**
   * 获取卡片状态
   */
  getCardStatus(card) {
    const statusBadge = card.querySelector('.status-badge');
    if (!statusBadge) return 'unknown';
    
    if (statusBadge.classList.contains('valid')) return 'valid';
    if (statusBadge.classList.contains('invalid')) return 'invalid';
    if (statusBadge.classList.contains('redirect')) return 'redirect';
    if (statusBadge.classList.contains('timeout')) return 'timeout';
    
    return 'unknown';
  }

  /**
   * 清理无效书签
   */
  cleanupInvalidBookmarks() {
    const invalidBookmarks = [];
    this.checkResults.forEach((result, bookmarkId) => {
      if (result.status === 'invalid' || result.status === 'timeout') {
        invalidBookmarks.push(result);
      }
    });

    if (invalidBookmarks.length === 0) {
      this.showMessage('没有发现无效书签');
      return;
    }

    const timeoutCount = invalidBookmarks.filter(b => b.status === 'timeout').length;
    const invalidCount = invalidBookmarks.filter(b => b.status === 'invalid').length;
    
    if (confirm(`确定要删除 ${invalidBookmarks.length} 个无效书签吗？\n(无效: ${invalidCount}, 超时: ${timeoutCount})`)) {
      invalidBookmarks.forEach(bookmark => {
        this.deleteBookmark(bookmark.id);
      });
      this.showMessage(`已删除 ${invalidBookmarks.length} 个无效书签`);
    }
  }

  /**
   * 更新单个书签的URL
   */
  async updateBookmarkUrl(bookmarkId, newUrl) {
    try {
      await chrome.bookmarks.update(bookmarkId, { url: newUrl });
      
      // 更新本地数据
      const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
      if (bookmark) {
        bookmark.url = newUrl;
      }
      
      // 更新检测结果
      if (this.checkResults.has(bookmarkId)) {
        const result = this.checkResults.get(bookmarkId);
        result.url = newUrl;
        result.finalUrl = newUrl;
        result.status = 'valid';
      }
      
      // 重新渲染书签卡片
      this.renderBookmarks();
      
    } catch (error) {
      console.error(`更新书签URL失败:`, error);
      throw error;
    }
  }

  /**
   * 更新重定向链接
   */
  async updateRedirects() {
    const redirects = [];
    this.checkResults.forEach((result, bookmarkId) => {
      if (result.status === 'redirect' && result.finalUrl && result.finalUrl !== result.url) {
        redirects.push(result);
      }
    });

    if (redirects.length === 0) {
      this.showMessage('没有发现需要更新的重定向链接');
      return;
    }

    const confirmed = confirm(`发现 ${redirects.length} 个重定向链接，是否要更新为最终URL？`);
    if (!confirmed) return;

    for (const bookmark of redirects) {
      try {
        await this.updateBookmarkUrl(bookmark.id, bookmark.finalUrl);
      } catch (error) {
        console.error(`更新书签 ${bookmark.id} 失败:`, error);
      }
    }

    this.showMessage(`已更新 ${redirects.length} 个重定向链接`);
  }

  /**
   * 导出检测结果
   */
  exportCheckResults() {
    const results = Array.from(this.checkResults.values());
    const csv = this.convertToCSV(results);
    this.downloadCSV(csv, `bookmark-check-results-${new Date().toISOString().split('T')[0]}.csv`);
    this.showMessage(`已导出 ${results.length} 条检测结果`);
  }

  /**
   * 转换为CSV格式
   */
  convertToCSV(data) {
    const headers = ['ID', '标题', '原始URL', '状态', 'HTTP状态码', '最终URL', '响应时间', '检测时间'];
    const rows = data.map(item => [
      item.id,
      `"${item.title}"`,
      `"${item.url}"`,
      item.status,
      item.statusCode || '',
      `"${item.finalUrl || ''}"`,
      item.responseTime || '',
      new Date(item.checkedAt).toLocaleString()
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * 下载CSV文件
   */
  downloadCSV(csv, filename) {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /**
   * 显示消息提示
   */
  showMessage(message) {
    // 创建临时提示元素
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2c3e50;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      font-size: 14px;
      max-width: 300px;
      word-wrap: break-word;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // ==================== 分组显示相关方法 ====================

  /**
   * 切换显示模式
   */
  toggleViewMode() {
    if (this.isGroupedView) {
      this.switchToNormalView();
    } else {
      this.switchToGroupedView();
    }
  }

  /**
   * 切换到分组显示
   */
  switchToGroupedView() {
    if (this.checkResults.size === 0) {
      this.showMessage('没有检测结果，无法显示分组');
      return;
    }

    this.isGroupedView = true;
    
    // 隐藏正常书签网格
    document.getElementById('bookmarks-grid').style.display = 'none';
    
    // 显示分组容器
    document.getElementById('results-grouped').style.display = 'block';
    
    // 渲染分组内容
    this.renderGroupedResults();
    
    // 绑定分组事件
    this.bindGroupEvents();
    
    this.showMessage('已切换到分组显示模式');
  }

  /**
   * 切换到正常显示
   */
  switchToNormalView() {
    this.isGroupedView = false;
    
    // 显示正常书签网格
    document.getElementById('bookmarks-grid').style.display = 'grid';
    
    // 隐藏分组容器
    document.getElementById('results-grouped').style.display = 'none';
    
    this.showMessage('已切换到正常显示模式');
  }

  /**
   * 渲染分组结果
   */
  renderGroupedResults() {
    // 按状态分组结果
    const groupedResults = {
      valid: [],
      redirect: [],
      timeout: [],
      invalid: []
    };

    this.checkResults.forEach((result) => {
      if (groupedResults[result.status]) {
        groupedResults[result.status].push(result);
      }
    });

    // 渲染每个分组
    Object.keys(groupedResults).forEach(status => {
      this.renderResultGroup(status, groupedResults[status]);
    });
  }

  /**
   * 渲染单个结果分组
   */
  renderResultGroup(status, bookmarks) {
    const group = document.querySelector(`[data-status="${status}"]`);
    if (!group) return;

    // 更新分组数量
    const countElement = group.querySelector('.group-count');
    countElement.textContent = `(${bookmarks.length})`;

    // 获取分组内容容器
    const content = group.querySelector('.group-bookmarks-grid');
    content.innerHTML = '';

    // 如果没有书签，显示空状态
    if (bookmarks.length === 0) {
      content.innerHTML = `
        <div class="empty-group-state">
          <div class="empty-icon">📭</div>
          <p>此分组暂无书签</p>
        </div>
      `;
      return;
    }

    // 渲染书签卡片
    bookmarks.forEach(bookmark => {
      const card = this.createBookmarkCard(bookmark);
      
      // 添加检测状态标签
      const statusBadge = document.createElement('div');
      statusBadge.className = `status-badge ${bookmark.status}`;
      const statusTexts = {
        valid: '有效',
        invalid: '无效',
        redirect: '重定向',
        timeout: '超时'
      };
      statusBadge.textContent = statusTexts[bookmark.status] || '未知';
      card.appendChild(statusBadge);
      
      content.appendChild(card);
    });
  }

  /**
   * 绑定分组事件
   */
  bindGroupEvents() {
    // 分组折叠/展开事件
    document.querySelectorAll('.group-collapse-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const group = btn.closest('.result-group');
        group.classList.toggle('collapsed');
      });
    });

    // 分组头部点击事件
    document.querySelectorAll('.group-header').forEach(header => {
      header.addEventListener('click', () => {
        const group = header.closest('.result-group');
        group.classList.toggle('collapsed');
      });
    });

    // 分组操作按钮事件
    this.bindGroupActionEvents();
  }

  /**
   * 绑定分组操作事件
   */
  bindGroupActionEvents() {
    // 重定向分组 - 批量更新
    const redirectUpdateBtn = document.querySelector('[data-status="redirect"] .group-action-btn');
    if (redirectUpdateBtn) {
      redirectUpdateBtn.addEventListener('click', () => {
        this.updateRedirects();
      });
    }

    // 超时分组 - 重新检测
    const timeoutRecheckBtn = document.querySelector('[data-status="timeout"] .group-action-btn');
    if (timeoutRecheckBtn) {
      timeoutRecheckBtn.addEventListener('click', () => {
        this.recheckTimeoutBookmarks();
      });
    }

    // 无效分组 - 批量删除
    const invalidDeleteBtn = document.querySelector('[data-status="invalid"] .group-action-btn');
    if (invalidDeleteBtn) {
      invalidDeleteBtn.addEventListener('click', () => {
        this.cleanupInvalidBookmarks();
      });
    }
  }

  /**
   * 重新检测超时书签
   */
  async recheckTimeoutBookmarks() {
    const timeoutBookmarks = Array.from(this.checkResults.values())
      .filter(result => result.status === 'timeout');

    if (timeoutBookmarks.length === 0) {
      this.showMessage('没有超时的书签需要重新检测');
      return;
    }

    if (confirm(`确定要重新检测 ${timeoutBookmarks.length} 个超时书签吗？`)) {
      this.showMessage(`开始重新检测 ${timeoutBookmarks.length} 个超时书签...`);
      
      // 从结果中移除超时书签，然后重新检测
      timeoutBookmarks.forEach(bookmark => {
        this.checkResults.delete(bookmark.id);
      });

      await this.performBatchCheck(timeoutBookmarks);
    }
  }

  /**
   * 获取当前文件夹名称
   */
  getCurrentFolderName() {
    if (this.currentFolder === null) {
      return null;
    }
    
    const folder = this.folders.find(f => f.id === this.currentFolder);
    return folder ? folder.title : '未知分类';
  }

  /**
   * 退出检测模式
   */
  exitCheckMode() {
    // 退出检测模式
    this.isCheckMode = false;

    // 如果在分组显示模式，先切换到正常模式
    if (this.isGroupedView) {
      this.switchToNormalView();
    }

    // 清除所有状态标签
    const cards = document.querySelectorAll('.bookmark-card');
    cards.forEach(card => {
      // 移除状态类
      card.classList.remove('valid', 'invalid', 'redirect', 'timeout', 'checking');
      
      // 移除状态标签
      const statusBadge = card.querySelector('.status-badge');
      if (statusBadge) {
        statusBadge.remove();
      }
      
      // 确保卡片可见
      card.style.display = 'block';
    });

    // 隐藏筛选工具栏
    document.getElementById('filter-toolbar').style.display = 'none';

    // 清空检测结果
    this.checkResults.clear();

    // 显示退出消息
    this.showMessage('已退出检测模式，恢复正常书签列表');
  }

  /**
   * 获取当前显示的书签
   */
  getCurrentBookmarks() {
    let bookmarksToCheck;
    
    if (this.currentFolder === null) {
      // 如果没有选择文件夹，检测所有书签
      bookmarksToCheck = this.bookmarks;
    } else {
      // 只检测当前文件夹的书签
      bookmarksToCheck = this.bookmarks.filter(b => b.parentId === this.currentFolder);
    }
    
    return bookmarksToCheck.map(bookmark => ({
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title
    }));
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 初始化书签管理器
let bookmarkManager;
document.addEventListener('DOMContentLoaded', () => {
  bookmarkManager = new BookmarkManager();
});