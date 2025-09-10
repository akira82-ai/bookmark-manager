document.addEventListener('DOMContentLoaded', function() {
  const bookmarkTitle = document.getElementById('bookmark-title');
  const bookmarkUrl = document.getElementById('bookmark-url');
  const addBookmarkBtn = document.getElementById('add-bookmark-btn');
  const bookmarksContainer = document.getElementById('bookmarks-container');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');

  // 加载书签
  loadBookmarks();

  // 添加书签
  addBookmarkBtn.addEventListener('click', function() {
    const title = bookmarkTitle.value.trim();
    const url = bookmarkUrl.value.trim();

    if (!title || !url) {
      alert('请输入书签标题和URL');
      return;
    }

    addBookmark(title, url);
    bookmarkTitle.value = '';
    bookmarkUrl.value = '';
    loadBookmarks();
  });

  // 导出书签
  exportBtn.addEventListener('click', function() {
    chrome.storage.local.get(['bookmarks'], function(result) {
      const bookmarks = result.bookmarks || [];
      const dataStr = JSON.stringify(bookmarks, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = 'bookmarks.json';
      link.click();
    });
  });

  // 导入书签
  importBtn.addEventListener('click', function() {
    importFile.click();
  });

  importFile.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const bookmarks = JSON.parse(e.target.result);
          chrome.storage.local.set({bookmarks: bookmarks}, function() {
            loadBookmarks();
            alert('书签导入成功！');
          });
        } catch (error) {
          alert('导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
    }
  });

  // 添加书签函数
  function addBookmark(title, url) {
    chrome.storage.local.get(['bookmarks'], function(result) {
      const bookmarks = result.bookmarks || [];
      bookmarks.push({
        id: Date.now(),
        title: title,
        url: url,
        createdAt: new Date().toISOString()
      });
      
      chrome.storage.local.set({bookmarks: bookmarks}, function() {
        console.log('书签添加成功');
      });
    });
  }

  // 加载书签函数
  function loadBookmarks() {
    chrome.storage.local.get(['bookmarks'], function(result) {
      const bookmarks = result.bookmarks || [];
      bookmarksContainer.innerHTML = '';

      bookmarks.forEach(bookmark => {
        const bookmarkElement = createBookmarkElement(bookmark);
        bookmarksContainer.appendChild(bookmarkElement);
      });
    });
  }

  // 创建书签元素
  function createBookmarkElement(bookmark) {
    const div = document.createElement('div');
    div.className = 'bookmark-item';
    
    const title = document.createElement('a');
    title.href = bookmark.url;
    title.target = '_blank';
    title.textContent = bookmark.title;
    title.className = 'bookmark-title';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '删除';
    deleteBtn.className = 'delete-btn';
    deleteBtn.addEventListener('click', function() {
      deleteBookmark(bookmark.id);
    });
    
    div.appendChild(title);
    div.appendChild(deleteBtn);
    
    return div;
  }

  // 删除书签
  function deleteBookmark(id) {
    chrome.storage.local.get(['bookmarks'], function(result) {
      let bookmarks = result.bookmarks || [];
      bookmarks = bookmarks.filter(bookmark => bookmark.id !== id);
      
      chrome.storage.local.set({bookmarks: bookmarks}, function() {
        loadBookmarks();
      });
    });
  }
});