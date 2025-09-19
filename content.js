// 内容脚本 - 弹窗显示功能

// 监听来自popup的消息
try {
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getPageInfo') {
      const pageInfo = {
        title: document.title,
        url: window.location.href,
        description: safeGetMetaDescription()
      };
      sendResponse(pageInfo);
    } else if (request.action === 'showReminder') {
      showReminderToast(request.data);
      sendResponse({success: true});
    }
  });
} catch (error) {
  console.warn('消息监听器设置失败:', error);
}

// 显示提醒弹窗
function showReminderToast(data) {
  // 移除已存在的弹窗
  const existingToast = document.getElementById('bookmark-reminder-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // 创建弹窗元素
  const toast = document.createElement('div');
  toast.id = 'bookmark-reminder-toast';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: white;
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 15px;
    width: 250px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    font-family: Arial, sans-serif;
  `;
  
  toast.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px; color: #333;">💡 智能提醒</div>
    <div style="margin-bottom: 15px; font-size: 14px; color: #333;">您近期已访问多次当前网站，需要收藏吗？</div>
    <div style="display: flex; gap: 5px;">
      <button id="btnAdd" style="padding: 5px 10px; border: none; background: #007bff; color: white; border-radius: 3px; cursor: pointer;">收藏</button>
      <button id="btnDismiss" style="padding: 5px 10px; border: 1px solid #ccc; background: white; color: #333; border-radius: 3px; cursor: pointer; margin-left: auto;">关闭</button>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // 绑定事件
  document.getElementById('btnAdd').onclick = () => {
    safeSendMessage({
      action: 'addBookmarkFromReminder',
      data: {
        url: data.url,
        title: data.title,
        type: data.type
      }
    }).then(() => {
      toast.innerHTML = '<div style="text-align: center; color: #333;">✓ 已添加到收藏</div>';
      setTimeout(() => toast.remove(), 2000);
    }).catch(error => {
      console.error('添加书签失败:', error);
      toast.remove();
    });
  };
  
  document.getElementById('btnDismiss').onclick = () => {
    toast.remove();
  };
  
  // 10秒后自动关闭
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 10000);
}


// 获取页面描述
function getMetaDescription() {
  try {
    const metaDescription = document.querySelector('meta[name="description"]');
    return metaDescription ? metaDescription.getAttribute('content') : '';
  } catch (error) {
    return '';
  }
}

// 添加键盘快捷键
document.addEventListener('keydown', function(event) {
  // Ctrl+Shift+T 触发智能提醒弹窗
  if (event.ctrlKey && event.shiftKey && event.key === 'T') {
    event.preventDefault();
    showTestReminder();
  }
});

// 显示测试弹窗
function showTestReminder() {
  const testData = {
    type: 'domain',
    url: window.location.href,
    title: document.title
  };
  
  showReminderToast(testData);
}

// 发送消息到扩展
function safeSendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}


