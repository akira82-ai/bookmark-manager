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
    <div class="toast-header">
      <div class="toast-icon">💡</div>
      <div class="toast-title">智能提醒</div>
    </div>
    <div class="toast-content">
      <div class="toast-info">
        您近期已访问多次当前网站，需要收藏吗？
      </div>
    </div>
    <div class="toast-actions">
      <button class="toast-btn btn-primary" id="btnAdd">收藏</button>
      <button class="toast-btn btn-secondary" id="btnSnooze">稍后</button>
      <button class="toast-btn btn-close" id="btnDismiss">╳</button>
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
      background: rgba(50, 50, 60, 0.15);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 8px;
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.15),
        0 2px 8px rgba(0, 0, 0, 0.08),
        0 0 0 1px rgba(255, 255, 255, 0.05),
        0 0 16px rgba(59, 130, 246, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        inset 0 -1px 0 rgba(0, 0, 0, 0.2);
      padding: 0;
      width: 320px;
      transform: translateX(400px) scale(0.8);
      transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .bookmark-reminder-toast.show {
      transform: translateX(0) scale(1);
    }
    
    /* Windows风格标题栏 */
    .bookmark-reminder-toast .toast-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px 8px 0 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .bookmark-reminder-toast .toast-icon {
      font-size: 14px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 1px 2px rgba(59, 130, 246, 0.3));
    }
    
    .bookmark-reminder-toast .toast-title {
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
      letter-spacing: 0.02em;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }
    
    /* 主要内容区域 */
    .bookmark-reminder-toast .toast-content {
      flex: 1;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      color: #ffffff;
      min-height: 80px;
    }
    
    .bookmark-reminder-toast .toast-info {
      font-size: 14px;
      line-height: 1.5;
      font-weight: 500;
      margin: 0;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5), 0 0 8px rgba(0, 0, 0, 0.3);
    }
    
    /* 底部操作栏 */
    .bookmark-reminder-toast .toast-actions {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.01);
      border-radius: 0 0 8px 8px;
      justify-content: flex-start;
      border-top: 1px solid rgba(255, 255, 255, 0.03);
    }
    
    /* 苹果风格按钮 */
    .bookmark-reminder-toast .toast-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      letter-spacing: 0.01em;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      min-width: 60px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .bookmark-reminder-toast .btn-primary {
      background: linear-gradient(135deg, #007AFF, #0051D5);
      color: white;
      box-shadow: 
        0 2px 8px rgba(0, 122, 255, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
    
    .bookmark-reminder-toast .btn-primary:hover {
      background: linear-gradient(135deg, #0051D5, #003D99);
      transform: translateY(-1px);
      box-shadow: 
        0 4px 12px rgba(0, 122, 255, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }
    
    .bookmark-reminder-toast .btn-primary:active {
      transform: translateY(0);
      background: linear-gradient(135deg, #003D99, #002966);
    }
    
    .bookmark-reminder-toast .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 
        0 1px 3px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
    
    .bookmark-reminder-toast .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
      box-shadow: 
        0 2px 6px rgba(0, 0, 0, 0.25),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }
    
    .bookmark-reminder-toast .btn-secondary:active {
      transform: translateY(0);
      background: rgba(255, 255, 255, 0.08);
    }
    
    .bookmark-reminder-toast .btn-close {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 6px 12px;
      font-size: 12px;
      margin-left: auto;
      min-width: 44px;
    }
    
    .bookmark-reminder-toast .btn-close:hover {
      background: linear-gradient(135deg, #FF3B30, #D70015);
      border-color: rgba(255, 59, 48, 0.8);
      color: white;
      box-shadow: 
        0 2px 8px rgba(255, 59, 48, 0.3);
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
        showSuccessToast();
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

// 显示成功提示
function showSuccessToast() {
  const toast = document.getElementById('bookmark-reminder-toast');
  if (!toast) return;
  
  const content = toast.querySelector('.toast-content');
  if (content) {
    content.innerHTML = `
      <div class="toast-info">
        ✓ 已添加到「最近收藏」
      </div>
    `;
    
    // 2秒后自动关闭
    setTimeout(() => {
      hideToast();
    }, 2000);
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
function setupKeyboardShortcuts() {
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
      
      // Ctrl+Shift+T 触发智能提醒弹窗
      if (event.ctrlKey && event.shiftKey && event.key === 'T') {
        event.preventDefault();
        showTestReminder();
      }
    });
    
    console.log('书签管理器快捷键已加载：Ctrl+Shift+B (快速添加书签), Ctrl+Shift+T (智能提醒)');
  } catch (error) {
    console.warn('键盘快捷键监听器设置失败:', error);
  }
}

// 确保快捷键在页面加载完成后设置
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupKeyboardShortcuts);
} else {
  setupKeyboardShortcuts();
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
    message: '您近期已访问多次当前网站，需要收藏吗？'
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
    background: rgba(255, 107, 107, 0.9);
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 1000000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 300px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
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