class BookmarkManager {
  constructor() {
    this.currentFolder = null;
    this.bookmarks = [];
    this.folders = [];
    this.searchTerm = '';
    this.searchTimeout = null;
    
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