/**
 * main.js
 * 主页面的JavaScript文件，负责初始化和协调各个功能模块
 */

// 导入所需模块
import bookmarkManager from './bookmarkManager.js';
import folderTree from './folderTree.js';
import dragDropManager from './dragDrop.js';
import urlValidator from './urlValidator.js';
import visitTracker from './visitTracker.js';
import suggestionManager from './suggestionManager.js';

class BookmarkApp {
  constructor() {
    // 状态管理
    this.currentFolderId = '1'; // 默认为书签栏
    this.currentFolderName = '书签栏';
    this.selectedBookmarks = new Set();
    this.viewMode = 'list'; // 列表模式 或 'grid' 网格模式
    
    // DOM 元素引用
    this.elements = {
      folderTree: document.getElementById('folderTree'),
      bookmarkList: document.getElementById('bookmarkList'),
      currentFolderName: document.getElementById('currentFolderName'),
      bookmarkCount: document.getElementById('bookmarkCount'),
      searchInput: document.getElementById('searchInput'),
      searchBtn: document.getElementById('searchBtn'),
      filterSelect: document.getElementById('filterSelect'),
      checkValidityBtn: document.getElementById('checkValidityBtn'),
      refreshBtn: document.getElementById('refreshBtn'),
      settingsBtn: document.getElementById('settingsBtn'),
      addFolderBtn: document.getElementById('addFolderBtn'),
      addBookmarkBtn: document.getElementById('addBookmarkBtn'),
      sortBookmarksBtn: document.getElementById('sortBookmarksBtn'),
      listViewBtn: document.getElementById('listViewBtn'),
      gridViewBtn: document.getElementById('gridViewBtn'),
      contextMenu: document.getElementById('contextMenu'),
      folderContextMenu: document.getElementById('folderContextMenu'),
      statusMessage: document.getElementById('statusMessage'),
      exportBtn: document.getElementById('exportBtn'),
      importBtn: document.getElementById('importBtn'),
      helpBtn: document.getElementById('helpBtn')
    };
  }

  /**
   * 初始化应用
   */
  async init() {
    try {
      // 显示加载状态
      this.updateStatus('正在初始化应用...');
      
      // 初始化文件夹树
      await this.initFolderTree();
      
      // 初始化拖放功能
      this.initDragDrop();
      
      // 初始化UI事件监听器
      this.initEventListeners();
      
      // 初始化右键菜单
      this.initContextMenus();
      
      // 加载并显示书签
      await this.loadBookmarks(this.currentFolderId);
      
      // 检查并显示智能收藏建议
      this.checkBookmarkSuggestions();
      
      this.updateStatus('就绪');
    } catch (error) {
      console.error('初始化应用失败:', error);
      this.updateStatus('初始化应用失败', 'error');
    }
  }

  /**
   * 初始化文件夹树
   */
  async initFolderTree() {
    folderTree.init(this.elements.folderTree, (folderId, folderName) => {
      this.currentFolderId = folderId;
      this.currentFolderName = folderName;
      this.loadBookmarks(folderId);
    });
  }

  /**
   * 初始化拖放功能
   */
  initDragDrop() {
    dragDropManager.init('#bookmarkList', '#folderTree', () => {
      // 排序变化后刷新视图
      this.loadBookmarks(this.currentFolderId);
    });
  }

  /**
   * 初始化事件监听器
   */
  initEventListeners() {
    // 搜索功能
    this.elements.searchBtn.addEventListener('click', () => this.performSearch());
    this.elements.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.performSearch();
    });
    
    // 过滤选择
    this.elements.filterSelect.addEventListener('change', () => this.applyFilter());
    
    // 工具栏按钮
    this.elements.checkValidityBtn.addEventListener('click', () => this.checkBookmarksValidity());
    this.elements.refreshBtn.addEventListener('click', () => this.refreshView());
    this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
    
    // 文件夹和书签操作
    this.elements.addFolderBtn.addEventListener('click', () => this.createNewFolder());
    this.elements.addBookmarkBtn.addEventListener('click', () => this.createNewBookmark());
    this.elements.sortBookmarksBtn.addEventListener('click', () => this.openSortOptions());
    
    // 视图切换
    this.elements.listViewBtn.addEventListener('click', () => this.switchViewMode('list'));
    this.elements.gridViewBtn.addEventListener('click', () => this.switchViewMode('grid'));
    
    // 底部操作按钮
    this.elements.exportBtn.addEventListener('click', () => this.exportBookmarks());
    this.elements.importBtn.addEventListener('click', () => this.importBookmarks());
    this.elements.helpBtn.addEventListener('click', () => this.showHelp());
    
    // 全局键盘快捷键
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
  }

  /**
   * 初始化右键菜单
   */
  initContextMenus() {
    // 书签右键菜单
    const menuItems = this.elements.contextMenu.querySelectorAll('li');
    
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const action = e.target.id;
        this.handleContextMenuAction(action);
      });
    });
    
    // 文件夹右键菜单
    const folderMenuItems = this.elements.folderContextMenu.querySelectorAll('li');
    
    folderMenuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const action = e.target.id;
        this.handleFolderContextMenuAction(action);
      });
    });
    
    // 点击文档其他地方关闭右键菜单
    document.addEventListener('click', () => {
      this.elements.contextMenu.style.display = 'none';
      this.elements.folderContextMenu.style.display = 'none';
    });
    
    // 禁用浏览器默认右键菜单
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#bookmarkList') || e.target.closest('#folderTree')) {
        e.preventDefault();
      }
    });
  }

  /**
   * 加载指定文件夹下的书签
   * @param {string} folderId - 文件夹ID 
   */
  async loadBookmarks(folderId) {
    try {
      this.updateStatus('加载书签中...');
      
      // 获取书签
      const bookmarks = await bookmarkManager.getBookmarks(folderId);
      
      // 更新UI
      this.elements.currentFolderName.textContent = this.currentFolderName;
      this.elements.bookmarkCount.textContent = `${bookmarks.length} 个项目`;
      
      // 清空并渲染书签列表
      this.renderBookmarkList(bookmarks);
      
      this.updateStatus('就绪');
    } catch (error) {
      console.error('加载书签失败:', error);
      this.updateStatus('加载书签失败', 'error');
    }
  }

  /**
   * 渲染书签列表
   * @param {Array} bookmarks - 书签数组
   */
  renderBookmarkList(bookmarks) {
    const bookmarkList = this.elements.bookmarkList;
    bookmarkList.innerHTML = '';
    
    if (bookmarks.length === 0) {
      bookmarkList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-text">此文件夹中还没有书签</div>
          <button id="emptyAddBtn" class="btn btn-primary">添加书签</button>
        </div>
      `;
      
      document.getElementById('emptyAddBtn')?.addEventListener('click', () => this.createNewBookmark());
      return;
    }
    
    const fragment = document.createDocumentFragment();
    
    bookmarks.forEach(bookmark => {
      const bookmarkElement = this.createBookmarkElement(bookmark);
      fragment.appendChild(bookmarkElement);
    });
    
    bookmarkList.appendChild(fragment);
  }

  /**
   * 创建单个书签元素
   * @param {Object} bookmark - 书签对象
   * @returns {HTMLElement} 书签DOM元素
   */
  createBookmarkElement(bookmark) {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    item.dataset.id = bookmark.id;
    item.dataset.url = bookmark.url || '';
    
    // 是文件夹还是书签
    const isFolder = !bookmark.url;
    
    // 创建图标
    const icon = document.createElement('div');
    icon.className = 'bookmark-icon';
    
    if (isFolder) {
      icon.classList.add('folder');
      icon.innerHTML = '📁';
    } else {
      // 使用favicon作为图标
      const faviconUrl = `chrome://favicon/${bookmark.url}`;
      icon.style.backgroundImage = `url('${faviconUrl}')`;
    }
    
    // 创建内容区域
    const content = document.createElement('div');
    content.className = 'bookmark-content';
    
    const title = document.createElement('div');
    title.className = 'bookmark-title';
    title.textContent = bookmark.title || (isFolder ? '未命名文件夹' : '未命名书签');
    
    content.appendChild(title);
    
    if (!isFolder) {
      const url = document.createElement('div');
      url.className = 'bookmark-url';
      url.textContent = bookmark.url;
      content.appendChild(url);
    }
    
    // 添加到项目中
    item.appendChild(icon);
    item.appendChild(content);
    
    // 添加操作按钮
    const actions = document.createElement('div');
    actions.className = 'bookmark-actions';
    
    if (!isFolder) {
      // 仅为书签添加操作按钮
      const editBtn = document.createElement('button');
      editBtn.className = 'bookmark-action-btn';
      editBtn.innerHTML = '✏️';
      editBtn.title = '编辑';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editBookmark(bookmark);
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'bookmark-action-btn';
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.title = '删除';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteBookmark(bookmark.id);
      });
      
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
    } else {
      // 文件夹操作
      const openBtn = document.createElement('button');
      openBtn.className = 'bookmark-action-btn';
      openBtn.innerHTML = '📂';
      openBtn.title = '打开';
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openFolder(bookmark.id, bookmark.title);
      });
      
      actions.appendChild(openBtn);
    }
    
    item.appendChild(actions);
    
    // 添加事件监听器
    item.addEventListener('click', () => this.handleBookmarkClick(bookmark));
    item.addEventListener('contextmenu', (e) => this.showBookmarkContextMenu(e, bookmark));
    
    return item;
  }

  /**
   * 处理书签点击事件
   * @param {Object} bookmark - 书签对象
   */
  handleBookmarkClick(bookmark) {
    if (bookmark.url) {
      // 如果是书签，打开链接
      chrome.tabs.create({ url: bookmark.url });
    } else {
      // 如果是文件夹，打开文件夹
      this.openFolder(bookmark.id, bookmark.title);
    }
  }
  
  /**
   * 打开文件夹
   * @param {string} folderId - 文件夹ID
   * @param {string} folderName - 文件夹名称
   */
  openFolder(folderId, folderName) {
    this.currentFolderId = folderId;
    this.currentFolderName = folderName;
    
    // 在文件夹树中选中该文件夹
    folderTree.expandToFolder(folderId);
    
    // 加载书签
    this.loadBookmarks(folderId);
  }

  /**
   * 显示书签右键菜单
   * @param {Event} event - 右键点击事件
   * @param {Object} bookmark - 书签对象
   */
  showBookmarkContextMenu(event, bookmark) {
    event.preventDefault();
    event.stopPropagation();
    
    const menu = this.elements.contextMenu;
    menu.style.top = `${event.clientY}px`;
    menu.style.left = `${event.clientX}px`;
    menu.style.display = 'block';
    
    // 保存当前右键点击的书签
    this.contextMenuTarget = bookmark;
    
    // 禁用/启用特定菜单项
    const cmOpen = document.getElementById('cmOpen');
    const cmOpenNewTab = document.getElementById('cmOpenNewTab');
    const cmCopyUrl = document.getElementById('cmCopyUrl');
    
    if (!bookmark.url) {
      // 如果是文件夹，禁用URL相关操作
      cmOpen.classList.add('disabled');
      cmOpenNewTab.classList.add('disabled');
      cmCopyUrl.classList.add('disabled');
    } else {
      cmOpen.classList.remove('disabled');
      cmOpenNewTab.classList.remove('disabled');
      cmCopyUrl.classList.remove('disabled');
    }
  }

  /**
   * 处理右键菜单操作
   * @param {string} action - 操作ID 
   */
  handleContextMenuAction(action) {
    const bookmark = this.contextMenuTarget;
    if (!bookmark) return;
    
    switch (action) {
      case 'cmOpen':
        if (bookmark.url) {
          chrome.tabs.update({ url: bookmark.url });
        }
        break;
        
      case 'cmOpenNewTab':
        if (bookmark.url) {
          chrome.tabs.create({ url: bookmark.url });
        }
        break;
        
      case 'cmEdit':
        this.editBookmark(bookmark);
        break;
        
      case 'cmDelete':
        this.deleteBookmark(bookmark.id);
        break;
        
      case 'cmMove':
        this.showMoveBookmarkDialog(bookmark);
        break;
        
      case 'cmCopyUrl':
        if (bookmark.url) {
          navigator.clipboard.writeText(bookmark.url)
            .then(() => this.updateStatus('链接已复制到剪贴板'))
            .catch(err => this.updateStatus('复制链接失败', 'error'));
        }
        break;
    }
    
    // 隐藏菜单
    this.elements.contextMenu.style.display = 'none';
  }
  
  /**
   * 处理文件夹右键菜单操作
   * @param {string} action - 操作ID 
   */
  handleFolderContextMenuAction(action) {
    if (!folderTree.selectedFolder) return;
    
    const folderId = folderTree.getSelectedFolderId();
    
    switch (action) {
      case 'fcmCreateFolder':
        this.createNewFolder();
        break;
        
      case 'fcmRename':
        this.renameFolder(folderId);
        break;
        
      case 'fcmDelete':
        this.deleteFolder(folderId);
        break;
        
      case 'fcmAddBookmark':
        this.createNewBookmark(folderId);
        break;
    }
    
    // 隐藏菜单
    this.elements.folderContextMenu.style.display = 'none';
  }

  /**
   * 执行搜索
   */
  performSearch() {
    const query = this.elements.searchInput.value.trim();
    
    if (!query) {
      // 如果搜索框为空，显示当前文件夹书签
      this.loadBookmarks(this.currentFolderId);
      return;
    }
    
    this.searchBookmarks(query);
  }

  /**
   * 搜索书签
   * @param {string} query - 搜索查询 
   */
  async searchBookmarks(query) {
    try {
      this.updateStatus(`搜索: ${query}`);
      
      const searchResults = await bookmarkManager.searchBookmarks(query);
      
      // 更新UI
      this.elements.currentFolderName.textContent = `搜索结果: "${query}"`;
      this.elements.bookmarkCount.textContent = `${searchResults.length} 个项目`;
      
      // 渲染搜索结果
      this.renderBookmarkList(searchResults);
      
      this.updateStatus(`找到 ${searchResults.length} 个结果`);
    } catch (error) {
      console.error('搜索书签失败:', error);
      this.updateStatus('搜索失败', 'error');
    }
  }

  /**
   * 应用过滤器
   */
  async applyFilter() {
    const filter = this.elements.filterSelect.value;
    
    try {
      switch (filter) {
        case 'all':
          // 显示当前文件夹所有书签
          this.loadBookmarks(this.currentFolderId);
          break;
          
        case 'recent':
          // 显示最近添加的书签
          const recentBookmarks = await bookmarkManager.getRecentBookmarks();
          this.renderFilterResults('最近添加的书签', recentBookmarks);
          break;
          
        case 'frequent':
          // 显示经常访问的书签
          const visitStats = await visitTracker.getVisitStats(null, 'week', 20);
          const frequentBookmarks = await this.getBookmarksByUrls(
            visitStats.map(stat => stat.url)
          );
          this.renderFilterResults('经常访问的书签', frequentBookmarks);
          break;
          
        case 'suggested':
          // 显示推荐收藏的网站
          const suggestions = await suggestionManager.analyzeUrlsForSuggestion();
          this.renderSuggestions(suggestions);
          break;
      }
    } catch (error) {
      console.error('应用过滤器失败:', error);
      this.updateStatus('应用过滤器失败', 'error');
    }
  }
  
  /**
   * 根据URL数组获取书签
   * @param {Array<string>} urls - URL数组 
   * @returns {Promise<Array>} 书签数组
   */
  async getBookmarksByUrls(urls) {
    const results = [];
    
    for (const url of urls) {
      const bookmarks = await bookmarkManager.searchBookmarks({ url: `*${url}*` });
      results.push(...bookmarks);
    }
    
    return results;
  }
  
  /**
   * 渲染过滤结果
   * @param {string} title - 结果标题
   * @param {Array} bookmarks - 书签数组 
   */
  renderFilterResults(title, bookmarks) {
    // 更新UI
    this.elements.currentFolderName.textContent = title;
    this.elements.bookmarkCount.textContent = `${bookmarks.length} 个项目`;
    
    // 渲染书签列表
    this.renderBookmarkList(bookmarks);
  }
  
  /**
   * 渲染收藏建议
   * @param {Array} suggestions - 建议数组
   */
  renderSuggestions(suggestions) {
    const bookmarkList = this.elements.bookmarkList;
    bookmarkList.innerHTML = '';
    
    if (suggestions.length === 0) {
      bookmarkList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-text">暂时没有收藏建议</div>
          <p>当您经常访问某些网站时，系统会在此处显示收藏建议。</p>
        </div>
      `;
      return;
    }
    
    // 更新UI
    this.elements.currentFolderName.textContent = '推荐收藏的网站';
    this.elements.bookmarkCount.textContent = `${suggestions.length} 个建议`;
    
    const fragment = document.createDocumentFragment();
    
    suggestions.forEach(suggestion => {
      const item = document.createElement('div');
      item.className = 'bookmark-item suggestion-item';
      
      // 创建图标
      const icon = document.createElement('div');
      icon.className = 'bookmark-icon';
      const faviconUrl = `chrome://favicon/https://${suggestion.url}`;
      icon.style.backgroundImage = `url('${faviconUrl}')`;
      
      // 创建内容区域
      const content = document.createElement('div');
      content.className = 'bookmark-content';
      
      const title = document.createElement('div');
      title.className = 'bookmark-title';
      title.textContent = suggestion.title || suggestion.url;
      
      const url = document.createElement('div');
      url.className = 'bookmark-url';
      url.textContent = suggestion.url;
      
      content.appendChild(title);
      content.appendChild(url);
      
      // 添加访问次数
      const stats = document.createElement('div');
      stats.className = 'bookmark-stats';
      
      const visitCount = document.createElement('span');
      visitCount.className = 'visit-count visit-count-high';
      visitCount.innerHTML = `<span class="visit-count-icon">🔍</span> ${suggestion.visits}次访问`;
      
      stats.appendChild(visitCount);
      
      // 添加操作按钮
      const actions = document.createElement('div');
      actions.className = 'bookmark-actions';
      actions.style.display = 'flex';
      
      const addBtn = document.createElement('button');
      addBtn.className = 'bookmark-action-btn';
      addBtn.innerHTML = '➕';
      addBtn.title = '添加到书签';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addSuggestionToBookmarks(suggestion);
      });
      
      const ignoreBtn = document.createElement('button');
      ignoreBtn.className = 'bookmark-action-btn';
      ignoreBtn.innerHTML = '✕';
      ignoreBtn.title = '忽略';
      ignoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ignoreSuggestion(suggestion);
        item.remove();
      });
      
      actions.appendChild(addBtn);
      actions.appendChild(ignoreBtn);
      
      // 组装项目
      item.appendChild(icon);
      item.appendChild(content);
      item.appendChild(stats);
      item.appendChild(actions);
      
      // 添加点击事件
      item.addEventListener('click', () => {
        const url = `https://${suggestion.url}`;
        chrome.tabs.create({ url });
      });
      
      fragment.appendChild(item);
    });
    
    bookmarkList.appendChild(fragment);
  }
  
  /**
   * 添加建议到书签
   * @param {Object} suggestion - 建议对象
   */
  async addSuggestionToBookmarks(suggestion) {
    try {
      const url = `https://${suggestion.url}`;
      
      await bookmarkManager.createBookmark({
        parentId: this.currentFolderId,
        title: suggestion.title || suggestion.url,
        url: url
      });
      
      // 标记为已通知
      await suggestionManager.clearNotifiedUrls(suggestion.url);
      
      this.updateStatus('已添加到书签');
      
      // 刷新建议列表
      this.applyFilter();
    } catch (error) {
      console.error('添加建议到书签失败:', error);
      this.updateStatus('添加书签失败', 'error');
    }
  }
  
  /**
   * 忽略建议
   * @param {Object} suggestion - 建议对象
   */
  async ignoreSuggestion(suggestion) {
    try {
      // 将URL添加到已通知列表，这样就不会再次建议了
      await suggestionManager.clearNotifiedUrls(suggestion.url);
      this.updateStatus('已忽略建议');
    } catch (error) {
      console.error('忽略建议失败:', error);
      this.updateStatus('操作失败', 'error');
    }
  }

  /**
   * 检查书签有效性
   */
  async checkBookmarksValidity() {
    try {
      this.updateStatus('正在检查书签有效性...');
      
      // 获取当前显示的书签
      const bookmarkElements = this.elements.bookmarkList.querySelectorAll('.bookmark-item');
      const bookmarkUrls = [];
      
      // 收集所有URL
      bookmarkElements.forEach(element => {
        const url = element.dataset.url;
        if (url) {
          bookmarkUrls.push(url);
          
          // 添加检查中的视觉指示
          const validityIndicator = document.createElement('div');
          validityIndicator.className = 'validity-indicator validity-checking';
          element.insertBefore(validityIndicator, element.firstChild);
        }
      });
      
      if (bookmarkUrls.length === 0) {
        this.updateStatus('没有可检查的URL');
        return;
      }
      
      // 检查URL有效性
      const results = await urlValidator.checkUrls(bookmarkUrls, {
        progressCallback: (completed, total) => {
          this.updateStatus(`正在检查书签有效性... (${completed}/${total})`);
        }
      });
      
      // 更新UI显示结果
      let validCount = 0;
      let invalidCount = 0;
      
      results.forEach(result => {
        const element = this.elements.bookmarkList.querySelector(`[data-url="${result.originalUrl}"]`);
        if (!element) return;
        
        // 移除检查中的指示器
        const indicator = element.querySelector('.validity-indicator');
        if (indicator) {
          indicator.className = `validity-indicator ${result.valid ? 'validity-valid' : 'validity-invalid'}`;
          
          // 添加tooltip
          indicator.title = result.valid 
            ? '链接有效'
            : urlValidator.getErrorMessage(result);
        }
        
        if (result.valid) {
          validCount++;
        } else {
          invalidCount++;
        }
      });
      
      this.updateStatus(`检查完成: ${validCount}个有效, ${invalidCount}个无效`);
    } catch (error) {
      console.error('检查书签有效性失败:', error);
      this.updateStatus('检查书签有效性失败', 'error');
    }
  }

  /**
   * 刷新视图
   */
  refreshView() {
    folderTree.render();
    this.loadBookmarks(this.currentFolderId);
  }

  /**
   * 打开设置页面
   */
  openSettings() {
    chrome.runtime.openOptionsPage();
  }

  /**
   * 创建新文件夹
   */
  async createNewFolder() {
    const parentId = folderTree.getSelectedFolderId();
    const folderName = prompt('请输入新文件夹名称:', '新文件夹');
    
    if (!folderName) return;
    
    try {
      this.updateStatus('创建文件夹...');
      
      const newFolder = await bookmarkManager.createBookmark({
        parentId: parentId,
        title: folderName
      });
      
      this.updateStatus('文件夹已创建');
      
      // 重新渲染文件夹树并选中新文件夹
      await folderTree.render();
      setTimeout(() => {
        folderTree.expandToFolder(newFolder.id);
      }, 100);
    } catch (error) {
      console.error('创建文件夹失败:', error);
      this.updateStatus('创建文件夹失败', 'error');
    }
  }

  /**
   * 创建新书签
   * @param {string} [parentId] - 父文件夹ID，默认使用当前选中文件夹
   */
  async createNewBookmark(parentId = null) {
    // 使用提供的parentId或当前选中的文件夹ID
    const targetParentId = parentId || this.currentFolderId;
    
    // 尝试获取当前标签页信息作为默认值
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tabs.length > 0) {
        const currentTab = tabs[0];
        
        const title = prompt('请输入书签标题:', currentTab.title);
        if (title === null) return; // 用户取消
        
        const url = prompt('请输入书签URL:', currentTab.url);
        if (!url) return; // 用户取消或留空
        
        this.updateStatus('创建书签...');
        
        await bookmarkManager.createBookmark({
          parentId: targetParentId,
          title: title,
          url: url
        });
        
        this.updateStatus('书签已创建');
        
        // 重新加载当前文件夹书签
        if (targetParentId === this.
