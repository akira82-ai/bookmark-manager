// 内容脚本 - 在网页中运行的脚本

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getPageInfo') {
    const pageInfo = {
      title: document.title,
      url: window.location.href,
      description: getMetaDescription()
    };
    sendResponse(pageInfo);
  }
});

// 获取页面描述
function getMetaDescription() {
  const metaDescription = document.querySelector('meta[name="description"]');
  return metaDescription ? metaDescription.getAttribute('content') : '';
}

// 添加右键菜单功能
document.addEventListener('contextmenu', function(event) {
  // 可以在这里添加右键菜单相关的功能
});

// 添加键盘快捷键
document.addEventListener('keydown', function(event) {
  // Ctrl+Shift+B 快速添加书签
  if (event.ctrlKey && event.shiftKey && event.key === 'B') {
    event.preventDefault();
    const pageInfo = {
      title: document.title,
      url: window.location.href,
      description: getMetaDescription()
    };
    
    // 发送消息到background script
    chrome.runtime.sendMessage({
      action: 'quickAddBookmark',
      data: pageInfo
    });
  }
});

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
  // 可以在这里添加页面加载完成后的功能
});

console.log('Bookmark Manager content script loaded');