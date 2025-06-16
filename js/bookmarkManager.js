/**
 * 书签管理核心功能模块
 * 提供书签的增删改查、移动、导入导出等功能
 */

class BookmarkManager {
  /**
   * 获取所有书签及其结构
   * @returns {Promise<Array>} 书签树结构
   */
  async getBookmarkTree() {
    try {
      return await chrome.bookmarks.getTree();
    } catch (error) {
      console.error('获取书签树失败:', error);
      throw new Error('获取书签树失败: ' + error.message);
    }
  }

  /**
   * 获取指定文件夹下的所有书签
   * @param {string} folderId - 文件夹ID
   * @returns {Promise<Array>} 书签列表
   */
  async getBookmarks(folderId = '1') {
    try {
      return await chrome.bookmarks.getChildren(folderId);
    } catch (error) {
      console.error(`获取文件夹 ${folderId} 下书签失败:`, error);
      throw new Error(`获取文件夹下书签失败: ${error.message}`);
    }
  }

  /**
   * 搜索书签
   * @param {Object} query - 搜索条件
   * @returns {Promise<Array>} 搜索结果
   */
  async searchBookmarks(query) {
    try {
      return await chrome.bookmarks.search(query);
    } catch (error) {
      console.error('搜索书签失败:', error);
      throw new Error('搜索书签失败: ' + error.message);
    }
  }

  /**
   * 获取最近添加的书签
   * @param {number} maxResults - 最大结果数
   * @returns {Promise<Array>} 最近的书签
   */
  async getRecentBookmarks(maxResults = 10) {
    try {
      return await chrome.bookmarks.getRecent(maxResults);
    } catch (error) {
      console.error('获取最近书签失败:', error);
      throw new Error('获取最近书签失败: ' + error.message);
    }
  }

  /**
   * 创建书签或文件夹
   * @param {Object} bookmark - 书签详情
   * @param {string} bookmark.parentId - 父文件夹ID
   * @param {string} bookmark.title - 标题
   * @param {string} [bookmark.url] - URL，如不提供则创建文件夹
   * @returns {Promise<Object>} 创建的书签对象
   */
  async createBookmark(bookmark) {
    try {
      return await chrome.bookmarks.create(bookmark);
    } catch (error) {
      console.error('创建书签失败:', error);
      throw new Error('创建书签失败: ' + error.message);
    }
  }

  /**
   * 编辑书签
   * @param {string} id - 书签ID
   * @param {Object} changes - 要修改的内容
   * @returns {Promise<Object>} 更新后的书签对象
   */
  async updateBookmark(id, changes) {
    try {
      return await chrome.bookmarks.update(id, changes);
    } catch (error) {
      console.error('更新书签失败:', error);
      throw new Error('更新书签失败: ' + error.message);
    }
  }

  /**
   * 重命名书签文件夹
   * 实际调用与updateBookmark相同，但专门用于文件夹操作
   * @param {string} folderId - 文件夹ID
   * @param {string} newName - 新的文件夹名
   * @returns {Promise<Object>} 更新后的文件夹对象
   */
  async renameFolder(folderId, newName) {
    try {
      return await chrome.bookmarks.update(folderId, { title: newName });
    } catch (error) {
      console.error('重命名文件夹失败:', error);
      throw new Error('重命名文件夹失败: ' + error.message);
    }
  }

  /**
   * 删除书签
   * @param {string} id - 书签ID
   * @returns {Promise<void>}
   */
  async removeBookmark(id) {
    try {
      await chrome.bookmarks.remove(id);
      return true;
    } catch (error) {
      console.error('删除书签失败:', error);
      throw new Error('删除书签失败: ' + error.message);
    }
  }

  /**
   * 删除书签文件夹及其所有内容
   * @param {string} id - 文件夹ID
   * @returns {Promise<void>}
   */
  async removeBookmarkTree(id) {
    try {
      await chrome.bookmarks.removeTree(id);
      return true;
    } catch (error) {
      console.error('删除文件夹失败:', error);
      throw new Error('删除文件夹失败: ' + error.message);
    }
  }

  /**
   * 移动书签
   * @param {string} id - 书签ID
   * @param {Object} destination - 目标位置
   * @param {string} destination.parentId - 父文件夹ID
   * @param {number} [destination.index] - 在父文件夹中的索引位置
   * @returns {Promise<Object>} 移动后的书签对象
   */
  async moveBookmark(id, destination) {
    try {
      return await chrome.bookmarks.move(id, destination);
    } catch (error) {
      console.error('移动书签失败:', error);
      throw new Error('移动书签失败: ' + error.message);
    }
  }

  /**
   * 批量移动书签
   * @param {Array<string>} ids - 书签ID数组
   * @param {string} parentId - 目标文件夹ID
   * @returns {Promise<Array>} 移动后的书签对象数组
   */
  async moveBookmarks(ids, parentId) {
    try {
      const results = [];
      for (const id of ids) {
        const result = await chrome.bookmarks.move(id, { parentId });
        results.push(result);
      }
      return results;
    } catch (error) {
      console.error('批量移动书签失败:', error);
      throw new Error('批量移动书签失败: ' + error.message);
    }
  }

  /**
   * 导出书签为JSON格式
   * @returns {Promise<string>} 包含书签的JSON字符串
   */
  async exportBookmarksAsJson() {
    try {
      const bookmarkTree = await this.getBookmarkTree();
      return JSON.stringify(bookmarkTree, null, 2);
    } catch (error) {
      console.error('导出书签失败:', error);
      throw new Error('导出书签失败: ' + error.message);
    }
  }

  /**
   * 导出书签为HTML格式
   * @returns {Promise<string>} 包含书签的HTML字符串
   */
  async exportBookmarksAsHtml() {
    try {
      const bookmarkTree = await this.getBookmarkTree();
      let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n';
      html += '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n';
      html += '<TITLE>书签</TITLE>\n';
      html += '<H1>书签</H1>\n';
      html += '<DL><p>\n';
      html += this._convertBookmarkTreeToHtml(bookmarkTree[0].children);
      html += '</DL><p>\n';
      return html;
    } catch (error) {
      console.error('导出HTML书签失败:', error);
      throw new Error('导出HTML书签失败: ' + error.message);
    }
  }

  /**
   * 递归将书签树转换为HTML格式
   * @param {Array} bookmarks - 书签数组
   * @param {number} indent - 缩进级别
   * @returns {string} HTML字符串
   * @private
   */
  _convertBookmarkTreeToHtml(bookmarks, indent = 1) {
    let html = '';
    const indentStr = '    '.repeat(indent);
    
    bookmarks.forEach(bookmark => {
      if (bookmark.url) {
        // 这是一个普通书签
        html += `${indentStr}<DT><A HREF="${bookmark.url}" ADD_DATE="${Math.floor(Date.now() / 1000)}">${bookmark.title}</A>\n`;
      } else {
        // 这是一个文件夹
        html += `${indentStr}<DT><H3 ADD_DATE="${Math.floor(Date.now() / 1000)}" LAST_MODIFIED="${Math.floor(Date.now() / 1000)}">${bookmark.title}</H3>\n`;
        html += `${indentStr}<DL><p>\n`;
        if (bookmark.children && bookmark.children.length > 0) {
          html += this._convertBookmarkTreeToHtml(bookmark.children, indent + 1);
        }
        html += `${indentStr}</DL><p>\n`;
      }
    });
    
    return html;
  }

  /**
   * 导入书签(从JSON)
   * @param {string} jsonStr - JSON格式的书签数据
   * @param {string} folderId - 导入到的文件夹ID
   * @returns {Promise<Array>} 导入的书签对象数组
   */
  async importBookmarksFromJson(jsonStr, folderId = '1') {
    try {
      const bookmarks = JSON.parse(jsonStr);
      return await this._importBookmarksRecursive(bookmarks, folderId);
    } catch (error) {
      console.error('导入JSON书签失败:', error);
      throw new Error('导入JSON书签失败: ' + error.message);
    }
  }

  /**
   * 递归导入书签
   * @param {Array} bookmarks - 书签数组
   * @param {string} parentId - 父文件夹ID
   * @returns {Promise<Array>} 导入的书签对象数组
   * @private
   */
  async _importBookmarksRecursive(bookmarks, parentId) {
    const results = [];
    
    if (!Array.isArray(bookmarks)) {
      if (Array.isArray(bookmarks.children)) {
        bookmarks = bookmarks.children;
      } else {
        throw new Error('无效的书签格式');
      }
    }

    for (const bookmark of bookmarks) {
      if (bookmark.url) {
        // 创建书签
        const newBookmark = await this.createBookmark({
          parentId,
          title: bookmark.title || '未命名书签',
          url: bookmark.url
        });
        results.push(newBookmark);
      } else if (bookmark.children) {
        // 创建文件夹
        const newFolder = await this.createBookmark({
          parentId,
          title: bookmark.title || '未命名文件夹'
        });
        
        // 递归处理文件夹内容
        const childResults = await this._importBookmarksRecursive(bookmark.children, newFolder.id);
        results.push(newFolder);
        results.push(...childResults);
      }
    }
    
    return results;
  }

  /**
   * 导入HTML格式的书签
   * @param {string} html - HTML格式的书签数据
   * @param {string} folderId - 目标文件夹ID
   * @returns {Promise<Array>} 创建的书签对象数组
   */
  async importBookmarksFromHtml(html, folderId = '1') {
    try {
      // 创建一个DOM解析器来解析HTML书签文件
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 找到所有的书签文件夹和链接
      const rootElement = doc.querySelector('DL');
      if (!rootElement) {
        throw new Error('无效的HTML书签格式');
      }
      
      // 解析并导入书签
      return await this._parseAndImportHtmlBookmarks(rootElement, folderId);
    } catch (error) {
      console.error('导入HTML书签失败:', error);
      throw new Error('导入HTML书签失败: ' + error.message);
    }
  }

  /**
   * 递归解析HTML书签并导入
   * @param {Element} element - HTML元素
   * @param {string} parentId - 父文件夹ID
   * @returns {Promise<Array>} 导入的书签对象数组
   * @private
   */
  async _parseAndImportHtmlBookmarks(element, parentId) {
    const results = [];
    
    // 遍历所有的DT元素
    const dtElements = element.querySelectorAll(':scope > DT');
    for (const dt of dtElements) {
      // 检查是否是文件夹
      const h3 = dt.querySelector('H3');
      if (h3) {
        // 是文件夹
        const folderName = h3.textContent || '未命名文件夹';
        const newFolder = await this.createBookmark({
          parentId,
          title: folderName
        });
        
        // 处理文件夹内容
        const dl = dt.querySelector('DL');
        if (dl) {
          const childResults = await this._parseAndImportHtmlBookmarks(dl, newFolder.id);
          results.push(...childResults);
        }
        
        results.push(newFolder);
      } else {
        // 是书签
        const a = dt.querySelector('A');
        if (a) {
          const bookmarkTitle = a.textContent || '未命名书签';
          const bookmarkUrl = a.getAttribute('HREF');
          
          if (bookmarkUrl) {
            const newBookmark = await this.createBookmark({
              parentId,
              title: bookmarkTitle,
              url: bookmarkUrl
            });
            
            results.push(newBookmark);
          }
        }
      }
    }
    
    return results;
  }

  /**
   * 检查书签有效性
   * @param {string} url - 要检查的URL
   * @returns {Promise<Object>} 检查结果
   */
  async checkBookmarkValidity(url) {
    try {
      const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
      return {
        url,
        valid: response.ok,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error) {
      return {
        url,
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * 批量检查书签有效性
   * @param {Array<string>} urls - URL数组
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Array>} 检查结果数组
   */
  async checkBookmarksValidity(urls, progressCallback = null) {
    const results = [];
    let completed = 0;
    const total = urls.length;
    
    for (const url of urls) {
      const result = await this.checkBookmarkValidity(url);
      results.push(result);
      
      completed++;
      if (progressCallback) {
        progressCallback(completed, total);
      }
    }
    
    return results;
  }

  /**
   * 获取无效书签
   * @param {string} folderId - 要检查的文件夹ID
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Array>} 无效书签列表
   */
  async findInvalidBookmarks(folderId = '1', progressCallback = null) {
    try {
      // 获取所有书签
      const allBookmarks = await this._getAllBookmarksInFolder(folderId);
      const bookmarksWithUrl = allBookmarks.filter(bookmark => bookmark.url);
      
      // 检查每个书签的有效性
      const results = await this.checkBookmarksValidity(
        bookmarksWithUrl.map(bookmark => bookmark.url),
        progressCallback
      );
      
      // 筛选出无效的书签
      const invalidResults = results.filter(result => !result.valid);
      
      // 将结果与原始书签关联
      return invalidResults.map(result => {
        const bookmark = bookmarksWithUrl.find(bm => bm.url === result.url);
        return { ...bookmark, validityResult: result };
      });
    } catch (error) {
      console.error('查找无效书签失败:', error);
      throw new Error('查找无效书签失败: ' + error.message);
    }
  }

  /**
   * 递归获取文件夹中的所有书签
   * @param {string} folderId - 文件夹ID
   * @returns {Promise<Array>} 书签数组
   * @private
   */
  async _getAllBookmarksInFolder(folderId) {
    const bookmarks = await this.getBookmarks(folderId);
    const results = [...bookmarks];
    
    for (const bookmark of bookmarks) {
      if (!bookmark.url) {
        // 这是一个文件夹
        const childBookmarks = await this._getAllBookmarksInFolder(bookmark.id);
        results.push(...childBookmarks);
      }
    }
    
    return results;
  }
}

// 导出书签管理器的实例
const bookmarkManager = new BookmarkManager();
export default bookmarkManager;
