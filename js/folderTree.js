/**
 * 文件夹树功能模块
 * 用于展示和操作书签文件夹结构
 */

class FolderTree {
  constructor() {
    this.rootElement = null;
    this.selectedFolder = null;
    this.contextMenu = null;
    this.renamingFolder = null;
    this.folderOpenState = {};
    this.onFolderSelect = null;
  }

  /**
   * 初始化文件夹树
   * @param {string|Element} rootElement - 文件夹树容器元素或选择器
   * @param {Function} onFolderSelect - 文件夹选择回调函数
   */
  init(rootElement, onFolderSelect) {
    if (typeof rootElement === 'string') {
      this.rootElement = document.querySelector(rootElement);
    } else {
      this.rootElement = rootElement;
    }
    
    if (!this.rootElement) {
      console.error('文件夹树容器元素未找到');
      return;
    }
    
    this.onFolderSelect = onFolderSelect;
    
    // 初始化右键菜单
    this._initContextMenu();
    
    // 从存储中加载文件夹打开状态
    this._loadFolderOpenState();
    
    // 初始化拖放功能
    this._initDragDrop();
    
    // 加载书签文件夹树
    this.render();
  }

  /**
   * 渲染书签文件夹树
   */
  async render() {
    try {
      // 显示加载提示
      this.rootElement.innerHTML = '<div class="loading-indicator">加载中...</div>';
      
      // 获取书签树
      const bookmarkTree = await chrome.bookmarks.getTree();
      
      // 清空容器
      this.rootElement.innerHTML = '';
      
      // 渲染根文件夹
      const rootFolder = bookmarkTree[0];
      this._renderFolderNode(rootFolder, this.rootElement, 0);
      
      // 恢复文件夹展开状态
      this._restoreFolderOpenState();
      
      // 选择默认文件夹(书签栏)
      const defaultFolder = this.rootElement.querySelector('[data-id="1"]');
      if (defaultFolder) {
        this._selectFolder(defaultFolder);
      }
    } catch (error) {
      console.error('渲染书签文件夹树失败:', error);
      this.rootElement.innerHTML = '<div class="error-message">加载文件夹树失败</div>';
    }
  }

  /**
   * 渲染单个文件夹节点及其子节点
   * @param {Object} folder - 文件夹数据
   * @param {Element} container - 容器元素
   * @param {number} level - 嵌套级别
   * @private
   */
  _renderFolderNode(folder, container, level) {
    // 创建文件夹元素
    const folderElement = document.createElement('div');
    folderElement.className = 'folder-item';
    folderElement.dataset.id = folder.id;
    folderElement.dataset.level = level;
    folderElement.style.paddingLeft = `${16 + level * 16}px`;
    
    // 添加展开/折叠图标
    const expandIcon = document.createElement('span');
    expandIcon.className = 'folder-expand-icon';
    expandIcon.innerHTML = '▶';
    expandIcon.addEventListener('click', (e) => this._toggleFolder(folderElement, e));
    folderElement.appendChild(expandIcon);
    
    // 添加文件夹图标
    const folderIcon = document.createElement('span');
    folderIcon.className = 'folder-icon';
    folderIcon.innerHTML = '📁';
    folderElement.appendChild(folderIcon);
    
    // 添加文件夹名称
    const folderName = document.createElement('span');
    folderName.className = 'folder-name';
    folderName.textContent = folder.title;
    folderElement.appendChild(folderName);
    
    // 设置文件夹点击事件
    folderElement.addEventListener('click', (e) => this._handleFolderClick(folderElement, e));
    
    // 设置右键菜单事件
    folderElement.addEventListener('contextmenu', (e) => this._showContextMenu(folderElement, e));
    
    // 添加到容器
    container.appendChild(folderElement);
    
    // 创建子文件夹容器
    if (folder.children && folder.children.length > 0) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'folder-children';
      childrenContainer.style.display = 'none'; // 默认折叠
      childrenContainer.dataset.parentId = folder.id;
      
      // 渲染子文件夹
      for (const child of folder.children) {
        if (!child.url) { // 如果没有 URL，则是文件夹
          this._renderFolderNode(child, childrenContainer, level + 1);
        }
      }
      
      container.appendChild(childrenContainer);
    } else {
      // 如果没有子文件夹，隐藏展开图标
      expandIcon.style.visibility = 'hidden';
    }
  }

  /**
   * 处理文件夹点击事件
   * @param {Element} folderElement - 文件夹元素
   * @param {Event} event - 点击事件
   * @private
   */
  _handleFolderClick(folderElement, event) {
    // 防止事件冒泡
    event.stopPropagation();
    
    // 如果点击的是展开图标，则不处理选中逻辑
    if (event.target.classList.contains('folder-expand-icon')) {
      return;
    }
    
    this._selectFolder(folderElement);
  }

  /**
   * 选择文件夹
   * @param {Element} folderElement - 要选择的文件夹元素
   * @private
   */
  _selectFolder(folderElement) {
    // 取消之前的选中状态
    if (this.selectedFolder) {
      this.selectedFolder.classList.remove('selected');
    }
    
    // 设置新的选中状态
    folderElement.classList.add('selected');
    this.selectedFolder = folderElement;
    
    // 回调函数通知选择变化
    if (typeof this.onFolderSelect === 'function') {
      this.onFolderSelect(folderElement.dataset.id, folderElement.querySelector('.folder-name').textContent);
    }
  }

  /**
   * 切换文件夹展开/折叠状态
   * @param {Element} folderElement - 文件夹元素
   * @param {Event} event - 点击事件
   * @private
   */
  _toggleFolder(folderElement, event) {
    // 防止事件冒泡
    event.stopPropagation();
    
    const folderId = folderElement.dataset.id;
    const expandIcon = folderElement.querySelector('.folder-expand-icon');
    const folderIcon = folderElement.querySelector('.folder-icon');
    const childrenContainer = folderElement.nextElementSibling;
    
    if (childrenContainer && childrenContainer.classList.contains('folder-children')) {
      // 更新文件夹展开状态
      const isOpen = childrenContainer.style.display !== 'none';
      
      if (isOpen) {
        // 折叠文件夹
        childrenContainer.style.display = 'none';
        expandIcon.innerHTML = '▶';
        folderIcon.innerHTML = '📁';
        this.folderOpenState[folderId] = false;
      } else {
        // 展开文件夹
        childrenContainer.style.display = 'block';
        expandIcon.innerHTML = '▼';
        folderIcon.innerHTML = '📂';
        this.folderOpenState[folderId] = true;
      }
      
      // 保存文件夹展开状态
      this._saveFolderOpenState();
    }
  }

  /**
   * 展开文件夹
   * @param {string} folderId - 文件夹ID
   */
  expandFolder(folderId) {
    const folderElement = this.rootElement.querySelector(`[data-id="${folderId}"]`);
    if (folderElement) {
      const childrenContainer = folderElement.nextElementSibling;
      if (childrenContainer && childrenContainer.classList.contains('folder-children') && 
          childrenContainer.style.display === 'none') {
        
        // 展开文件夹
        childrenContainer.style.display = 'block';
        folderElement.querySelector('.folder-expand-icon').innerHTML = '▼';
        folderElement.querySelector('.folder-icon').innerHTML = '📂';
        
        // 更新状态
        this.folderOpenState[folderId] = true;
        this._saveFolderOpenState();
      }
    }
  }

  /**
   * 递归展开到指定文件夹
   * @param {string} folderId - 目标文件夹ID
   */
  expandToFolder(folderId) {
    // 查找文件夹元素
    const folderElement = this.rootElement.querySelector(`[data-id="${folderId}"]`);
    if (!folderElement) return;
    
    // 查找所有上层文件夹并展开
    let parent = folderElement.parentElement;
    while (parent) {
      if (parent.classList.contains('folder-children')) {
        const parentId = parent.dataset.parentId;
        this.expandFolder(parentId);
      }
      parent = parent.parentElement;
    }
    
    // 选中目标文件夹
    this._selectFolder(folderElement);
  }

  /**
   * 保存文件夹展开状态
   * @private
   */
  _saveFolderOpenState() {
    chrome.storage.local.set({ folderOpenState: this.folderOpenState });
  }

  /**
   * 加载文件夹展开状态
   * @private
   */
  async _loadFolderOpenState() {
    try {
      const data = await chrome.storage.local.get(['folderOpenState']);
      this.folderOpenState = data.folderOpenState || {};
    } catch (error) {
      console.error('加载文件夹展开状态失败:', error);
      this.folderOpenState = {};
    }
  }

  /**
   * 恢复文件夹展开状态
   * @private
   */
  _restoreFolderOpenState() {
    for (const folderId in this.folderOpenState) {
      if (this.folderOpenState[folderId]) {
        this.expandFolder(folderId);
      }
    }
  }

  /**
   * 初始化右键菜单
   * @private
   */
  _initContextMenu() {
    // 查找菜单容器
    this.contextMenu = document.getElementById('contextMenu');
    
    // 如果不存在则创建菜单
    if (!this.contextMenu) {
      this.contextMenu = document.createElement('div');
      this.contextMenu.id = 'folderContextMenu';
      this.contextMenu.className = 'context-menu';
      
      const menuItems = `
        <ul>
          <li id="cmCreateFolder">新建文件夹</li>
          <li id="cmRenameFolder">重命名</li>
          <li id="cmDeleteFolder">删除</li>
          <li class="separator"></li>
          <li id="cmCreateBookmark">添加书签</li>
        </ul>
      `;
      
      this.contextMenu.innerHTML = menuItems;
      document.body.appendChild(this.contextMenu);
    }
    
    // 添加点击事件处理
    this.contextMenu.querySelector('#cmCreateFolder').addEventListener('click', () => this._createFolder());
    this.contextMenu.querySelector('#cmRenameFolder').addEventListener('click', () => this._renameFolder());
    this.contextMenu.querySelector('#cmDeleteFolder').addEventListener('click', () => this._deleteFolder());
    this.contextMenu.querySelector('#cmCreateBookmark').addEventListener('click', () => this._createBookmark());
    
    // 点击页面其他区域关闭菜单
    document.addEventListener('click', () => {
      this._hideContextMenu();
    });
  }

  /**
   * 显示右键菜单
   * @param {Element} folderElement - 文件夹元素
   * @param {Event} event - 右键点击事件
   * @private
   */
  _showContextMenu(folderElement, event) {
    // 阻止默认右键菜单
    event.preventDefault();
    
    // 保存当前右键点击的文件夹元素
    this.contextMenuTarget = folderElement;
    
    // 调整菜单位置
    this.contextMenu.style.top = `${event.clientY}px`;
    this.contextMenu.style.left = `${event.clientX}px`;
    
    // 显示菜单
    this.contextMenu.style.display = 'block';
    
    // 禁用特定项目
    const folderId = folderElement.dataset.id;
    if (folderId === '0' || folderId === '1' || folderId === '2') {
      // 根文件夹、书签栏和其他书签不能删除
      this.contextMenu.querySelector('#cmDeleteFolder').classList.add('disabled');
    } else {
      this.contextMenu.querySelector('#cmDeleteFolder').classList.remove('disabled');
    }
  }

  /**
   * 隐藏右键菜单
   * @private
   */
  _hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
      this.contextMenuTarget = null;
    }
  }

  /**
   * 创建新文件夹
   * @private
   */
  async _createFolder() {
    if (!this.contextMenuTarget) return;
    
    const parentId = this.contextMenuTarget.dataset.id;
    const folderName = window.prompt('请输入新文件夹名称:', '新文件夹');
    
    if (folderName) {
      try {
        const newFolder = await chrome.bookmarks.create({
          parentId: parentId,
          title: folderName
        });
        
        // 刷新文件夹树
        this.render();
        
        // 展开上层文件夹
        setTimeout(() => {
          this.expandToFolder(newFolder.id);
        }, 100);
      } catch (error) {
        console.error('创建文件夹失败:', error);
        alert('创建文件夹失败: ' + error.message);
      }
    }
    
    this._hideContextMenu();
  }

  /**
   * 重命名文件夹
   * @private
   */
  _renameFolder() {
    if (!this.contextMenuTarget) return;
    
    const folderId = this.contextMenuTarget.dataset.id;
    const currentName = this.contextMenuTarget.querySelector('.folder-name').textContent;
    
    // 创建内联编辑模式
    this._showFolderRenameInput(this.contextMenuTarget, currentName, folderId);
    
    this._hideContextMenu();
  }

  /**
   * 显示文件夹重命名输入框
   * @param {Element} folderElement - 文件夹元素
   * @param {string} currentName - 当前名称
   * @param {string} folderId - 文件夹ID
   * @private 
   */
  _showFolderRenameInput(folderElement, currentName, folderId) {
    // 防止重复创建
    if (this.renamingFolder === folderElement) return;
    
    // 记录当前正在重命名的文件夹
    this.renamingFolder = folderElement;
    
    // 获取文件夹名称元素并隐藏
    const nameElement = folderElement.querySelector('.folder-name');
    nameElement.style.display = 'none';
    
    // 创建输入框
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.className = 'folder-rename-input';
    inputElement.value = currentName;
    inputElement.style.width = '150px';
    
    // 添加到文件夹元素
    folderElement.insertBefore(inputElement, nameElement.nextSibling);
    
    // 聚焦并选中文本
    inputElement.focus();
    inputElement.select();
    
    // 处理完成重命名
    const completeRename = async (save) => {
      const newName = inputElement.value.trim();
      
      // 恢复界面
      nameElement.style.display = '';
      folderElement.removeChild(inputElement);
      this.renamingFolder = null;
      
      // 保存新名称
      if (save && newName && newName !== currentName) {
        try {
          await chrome.bookmarks.update(folderId, { title: newName });
          nameElement.textContent = newName;
        } catch (error) {
          console.error('重命名文件夹失败:', error);
          alert('重命名文件夹失败: ' + error.message);
        }
      }
    };
    
    // 添加事件处理
    inputElement.addEventListener('blur', () => completeRename(true));
    inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        completeRename(true);
      } else if (e.key === 'Escape') {
        completeRename(false);
      }
    });
  }

  /**
   * 删除文件夹
   * @private
   */
  async _deleteFolder() {
    if (!this.contextMenuTarget) return;
    
    const folderId = this.contextMenuTarget.dataset.id;
    const folderName = this.contextMenuTarget.querySelector('.folder-name').textContent;
    
    // 根文件夹、书签栏和其他书签不能删除
    if (folderId === '0' || folderId === '1' || folderId === '2') {
      alert('不能删除此文件夹');
      this._hideContextMenu();
      return;
    }
    
    // 确认删除
    if (confirm(`确定要删除文件夹"${folderName}"及其所有内容吗？此操作不可撤销。`)) {
      try {
        await chrome.bookmarks.removeTree(folderId);
        
        // 刷新文件夹树
        this.render();
      } catch (error) {
        console.error('删除文件夹失败:', error);
        alert('删除文件夹失败: ' + error.message);
      }
    }
    
    this._hideContextMenu();
  }

  /**
   * 在文件夹中添加书签
   * @private
   */
  async _createBookmark() {
    if (!this.contextMenuTarget) return;
    
    const folderId = this.contextMenuTarget.dataset.id;
    
    // 获取当前标签页信息作为默认值
    let title = '';
    let url = '';
    
    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs.length > 0) {
        title = tabs[0].title;
        url = tabs[0].url;
      }
    } catch (error) {
      console.error('获取当前标签页信息失败:', error);
    }
    
    // 提示用户输入书签信息
    title = window.prompt('请输入书签标题:', title);
    
    if (title !== null) {
      url = window.prompt('请输入书签URL:', url);
      
      if (url) {
        try {
          await chrome.bookmarks.create({
            parentId: folderId,
            title: title,
            url: url
          });
          
          // 如果当前已选中此文件夹，则刷新书签列表
          if (this.selectedFolder && this.selectedFolder.dataset.id === folderId) {
            if (typeof this.onFolderSelect === 'function') {
              this.onFolderSelect(folderId, this.selectedFolder.querySelector('.folder-name').textContent);
            }
          }
        } catch (error) {
          console.error('创建书签失败:', error);
          alert('创建书签失败: ' + error.message);
        }
      }
    }
    
    this._hideContextMenu();
  }

  /**
   * 初始化拖拽功能
   * @private
   */
  _initDragDrop() {
    try {
      // 导入dragDrop.js
      import('./dragDrop.js')
        .then(module => {
          const dragDropManager = module.default;
          
          // 初始化拖拽功能
          dragDropManager.init(null, this.rootElement, () => {
            // 排序改变后刷新文件夹树
            this.render();
          });
        })
        .catch(error => {
          console.error('加载拖拽功能模块失败:', error);
        });
    } catch (error) {
      console.error('初始化拖拽功能失败:', error);
    }
  }

  /**
   * 更新文件夹树
   * 在书签结构发生变化时调用
   */
  update() {
    this.render();
  }

  /**
   * 获取当前选中的文件夹ID
   * @returns {string} 文件夹ID
   */
  getSelectedFolderId() {
    return this.selectedFolder ? this.selectedFolder.dataset.id : '1';
  }
}

// 导出单例
const folderTree = new FolderTree();
export default folderTree;
