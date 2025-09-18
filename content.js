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
      // 显示提醒弹窗
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
      // 安全地发送添加书签消息
      safeSendMessage({
        action: 'addBookmarkFromReminder',
        data: {
          url: data.url,
          title: data.title,
          type: data.type
        }
      }).then(() => {
        hideToast();
      }).catch(error => {
        console.error('添加书签失败:', error);
        showExtensionErrorTip();
      });
    };
  }
  
  if (snoozeBtn) {
    snoozeBtn.onclick = () => {
      hideToast();
    };
  }
  
  if (dismissBtn) {
    dismissBtn.onclick = () => {
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

// 安全获取页面描述
function safeGetMetaDescription() {
  try {
    const metaDescription = document.querySelector('meta[name="description"]');
    return metaDescription ? metaDescription.getAttribute('content') : '';
  } catch (error) {
    console.warn('获取页面描述失败:', error);
    return '';
  }
}

// 获取页面描述（保持向后兼容）
function getMetaDescription() {
  return safeGetMetaDescription();
}

// 添加键盘快捷键
try {
  document.addEventListener('keydown', function(event) {
    // Ctrl+Shift+B 快速添加书签
    if (event.ctrlKey && event.shiftKey && event.key === 'B') {
      event.preventDefault();
      const pageInfo = {
        title: document.title,
        url: window.location.href,
        description: safeGetMetaDescription()
      };
      
      // 安全地发送消息到background script
      safeSendMessage({
        action: 'quickAddBookmark',
        data: pageInfo
      });
    }
    
    // Ctrl+Shift+T 触发测试弹窗
    if (event.ctrlKey && event.shiftKey && event.key === 'T') {
      event.preventDefault();
      showTestReminder();
    }
  });
} catch (error) {
  console.warn('键盘快捷键监听器设置失败:', error);
}

// 安全的消息发送函数
function safeSendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      // 检查扩展上下文是否有效
      if (!chrome.runtime || !chrome.runtime.id) {
        throw new Error('扩展上下文已失效');
      }
      
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

// 显示测试弹窗
function showTestReminder() {
  const testData = {
    type: 'domain',
    domain: extractDomain(window.location.href),
    url: window.location.href,
    title: document.title,
    message: `您最近访问了 ${extractDomain(window.location.href)} 多次，是否要添加书签？`
  };
  
  showReminderToast(testData);
}

// 从URL提取域名
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (error) {
    return url;
  }
}

// 显示扩展错误提示
function showExtensionErrorTip() {
  // 移除已存在的提示
  const existingTip = document.getElementById('extension-error-tip');
  if (existingTip) {
    existingTip.remove();
  }
  
  // 创建提示元素
  const tip = document.createElement('div');
  tip.id = 'extension-error-tip';
  tip.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff6b6b;
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 1000000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-width: 300px;
  `;
  tip.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 4px;">⚠️ 扩展需要重新加载</div>
    <div style="font-size: 12px; opacity: 0.9;">请刷新此页面或重新加载扩展</div>
  `;
  
  document.body.appendChild(tip);
  
  // 5秒后自动移除
  setTimeout(() => {
    if (tip.parentNode) {
      tip.remove();
    }
  }, 5000);
}