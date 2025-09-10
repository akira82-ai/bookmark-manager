class BookmarkManager {
  constructor() {
    this.currentFolder = null;
    this.bookmarks = [];
    this.folders = [];
    this.sortBy = 'title';
    this.sortOrder = 'asc';
    this.viewMode = 'grid';
    this.searchTerm = '';
    this.searchTitles = true;
    this.searchUrls = true;
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadBookmarks();
  }

  bindEvents() {
    // 搜索相关事件
    document.getElementById('search-toggle-btn').addEventListener('click', () => {
      this.toggleSearch();
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.filterBookmarks();
    });

    document.getElementById('search-titles').addEventListener('change', (e) => {
      this.searchTitles = e.target.checked;
      this.filterBookmarks();
    });

    document.getElementById('search-urls').addEventListener('change', (e) => {
      this.searchUrls = e.target.checked;
      this.filterBookmarks();
    });

    // 刷新按钮
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.loadBookmarks();
    });

    // 展开所有按钮
    document.getElementById('expand-all-btn').addEventListener('click', () => {
      this.toggleExpandAll();
    });

    // 视图切换
    document.getElementById('view-grid-btn').addEventListener('click', () => {
      this.setViewMode('grid');
    });

    document.getElementById('view-list-btn').addEventListener('click', () => {
      this.setViewMode('list');
    });

    // 排序相关
    document.getElementById('sort-select').addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.sortBookmarks();
    });

    document.getElementById('sort-order-btn').addEventListener('click', () => {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
      document.getElementById('sort-order-btn').innerHTML = this.sortOrder === 'asc' ? '↑' : '↓';
      this.sortBookmarks();
    });

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
    
    // 创建根文件夹
    const rootFolder = this.createFolderElement({
      id: '0',
      title: '🏠 根目录',
      parentId: null,
      children: this.folders.filter(f => f.parentId === '0')
    });
    
    folderTree.appendChild(rootFolder);
  }

  createFolderElement(folder) {
    const folderElement = document.createElement('div');
    folderElement.className = 'folder-item';
    folderElement.dataset.folderId = folder.id;
    
    const folderIcon = document.createElement('span');
    folderIcon.className = 'folder-icon';
    folderIcon.textContent = '▶';
    
    const folderName = document.createElement('span');
    folderName.className = 'folder-name';
    folderName.textContent = folder.title;
    
    const childFolders = this.folders.filter(f => f.parentId === folder.id);
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
    
    // 如果有子文件夹，递归创建
    if (childFolders.length > 0) {
      const childContainer = document.createElement('div');
      childContainer.className = 'folder-children';
      childContainer.style.display = 'none';
      
      childFolders.forEach(childFolder => {
        const childElement = this.createFolderElement(childFolder);
        childContainer.appendChild(childElement);
      });
      
      folderElement.appendChild(childContainer);
      
      // 双击展开/折叠
      folderElement.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.toggleFolder(folderElement);
      });
    }
    
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
    
    // 更新面包屑导航
    this.updateBreadcrumb(folderId, folderTitle);
    
    // 渲染书签
    this.renderBookmarks();
  }

  updateBreadcrumb(folderId, folderTitle) {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = '';
    
    // 添加根目录
    const rootItem = this.createBreadcrumbItem('0', '🏠 根目录');
    breadcrumb.appendChild(rootItem);
    
    // 如果不是根目录，添加路径
    if (folderId !== '0') {
      const path = this.getFolderPath(folderId);
      path.forEach(folder => {
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.textContent = ' > ';
        breadcrumb.appendChild(separator);
        
        const item = this.createBreadcrumbItem(folder.id, folder.title);
        breadcrumb.appendChild(item);
      });
    }
  }

  createBreadcrumbItem(folderId, title) {
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'breadcrumb-item';
    item.textContent = title;
    item.dataset.folderId = folderId;
    
    item.addEventListener('click', (e) => {
      e.preventDefault();
      this.selectFolder(folderId, title);
    });
    
    return item;
  }

  getFolderPath(folderId) {
    const path = [];
    let currentId = folderId;
    
    while (currentId && currentId !== '0') {
      const folder = this.folders.find(f => f.id === currentId);
      if (folder) {
        path.unshift(folder);
        currentId = folder.parentId;
      } else {
        break;
      }
    }
    
    return path;
  }

  renderBookmarks() {
    const grid = document.getElementById('bookmarks-grid');
    grid.innerHTML = '';
    
    // 获取当前文件夹的书签
    let bookmarks = this.bookmarks.filter(b => b.parentId === this.currentFolder);
    
    // 应用搜索过滤
    if (this.searchTerm) {
      bookmarks = bookmarks.filter(bookmark => {
        const titleMatch = this.searchTitles && bookmark.title.toLowerCase().includes(this.searchTerm);
        const urlMatch = this.searchUrls && bookmark.url.toLowerCase().includes(this.searchTerm);
        return titleMatch || urlMatch;
      });
    }
    
    // 排序
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

  createBookmarkCard(bookmark) {
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    card.dataset.bookmarkId = bookmark.id;
    
    // 获取favicon
    const favicon = this.getFaviconUrl(bookmark.url);
    
    card.innerHTML = `
      <div class="bookmark-header">
        <img class="bookmark-favicon" src="${favicon}" alt="favicon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI0U1RTVFNSIvPgo8cGF0aCBkPSJNMTIgN0M5LjI0IDcgNyA5LjI0IDcgMTJDMiAxNC43NiA5LjI0IDE3IDEyIDE3QzE0Ljc2IDE3IDE3IDE0Ljc2IDE3IDEyQzE3IDkuMjQgMTQuNzYgNyAxMiA3WiIgZmlsbD0iIzk5OTk5OSIvPgo8L3N2Zz4K'">
        <div class="bookmark-title">${this.escapeHtml(bookmark.title)}</div>
      </div>
      <div class="bookmark-url">${this.escapeHtml(bookmark.url)}</div>
      <div class="bookmark-actions">
        <button class="bookmark-action-btn" onclick="bookmarkManager.openBookmark('${bookmark.url}')">打开</button>
        <button class="bookmark-action-btn" onclick="bookmarkManager.editBookmark('${bookmark.id}')">编辑</button>
        <button class="bookmark-action-btn" onclick="bookmarkManager.deleteBookmark('${bookmark.id}')">删除</button>
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
      let aValue, bValue;
      
      switch (this.sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'date':
          aValue = a.dateAdded || 0;
          bValue = b.dateAdded || 0;
          break;
        case 'url':
          aValue = a.url.toLowerCase();
          bValue = b.url.toLowerCase();
          break;
        default:
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
      }
      
      if (aValue < bValue) return this.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  sortBookmarks() {
    this.renderBookmarks();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    
    // 更新按钮状态
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    if (mode === 'grid') {
      document.getElementById('view-grid-btn').classList.add('active');
      document.querySelector('.content').classList.remove('list-view');
    } else {
      document.getElementById('view-list-btn').classList.add('active');
      document.querySelector('.content').classList.add('list-view');
    }
  }

  toggleSearch() {
    const searchBar = document.getElementById('search-bar');
    const isVisible = searchBar.style.display !== 'none';
    
    if (isVisible) {
      searchBar.style.display = 'none';
      this.searchTerm = '';
      document.getElementById('search-input').value = '';
    } else {
      searchBar.style.display = 'block';
      document.getElementById('search-input').focus();
    }
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