// @ts-check
/**
 * Popup script for the bookmark manager extension
 * This is a module script that handles the popup UI and interaction
 */
import bookmarkManager from '../js/bookmarkManager.js';
import categoryManager from '../js/categoryManager.js';

// 全局变量
let currentFolder = null;
let bookmarkTree = [];
let searchTimeout = null;
let draggedElement = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initializePopup();
    bindEvents();
});

// 初始化弹出窗口
async function initializePopup() {
    try {
        // 显示加载指示器
        updateStatus('正在加载书签数据...');

        // 获取书签数据
        bookmarkTree = await getBookmarks();

        // 渲染书签文件夹结构
        renderFolderTree(bookmarkTree);

        // 默认显示根文件夹下的书签
        showBookmarksInFolder(bookmarkTree[0].id);

        // 更新状态
        updateStatus('就绪');
    } catch (error) {
        console.error('初始化失败:', error);
        updateStatus('加载失败: ' + error.message, 'error');
    }
}

// 绑定事件处理程序
function bindEvents() {
    // 头部控制按钮
    document.getElementById('refreshBtn').addEventListener('click', refreshBookmarks);
    document.getElementById('minimizeBtn').addEventListener('click', minimizePopup);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    document.getElementById('newPageBtn').addEventListener('click', openInNewPage);

    // 搜索功能
    document.getElementById('searchBookmark').addEventListener('input', handleSearch);
    document.getElementById('searchBtn').addEventListener('click', () => {
        const query = document.getElementById('searchBookmark').value;
        searchBookmarks(query);
    });

    // 底部操作按钮
    document.getElementById('checkValidBtn').addEventListener('click', checkBookmarksValidity);
    document.getElementById('deleteBtn').addEventListener('click', deleteSelectedBookmarks);
    document.getElementById('moveBtn').addEventListener('click', moveSelectedBookmarks);
    document.getElementById('exportBtn').addEventListener('click', exportBookmarks);
    document.getElementById('importBtn').addEventListener('click', importBookmarks);

    // 右键菜单事件
    document.addEventListener('click', hideContextMenu);
    document.getElementById('cmOpen').addEventListener('click', openBookmarkFromContextMenu);
    document.getElementById('cmOpenNewTab').addEventListener('click', openBookmarkInNewTabFromContextMenu);
    document.getElementById('cmEdit').addEventListener('click', editBookmarkFromContextMenu);
    document.getElementById('cmDelete').addEventListener('click', deleteBookmarkFromContextMenu);
    document.getElementById('cmMove').addEventListener('click', moveBookmarkFromContextMenu);
    document.getElementById('cmCopyUrl').addEventListener('click', copyBookmarkUrlFromContextMenu);
}

// 获取书签数据
async function getBookmarks() {
    try {
        return await chrome.bookmarks.getTree();
    } catch (error) {
        console.error('获取书签树失败:', error);
        throw new Error('获取书签树失败: ' + error.message);
    }
}

// 渲染书签文件夹树
function renderFolderTree(bookmarks, parentElement = null) {
    // 清空现有内容
    const folderTreeElement = parentElement || document.getElementById('folderTree');
    if (!parentElement) {
        folderTreeElement.innerHTML = '';
    }

    // 创建文件夹列表
    const folderList = document.createElement('ul');
    folderList.className = 'folder-list';

    // 遍历书签树
    bookmarks.forEach(bookmark => {
        if (bookmark.children) {
            // 创建文件夹元素
            const folderItem = document.createElement('li');
            folderItem.className = 'folder-item';
            folderItem.dataset.folderId = bookmark.id;

            // 创建文件夹图标和标题
            const folderHeader = document.createElement('div');
            folderHeader.className = 'folder-header';

            const expandIcon = document.createElement('span');
            expandIcon.className = 'expand-icon';
            expandIcon.textContent = '►';
            expandIcon.addEventListener('click', toggleFolder);

            const folderIcon = document.createElement('span');
            folderIcon.className = 'folder-icon';
            folderIcon.textContent = '📁';

            const folderTitle = document.createElement('span');
            folderTitle.className = 'folder-title';
            folderTitle.textContent = bookmark.title || '未命名文件夹';
            folderTitle.addEventListener('click', () => {
                selectFolder(bookmark.id);
            });

            // 组装文件夹头部
            folderHeader.appendChild(expandIcon);
            folderHeader.appendChild(folderIcon);
            folderHeader.appendChild(folderTitle);
            folderItem.appendChild(folderHeader);

            // 如果有子文件夹，递归渲染
            if (bookmark.children.length > 0) {
                const subFolders = bookmark.children.filter(child => child.children);
                if (subFolders.length > 0) {
                    const subFolderContainer = document.createElement('div');
                    subFolderContainer.className = 'subfolder-container hidden';
                    renderFolderTree(subFolders, subFolderContainer);
                    folderItem.appendChild(subFolderContainer);
                }
            }

            // 添加到文件夹列表
            folderList.appendChild(folderItem);
        }
    });

    // 添加文件夹列表到DOM
    folderTreeElement.appendChild(folderList);
}

// 切换文件夹展开/折叠
function toggleFolder(event) {
    const expandIcon = event.target;
    const folderItem = expandIcon.closest('.folder-item');
    const subfolderContainer = folderItem.querySelector('.subfolder-container');

    if (subfolderContainer) {
        if (subfolderContainer.classList.contains('hidden')) {
            // 展开文件夹
            subfolderContainer.classList.remove('hidden');
            expandIcon.textContent = '▼';
        } else {
            // 折叠文件夹
            subfolderContainer.classList.add('hidden');
            expandIcon.textContent = '►';
        }
    }
}

// 选择文件夹并显示其中的书签
async function selectFolder(folderId) {
    // 更新当前选中的文件夹
    currentFolder = folderId;

    // 移除之前的选中状态
    const folderItems = document.querySelectorAll('.folder-item');
    folderItems.forEach(item => item.classList.remove('selected'));

    // 添加新的选中状态
    const selectedFolder = document.querySelector(`.folder-item[data-folder-id="${folderId}"]`);
    if (selectedFolder) {
        selectedFolder.classList.add('selected');
    }

    // 显示该文件夹中的书签
    showBookmarksInFolder(folderId);
}

// 显示指定文件夹中的书签
async function showBookmarksInFolder(folderId) {
    try {
        updateStatus('正在加载书签...');

        // 获取指定文件夹中的书签
        const bookmarks = await getBookmarksInFolder(folderId);

        // 更新文件夹名称
        updateCurrentFolderName(bookmarks.title || '未命名文件夹');

        // 渲染书签列表
        renderBookmarkList(bookmarks.children || []);

        updateStatus('就绪');
    } catch (error) {
        console.error('加载书签失败:', error);
        updateStatus('加载失败: ' + error.message, 'error');
    }
}

// 获取指定文件夹中的书签
async function getBookmarksInFolder(folderId) {
    try {
        const bookmarks = await chrome.bookmarks.getSubTree(folderId);
        if (bookmarks && bookmarks.length > 0) {
            return bookmarks[0];
        } else {
            throw new Error('未找到指定文件夹');
        }
    } catch (error) {
        console.error(`获取文件夹 ${folderId} 下书签失败:`, error);
        throw new Error(`获取文件夹下书签失败: ${error.message}`);
    }
}


// 更新当前文件夹名称
function updateCurrentFolderName(name) {
    document.getElementById('currentFolderName').textContent = name;
}

// 渲染书签列表
function renderBookmarkList(bookmarks) {
    const bookmarkListElement = document.getElementById('bookmarkList');
    bookmarkListElement.innerHTML = '';

    if (bookmarks.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = '此文件夹中没有书签';
        bookmarkListElement.appendChild(emptyMessage);
        return;
    }

    const bookmarkTable = document.createElement('table');
    bookmarkTable.className = 'bookmark-table';

    // 创建表头
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const selectHeader = document.createElement('th');
    selectHeader.className = 'select-column';
    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.addEventListener('change', toggleSelectAll);
    selectHeader.appendChild(selectAllCheckbox);

    const titleHeader = document.createElement('th');
    titleHeader.className = 'title-column';
    titleHeader.textContent = '标题';

    const urlHeader = document.createElement('th');
    urlHeader.className = 'url-column';
    urlHeader.textContent = 'URL';

    headerRow.appendChild(selectHeader);
    headerRow.appendChild(titleHeader);
    headerRow.appendChild(urlHeader);
    thead.appendChild(headerRow);
    bookmarkTable.appendChild(thead);

    // 创建表格主体
    const tbody = document.createElement('tbody');

    // 处理书签和子文件夹
    bookmarks.forEach(bookmark => {
        const row = document.createElement('tr');
        row.className = bookmark.children ? 'folder-row' : 'bookmark-row';
        row.dataset.id = bookmark.id;
        row.draggable = true;

        // 添加拖拽事件
        row.addEventListener('dragstart', handleDragStart);
        row.addEventListener('dragover', handleDragOver);
        row.addEventListener('dragenter', handleDragEnter);
        row.addEventListener('dragleave', handleDragLeave);
        row.addEventListener('drop', handleDrop);
        row.addEventListener('dragend', handleDragEnd);

        // 添加右键菜单
        row.addEventListener('contextmenu', showContextMenu);

        // 选择框单元格
        const selectCell = document.createElement('td');
        selectCell.className = 'select-column';
        if (!bookmark.children) {  // 只有书签可选，文件夹不可选
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'bookmark-checkbox';
            selectCell.appendChild(checkbox);
        }

        // 标题单元格
        const titleCell = document.createElement('td');
        titleCell.className = 'title-column';

        const icon = document.createElement('span');
        icon.className = 'item-icon';
        icon.textContent = bookmark.children ? '📁' : '🔖';

        const title = document.createElement('span');
        title.className = 'item-title';
        title.textContent = bookmark.title || (bookmark.children ? '未命名文件夹' : '未命名书签');

        titleCell.appendChild(icon);
        titleCell.appendChild(title);

        // 如果是书签，点击标题就打开书签
        if (!bookmark.children) {
            titleCell.addEventListener('click', () => {
                openBookmark(bookmark.url);
            });
        } else {
            // 如果是文件夹，点击标题就进入该文件夹
            titleCell.addEventListener('click', () => {
                selectFolder(bookmark.id);
            });
        }

        // URL单元格
        const urlCell = document.createElement('td');
        urlCell.className = 'url-column';
        if (bookmark.url) {
            const urlText = document.createElement('span');
            urlText.className = 'url-text';
            urlText.textContent = bookmark.url;
            urlCell.appendChild(urlText);
        }

        row.appendChild(selectCell);
        row.appendChild(titleCell);
        row.appendChild(urlCell);
        tbody.appendChild(row);
    });

    bookmarkTable.appendChild(tbody);
    bookmarkListElement.appendChild(bookmarkTable);
}

// 切换全选/全不选
function toggleSelectAll(event) {
    const checkboxes = document.querySelectorAll('.bookmark-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = event.target.checked;
    });
}

// 处理书签搜索
function handleSearch(event) {
    // 使用延时执行，避免频繁搜索
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = event.target.value;
        if (query.trim().length > 0) {
            searchBookmarks(query);
        } else {
            // 如果搜索框为空，则显示当前文件夹中的书签
            showBookmarksInFolder(currentFolder);
        }
    }, 300);
}

// 搜索书签
async function searchBookmarks(query) {
    if (!query.trim()) return;

    updateStatus('正在搜索...');

    try {
        const results = await chrome.bookmarks.search(query);
        const bookmarkListElement = document.getElementById('bookmarkList');
        bookmarkListElement.innerHTML = '';

        if (results.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = '没有找到匹配的书签';
            bookmarkListElement.appendChild(emptyMessage);
            updateStatus('搜索完成，没有结果');
            return;
        }

        updateCurrentFolderName(`搜索结果: "${query}"`);
        renderBookmarkList(results);
        updateStatus(`搜索完成，找到 ${results.length} 个结果`);
    } catch (error) {
        console.error('搜索书签失败:', error);
        updateStatus('搜索失败: ' + error.message, 'error');
    }
}

// 刷新书签
async function refreshBookmarks() {
    try {
        updateStatus('正在刷新书签...');

        // 重新获取书签树
        bookmarkTree = await getBookmarks();

        // 重新渲染文件夹树
        renderFolderTree(bookmarkTree);

        // 显示当前选中文件夹的书签（如果有）
        if (currentFolder) {
            showBookmarksInFolder(currentFolder);
        } else {
            showBookmarksInFolder(bookmarkTree[0].id);
        }

        updateStatus('刷新完成');
    } catch (error) {
        console.error('刷新书签失败:', error);
        updateStatus('刷新失败: ' + error.message, 'error');
    }
}

// 最小化弹出窗口
function minimizePopup() {
    window.close();
}

// 切换全屏模式
function toggleFullscreen() {
    // 使用消息向后台脚本请求在新标签页打开全屏视图
    chrome.runtime.sendMessage({ action: 'openFullscreen' });
}

// 在新页面打开
function openInNewPage() {
    // 在新标签页中打开主页面
    chrome.tabs.create({ url: chrome.runtime.getURL('main.html') });
}

// 打开书签
function openBookmark(url) {
    if (url) {
        chrome.tabs.create({ url });
    }
}

// 检查书签有效性
async function checkBookmarksValidity() {
    const selectedBookmarks = getSelectedBookmarks();

    if (selectedBookmarks.length === 0) {
        updateStatus('请先选择要检查的书签', 'warning');
        return;
    }

    updateStatus(`正在检查 ${selectedBookmarks.length} 个书签的有效性...`);

    try {
        // 使用书签管理器模块检查URL有效性
        const results = await Promise.all(
            selectedBookmarks.map(bookmark =>
                bookmarkManager.checkBookmarkValidity(bookmark.url)
                    .then(result => ({ ...result, id: bookmark.id }))
            )
        );

        const valid = results.filter(r => r.valid).length;
        const invalid = results.length - valid;

        updateStatus(`检查完成，${valid} 个有效，${invalid} 个无效`);

        // 更新UI以显示有效性结果
        results.forEach(result => {
            const bookmarkRow = document.querySelector(`.bookmark-row[data-id="${result.id}"]`);
            if (bookmarkRow) {
                if (result.valid) {
                    bookmarkRow.classList.remove('invalid');
                    bookmarkRow.classList.add('valid');
                } else {
                    bookmarkRow.classList.remove('valid');
                    bookmarkRow.classList.add('invalid');
                }
            }
        });
    } catch (error) {
        console.error('检查书签有效性失败:', error);
        updateStatus('检查失败: ' + error.message, 'error');
    }
}

// 删除选中的书签
function deleteSelectedBookmarks() {
    const selectedBookmarks = getSelectedBookmarks();

    if (selectedBookmarks.length === 0) {
        updateStatus('请先选择要删除的书签', 'warning');
        return;
    }

    if (!confirm(`确定要删除选中的 ${selectedBookmarks.length} 个书签吗？`)) {
        return;
    }

    updateStatus(`正在删除 ${selectedBookmarks.length} 个书签...`);

    // 计数器，用于跟踪删除进度
    let deletedCount = 0;
    let errorCount = 0;

    selectedBookmarks.forEach(bookmark => {
        chrome.bookmarks.remove(bookmark.id, () => {
            if (chrome.runtime.lastError) {
                console.error('删除书签失败:', chrome.runtime.lastError);
                errorCount++;
            } else {
                deletedCount++;
            }

            // 检查是否所有书签都已处理
            if (deletedCount + errorCount === selectedBookmarks.length) {
                // 刷新书签列表
                refreshBookmarks();
                updateStatus(`删除完成，成功删除 ${deletedCount} 个书签，${errorCount} 个失败`);
            }
        });
    });
}

// 移动选中的书签到指定文件夹
function moveSelectedBookmarks() {
    const selectedBookmarks = getSelectedBookmarks();

    if (selectedBookmarks.length === 0) {
        updateStatus('请先选择要移动的书签', 'warning');
        return;
    }

    // 获取所有文件夹，用于创建选择列表
    chrome.bookmarks.getTree(bookmarkTree => {
        // 创建文件夹选择对话框
        const folderSelector = document.createElement('div');
        folderSelector.className = 'folder-selector';

        const selectorHeader = document.createElement('div');
        selectorHeader.className = 'selector-header';
        selectorHeader.textContent = '选择目标文件夹';

        const selectorContent = document.createElement('div');
        selectorContent.className = 'selector-content';

        // 递归构建文件夹选择列表
        function buildFolderList(folders, container, depth = 0) {
            folders.forEach(folder => {
                if (folder.children) {
                    const folderItem = document.createElement('div');
                    folderItem.className = 'selector-folder-item';
                    folderItem.style.paddingLeft = `${depth * 20}px`;
                    folderItem.dataset.folderId = folder.id;

                    const folderIcon = document.createElement('span');
                    folderIcon.className = 'folder-icon';
                    folderIcon.textContent = '📁';

                    const folderTitle = document.createElement('span');
                    folderTitle.textContent = folder.title || '未命名文件夹';

                    folderItem.appendChild(folderIcon);
                    folderItem.appendChild(folderTitle);

                    // 点击文件夹时移动书签
                    folderItem.addEventListener('click', () => {
                        const targetFolderId = folder.id;
                        moveBookmarks(selectedBookmarks, targetFolderId);
                        document.body.removeChild(folderSelector);
                    });

                    container.appendChild(folderItem);

                    // 递归处理子文件夹
                    const subFolders = folder.children.filter(child => child.children);
                    if (subFolders.length > 0) {
                        buildFolderList(subFolders, container, depth + 1);
                    }
                }
            });
        }

        buildFolderList(bookmarkTree, selectorContent);

        const selectorFooter = document.createElement('div');
        selectorFooter.className = 'selector-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(folderSelector);
        });

        selectorFooter.appendChild(cancelBtn);

        folderSelector.appendChild(selectorHeader);
        folderSelector.appendChild(selectorContent);
        folderSelector.appendChild(selectorFooter);

        document.body.appendChild(folderSelector);
    });
}

// 移动书签到指定文件夹
function moveBookmarks(bookmarks, targetFolderId) {
    updateStatus(`正在移动 ${bookmarks.length} 个书签...`);

    // 计数器，用于跟踪移动进度
    let movedCount = 0;
    let errorCount = 0;

    bookmarks.forEach(bookmark => {
        chrome.bookmarks.move(bookmark.id, { parentId: targetFolderId }, () => {
            if (chrome.runtime.lastError) {
                console.error('移动书签失败:', chrome.runtime.lastError);
                errorCount++;
            } else {
                movedCount++;
            }

            // 检查是否所有书签都已处理
            if (movedCount + errorCount === bookmarks.length) {
                // 刷新书签列表
                refreshBookmarks();
                updateStatus(`移动完成，成功移动 ${movedCount} 个书签，${errorCount} 个失败`);
            }
        });
    });
}

// 导出书签
async function exportBookmarks() {
    try {
        const jsonData = await bookmarkManager.exportBookmarksAsJson();

        // 创建下载链接
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bookmarks_export_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        updateStatus('书签已成功导出');
    } catch (error) {
        console.error('导出书签失败:', error);
        updateStatus('导出失败: ' + error.message, 'error');
    }
}

// 导入书签
function importBookmarks() {
    // 创建文件输入元素
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';

    fileInput.addEventListener('change', async event => {
        if (event.target.files.length === 0) {
            return;
        }

        const file = event.target.files[0];
        const reader = new FileReader();

        reader.onload = async e => {
            try {
                const bookmarkData = e.target.result;

                // 使用书签管理器导入书签
                const results = await bookmarkManager.importBookmarksFromJson(bookmarkData);

                refreshBookmarks();
                updateStatus(`书签导入成功，导入了 ${results.length} 个书签`);
            } catch (error) {
                console.error('导入书签失败:', error);
                updateStatus('导入失败: ' + error.message, 'error');
            }
        };

        reader.onerror = () => {
            updateStatus('导入失败: 无法读取文件', 'error');
        };

        reader.readAsText(file);
    });

    fileInput.click();
}

// 获取选中的书签
function getSelectedBookmarks() {
    const selectedBookmarks = [];
    const checkboxes = document.querySelectorAll('.bookmark-checkbox:checked');

    checkboxes.forEach(checkbox => {
        const bookmarkRow = checkbox.closest('.bookmark-row');
        if (bookmarkRow) {
            const bookmarkId = bookmarkRow.dataset.id;
            const title = bookmarkRow.querySelector('.item-title').textContent;
            const url = bookmarkRow.querySelector('.url-text')?.textContent;

            selectedBookmarks.push({
                id: bookmarkId,
                title,
                url
            });
        }
    });

    return selectedBookmarks;
}

// 更新状态信息
function updateStatus(message, type = 'info') {
    const statusBar = document.getElementById('statusBar');
    const statusMessage = document.getElementById('statusMessage');

    statusMessage.textContent = message;

    // 移除之前的类型
    statusBar.classList.remove('info', 'warning', 'error', 'success');

    // 添加新的类型
    statusBar.classList.add(type);
}

// 处理拖动开始
function handleDragStart(event) {
    draggedElement = event.target;

    // 添加拖动效果
    event.target.classList.add('dragging');

    // 存储被拖动的数据
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', event.target.dataset.id);
}

// 处理拖动经过
function handleDragOver(event) {
    event.preventDefault();
    return false;
}

// 处理拖动进入
function handleDragEnter(event) {
    event.target.classList.add('drag-over');
}

// 处理拖动离开
function handleDragLeave(event) {
    event.target.classList.remove('drag-over');
}

// 处理释放
function handleDrop(event) {
    event.stopPropagation();
    event.preventDefault();

    // 移除拖动过程中的样式
    event.target.classList.remove('drag-over');

    // 获取目标行和拖动的数据
    const targetRow = event.target.closest('tr');
    if (!targetRow) return;

    const draggedId = event.dataTransfer.getData('text/plain');
    const targetId = targetRow.dataset.id;

    // 不能将项目拖放到自身
    if (draggedId === targetId) return;

    // 检查目标是文件夹还是书签
    const isTargetFolder = targetRow.classList.contains('folder-row');

    if (isTargetFolder) {
        // 如果目标是文件夹，将拖动的项目移动到该文件夹中
        chrome.bookmarks.move(draggedId, { parentId: targetId }, () => {
            if (chrome.runtime.lastError) {
                console.error('移动失败:', chrome.runtime.lastError);
                updateStatus('移动失败: ' + chrome.runtime.lastError.message, 'error');
            } else {
                updateStatus('移动成功');
                refreshBookmarks();
            }
        });
    } else {
        // 如果目标是书签，将拖动的项目移动到目标的相同位置
        chrome.bookmarks.get(targetId, targetBookmarks => {
            if (chrome.runtime.lastError || !targetBookmarks || targetBookmarks.length === 0) {
                console.error('获取目标书签失败:', chrome.runtime.lastError);
                return;
            }

            const targetBookmark = targetBookmarks[0];

            chrome.bookmarks.move(
                draggedId,
                {
                    parentId: targetBookmark.parentId,
                    index: targetBookmark.index
                },
                () => {
                    if (chrome.runtime.lastError) {
                        console.error('移动失败:', chrome.runtime.lastError);
                        updateStatus('移动失败: ' + chrome.runtime.lastError.message, 'error');
                    } else {
                        updateStatus('移动成功');
                        refreshBookmarks();
                    }
                }
            );
        });
    }

    return false;
}

// 处理拖动结束
function handleDragEnd(event) {
    // 清除拖动样式
    event.target.classList.remove('dragging');

    // 清除拖动过程中的变量
    draggedElement = null;
}

// 显示右键菜单
function showContextMenu(event) {
    event.preventDefault();

    // 获取被点击的行
    const row = event.target.closest('tr');
    if (!row) return;

    const contextMenu = document.getElementById('contextMenu');
    const bookmarkId = row.dataset.id;

    // 为菜单项设置当前书签ID
    contextMenu.dataset.bookmarkId = bookmarkId;

    // 检查是文件夹还是书签
    const isFolder = row.classList.contains('folder-row');

    // 根据类型显示/隐藏菜单项
    document.getElementById('cmOpen').style.display = isFolder ? 'none' : 'block';
    document.getElementById('cmOpenNewTab').style.display = isFolder ? 'none' : 'block';
    document.getElementById('cmCopyUrl').style.display = isFolder ? 'none' : 'block';

    // 定位菜单到鼠标位置
    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.top = `${event.pageY}px`;

    // 显示菜单
    contextMenu.style.display = 'block';
}

// 隐藏右键菜单
function hideContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.display = 'none';
}

// 从右键菜单打开书签
function openBookmarkFromContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    const bookmarkId = contextMenu.dataset.bookmarkId;

    if (bookmarkId) {
        chrome.bookmarks.get(bookmarkId, bookmarks => {
            if (bookmarks && bookmarks.length > 0 && bookmarks[0].url) {
                openBookmark(bookmarks[0].url);
            }
            hideContextMenu();
        });
    }
}

// 从右键菜单在新标签页打开书签
function openBookmarkInNewTabFromContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    const bookmarkId = contextMenu.dataset.bookmarkId;

    if (bookmarkId) {
        chrome.bookmarks.get(bookmarkId, bookmarks => {
            if (bookmarks && bookmarks.length > 0 && bookmarks[0].url) {
                chrome.tabs.create({ url: bookmarks[0].url });
            }
            hideContextMenu();
        });
    }
}

// 从右键菜单编辑书签
function editBookmarkFromContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    const bookmarkId = contextMenu.dataset.bookmarkId;

    if (bookmarkId) {
        chrome.bookmarks.get(bookmarkId, bookmarks => {
            if (bookmarks && bookmarks.length > 0) {
                const bookmark = bookmarks[0];

                // 创建编辑对话框
                const editDialog = document.createElement('div');
                editDialog.className = 'edit-dialog';

                const dialogHeader = document.createElement('div');
                dialogHeader.className = 'dialog-header';
                dialogHeader.textContent = '编辑书签';

                const dialogContent = document.createElement('div');
                dialogContent.className = 'dialog-content';

                // 标题输入
                const titleLabel = document.createElement('label');
                titleLabel.textContent = '标题:';
                const titleInput = document.createElement('input');
                titleInput.type = 'text';
                titleInput.value = bookmark.title || '';

                // URL输入（仅对书签显示）
                let urlLabel, urlInput;
                if (bookmark.url) {
                    urlLabel = document.createElement('label');
                    urlLabel.textContent = 'URL:';
                    urlInput = document.createElement('input');
                    urlInput.type = 'text';
                    urlInput.value = bookmark.url || '';
                }

                // 按钮区域
                const dialogFooter = document.createElement('div');
                dialogFooter.className = 'dialog-footer';

                const saveBtn = document.createElement('button');
                saveBtn.textContent = '保存';
                saveBtn.addEventListener('click', () => {
                    const updates = {
                        title: titleInput.value
                    };

                    if (urlInput) {
                        updates.url = urlInput.value;
                    }

                    chrome.bookmarks.update(bookmarkId, updates, () => {
                        if (chrome.runtime.lastError) {
                            updateStatus('更新失败: ' + chrome.runtime.lastError.message, 'error');
                        } else {
                            updateStatus('书签已更新');
                            refreshBookmarks();
                        }
                        document.body.removeChild(editDialog);
                    });
                });

                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = '取消';
                cancelBtn.addEventListener('click', () => {
                    document.body.removeChild(editDialog);
                });

                // 组装对话框
                dialogContent.appendChild(titleLabel);
                dialogContent.appendChild(titleInput);

                if (urlLabel && urlInput) {
                    dialogContent.appendChild(urlLabel);
                    dialogContent.appendChild(urlInput);
                }

                dialogFooter.appendChild(saveBtn);
                dialogFooter.appendChild(cancelBtn);

                editDialog.appendChild(dialogHeader);
                editDialog.appendChild(dialogContent);
                editDialog.appendChild(dialogFooter);

                document.body.appendChild(editDialog);
            }

            hideContextMenu();
        });
    }
}

// 从右键菜单删除书签
function deleteBookmarkFromContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    const bookmarkId = contextMenu.dataset.bookmarkId;

    if (bookmarkId) {
        chrome.bookmarks.get(bookmarkId, bookmarks => {
            if (bookmarks && bookmarks.length > 0) {
                const bookmark = bookmarks[0];

                if (confirm(`确定要删除"${bookmark.title}"吗？`)) {
                    const removeFunction = bookmark.children ? 'removeTree' : 'remove';

                    chrome.bookmarks[removeFunction](bookmarkId, () => {
                        if (chrome.runtime.lastError) {
                            updateStatus('删除失败: ' + chrome.runtime.lastError.message, 'error');
                        } else {
                            updateStatus('已成功删除');
                            refreshBookmarks();
                        }
                    });
                }
            }

            hideContextMenu();
        });
    }
}

// 从右键菜单移动书签
function moveBookmarkFromContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    const bookmarkId = contextMenu.dataset.bookmarkId;

    if (bookmarkId) {
        chrome.bookmarks.get(bookmarkId, bookmarks => {
            if (bookmarks && bookmarks.length > 0) {
                const bookmark = bookmarks[0];

                // 获取所有文件夹，用于创建选择列表
                chrome.bookmarks.getTree(bookmarkTree => {
                    // 创建文件夹选择对话框
                    const folderSelector = document.createElement('div');
                    folderSelector.className = 'folder-selector';

                    const selectorHeader = document.createElement('div');
                    selectorHeader.className = 'selector-header';
                    selectorHeader.textContent = `选择将"${bookmark.title}"移动到的文件夹`;

                    const selectorContent = document.createElement('div');
                    selectorContent.className = 'selector-content';

                    // 递归构建文件夹选择列表
                    function buildFolderList(folders, container, depth = 0) {
                        folders.forEach(folder => {
                            if (folder.children) {
                                const folderItem = document.createElement('div');
                                folderItem.className = 'selector-folder-item';
                                folderItem.style.paddingLeft = `${depth * 20}px`;
                                folderItem.dataset.folderId = folder.id;

                                const folderIcon = document.createElement('span');
                                folderIcon.className = 'folder-icon';
                                folderIcon.textContent = '📁';

                                const folderTitle = document.createElement('span');
                                folderTitle.textContent = folder.title || '未命名文件夹';

                                folderItem.appendChild(folderIcon);
                                folderItem.appendChild(folderTitle);

                                // 点击文件夹时移动书签
                                folderItem.addEventListener('click', () => {
                                    const targetFolderId = folder.id;
                                    chrome.bookmarks.move(bookmarkId, { parentId: targetFolderId }, () => {
                                        if (chrome.runtime.lastError) {
                                            updateStatus('移动失败: ' + chrome.runtime.lastError.message, 'error');
                                        } else {
                                            updateStatus('移动成功');
                                            refreshBookmarks();
                                        }
                                        document.body.removeChild(folderSelector);
                                    });
                                });

                                container.appendChild(folderItem);

                                // 递归处理子文件夹
                                const subFolders = folder.children.filter(child => child.children);
                                if (subFolders.length > 0) {
                                    buildFolderList(subFolders, container, depth + 1);
                                }
                            }
                        });
                    }

                    buildFolderList(bookmarkTree, selectorContent);

                    const selectorFooter = document.createElement('div');
                    selectorFooter.className = 'selector-footer';

                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = '取消';
                    cancelBtn.addEventListener('click', () => {
                        document.body.removeChild(folderSelector);
                    });

                    selectorFooter.appendChild(cancelBtn);

                    folderSelector.appendChild(selectorHeader);
                    folderSelector.appendChild(selectorContent);
                    folderSelector.appendChild(selectorFooter);

                    document.body.appendChild(folderSelector);
                });
            }

            hideContextMenu();
        });
    }
}

// 从右键菜单复制书签URL
function copyBookmarkUrlFromContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    const bookmarkId = contextMenu.dataset.bookmarkId;

    if (bookmarkId) {
        chrome.bookmarks.get(bookmarkId, bookmarks => {
            if (bookmarks && bookmarks.length > 0 && bookmarks[0].url) {
                // 创建临时输入框来复制URL
                const tempInput = document.createElement('input');
                tempInput.value = bookmarks[0].url;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);

                updateStatus('URL已复制到剪贴板');
            }

            hideContextMenu();
        });
    }
}

// 辅助函数：处理Chrome API错误
function handleChromeError(error) {
    console.error('Chrome API 错误:', error);
    return Promise.reject(new Error(error?.message || '未知错误'));
}

// 获取书签分类建议
async function getBookmarkCategorySuggestion(url, title) {
    try {
        return await categoryManager.categorizeUrl(url, title);
    } catch (error) {
        console.error('获取分类建议失败:', error);
        return null;
    }
}
