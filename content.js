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

// URL解析函数
function analyzeURL(url) {
  try {
    // 处理没有协议的情况
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }
    
    const urlObj = new URL(url);
    
    // 提取域名信息
    const domainParts = urlObj.hostname.split('.');
    let topLevelDomain = '';
    
    if (domainParts.length >= 2) {
      topLevelDomain = domainParts.slice(-2).join('.');
    } else {
      topLevelDomain = urlObj.hostname;
    }
    
    // 提取路径层级
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    const firstLevelPath = pathParts[0] || '';
    const secondLevelPath = pathParts[1] || '';
    const thirdLevelPath = pathParts[2] || '';
    
    // 构建一级和二级地址
    let firstLevelAddress = '';
    let secondLevelAddress = '';
    
    if (firstLevelPath) {
      firstLevelAddress = urlObj.protocol + '//' + urlObj.hostname + '/' + firstLevelPath;
      if (secondLevelPath) {
        secondLevelAddress = urlObj.protocol + '//' + urlObj.hostname + '/' + firstLevelPath + '/' + secondLevelPath;
      }
    }
    
    return {
      fullUrl: urlObj.href,
      protocol: urlObj.protocol,
      domain: urlObj.hostname,
      topLevelDomain: topLevelDomain,
      subdomain: urlObj.protocol + '//' + urlObj.hostname, // 完整域名作为子域名，加协议
      topLevelDomainWithProtocol: urlObj.protocol + '//' + topLevelDomain, // 主域名加协议
      path: urlObj.pathname,
      firstLevelPath: firstLevelPath,
      secondLevelPath: secondLevelPath,
      thirdLevelPath: thirdLevelPath,
      pathDepth: pathParts.length,
      firstLevelAddress: firstLevelAddress,
      secondLevelAddress: secondLevelAddress,
      search: urlObj.search,
      hash: urlObj.hash
    };
  } catch (error) {
    return null;
  }
}

// 显示提醒弹窗
function showReminderToast(data) {
  // 移除已存在的弹窗
  const existingToast = document.getElementById('bookmark-reminder-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // 分析当前URL
  const currentUrl = window.location.href;
  const analysis = analyzeURL(currentUrl);
  
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
    width: 380px;
    box-shadow: 
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transform: translateX(400px);
    transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  `;
  
  // 生成URL选项HTML
  let urlOptionsHTML = '';
  
  if (analysis) {
    // 主域名
    urlOptionsHTML += `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="color: #f5f5f7; font-size: 13px; flex: 1; margin-right: 8px; word-break: break-all;">🌐 ${analysis.topLevelDomainWithProtocol}</span>
        <button class="bookmark-btn" data-url="${analysis.topLevelDomainWithProtocol}" data-title="${analysis.topLevelDomain}" style="
          padding: 4px 12px;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s ease;
          white-space: nowrap;
        ">收藏</button>
      </div>
    `;
    
    // 子域名（如果和主域名不同且不包含www）
    const showSubdomain = analysis.topLevelDomainWithProtocol !== analysis.subdomain && 
                         !analysis.subdomain.includes('www.');
    
    if (showSubdomain) {
      urlOptionsHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="color: #f5f5f7; font-size: 13px; flex: 1; margin-right: 8px; word-break: break-all;">🔧 ${analysis.subdomain}</span>
          <button class="bookmark-btn" data-url="${analysis.subdomain}" data-title="${analysis.domain}" style="
            padding: 4px 12px;
            border: none;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
            white-space: nowrap;
          ">收藏</button>
        </div>
      `;
    }
    
    // 一级地址
    if (analysis.firstLevelAddress) {
      urlOptionsHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="color: #f5f5f7; font-size: 13px; flex: 1; margin-right: 8px; word-break: break-all;">📚 ${analysis.firstLevelAddress}</span>
          <button class="bookmark-btn" data-url="${analysis.firstLevelAddress}" data-title="${analysis.firstLevelPath}" style="
            padding: 4px 12px;
            border: none;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
            white-space: nowrap;
          ">收藏</button>
        </div>
      `;
    }
    
    // 二级地址
    if (analysis.secondLevelAddress) {
      urlOptionsHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="color: #f5f5f7; font-size: 13px; flex: 1; margin-right: 8px; word-break: break-all;">📄 ${analysis.secondLevelAddress}</span>
          <button class="bookmark-btn" data-url="${analysis.secondLevelAddress}" data-title="${analysis.secondLevelPath}" style="
            padding: 4px 12px;
            border: none;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
            white-space: nowrap;
          ">收藏</button>
        </div>
      `;
    }
  }
  
  toast.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <div style="font-weight: 600; color: #f5f5f7; font-size: 15px; letter-spacing: -0.2px;">💡 为您准备的收藏建议</div>
      <button id="btnDismiss" style="
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 16px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s ease;
      ">❌</button>
    </div>
    
    <div style="margin-bottom: 12px; font-size: 14px; color: #ffffff; line-height: 1.4; letter-spacing: -0.1px;">
      看来您很喜欢这里，帮您整理了几个收藏选项：
    </div>
    
    <div style="margin-bottom: 12px; font-size: 12px; color: rgba(255, 255, 255, 0.8); word-break: break-all; line-height: 1.3;">
      当前页面: ${currentUrl}
    </div>
    
    <div style="margin-bottom: 8px; font-size: 13px; color: rgba(255, 255, 255, 0.9); font-weight: 500;">
    </div>
    
    ${urlOptionsHTML}
  `;
  
  document.body.appendChild(toast);
  
  // 触发入场动画
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 10);
  
  // 计时器管理
  let autoCloseTimer = null;
  let remainingTime = 10000; // 10秒总时间
  let lastPauseTime = null;
  
  // 开始自动关闭计时
  function startAutoCloseTimer() {
    autoCloseTimer = setTimeout(() => {
      if (toast.parentNode) {
        // 出场动画
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => toast.remove(), 400);
      }
    }, remainingTime);
  }
  
  // 暂停计时
  function pauseTimer() {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      lastPauseTime = Date.now();
      autoCloseTimer = null;
    }
  }
  
  // 恢复计时
  function resumeTimer() {
    if (lastPauseTime) {
      const pausedDuration = Date.now() - lastPauseTime;
      remainingTime = Math.max(0, remainingTime - pausedDuration);
      lastPauseTime = null;
    }
    startAutoCloseTimer();
  }
  
  // 绑定收藏按钮事件
  const bookmarkButtons = toast.querySelectorAll('.bookmark-btn');
  bookmarkButtons.forEach(button => {
    button.addEventListener('click', function() {
      const url = this.getAttribute('data-url');
      const title = this.getAttribute('data-title');
      
      safeSendMessage({
        action: 'addBookmarkFromReminder',
        data: {
          url: url,
          title: title,
          type: 'domain'
        }
      }).then(() => {
        toast.innerHTML = '<div style="text-align: center; color: #34c759; font-size: 15px; font-weight: 500; letter-spacing: -0.1px; padding: 20px;">✓ 已添加到收藏</div>';
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
    });
    
    // 添加悬停效果
    button.addEventListener('mouseenter', function() {
      this.style.background = 'rgba(255, 255, 255, 0.3)';
    });
    
    button.addEventListener('mouseleave', function() {
      this.style.background = 'rgba(255, 255, 255, 0.2)';
    });
  });
  
  // 绑定关闭按钮事件
  document.getElementById('btnDismiss').onclick = () => {
    // 出场动画
    toast.style.transform = 'translateX(400px)';
    setTimeout(() => toast.remove(), 400);
  };
  
  // 鼠标悬停暂停计时
  toast.addEventListener('mouseenter', pauseTimer);
  toast.addEventListener('mouseleave', resumeTimer);
  
  // 开始自动关闭计时
  startAutoCloseTimer();
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


