class BookmarkManager {
  constructor() {
    this.currentFolder = null;
    this.bookmarks = [];
    this.folders = [];
    this.searchTerm = '';
    
    this.init();
  }

  init() {
    this.bindEvents();
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
    
    // 点击搜索按钮进行搜索
    searchBtn.addEventListener('click', () => {
      this.performSearch();
    });
    
    // 回车键搜索
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
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

  toggleFolder(folderElement) {
    const children = folderElement.querySelector('.folder-children');
    const icon = folderElement.querySelector('.folder-icon');
    
    if (children) {
      const isExpanded = children.style.display !== 'none';
      children.style.display = isExpanded ? 'none' : 'block';
      folderElement.classList.toggle('expanded', !isExpanded);
    }
  }

  selectFolder(folderId, folderTitle) {
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
    let bookmarks = this.bookmarks.filter(b => b.parentId === this.currentFolder);
    
    // 按标题排序（默认）
    bookmarks = this.sortBookmarksArray(bookmarks);
    
    if (bookmarks.length === 0) {
      this.showEmptyState();
      return;
    }
    
    this.hideEmptyState();
    
    bookmarks.forEach(bookmark => {
      const card = this.createBookmarkCard(bookmark);
      grid.appendChild(card);
    });
  }

  renderSearchResults() {
    const grid = document.getElementById('bookmarks-grid');
    grid.innerHTML = '';
    
    // 全局搜索过滤所有书签
    const allBookmarks = this.bookmarks.filter(bookmark => {
      const titleMatch = bookmark.title.toLowerCase().includes(this.searchTerm);
      const urlMatch = bookmark.url.toLowerCase().includes(this.searchTerm);
      return titleMatch || urlMatch;
    });
    
    if (allBookmarks.length === 0) {
      this.showSearchEmptyState();
      return;
    }
    
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
      
      // 创建文件夹区域
      const folderSection = this.createSearchFolderSection(folderId, folderName, bookmarks);
      grid.appendChild(folderSection);
      
      // 如果不是最后一个分类，添加分隔线
      if (index < sortedFolderIds.length - 1) {
        const divider = document.createElement('div');
        divider.className = 'search-divider';
        grid.appendChild(divider);
      }
    });
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
    
    // 对每个文件夹内的书签按名称排序
    Object.keys(grouped).forEach(folderId => {
      grouped[folderId] = this.sortBookmarksArray(grouped[folderId]);
    });
    
    return grouped;
  }

  createSearchFolderSection(folderId, folderName, bookmarks) {
    const section = document.createElement('div');
    section.className = 'search-folder-section';
    
    // 创建文件夹标题
    const header = document.createElement('div');
    header.className = 'search-folder-header';
    header.innerHTML = `
      <span class="folder-name">${this.escapeHtml(folderName)}</span>
      <span class="bookmark-count">(${bookmarks.length})</span>
    `;
    
    // 点击标题跳转到对应文件夹
    header.addEventListener('click', () => {
      this.selectFolder(folderId, folderName);
    });
    
    section.appendChild(header);
    
    // 创建书签网格（复用现有样式）
    const bookmarksGrid = document.createElement('div');
    bookmarksGrid.className = 'bookmarks-grid-group';
    
    bookmarks.forEach(bookmark => {
      const card = this.createBookmarkCard(bookmark);
      bookmarksGrid.appendChild(card);
    });
    
    section.appendChild(bookmarksGrid);
    
    return section;
  }

  createSearchResultCard(folderId, folderName, bookmarks) {
    const card = document.createElement('div');
    card.className = 'search-result-card';
    
    // 创建卡片头部
    const header = document.createElement('div');
    header.className = 'search-card-header';
    header.innerHTML = `
      <div class="folder-info">
        <span class="folder-icon">📁</span>
        <span class="folder-name">${this.escapeHtml(folderName)}</span>
      </div>
      <span class="bookmark-count">${bookmarks.length} 个书签</span>
    `;
    
    // 点击头部跳转到该文件夹
    header.addEventListener('click', () => {
      this.selectFolder(folderId, folderName);
    });
    
    card.appendChild(header);
    
    // 创建书签列表
    const bookmarksList = document.createElement('div');
    bookmarksList.className = 'search-bookmarks-list';
    
    bookmarks.forEach(bookmark => {
      const bookmarkItem = this.createSearchBookmarkItem(bookmark);
      bookmarksList.appendChild(bookmarkItem);
    });
    
    card.appendChild(bookmarksList);
    
    return card;
  }

  createSearchBookmarkItem(bookmark) {
    const item = document.createElement('div');
    item.className = 'search-bookmark-item';
    
    const favicon = this.getFaviconUrl(bookmark.url);
    
    item.innerHTML = `
      <div class="bookmark-content">
        <img class="bookmark-favicon" src="${favicon}" alt="favicon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiByeD0iMyIgZmlsbD0iI0U1RTVFNSIvPgo8cGF0aCBkPSJNOCA3QzUuMjQgNyAzIDkuMjQgMyAxMiAzIDE0Ljc2IDEzIDE3IDEwLjc2IDE3IDhDMTcgNS4yNCAxNC43NiAzIDEyIDNDOS4yNCAzIDcgNS4yNCA3IDhaIiBmaWxsPSIjOTk5OTk5Ii8+Cjwvc3ZnPg=='">
        <div class="bookmark-text">
          <div class="bookmark-title">${this.escapeHtml(bookmark.title)}</div>
          <div class="bookmark-url">${this.escapeHtml(bookmark.url)}</div>
        </div>
      </div>
    `;
    
    // 点击整个项目打开书签
    item.addEventListener('click', () => {
      this.openBookmark(bookmark.url);
    });
    
    // 右键菜单
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, bookmark);
    });
    
    return item;
  }

  addExitSearchButton() {
    const grid = document.getElementById('bookmarks-grid');
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'exit-search-container';
    buttonContainer.innerHTML = `
      <button class="exit-search-btn" id="exit-search-btn">
        <span class="exit-icon">✖️</span>
        <span class="exit-text">退出搜索</span>
      </button>
    `;
    
    // 绑定退出搜索事件
    buttonContainer.querySelector('.exit-search-btn').addEventListener('click', () => {
      this.clearSearch();
    });
    
    grid.appendChild(buttonContainer);
  }

  
  showSearchEmptyState() {
    const grid = document.getElementById('bookmarks-grid');
    const emptyState = document.createElement('div');
    emptyState.className = 'search-empty-state';
    emptyState.innerHTML = `
      <div class="search-empty-icon">🔍</div>
      <h3>未找到匹配的书签</h3>
      <p>尝试使用不同的关键词进行搜索</p>
      <button class="clear-search-btn" id="clear-search-btn">清空搜索</button>
    `;
    
    grid.appendChild(emptyState);
    
    // 绑定清空搜索事件
    document.getElementById('clear-search-btn').addEventListener('click', () => {
      this.clearSearch();
    });
  }

  performSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    this.searchTerm = searchInput.value.toLowerCase();
    this.filterBookmarks();
    
    // 给搜索按钮一个反馈效果
    searchBtn.style.transform = 'translateY(-50%) scale(0.9)';
    setTimeout(() => {
      searchBtn.style.transform = 'translateY(-50%) scale(1)';
    }, 100);
  }

  createDivider() {
    const divider = document.createElement('div');
    divider.className = 'search-divider';
    return divider;
  }

  createClearSearchButton() {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'clear-search-container';
    buttonContainer.innerHTML = `
      <button class="clear-search-btn" id="clear-search-btn">清空搜索</button>
    `;
    
    // 绑定清空搜索事件
    buttonContainer.querySelector('.clear-search-btn').addEventListener('click', () => {
      this.clearSearch();
    });
    
    return buttonContainer;
  }

  clearSearch() {
    this.searchTerm = '';
    document.getElementById('search-input').value = '';
    this.renderBookmarks();
  }

  createBookmarkCard(bookmark) {
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    card.dataset.bookmarkId = bookmark.id;
    card.dataset.bookmarkUrl = bookmark.url;
    
    // 获取favicon
    const favicon = this.getFaviconUrl(bookmark.url);
    
    card.innerHTML = `
      <div class="bookmark-header">
        <img class="bookmark-favicon" src="${favicon}" alt="favicon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI0U1RTVFNSIvPgo8cGF0aCBkPSJNMTIgN0M5LjI0IDcgNyA5LjI0IDcgMTJDMiAxNC43NiA5LjI0IDE3IDEyIDE3QzE0Ljc2IDE3IDE3IDE0Ljc2IDE3IDEyQzE3IDkuMjQgMTQuNzYgNyAxMiA3WiIgZmlsbD0iIzk5OTk5OSIvPgo8L3N2Zz4K'">
        <div class="bookmark-title">${this.escapeHtml(bookmark.title)}</div>
      </div>
      <div class="bookmark-url">${this.escapeHtml(bookmark.url)}</div>
      <div class="bookmark-actions">
        <button class="bookmark-action-btn open-btn">打开</button>
        <button class="bookmark-action-btn edit-btn">编辑</button>
        <button class="bookmark-action-btn delete-btn">删除</button>
      </div>
    `;
    
    // 右键菜单
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, bookmark);
    });
    
    // 双击打开
    card.addEventListener('dblclick', () => {
      this.openBookmark(bookmark.url);
    });
    
    return card;
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

  filterBookmarks() {
    this.renderBookmarks();
  }

  toggleExpandAll() {
    const allFolders = document.querySelectorAll('.folder-item');
    const allExpanded = Array.from(allFolders).every(f => f.classList.contains('expanded'));
    
    allFolders.forEach(folder => {
      const children = folder.querySelector('.folder-children');
      if (children) {
        children.style.display = allExpanded ? 'none' : 'block';
        folder.classList.toggle('expanded', !allExpanded);
      }
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