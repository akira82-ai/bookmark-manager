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


// 智能提醒三个核心参数计算模块
// ======================================

// 全局状态管理
const CoreMetricsState = {
  // 浏览次数相关
  domainVisitCount: 1, // 当前会话中该主域名的访问次数

  // 浏览时长相关
  sessionStartTime: Date.now(),
  totalActiveTime: 0,
  lastActiveTime: Date.now(),
  isActiveTab: true,

  // 浏览深度相关
  maxScreenCount: 0,
  scrollTimeout: null,

  // 数据收集状态
  isInitialized: false,

  // 调试窗口相关
  debugWindow: null,
  updateInterval: null
};

// 获取主域名
function getMainDomain(url) {
  try {
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }
    const urlObj = new URL(url);
    const domainParts = urlObj.hostname.split('.');

    if (domainParts.length >= 2) {
      return domainParts.slice(-2).join('.');
    }
    return urlObj.hostname;
  } catch (error) {
    return '';
  }
}

// 浏览次数计算
// =============

/**
 * 获取当前页面的浏览次数
 * @returns {Promise<number>} 近3天内该主域名的访问次数
 */
async function getVisitCount() {
  // 返回缓存的访问次数，只在激活时更新
  return CoreMetricsState.domainVisitCount;
}

/**
 * 从浏览器历史记录中更新域名访问次数
 * @returns {Promise<number>} 近3天内该主域名的访问次数
 */
async function updateDomainVisitCount() {
  const currentUrl = window.location.href;
  const mainDomain = getMainDomain(currentUrl);

  // 隐私保护：不统计隐私模式或特殊页面
  if (currentUrl.startsWith('chrome://') ||
      currentUrl.startsWith('chrome-extension://') ||
      currentUrl.startsWith('moz-extension://') ||
      currentUrl.startsWith('edge://') ||
      currentUrl.startsWith('about:')) {
    CoreMetricsState.domainVisitCount = 0;
    return 0;
  }

  try {
    // 计算3天前的时间戳
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);

    // Content scripts不能直接使用chrome.history，通过消息传递获取历史记录
    const historyResults = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('获取历史记录超时'));
      }, 5000); // 5秒超时

      chrome.runtime.sendMessage({
        action: 'getDomainHistory',
        mainDomain: mainDomain,
        startTime: threeDaysAgo
      }, (response) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response.results || []);
        }
      });
    });

    // background已经过滤好了，直接统计数量
    const visitCount = historyResults.length;

    // 更新全局状态
    CoreMetricsState.domainVisitCount = visitCount;

    console.log(`主域名 ${mainDomain} 近3天访问次数: ${visitCount}`);
    return visitCount;

  } catch (error) {
    console.warn('获取历史记录失败:', error);
    // 如果历史记录获取失败，降级为使用sessionStorage
    const sessionKey = `visit_count_${mainDomain}`;
    const fallbackCount = parseInt(sessionStorage.getItem(sessionKey) || '0') + 1;
    sessionStorage.setItem(sessionKey, fallbackCount.toString());
    CoreMetricsState.domainVisitCount = fallbackCount;
    return fallbackCount;
  }
}

// 浏览时长计算
// =============

/**
 * 计算浏览时长（仅active tab）
 * @returns {number} 浏览时长（秒）
 */
function getBrowseDuration() {
  if (!CoreMetricsState.isActiveTab) {
    return CoreMetricsState.totalActiveTime;
  }

  const now = Date.now();
  const currentSessionTime = now - CoreMetricsState.lastActiveTime;
  return Math.round((CoreMetricsState.totalActiveTime + currentSessionTime) / 1000);
}

/**
 * 处理页面可见性变化（active tab状态）
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // 页面隐藏，停止计时
    if (CoreMetricsState.isActiveTab) {
      const now = Date.now();
      CoreMetricsState.totalActiveTime += (now - CoreMetricsState.lastActiveTime);
      CoreMetricsState.isActiveTab = false;
    }
  } else {
    // 页面显示，重新开始计时并立即更新访问次数
    if (!CoreMetricsState.isActiveTab) {
      CoreMetricsState.isActiveTab = true;
      CoreMetricsState.lastActiveTime = Date.now();

      // 每次激活时重新计算访问次数
      updateDomainVisitCount();
    }
  }
}

// 浏览深度计算
// =============

/**
 * 计算屏幕滚动数量
 * @returns {number} 屏幕数量
 */
function calculateScreenCount() {
  const scrollY = window.scrollY || window.pageYOffset;
  const viewportHeight = window.innerHeight;

  if (viewportHeight === 0) return 0;

  return scrollY / viewportHeight;
}

/**
 * 处理滚动事件（性能优化：1秒延迟后获取位置）
 */
function handleScroll() {
  // 清除之前的定时器
  if (CoreMetricsState.scrollTimeout) {
    clearTimeout(CoreMetricsState.scrollTimeout);
  }

  // 设置新的定时器，1秒后执行
  CoreMetricsState.scrollTimeout = setTimeout(() => {
    const screenCount = calculateScreenCount();

    // 更新最大屏幕数量
    if (screenCount > CoreMetricsState.maxScreenCount) {
      CoreMetricsState.maxScreenCount = screenCount;
    }
  }, 1000);
}

/**
 * 获取当前页面的浏览深度
 * @returns {number} 最大屏幕数量
 */
function getBrowseDepth() {
  return CoreMetricsState.maxScreenCount;
}

// 统一数据管理
// =============

/**
 * 获取当前页面的三个核心指标
 * @returns {Promise<Object>} 包含三个核心指标的对象
 */
async function getCoreMetrics() {
  const currentUrl = window.location.href;
  const mainDomain = getMainDomain(currentUrl);

  return {
    url: currentUrl,
    mainDomain: mainDomain,
    visitCount: await getVisitCount(),
    browseDuration: getBrowseDuration(),
    browseDepth: getBrowseDepth(),
    timestamp: Date.now()
  };
}



/**
 * 初始化核心指标计算
 */
async function initCoreMetrics() {
  if (CoreMetricsState.isInitialized) return;

  // 监听页面可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // 监听滚动事件（使用passive监听器优化性能）
  document.addEventListener('scroll', handleScroll, { passive: true });

  // 如果当前是active tab，立即计算访问次数并开始计时
  if (!document.hidden) {
    CoreMetricsState.isActiveTab = true;
    CoreMetricsState.lastActiveTime = Date.now();
    updateDomainVisitCount();
  }

  CoreMetricsState.isInitialized = true;
}

/**
 * 清理资源
 */
function cleanupCoreMetrics() {
  if (!CoreMetricsState.isInitialized) return;

  // 移除调试窗口
  removeDebugWindow();

  // 移除事件监听器
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.removeEventListener('scroll', handleScroll);

  // 停止更新定时器
  if (CoreMetricsState.updateInterval) {
    clearInterval(CoreMetricsState.updateInterval);
    CoreMetricsState.updateInterval = null;
  }

  // 清理滚动定时器
  if (CoreMetricsState.scrollTimeout) {
    clearTimeout(CoreMetricsState.scrollTimeout);
    CoreMetricsState.scrollTimeout = null;
  }

  CoreMetricsState.isInitialized = false;
  CoreMetricsState.isActiveTab = false;
}

// 调试窗口管理
// =============

/**
 * 创建调试窗口
 */
function createDebugWindow() {
  // 如果窗口已存在，直接返回
  if (CoreMetricsState.debugWindow) {
    return;
  }

  // 创建窗口容器
  const debugWindow = document.createElement('div');
  debugWindow.id = 'core-metrics-debug-window';
  debugWindow.innerHTML = `
    <div class="debug-header">
      📊 浏览数据
    </div>
    <div class="debug-content">
      <div class="debug-item">
        <span class="debug-label">次数:</span>
        <span class="debug-value" id="debug-visit-count">0次</span>
      </div>
      <div class="debug-item">
        <span class="debug-label">时长:</span>
        <span class="debug-value" id="debug-duration">0:00</span>
      </div>
      <div class="debug-item">
        <span class="debug-label">深度:</span>
        <span class="debug-value" id="debug-depth">0.0屏</span>
      </div>
      <div class="debug-hit-level" id="debug-hit-level" style="display: none;">
        <span class="debug-label">命中:</span>
        <span class="debug-value" id="debug-level-name">--</span>
      </div>
    </div>
    
    <!-- 配置规则匹配区域 -->
    <div class="debug-rules-section" id="debug-rules-section" style="display: none;">
      <div class="debug-rules-header">
        🎯 配置规则匹配
      </div>
      <div class="debug-rules-content">
        <div class="debug-rule-item">
          <span class="debug-label">级别:</span>
          <span class="debug-value" id="debug-current-level">--</span>
        </div>
        <div class="debug-rule-item">
          <span class="debug-label">状态:</span>
          <span class="debug-value" id="debug-rule-status">--</span>
        </div>
        
        <div class="debug-rule-details">
          <div class="debug-rule-detail" id="debug-visit-rule">
            <span class="debug-rule-label">次数要求:</span>
            <span class="debug-rule-value">--</span>
          </div>
          <div class="debug-rule-detail" id="debug-time-rule">
            <span class="debug-rule-label">时长要求:</span>
            <span class="debug-rule-value">--</span>
          </div>
          <div class="debug-rule-detail" id="debug-depth-rule">
            <span class="debug-rule-label">深度要求:</span>
            <span class="debug-rule-value">--</span>
          </div>
        </div>
        
        <div class="debug-next-target" id="debug-next-target" style="display: none;">
          <span class="debug-label">下一目标:</span>
          <span class="debug-value" id="debug-next-level">--</span>
        </div>
      </div>
    </div>
  `;

  // 添加样式
  const style = document.createElement('style');
  style.setAttribute('data-debug-window', 'true');
  style.textContent = `
    #core-metrics-debug-window {
      position: fixed;
      bottom: 10px;
      right: 10px;
      width: 220px;
      min-height: 80px;
      max-height: 240px;
      background: rgba(0, 0, 0, 0.7);
      border-radius: 8px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      z-index: 999999;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      pointer-events: none;
      user-select: none;
    }

    .debug-header {
      padding: 8px 12px 4px 12px;
      font-weight: 600;
      font-size: 11px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      margin-bottom: 4px;
    }

    .debug-content {
      padding: 0 12px 8px 12px;
    }

    .debug-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
      line-height: 1.2;
    }

    .debug-label {
      color: rgba(255, 255, 255, 0.8);
    }

    .debug-value {
      font-weight: 500;
      color: #4fc3f7;
    }

    .debug-hit-level {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    #debug-level-name {
      color: #4caf50;
      font-weight: 600;
    }

    /* 配置规则匹配区域样式 */
    .debug-rules-section {
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      margin-top: 8px;
      padding-top: 8px;
    }

    .debug-rules-header {
      padding: 4px 12px;
      font-weight: 600;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.9);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      margin-bottom: 6px;
    }

    .debug-rules-content {
      padding: 0 12px 8px 12px;
    }

    .debug-rule-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      font-size: 11px;
    }

    .debug-rule-details {
      margin: 6px 0;
      font-size: 10px;
    }

    .debug-rule-detail {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
      color: rgba(255, 255, 255, 0.7);
    }

    .debug-rule-label {
      color: rgba(255, 255, 255, 0.6);
    }

    .debug-rule-value {
      font-weight: 500;
    }

    .debug-rule-value.met {
      color: #4caf50;
    }

    .debug-rule-value.not-met {
      color: #f44336;
    }

    .debug-next-target {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
    }

    #debug-current-level {
      color: #2196f3;
      font-weight: 600;
    }

    #debug-rule-status {
      font-weight: 600;
    }

    #debug-rule-status.met {
      color: #4caf50;
    }

    #debug-rule-status.not-met {
      color: #ff9800;
    }

    #debug-next-level {
      color: #9c27b0;
      font-weight: 500;
      font-size: 10px;
    }
  `;

  try {
    document.head.appendChild(style);
    document.body.appendChild(debugWindow);
  } catch (error) {
    console.error('添加调试窗口失败:', error);
  }

  // 保存引用
  CoreMetricsState.debugWindow = debugWindow;

  console.log('[调试] 调试窗口创建完成，窗口对象:', debugWindow);
  console.log('[调试] 窗口在页面中:', document.getElementById('core-metrics-debug-window') !== null);
}

/**
 * 更新调试窗口显示的数据
 */
async function updateDebugWindow() {
  if (!CoreMetricsState.debugWindow) {
    return;
  }

  try {
    // 获取最新的数据
    const metrics = await getCoreMetrics();

    // 更新显示
    const visitCountEl = document.getElementById('debug-visit-count');
    const durationEl = document.getElementById('debug-duration');
    const depthEl = document.getElementById('debug-depth');
    const hitLevelEl = document.getElementById('debug-hit-level');
    const levelNameEl = document.getElementById('debug-level-name');

    if (visitCountEl) {
      visitCountEl.textContent = `${metrics.visitCount}次`;
    }

    if (durationEl) {
      durationEl.textContent = formatDuration(metrics.browseDuration);
    }

    if (depthEl) {
      depthEl.textContent = `${metrics.browseDepth.toFixed(1)}屏`;
    }

    
  } catch (error) {
    console.warn('更新调试窗口失败:', error);
  }
}


/**
 * 格式化时长显示
 * @param {number} seconds - 秒数
 * @returns {string} 格式化的时长字符串
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `0:${seconds.toString().padStart(2, '0')}`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

/**
 * 启动调试窗口数据更新
 */
function startDebugWindowUpdates() {
  // 立即更新一次
  updateDebugWindow();

  // 设置定时更新 - 每秒更新访问时长
  CoreMetricsState.updateInterval = setInterval(() => {
    updateDebugWindow();
  }, 1000); // 每1秒更新一次
}

/**
 * 停止调试窗口更新
 */
function stopDebugWindowUpdates() {
  if (CoreMetricsState.updateInterval) {
    clearInterval(CoreMetricsState.updateInterval);
    CoreMetricsState.updateInterval = null;
  }
}

/**
 * 移除调试窗口
 */
function removeDebugWindow() {
  stopDebugWindowUpdates();

  if (CoreMetricsState.debugWindow) {
    CoreMetricsState.debugWindow.remove();
    CoreMetricsState.debugWindow = null;
  }

  // 移除样式
  const style = document.querySelector('style[data-debug-window="true"]');
  if (style) {
    style.remove();
  }

  console.log('调试窗口已移除');
}

// 页面加载完成后初始化
function initOnLoad() {
  setTimeout(async () => {
    try {
      await initCoreMetrics();
      // 创建调试窗口（临时用于调试）
      createDebugWindow();
      startDebugWindowUpdates();
    } catch (error) {
      console.warn('核心指标初始化失败:', error);
    }
  }, 1000);
}

// 同时监听DOMContentLoaded事件，并立即检查是否已经加载完成
document.addEventListener('DOMContentLoaded', initOnLoad);

// 如果页面已经加载完成，立即执行
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(initOnLoad, 100);
}

// 页面卸载时清理资源
window.addEventListener('unload', cleanupCoreMetrics);

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
  // Ctrl+Shift+X 触发智能提醒弹窗
  if (event.ctrlKey && event.shiftKey && event.key === 'X') {
    event.preventDefault();
    showTestReminder();
  }

  // Ctrl+Shift+D 移除调试窗口（调试用）
  if (event.ctrlKey && event.shiftKey && event.key === 'D') {
    event.preventDefault();
    removeDebugWindow();
    console.log('调试窗口已通过快捷键移除');
  }
});

// 添加控制台命令（调试用）
if (typeof window !== 'undefined') {
  window.removeDebugWindow = removeDebugWindow;
  window.showDebugWindow = function() {
    createDebugWindow();
    startDebugWindowUpdates();
  };
  window.testCoreMetrics = async function() {
    console.log('测试核心指标函数...');
    try {
      console.log('CoreMetricsState:', CoreMetricsState);
      console.log('getMainDomain函数:', typeof getMainDomain);
      console.log('getVisitCount函数:', typeof getVisitCount);
      console.log('getBrowseDuration函数:', typeof getBrowseDuration);
      console.log('getBrowseDepth函数:', typeof getBrowseDepth);
      console.log('getCoreMetrics函数:', typeof getCoreMetrics);

      const metrics = await getCoreMetrics();
      console.log('getCoreMetrics()结果:', metrics);
    } catch (error) {
      console.error('测试失败:', error);
    }
  };

  console.log('调试窗口控制命令:');
  console.log('- window.removeDebugWindow() 移除调试窗口');
  console.log('- window.showDebugWindow() 显示调试窗口');
  console.log('- window.testCoreMetrics() 测试核心指标函数');
  console.log('- Ctrl+Shift+D 快捷键移除调试窗口');
}

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


