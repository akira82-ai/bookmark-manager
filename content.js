// 内容脚本 - 智能提醒弹窗显示

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getPageInfo') {
    const pageInfo = {
      title: document.title,
      url: window.location.href,
      description: getMetaDescription()
    };
    sendResponse(pageInfo);
  } else if (request.action === 'showReminder') {
    // 显示智能提醒弹窗
    showReminderToast(request.data);
    sendResponse({success: true});
  }
});

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
  toast.className = 'bookmark-reminder-toast';
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-icon">📊</div>
      <div class="toast-info">
        <div class="toast-title">${data.message}</div>
      </div>
      <div class="toast-actions">
        <button class="toast-btn primary" id="btnAdd">添加书签</button>
        <button class="toast-btn secondary" id="btnSnooze">稍后</button>
        <button class="toast-btn close" id="btnDismiss">×</button>
      </div>
    </div>
  `;
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .bookmark-reminder-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      border: 1px solid #e2e8f0;
      max-width: 380px;
      transform: translateX(400px);
      transition: transform 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .bookmark-reminder-toast.show {
      transform: translateX(0);
    }
    
    .toast-content {
      display: flex;
      align-items: center;
      padding: 16px;
      gap: 12px;
    }
    
    .toast-icon {
      font-size: 24px;
      flex-shrink: 0;
    }
    
    .toast-info {
      flex: 1;
      min-width: 0;
    }
    
    .toast-title {
      font-size: 14px;
      font-weight: 500;
      color: #1a202c;
      line-height: 1.4;
      margin: 0;
    }
    
    .toast-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    
    .toast-btn {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    
    .toast-btn.primary {
      background: #4299e1;
      color: white;
    }
    
    .toast-btn.primary:hover {
      background: #3182ce;
    }
    
    .toast-btn.secondary {
      background: #f7fafc;
      color: #4a5568;
      border: 1px solid #e2e8f0;
    }
    
    .toast-btn.secondary:hover {
      background: #edf2f7;
    }
    
    .toast-btn.close {
      background: transparent;
      color: #a0aec0;
      font-size: 16px;
      padding: 4px 8px;
    }
    
    .toast-btn.close:hover {
      color: #4a5568;
      background: #f7fafc;
    }
    
    /* 深色模式支持 */
    @media (prefers-color-scheme: dark) {
      .bookmark-reminder-toast {
        background: #1a202c;
        border-color: #2d3748;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }
      
      .toast-title {
        color: #f7fafc;
      }
      
      .toast-btn.secondary {
        background: #2d3748;
        color: #e2e8f0;
        border-color: #4a5568;
      }
      
      .toast-btn.secondary:hover {
        background: #4a5568;
      }
      
      .toast-btn.close:hover {
        color: #e2e8f0;
        background: #2d3748;
      }
    }
  `;
  
  // 添加到页面
  document.head.appendChild(style);
  document.body.appendChild(toast);
  
  // 绑定事件
  const addBtn = document.getElementById('btnAdd');
  const snoozeBtn = document.getElementById('btnSnooze');
  const dismissBtn = document.getElementById('btnDismiss');
  
  if (addBtn) {
    addBtn.onclick = () => {
      // 发送添加书签消息
      chrome.runtime.sendMessage({
        action: 'addBookmarkFromReminder',
        data: {
          url: data.url,
          title: data.title,
          type: data.type
        }
      });
      hideToast();
    };
  }
  
  if (snoozeBtn) {
    snoozeBtn.onclick = () => {
      // 发送稍后提醒消息
      chrome.runtime.sendMessage({
        action: 'snoozeReminder',
        data: {
          type: data.type,
          target: data.type === 'domain' ? data.domain : data.url
        }
      });
      hideToast();
    };
  }
  
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      // 发送不再提醒消息
      chrome.runtime.sendMessage({
        action: 'dismissReminder',
        data: {
          type: data.type,
          target: data.type === 'domain' ? data.domain : data.url
        }
      });
      hideToast();
    };
  }
  
  // 显示弹窗
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // 自动隐藏
  setTimeout(() => {
    hideToast();
  }, 10000);
}

// 隐藏弹窗
function hideToast() {
  const toast = document.getElementById('bookmark-reminder-toast');
  if (toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }
}

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