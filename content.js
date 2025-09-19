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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    padding: 16px;
    width: 260px;
    box-shadow: 
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transform: translateX(400px);
    transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  `;
  
  toast.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 10px; color: #f5f5f7; font-size: 15px; letter-spacing: -0.2px;">💡 智能提醒</div>
    <div style="margin-bottom: 12px; font-size: 14px; color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5); line-height: 1.4; letter-spacing: -0.1px;">您近期已访问多次当前网站，需要收藏吗？</div>
    <div style="margin-bottom: 16px; font-size: 12px; color: rgba(255, 255, 255, 0.8); text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3); word-break: break-all; line-height: 1.3;">${window.location.href}</div>
    <div style="display: flex; gap: 8px;">
      <button id="btnAdd" style="
        padding: 8px 16px;
        border: none;
        background: #007aff;
        color: white;
        border-radius: 10px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        letter-spacing: -0.1px;
        box-shadow: 
          0 2px 8px rgba(0, 122, 255, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
        transition: all 0.2s ease;
      ">收藏</button>
      <button id="btnDismiss" style="
        padding: 8px 16px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.1);
        color: #f5f5f7;
        border-radius: 10px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        letter-spacing: -0.1px;
        margin-left: auto;
        box-shadow: 
          0 1px 3px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
        transition: all 0.2s ease;
      ">关闭</button>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // 触发入场动画
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 10);
  
  // 绑定事件
  document.getElementById('btnAdd').onclick = () => {
    safeSendMessage({
      action: 'addBookmarkFromReminder',
      data: {
        url: window.location.href,
        title: document.title,
        type: 'domain'
      }
    }).then(() => {
      toast.innerHTML = '<div style="text-align: center; color: #34c759; font-size: 15px; font-weight: 500; letter-spacing: -0.1px;">✓ 已添加到收藏</div>';
      setTimeout(() => {
        // 出场动画
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => toast.remove(), 400);
      }, 1500);
    }).catch(error => {
      console.error('添加书签失败:', error);
      // 出场动画
      toast.style.transform = 'translateX(400px)';
      setTimeout(() => toast.remove(), 400);
    });
  };
  
  document.getElementById('btnDismiss').onclick = () => {
    // 出场动画
    toast.style.transform = 'translateX(400px)';
    setTimeout(() => toast.remove(), 400);
  };
  
  // 10秒后自动关闭
  setTimeout(() => {
    if (toast.parentNode) {
      // 出场动画
      toast.style.transform = 'translateX(400px)';
      setTimeout(() => toast.remove(), 400);
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


