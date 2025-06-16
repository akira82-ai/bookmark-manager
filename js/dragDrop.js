/**
 * 拖拽功能模块
 * 用于书签和书签文件夹的排序
 */

class DragDropManager {
  constructor() {
    this.draggedElement = null;
    this.draggedElementType = null; // 'bookmark' 或 'folder'
    this.originalIndex = -1;
    this.originalParentId = '';
    this.dropTarget = null;
    this.dropPosition = null; // 'before', 'after', 'inside'
    this.placeholderElement = null;
    this.draggedElementClone = null;
    this.initialized = false;
  }

  /**
   * 初始化拖拽功能
   * @param {string} bookmarkListSelector - 书签列表元素选择器
   * @param {string} folderTreeSelector - 文件夹树元素选择器
   * @param {function} onOrderChanged - 排序变化时的回调函数
   */
  init(bookmarkListSelector, folderTreeSelector, onOrderChanged) {
    if (this.initialized) return;
    
    this.bookmarkListElement = document.querySelector(bookmarkListSelector);
    this.folderTreeElement = document.querySelector(folderTreeSelector);
    this.onOrderChanged = onOrderChanged || (() => {});
    
    // 初始化拖拽相关事件监听
    this._initBookmarkListDrag();
    this._initFolderTreeDrag();
    
    this.initialized = true;
  }
  
  /**
   * 初始化书签列表的拖拽功能
   * @private
   */
  _initBookmarkListDrag() {
    if (!this.bookmarkListElement) return;
    
    // 设置列表本身可以接收拖拽
    this.bookmarkListElement.addEventListener('dragover', (e) => this._handleDragOver(e));
    this.bookmarkListElement.addEventListener('dragleave', (e) => this._handleDragLeave(e));
    this.bookmarkListElement.addEventListener('drop', (e) => this._handleDrop(e));
    
    // 为每个书签项添加拖拽能力
    this._refreshBookmarkDraggable();
  }
  
  /**
   * 初始化文件夹树的拖拽功能
   * @private
   */
  _initFolderTreeDrag() {
    if (!this.folderTreeElement) return;
    
    // 设置文件夹树本身可以接收拖拽
    this.folderTreeElement.addEventListener('dragover', (e) => this._handleDragOver(e));
    this.folderTreeElement.addEventListener('dragleave', (e) => this._handleDragLeave(e));
    this.folderTreeElement.addEventListener('drop', (e) => this._handleDrop(e));
    
    // 为每个文件夹项添加拖拽能力
    this._refreshFolderDraggable();
  }
  
  /**
   * 刷新书签元素的拖拽属性
   * @public
   */
  refreshDraggable() {
    this._refreshBookmarkDraggable();
    this._refreshFolderDraggable();
  }
  
  /**
   * 为书签列表中的项添加拖拽能力
   * @private
   */
  _refreshBookmarkDraggable() {
    if (!this.bookmarkListElement) return;
    
    const bookmarkItems = this.bookmarkListElement.querySelectorAll('.bookmark-item');
    bookmarkItems.forEach(item => {
      // 确保每个元素只绑定一次事件
      if (item.dataset.dragInitialized) return;
      
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', (e) => this._handleBookmarkDragStart(e));
      item.addEventListener('dragend', (e) => this._handleDragEnd(e));
      item.addEventListener('dragover', (e) => this._handleBookmarkItemDragOver(e));
      item.addEventListener('dragleave', (e) => this._handleItemDragLeave(e));
      item.addEventListener('drop', (e) => this._handleBookmarkItemDrop(e));
      
      // 标记已初始化
      item.dataset.dragInitialized = 'true';
    });
  }
  
  /**
   * 为文件夹树中的项添加拖拽能力
   * @private
   */
  _refreshFolderDraggable() {
    if (!this.folderTreeElement) return;
    
    const folderItems = this.folderTreeElement.querySelectorAll('.folder-item');
    folderItems.forEach(item => {
      // 确保每个元素只绑定一次事件
      if (item.dataset.dragInitialized) return;
      
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', (e) => this._handleFolderDragStart(e));
      item.addEventListener('dragend', (e) => this._handleDragEnd(e));
      item.addEventListener('dragover', (e) => this._handleFolderItemDragOver(e));
      item.addEventListener('dragleave', (e) => this._handleItemDragLeave(e));
      item.addEventListener('drop', (e) => this._handleFolderItemDrop(e));
      
      // 标记已初始化
      item.dataset.dragInitialized = 'true';
    });
  }
  
  /**
   * 处理书签拖拽开始事件
   * @param {DragEvent} e - 拖拽事件对象
   * @private
   */
  _handleBookmarkDragStart(e) {
    if (!e.target.classList.contains('bookmark-item')) return;
    
    this.draggedElement = e.target;
    this.draggedElementType = 'bookmark';
    this.originalIndex = Array.from(e.target.parentNode.children).indexOf(e.target);
    this.originalParentId = e.target.parentNode.dataset.folderId || '1';
    
    // 设置拖拽数据和效果
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
    
    // 创建拖拽元素的视觉克隆
    this._createDragClone(e.target);
    e.dataTransfer.setDragImage(this.draggedElementClone, 10, 10);
    
    // 添加拖拽中样式
    e.target.classList.add('dragging');
    
    // 创建占位符
    this._createPlaceholder(e.target);
  }
  
  /**
   * 处理文件夹拖拽开始事件
   * @param {DragEvent} e - 拖拽事件对象
   * @private
   */
  _handleFolderDragStart(e) {
    if (!e.target.classList.contains('folder-item')) return;
    
    this.draggedElement = e.target;
    this.draggedElementType = 'folder';
    this.originalIndex = Array.from(e.target.parentNode.children).indexOf(e.target);
    this.originalParentId = e.target.parentNode.dataset.parentId || '0';
    
    // 设置拖拽数据和效果
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
    
    // 创建拖拽元素的视觉克隆
    this._createDragClone(e.target);
    e.dataTransfer.setDragImage(this.draggedElementClone, 10, 10);
    
    // 添加拖拽中样式
    e.target.classList.add('dragging');
    
    // 创建占位符
    this._createPlaceholder(e.target);
  }
  
  /**
   * 创建拖拽元素的视觉克隆
   * @param {Element} element - 被拖拽的元素
   * @private
   */
  _createDragClone(element) {
    this.draggedElementClone = element.cloneNode(true);
    this.draggedElementClone.style.position = 'absolute';
    this.draggedElementClone.style.opacity = '0.7';
    this.draggedElementClone.style.pointerEvents = 'none';
    this.draggedElementClone.style.zIndex = '9999';
    this.draggedElementClone.style.width = `${element.offsetWidth}px`;
    document.body.appendChild(this.draggedElementClone);
  }
  
  /**
   * 创建拖拽位置占位符
   * @param {Element} element - 被拖拽的元素
   * @private
   */
  _createPlaceholder(element) {
    this.placeholderElement = document.createElement('div');
    this.placeholderElement.className = 'drag-placeholder';
    this.placeholderElement.style.height = `${element.offsetHeight}px`;
    this.placeholderElement.style.marginTop = '4px';
    this.placeholderElement.style.marginBottom = '4px';
    this.placeholderElement.style.border = '1px dashed #aaa';
    this.placeholderElement.style.borderRadius = '4px';
    this.placeholderElement.style.backgroundColor = '#f8f9fa';
  }
  
  /**
   * 处理拖拽结束事件
   * @param {DragEvent} e - 拖拽事件对象
   * @private
   */
  _handleDragEnd(e) {
    // 移除拖拽中样式
    if (this.draggedElement) {
      this.draggedElement.classList.remove('dragging');
    }
    
    // 移除视觉反馈元素
    if (this.draggedElementClone) {
      document.body.removeChild(this.draggedElementClone);
      this.draggedElementClone = null;
    }
    
    // 移除占位符
    if (this.placeholderElement && this.placeholderElement.parentNode) {
      this.placeholderElement.parentNode.removeChild(this.placeholderElement);
      this.placeholderElement = null;
    }
    
    // 移除所有元素的拖拽状态样式
    const draggingOverElements = document.querySelectorAll('.dragover-top, .dragover-bottom, .dragover-inside');
    draggingOverElements.forEach(el => {
      el.classList.remove('dragover-top', 'dragover-bottom', 'dragover-inside');
    });
    
    // 重置状态
    this.draggedElement = null;
    this.draggedElementType = null;
    this.originalIndex = -1;
    this.originalParentId = '';
    this.dropTarget = null;
    this.dropPosition = null;
  }
  
  /**
   * 处理元素拖拽悬停时的离开事件
   * @param {DragEvent} e - 拖拽事件对象
   * @private
   */
  _handleItemDragLeave(e) {
    if (e.target === this.dropTarget) {
      e.target.classList.remove('dragover-top', 'dragover-bottom', 'dragover-inside');
      this.dropTarget = null;
      this.dropPosition = null;
    }
  }
  
  /**
   * 处理容器的拖拽经过事件
   * @param {DragEvent} e - 拖拽事件对象
   * @private
   */
  _handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // 容器本身没有特殊的视觉反馈，这里主要是允许拖放
    if (e.target === this.bookmarkListElement || e.target === this.folderTreeElement) {
      // 可以在此添加容器级别的视觉反馈
    }
  }
  
  /**
   * 处理容器的拖拽离开事件
   * @param {DragEvent} e - 拖拽事件对象
   * @private
   */
  _handleDragLeave(e) {
    // 当拖动离开整个容器时清除容器级别的视觉反馈
    if (e.target === this.bookmarkListElement || e.target === this.folderTreeElement) {
      // 清除容器级别的视觉反馈
    }
  }
  
  /**
   * 处理书签项的拖拽经过事件
   * @param {DragEvent} e - 拖拽事件对象
   * @private
   */
  _handleBookmarkItemDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // 如果拖动的是正在悬停的元素本身，不做任何处理
    if (this.draggedElement === e.currentTarget) return;
    
    const item = e.currentTarget;
    const rect = item.getBoundingClientRect();
    const mouseY = e.clientY;
    
    // 移除此前的视觉反馈
    if (this.dropTarget) {
      this.dropTarget.classList.remove('dragover-top', 'dragover-bottom', 'dragover-inside');
    }
    
    // 根据鼠标位置确定放置位置
    if (mouseY < rect.top + rect.height * 0.3) {
      // 上方 30% 区域
      this.dropPosition = 'before';
      item.classList.add('dragover-top');
    } else if (mouseY > rect.top + rect.height * 0.7) {
      // 下方 30% 区域
      this.dropPosition = 'after';
      item.classList.add('dragover-bottom');
    } else {
      // 中间区域，不适用于书签项
      this.dropPosition = 'after'; // 默认放在后面
      item.classList.add('dragover-bottom');
    }
    
    this.dropTarget = item;
  }
  
  /**
   * 处理文件夹项的拖拽经过事件
   * @param {DragEvent} e - 拖拽事件对象
   * @private
   */
  _handleFolderItemDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // 如果拖动的是正在悬停的元素本身，不做任何处理
    if (this.draggedElement === e.currentTarget) return;
    
    const item = e.currentTarget;
    const rect = item.getBoundingClientRect();
    const mouseY = e.clientY;
    
    // 移除此前的视觉反馈
    if (this.dropTarget) {
      this.dropTarget.classList.remove('dragover-top', 'dragover-bottom', 'dragover-inside');
    }
    
    // 根据鼠标位置确定放置位置
    if (mouseY < rect.top + rect.height * 0.3) {
      // 上方 30% 区域
      this.dropPosition = 'before';
      item.classList.add('dragover-top');
    } else if (mouseY > rect.top + rect.height * 0.7) {
      // 下方 30% 区域
      this.dropPosition = 'after';
      item.classList.add('dragover-bottom');
    } else {
      // 中间区域，表示放入文件夹内
      this.dropPosition = 'inside';
      item.classList.add('dragover-inside');
    }
    
    this.dropTarget = item;
  }
  
  /**
   * 处理容器的放置事件
   * @param {DragEvent} e - 拖拽事件对象
   * @private
   */
  _handleDrop(e) {
    e.preventDefault();
    
    // 如果没有被拖拽的元素，退出
    if (!this.draggedElement) return;
    
    // 如果放置到了容器本身，将元素添加到末尾
    if (e.target === this.bookmarkListElement || e.target === this.folderTreeElement) {
      let targetContainerId;
      
      if (e.target === this.bookmarkListElement) {
        targetContainerId = this.bookmarkListElement.dataset.folderId || '1';
      } else {
        targetContainerId = this.folderTreeElement.dataset.parentId || '0';
      }
      
      this._moveElement(this.draggedElement.dataset.id, targetContainerId);
    }
    
    this._handleDragEnd(e);
  }
  
  /**
   * 处理书签项的放置事件
   * @param {DragEvent} e - 拖拽事件对象
   * @private
   */
  _handleBookmarkItemDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // 如果没有被拖拽的元素或放置目标，退出
    if (!this.draggedElement || !this.dropTarget) return;
    
    const draggedId = this.draggedElement.dataset.id;
    const targetId = this.dropTarget.dataset.id;
    const targetParentId = this.dropTarget.parentNode.dataset.folderId || '1';
    
    // 如果放置的是书签项
    if (this.dropTarget.classList.contains('bookmark-item')) {
      // 根据放置位置处理
      if (this.dropPosition === 'before' || this.dropPosition === 'after') {
        const targetIndex = Array.from(this.dropTarget.parentNode.children).indexOf(this.dropTarget);
        const newIndex = this.dropPosition === 'before' ? targetIndex : targetIndex + 1;
        
        // 移动书签到新位置
        this._moveElement(draggedId, targetParentId, newIndex);
      }
    }
    
    this._handleDragEnd(e);
  }
  
  /**
   * 处理文件夹项的放置事件
   * @param {DragEvent} e - 拖拽事件对象
   * @private
   */
  _handleFolderItemDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // 如果没有被拖拽的元素或放置目标，退出
    if (!this.draggedElement || !this.dropTarget) return;
    
    const draggedId = this.draggedElement.dataset.id;
    const targetId = this.dropTarget.dataset.id;
    
    // 如果放置的是文件夹项
    if (this.dropTarget.classList.contains('folder-item')) {
      // 根据放置位置处理
      if (this.dropPosition === 'inside') {
        // 放入文件夹内部
        this._moveElement(draggedId, targetId);
      } else if (this.dropPosition === 'before' || this.dropPosition === 'after') {
        const targetParentId = this.dropTarget.parentNode.dataset.parentId || '0';
        const targetIndex = Array.from(this.dropTarget.parentNode.children).indexOf(this.dropTarget);
        const newIndex = this.dropPosition === 'before' ? targetIndex : targetIndex + 1;
        
        // 移动元素到文件夹的前或后
        this._moveElement(draggedId, targetParentId, newIndex);
      }
    }
    
    this._handleDragEnd(e);
  }
  
  /**
   * 移动元素到新位置
   * @param {string} elementId - 要移动的元素ID
   * @param {string} newParentId - 新的父元素ID
   * @param {number} [newIndex] - 新的位置索引
   * @private
   */
  _moveElement(elementId, newParentId, newIndex) {
    if (!elementId || !newParentId) return;
    
    try {
      // 构建移动目标对象
      const destination = { parentId: newParentId };
      if (newIndex !== undefined) {
        destination.index = newIndex;
      }
      
      // 调用Chrome书签API移动书签
      chrome.bookmarks.move(elementId, destination)
        .then(newBookmark => {
          console.log('书签移动成功:', newBookmark);
          // 触发回调函数
          if (typeof this.onOrderChanged === 'function') {
            this.onOrderChanged(newBookmark);
          }
        })
        .catch(error => {
          console.error('书签移动失败:', error);
          this._handleMoveError(elementId, error);
        });
    } catch (error) {
      console.error('处理拖放操作时发生错误:', error);
      this._handleMoveError(elementId, error);
    }
  }
  
  /**
   * 处理移动操作错误
   * @param {string} elementId - 尝试移动的元素ID
   * @param {Error} error - 错误对象
   * @private
   */
  _handleMoveError(elementId, error) {
    // 这里可以添加错误处理逻辑，比如显示错误提示，恢复原始位置等
    console.error(`移动书签 ${elementId} 失败:`, error);
    
    // 如果UI界面有状态消息区域，可以显示错误信息
    const statusBar = document.getElementById('statusBar');
    if (statusBar) {
      const statusMessage = statusBar.querySelector('#statusMessage');
      if (statusMessage) {
        statusMessage.textContent = `移动书签失败: ${error.message || '未知错误'}`;
        statusMessage.classList.add('error');
        
        // 5秒后清除错误状态
        setTimeout(() => {
          statusMessage.classList.remove('error');
          statusMessage.textContent = '就绪';
        }, 5000);
      }
    }
  }
}

// 导出一个全局实例
const dragDropManager = new DragDropManager();
export default dragDropManager;
