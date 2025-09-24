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


// Chrome.Storage能力优化系统
// ======================================

// 智能重试机制
const StorageRetry = {
  maxAttempts: 3,
  retryDelay: 1000,
  exponentialBackoff: true,

  async retry(operation, attempt = 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.maxAttempts) throw error;

      const delay = this.exponentialBackoff
        ? this.retryDelay * Math.pow(2, attempt - 1)
        : this.retryDelay;

      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retry(operation, attempt + 1);
    }
  }
};

// 双写同步策略
async function syncWrite(key, value) {
  const promises = [
    StorageRetry.retry(() => chrome.storage.local.set({[key]: value})).catch(() => {
      console.warn('Chrome.storage写入失败，忽略:', key);
    }),
    new Promise(resolve => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        resolve();
      } catch (error) {
        console.warn('LocalStorage写入失败:', error);
        resolve(); // localStorage失败也继续
      }
    })
  ];

  await Promise.allSettled(promises);
}

// 智能读取策略
async function smartRead(key, defaultValue) {
  // 优先级1: chrome.storage
  try {
    const result = await StorageRetry.retry(() =>
      chrome.storage.local.get([key])
    );
    if (result[key] !== undefined) return result[key];
  } catch (error) {
    console.warn('Chrome.storage读取失败，尝试fallback:', error);
  }

  // 优先级2: localStorage
  try {
    const localValue = localStorage.getItem(key);
    if (localValue !== null) {
      return JSON.parse(localValue);
    }
  } catch (error) {
    console.warn('LocalStorage读取失败:', error);
  }

  // 优先级3: 默认值
  return defaultValue;
}

// 存储健康状态监控
const StorageHealth = {
  isHealthy: true,
  lastCheck: 0,
  checkInterval: 30000, // 30秒检查一次

  async check() {
    try {
      const testKey = '_health_check';
      await StorageRetry.retry(() =>
        chrome.storage.local.set({[testKey]: Date.now()})
      );
      await StorageRetry.retry(() =>
        chrome.storage.local.remove([testKey])
      );
      this.isHealthy = true;
    } catch (error) {
      this.isHealthy = false;
      console.warn('Chrome.storage健康检查失败:', error);
    }
    this.lastCheck = Date.now();
  },

  startMonitoring() {
    setInterval(() => this.check(), this.checkInterval);
  }
};

// 智能缓存管理
class StorageCache {
  constructor(ttl = 60000) { // 1分钟缓存
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

// 存储事件系统
class StorageEventSystem {
  constructor() {
    this.listeners = new Map();
    this.setupListeners();
  }

  setupListeners() {
    // Chrome存储监听
    if (chrome.storage) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        this.emit('storage:changed', {changes, namespace});
      });
    }

    // LocalStorage监听
    window.addEventListener('storage', (event) => {
      this.emit('localStorage:changed', event);
    });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('事件监听器执行失败:', error);
        }
      });
    }
  }

  destroy() {
    this.listeners.clear();
  }
}

// 统一的存储API
class UnifiedStorage {
  constructor() {
    this.cache = new StorageCache();
    this.eventSystem = new StorageEventSystem();
    this.health = StorageHealth;
    this.health.startMonitoring();
    this.initialize();
  }

  initialize() {
    // 监听存储变化，自动更新缓存
    this.eventSystem.on('storage:changed', ({changes}) => {
      Object.keys(changes).forEach(key => {
        const change = changes[key];
        if (change.newValue !== undefined) {
          this.cache.set(key, change.newValue);
        } else {
          this.cache.invalidate(key);
        }
      });
    });

    this.eventSystem.on('localStorage:changed', (event) => {
      if (event.key && event.newValue !== null) {
        try {
          this.cache.set(event.key, JSON.parse(event.newValue));
        } catch (error) {
          console.warn('LocalStorage值解析失败:', error);
        }
      }
    });

    // 监听健康状态变化
    setInterval(() => {
      if (this.health.isHealthy) {
        // 扩展恢复健康，刷新缓存
        this.refreshCache();
      }
    }, 5000);
  }

  async get(key, defaultValue = null) {
    // 先检查缓存
    const cached = this.cache.get(key);
    if (cached !== null) return cached;

    // 智能读取
    const value = await smartRead(key, defaultValue);

    // 更新缓存
    this.cache.set(key, value);

    return value;
  }

  async set(key, value) {
    // 双写同步
    await syncWrite(key, value);

    // 更新缓存
    this.cache.set(key, value);

    // 触发事件
    this.eventSystem.emit('value:changed', {key, value});
  }

  async remove(key) {
    try {
      await StorageRetry.retry(() =>
        chrome.storage.local.remove([key])
      ).catch(() => {});

      localStorage.removeItem(key);

      this.cache.invalidate(key);

      this.eventSystem.emit('value:removed', {key});
    } catch (error) {
      console.warn('删除存储项失败:', error);
    }
  }

  onValueChanged(callback) {
    this.eventSystem.on('value:changed', callback);
    this.eventSystem.on('value:removed', callback);
  }

  offValueChanged(callback) {
    this.eventSystem.off('value:changed', callback);
    this.eventSystem.off('value:removed', callback);
  }

  async refreshCache() {
    // 刷新所有缓存项
    for (const [key, item] of this.cache.entries()) {
      try {
        const freshValue = await smartRead(key, null);
        if (freshValue !== null) {
          this.cache.set(key, freshValue);
        } else {
          this.cache.invalidate(key);
        }
      } catch (error) {
        console.warn('刷新缓存失败:', key, error);
      }
    }
  }

  destroy() {
    this.eventSystem.destroy();
    this.cache.clear();
  }
}

// 创建全局存储实例
let unifiedStorage = null;

function getUnifiedStorage() {
  if (!unifiedStorage) {
    unifiedStorage = new UnifiedStorage();
  }
  return unifiedStorage;
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
  updateInterval: null,

  // 智能提醒防抖
  lastReminderTime: 0,
  reminderCooldown: 300000 // 5分钟冷却时间
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

      // 检查是否需要触发智能提醒（延迟执行，确保数据已更新）
      setTimeout(triggerSmartReminder, 2000);
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

// 智能提醒触发机制
// =============

/**
 * 基于3大指标判定结果触发智能提醒
 */
async function triggerSmartReminder() {
  try {
    // 检查冷却时间
    const now = Date.now();
    if (now - CoreMetricsState.lastReminderTime < CoreMetricsState.reminderCooldown) {
      return; // 在冷却时间内，不触发提醒
    }

    const metrics = await getCoreMetrics();

    if (!metrics.judgmentResult || !metrics.judgmentResult.passed) {
      return; // 判定失败，不触发提醒
    }

    const result = metrics.judgmentResult;

    // 根据判定级别决定是否触发提醒
    let shouldTrigger = false;
    let reminderMessage = '';

    // 只有达到"高度关注"及以上级别才触发提醒
    if (result.level >= 2) {
      shouldTrigger = true;
      reminderMessage = `检测到您${result.levelName}此页面：`;

      // 根据具体指标添加详细信息
      const details = [];
      if (result.detailResults.visitCount.level >= 2) {
        details.push(`访问${result.detailResults.visitCount.value}次`);
      }
      if (result.detailResults.browseDuration.level >= 2) {
        details.push(`浏览${result.detailResults.browseDuration.value}秒`);
      }
      if (result.detailResults.browseDepth.level >= 2) {
        details.push(`深度${result.detailResults.browseDepth.value.toFixed(1)}屏`);
      }

      reminderMessage += details.join('，');
    }

    if (shouldTrigger) {
      console.log(`🎯 触发智能提醒: ${reminderMessage}`);

      // 更新最后提醒时间
      CoreMetricsState.lastReminderTime = now;

      // 显示提醒弹窗
      const reminderData = {
        type: 'domain',
        url: metrics.url,
        title: document.title,
        metrics: metrics,
        judgmentResult: result
      };

      showReminderToast(reminderData);
    }
  } catch (error) {
    console.warn('智能提醒触发失败:', error);
  }
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

  const metrics = {
    url: currentUrl,
    mainDomain: mainDomain,
    visitCount: await getVisitCount(),
    browseDuration: getBrowseDuration(),
    browseDepth: getBrowseDepth(),
    timestamp: Date.now()
  };

  // 使用3大指标判定引擎进行判定
  if (window.MetricsJudgmentEngine) {
    try {
      const engine = new window.MetricsJudgmentEngine();
      engine.setDebugMode(false);
      const judgmentResult = engine.judge(metrics);
      metrics.judgmentResult = judgmentResult;
    } catch (error) {
      console.warn('3大指标判定失败:', error);
    }
  }

  return metrics;
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
      <span class="debug-title">🛠️ 智能书签调试窗口 v2.0</span>
      <span class="debug-close-btn" id="debug-close-btn">×</span>
    </div>

    <!-- 当前档位配置 -->
    <div class="debug-config-section">
      <div class="debug-config-header">
        📊 当前档位配置
      </div>
      <div class="debug-config-content">
        <div class="debug-config-item">
          <span class="debug-label">档位:</span>
          <span class="debug-value" id="debug-config-level">适中提醒</span>
        </div>
        <div class="debug-config-item">
          <span class="debug-label">频率:</span>
          <span class="debug-value" id="debug-config-frequency">每周提醒</span>
        </div>
        <div class="debug-config-thresholds">
          <div class="debug-threshold-item">
            <span class="debug-label">• 访问次数:</span>
            <span class="debug-value" id="debug-threshold-visit">≥ 8次</span>
          </div>
          <div class="debug-threshold-item">
            <span class="debug-label">• 访问时长:</span>
            <span class="debug-value" id="debug-threshold-duration">≥ 60秒</span>
          </div>
          <div class="debug-threshold-item">
            <span class="debug-label">• 访问深度:</span>
            <span class="debug-value" id="debug-threshold-depth">≥ 1.5屏</span>
          </div>
        </div>
        <div class="debug-config-process">
          <span class="debug-label">流程:</span>
          <span class="debug-value" id="debug-config-process">(3档,2档,1档)</span>
        </div>
      </div>
    </div>

    <!-- 实时指标数据 -->
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

      <!-- 进度条显示 -->
      <div class="debug-progress-section">
        <div class="debug-progress-item">
          <span class="debug-progress-label">次数进度:</span>
          <div class="debug-progress-bar">
            <div class="debug-progress-fill" id="debug-visit-progress"></div>
          </div>
          <span class="debug-progress-text" id="debug-visit-percent">0%</span>
        </div>
        <div class="debug-progress-item">
          <span class="debug-progress-label">时长进度:</span>
          <div class="debug-progress-bar">
            <div class="debug-progress-fill" id="debug-duration-progress"></div>
          </div>
          <span class="debug-progress-text" id="debug-duration-percent">0%</span>
        </div>
        <div class="debug-progress-item">
          <span class="debug-progress-label">深度进度:</span>
          <div class="debug-progress-bar">
            <div class="debug-progress-fill" id="debug-depth-progress"></div>
          </div>
          <span class="debug-progress-text" id="debug-depth-percent">0%</span>
        </div>
      </div>
    </div>

    <!-- 条件命中检测 -->
    <div class="debug-hit-section" id="debug-hit-section">
      <div class="debug-hit-header">
        🎯 条件命中检测
      </div>
      <div class="debug-hit-content" id="debug-hit-content">
        <div class="debug-hit-status" id="debug-hit-status">
          <span class="debug-label">状态:</span>
          <span class="debug-value" id="debug-hit-text">检测中...</span>
        </div>
        <div class="debug-hit-analysis" id="debug-hit-analysis" style="display: none;">
          <div class="debug-analysis-item">
            <span class="debug-label">• 访问次数:</span>
            <span class="debug-value" id="debug-analysis-visit">--</span>
          </div>
          <div class="debug-analysis-item">
            <span class="debug-label">• 访问时长:</span>
            <span class="debug-value" id="debug-analysis-duration">--</span>
          </div>
          <div class="debug-analysis-item">
            <span class="debug-label">• 访问深度:</span>
            <span class="debug-value" id="debug-analysis-depth">--</span>
          </div>
        </div>
        <div class="debug-hit-suggestion" id="debug-hit-suggestion" style="display: none;">
          <span class="debug-suggestion-text" id="debug-suggestion-text">--</span>
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
      width: 320px;
      min-height: 380px;
      max-height: 600px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 12px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      z-index: 999999;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      pointer-events: auto;
      user-select: none;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    .debug-header {
      padding: 10px 15px 6px 15px;
      font-weight: 600;
      font-size: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      margin-bottom: 8px;
      background: rgba(102, 126, 234, 0.2);
      border-radius: 12px 12px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .debug-title {
      flex: 1;
    }

    .debug-close-btn {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .debug-close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .debug-content {
      padding: 0 15px 12px 15px;
    }

    .debug-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      line-height: 1.3;
    }

    .debug-label {
      color: rgba(255, 255, 255, 0.8);
    }

    .debug-value {
      font-weight: 500;
      color: #4fc3f7;
    }

    /* 档位配置区域 */
    .debug-config-section {
      border: 1px solid rgba(102, 126, 234, 0.3);
      border-radius: 8px;
      margin: 8px 15px;
      background: rgba(102, 126, 234, 0.1);
    }

    .debug-config-header {
      padding: 6px 12px 4px 12px;
      font-weight: 600;
      font-size: 11px;
      color: #667eea;
      border-bottom: 1px solid rgba(102, 126, 234, 0.3);
      margin-bottom: 6px;
    }

    .debug-config-content {
      padding: 0 12px 8px 12px;
    }

    .debug-config-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      font-size: 11px;
    }

    .debug-config-thresholds {
      margin: 6px 0;
      font-size: 10px;
    }

    .debug-threshold-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
      color: rgba(255, 255, 255, 0.7);
    }

    .debug-config-process {
      margin-top: 4px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.6);
      font-style: italic;
    }

    /* 进度条区域 */
    .debug-progress-section {
      margin-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 8px;
    }

    .debug-progress-item {
      margin-bottom: 6px;
    }

    .debug-progress-label {
      display: block;
      margin-bottom: 2px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.7);
    }

    .debug-progress-bar {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 2px;
    }

    .debug-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4fc3f7, #29b6f6);
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    .debug-progress-text {
      font-size: 9px;
      color: rgba(255, 255, 255, 0.6);
      text-align: right;
    }

    /* 条件命中检测区域 */
    .debug-hit-section {
      border: 1px solid rgba(76, 175, 80, 0.3);
      border-radius: 8px;
      margin: 8px 15px;
      background: rgba(76, 175, 80, 0.1);
    }

    .debug-hit-header {
      padding: 6px 12px 4px 12px;
      font-weight: 600;
      font-size: 11px;
      color: #4caf50;
      border-bottom: 1px solid rgba(76, 175, 80, 0.3);
      margin-bottom: 6px;
    }

    .debug-hit-content {
      padding: 0 12px 8px 12px;
    }

    .debug-hit-status {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      font-size: 11px;
    }

    .debug-hit-analysis {
      margin: 6px 0;
      font-size: 10px;
    }

    .debug-analysis-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }

    .debug-hit-suggestion {
      margin-top: 6px;
      padding: 4px 8px;
      background: rgba(76, 175, 80, 0.2);
      border-radius: 4px;
      border-left: 3px solid #4caf50;
    }

    .debug-suggestion-text {
      font-size: 10px;
      color: #a5d6a7;
      font-weight: 500;
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

    /* 3大指标判定结果样式 */
    .debug-judgment-result {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }

    .debug-judgment-header {
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 6px;
      color: rgba(255, 255, 255, 0.9);
    }

    .debug-judgment-content {
      font-size: 10px;
    }

    .debug-judgment-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
    }

    #debug-judgment-status {
      font-weight: 600;
    }

    #debug-judgment-status.passed {
      color: #4caf50;
    }

    #debug-judgment-status.failed {
      color: #f44336;
    }

    #debug-judgment-level {
      color: #2196f3;
      font-weight: 500;
    }

    #debug-judgment-score {
      color: #ff9800;
      font-weight: 500;
    }

    #debug-judgment-confidence {
      color: #9c27b0;
      font-weight: 500;
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

    // 更新基本数据显示
    updateBasicMetrics(metrics);

    // 更新档位配置显示
    updateCurrentLevelConfig();

    // 更新进度条显示
    await updateProgressBars(metrics);

    // 更新条件命中检测
    await updateHitDetection(metrics);

    // 绑定调试控制按钮事件
    bindDebugControlEvents(metrics);

  } catch (error) {
    console.warn('更新调试窗口失败:', error);
  }
}

/**
 * 更新基本指标数据显示
 */
function updateBasicMetrics(metrics) {
  const visitCountEl = document.getElementById('debug-visit-count');
  const durationEl = document.getElementById('debug-duration');
  const depthEl = document.getElementById('debug-depth');

  if (visitCountEl) {
    visitCountEl.textContent = `${metrics.visitCount}次`;
  }

  if (durationEl) {
    durationEl.textContent = formatDuration(metrics.browseDuration);
  }

  if (depthEl) {
    depthEl.textContent = `${metrics.browseDepth.toFixed(1)}屏`;
  }
}

/**
 * 更新当前档位配置显示
 */
async function updateCurrentLevelConfig() {
  // 档位配置映射 - 移到函数开始处确保在try-catch块中可用
  const levelConfigs = [
    {
      name: '很少提醒',
      frequency: '每月提醒',
      thresholds: { visit: '≥ 20次', duration: '≥ 120秒', depth: '≥ 10屏' },
      process: '(0档,1档,2档)'
    },
    {
      name: '偶尔提醒',
      frequency: '每两周提醒',
      thresholds: { visit: '≥ 12次', duration: '≥ 90秒', depth: '≥ 5屏' },
      process: '(1档,2档,3档)'
    },
    {
      name: '适中提醒',
      frequency: '每周提醒',
      thresholds: { visit: '≥ 8次', duration: '≥ 60秒', depth: '≥ 1.5屏' },
      process: '(2档,3档,4档)'
    },
    {
      name: '常常提醒',
      frequency: '每三天提醒',
      thresholds: { visit: '≥ 5次', duration: '≥ 30秒', depth: '无要求' },
      process: '(3档,4档,?)'
    },
    {
      name: '频繁提醒',
      frequency: '每天提醒',
      thresholds: { visit: '≥ 3次', duration: '无要求', depth: '无要求' },
      process: '(4档,?,?)'
    }
  ];

  try {
    // 使用统一存储系统获取当前档位配置
    const storage = getUnifiedStorage();
    let currentLevel = await storage.get('reminder-sensitivity-level', 2); // 默认适中提醒

    // 确保值在有效范围内
    currentLevel = Math.max(0, Math.min(4, currentLevel));

    const config = levelConfigs[currentLevel];
    if (!config) return;

    // 更新档位配置显示
    const configLevelEl = document.getElementById('debug-config-level');
    const configFreqEl = document.getElementById('debug-config-frequency');
    const thresholdVisitEl = document.getElementById('debug-threshold-visit');
    const thresholdDurationEl = document.getElementById('debug-threshold-duration');
    const thresholdDepthEl = document.getElementById('debug-threshold-depth');
    const processEl = document.getElementById('debug-config-process');

    if (configLevelEl) configLevelEl.textContent = config.name;
    if (configFreqEl) configFreqEl.textContent = config.frequency;
    if (thresholdVisitEl) thresholdVisitEl.textContent = config.thresholds.visit;
    if (thresholdDurationEl) thresholdDurationEl.textContent = config.thresholds.duration;
    if (thresholdDepthEl) thresholdDepthEl.textContent = config.thresholds.depth;
    if (processEl) processEl.textContent = config.process;

    // 缓存当前档位，供其他函数使用
    window.currentDebugLevel = currentLevel;

    console.log(`[调试] 档位配置更新成功: ${config.name} (级别: ${currentLevel})`);

  } catch (error) {
    console.warn('更新档位配置失败:', error);

    // 使用统一存储系统的降级机制
    try {
      const storage = getUnifiedStorage();
      const fallbackLevel = await storage.get('reminder-sensitivity-level', 2);
      const fallbackConfig = levelConfigs[fallbackLevel];

      if (fallbackConfig) {
        const configLevelEl = document.getElementById('debug-config-level');
        const configFreqEl = document.getElementById('debug-config-frequency');
        const thresholdVisitEl = document.getElementById('debug-threshold-visit');
        const thresholdDurationEl = document.getElementById('debug-threshold-duration');
        const thresholdDepthEl = document.getElementById('debug-threshold-depth');
        const processEl = document.getElementById('debug-config-process');

        if (configLevelEl) configLevelEl.textContent = fallbackConfig.name;
        if (configFreqEl) configFreqEl.textContent = fallbackConfig.frequency;
        if (thresholdVisitEl) thresholdVisitEl.textContent = fallbackConfig.thresholds.visit;
        if (thresholdDurationEl) thresholdDurationEl.textContent = fallbackConfig.thresholds.duration;
        if (thresholdDepthEl) thresholdDepthEl.textContent = fallbackConfig.thresholds.depth;
        if (processEl) processEl.textContent = fallbackConfig.process;

        window.currentDebugLevel = fallbackLevel;
        console.log(`[调试] 档位配置降级成功: ${fallbackConfig.name} (级别: ${fallbackLevel})`);
      }
    } catch (fallbackError) {
      console.warn('档位配置降级也失败:', fallbackError);
      // 最后保底：使用硬编码默认值
      const configLevelEl = document.getElementById('debug-config-level');
      const configFreqEl = document.getElementById('debug-config-frequency');

      if (configLevelEl) configLevelEl.textContent = '适中提醒';
      if (configFreqEl) configFreqEl.textContent = '每周提醒';

      // 确保设置默认档位级别
      window.currentDebugLevel = 2;
    }
  }
}

/**
 * 更新进度条显示
 */
async function updateProgressBars(metrics) {
  // 直接从存储获取最新档位配置，避免依赖可能过期的缓存
  let currentLevel;
  try {
    const storage = getUnifiedStorage();
    currentLevel = await storage.get('reminder-sensitivity-level', 2);
  } catch (error) {
    console.warn('获取档位配置失败，使用默认值:', error);
    currentLevel = 2;
  }

  // 确保值在有效范围内
  currentLevel = Math.max(0, Math.min(4, currentLevel));

  // 同步更新缓存变量
  window.currentDebugLevel = currentLevel;

  // 档位阈值配置
  const thresholdConfigs = [
    { visit: 20, duration: 120, depth: 10 },   // 很少
    { visit: 12, duration: 90, depth: 5 },     // 偶尔
    { visit: 8, duration: 60, depth: 1.5 },    // 适中
    { visit: 5, duration: 30, depth: 0 },      // 常常 (深度无要求)
    { visit: 3, duration: 0, depth: 0 }        // 频繁 (时长和深度无要求)
  ];

  const thresholds = thresholdConfigs[currentLevel];
  if (!thresholds) {
    console.warn('无效的档位级别:', currentLevel);
    return;
  }

  // 调试日志
  console.log(`[进度条] 档位级别: ${currentLevel}, 时长阈值: ${thresholds.duration}秒, 当前时长: ${metrics.browseDuration}秒`);

  // 计算进度百分比
  const visitProgress = Math.min(100, (metrics.visitCount / thresholds.visit) * 100);
  const durationProgress = thresholds.duration > 0 ? Math.min(100, (metrics.browseDuration / thresholds.duration) * 100) : 100;
  const depthProgress = thresholds.depth > 0 ? Math.min(100, (metrics.browseDepth / thresholds.depth) * 100) : 100;

  // 更新进度条
  updateProgressBar('debug-visit-progress', 'debug-visit-percent', visitProgress);
  updateProgressBar('debug-duration-progress', 'debug-duration-percent', durationProgress);
  updateProgressBar('debug-depth-progress', 'debug-depth-percent', depthProgress);
}

/**
 * 更新单个进度条
 */
function updateProgressBar(progressId, textId, percentage) {
  const progressEl = document.getElementById(progressId);
  const textEl = document.getElementById(textId);

  if (progressEl) {
    progressEl.style.width = `${percentage}%`;

    // 根据进度调整颜色
    if (percentage >= 100) {
      progressEl.style.background = 'linear-gradient(90deg, #4caf50, #66bb6a)';
    } else if (percentage >= 80) {
      progressEl.style.background = 'linear-gradient(90deg, #ff9800, #ffa726)';
    } else {
      progressEl.style.background = 'linear-gradient(90deg, #4fc3f7, #29b6f6)';
    }
  }

  if (textEl) {
    textEl.textContent = `${Math.round(percentage)}%`;
  }
}

/**
 * 更新条件命中检测
 */
async function updateHitDetection(metrics) {
  // 获取当前档位配置 - 与updateProgressBars保持一致
  let currentLevel;
  try {
    const storage = getUnifiedStorage();
    currentLevel = await storage.get('reminder-sensitivity-level', 2);
  } catch (error) {
    console.warn('获取档位配置失败，使用默认值:', error);
    currentLevel = 2;
  }

  // 确保值在有效范围内
  currentLevel = Math.max(0, Math.min(4, currentLevel));

  // 备用方案：如果window.sensitivitySlider存在，使用它的值
  if (window.sensitivitySlider && typeof window.sensitivitySlider.currentLevel !== 'undefined') {
    currentLevel = window.sensitivitySlider.currentLevel;
  }

  // 档位阈值配置
  const thresholdConfigs = [
    { visit: 20, duration: 120, depth: 10 },   // 很少
    { visit: 12, duration: 90, depth: 5 },     // 偶尔
    { visit: 8, duration: 60, depth: 1.5 },    // 适中
    { visit: 5, duration: 30, depth: 0 },      // 常常
    { visit: 3, duration: 0, depth: 0 }        // 频繁
  ];

  const thresholds = thresholdConfigs[currentLevel];
  if (!thresholds) {
    console.warn('无效的档位级别:', currentLevel);
    return;
  }

  // 调试日志
  console.log(`[命中检测] 档位级别: ${currentLevel}, 时长阈值: ${thresholds.duration}秒, 当前时长: ${metrics.browseDuration}秒`);

  // 检查条件是否命中
  const visitHit = metrics.visitCount >= thresholds.visit;
  const durationHit = thresholds.duration === 0 || metrics.browseDuration >= thresholds.duration;
  const depthHit = thresholds.depth === 0 || metrics.browseDepth >= thresholds.depth;

  const isHit = visitHit && durationHit && depthHit;

  // 更新命中状态显示
  updateHitStatus(isHit, metrics, thresholds);
}

/**
 * 更新命中状态显示
 */
function updateHitStatus(isHit, metrics, thresholds) {
  const hitTextEl = document.getElementById('debug-hit-text');
  const analysisEl = document.getElementById('debug-hit-analysis');
  const suggestionEl = document.getElementById('debug-hit-suggestion');
  const suggestionTextEl = document.getElementById('debug-suggestion-text');

  if (hitTextEl) {
    if (isHit) {
      hitTextEl.textContent = '✅ 条件命中！';
      hitTextEl.style.color = '#4caf50';
    } else {
      hitTextEl.textContent = '❌ 条件未满足';
      hitTextEl.style.color = '#ff5722';
    }
  }

  // 显示详细分析
  if (analysisEl) {
    const visitAnalysis = document.getElementById('debug-analysis-visit');
    const durationAnalysis = document.getElementById('debug-analysis-duration');
    const depthAnalysis = document.getElementById('debug-analysis-depth');

    if (visitAnalysis) {
      visitAnalysis.textContent = `${metrics.visitCount}次 ${metrics.visitCount >= thresholds.visit ? '✅' : '❌'} (需要 ≥ ${thresholds.visit}次)`;
      visitAnalysis.style.color = metrics.visitCount >= thresholds.visit ? '#4caf50' : '#ff5722';
    }

    if (durationAnalysis) {
      if (thresholds.duration === 0) {
        durationAnalysis.textContent = '无要求 ✅';
        durationAnalysis.style.color = '#4caf50';
      } else {
        durationAnalysis.textContent = `${Math.round(metrics.browseDuration)}秒 ${metrics.browseDuration >= thresholds.duration ? '✅' : '❌'} (需要 ≥ ${thresholds.duration}秒)`;
        durationAnalysis.style.color = metrics.browseDuration >= thresholds.duration ? '#4caf50' : '#ff5722';
      }
    }

    if (depthAnalysis) {
      if (thresholds.depth === 0) {
        depthAnalysis.textContent = '无要求 ✅';
        depthAnalysis.style.color = '#4caf50';
      } else {
        depthAnalysis.textContent = `${metrics.browseDepth.toFixed(1)}屏 ${metrics.browseDepth >= thresholds.depth ? '✅' : '❌'} (需要 ≥ ${thresholds.depth}屏)`;
        depthAnalysis.style.color = metrics.browseDepth >= thresholds.depth ? '#4caf50' : '#ff5722';
      }
    }

    analysisEl.style.display = 'block';
  }

  // 显示建议
  if (suggestionEl && suggestionTextEl) {
    if (isHit) {
      suggestionTextEl.textContent = '🎉 当前访问模式已达到触发条件，建议触发智能收藏提醒！';
      suggestionEl.style.display = 'block';
    } else {
      suggestionEl.style.display = 'none';
    }
  }
}

/**
 * 绑定调试控制按钮事件
 */
function bindDebugControlEvents(metrics) {
  // 只绑定一次事件
  if (window.debugEventsBound) return;
  window.debugEventsBound = true;

  // 关闭窗口按钮（标题栏右侧）
  const closeBtn = document.getElementById('debug-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      removeDebugWindow();
    });
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
async function startDebugWindowUpdates() {
  // 立即更新一次
  await updateDebugWindow();

  // 设置定时更新 - 每秒更新访问时长
  CoreMetricsState.updateInterval = setInterval(async () => {
    await updateDebugWindow();
  }, 1000); // 每1秒更新一次

  // 使用统一存储系统的事件监听
  try {
    const storage = getUnifiedStorage();

    // 监听档位配置变化
    CoreMetricsState.storageChangeListener = async ({key, value}) => {
      if (key === 'reminder-sensitivity-level') {
        console.log('调试窗口：检测到档位配置变化，重新加载配置');
        await updateCurrentLevelConfig();
        await updateDebugWindow();
      }
    };

    storage.onValueChanged(CoreMetricsState.storageChangeListener);
    console.log('调试窗口：统一存储事件监听器已注册');

  } catch (error) {
    console.warn('统一存储事件监听器注册失败，使用传统监听:', error);

    // 降级到传统监听方式
    CoreMetricsState.storageChangeListener = async function(changes, namespace) {
      if (namespace === 'local') {
        if (changes['reminder-sensitivity-level']) {
          console.log('调试窗口：检测到档位配置变化(传统监听)，重新加载配置');
          await updateCurrentLevelConfig();
          await updateDebugWindow();
        }
      }
    };

    if (chrome.storage) {
      chrome.storage.onChanged.addListener(CoreMetricsState.storageChangeListener);
      console.log('调试窗口：传统存储变化监听器已注册');
    }
  }
}

/**
 * 停止调试窗口更新
 */
function stopDebugWindowUpdates() {
  if (CoreMetricsState.updateInterval) {
    clearInterval(CoreMetricsState.updateInterval);
    CoreMetricsState.updateInterval = null;
  }

  // 移除存储变化监听器
  if (CoreMetricsState.storageChangeListener) {
    try {
      // 尝试从统一存储系统移除监听器
      const storage = getUnifiedStorage();
      storage.offValueChanged(CoreMetricsState.storageChangeListener);
      console.log('调试窗口：统一存储事件监听器已移除');
    } catch (error) {
      console.warn('统一存储事件监听器移除失败，尝试传统方式:', error);

      // 降级到传统方式移除
      if (chrome.storage) {
        chrome.storage.onChanged.removeListener(CoreMetricsState.storageChangeListener);
        console.log('调试窗口：传统存储变化监听器已移除');
      }
    }
    CoreMetricsState.storageChangeListener = null;
  }
}

/**
 * 切换调试窗口显示/隐藏状态
 */
function toggleDebugWindow() {
  if (CoreMetricsState.debugWindow) {
    removeDebugWindow();
    console.log('[调试窗口] 通过快捷键隐藏');
  } else {
    window.showDebugWindow();
    console.log('[调试窗口] 通过快捷键显示');
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

// 加载3大指标判定引擎
function loadMetricsJudgmentEngine() {
  return new Promise((resolve, reject) => {
    if (window.MetricsJudgmentEngine) {
      resolve();
      return;
    }

    // 创建script标签
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('metrics-judgment-engine.js');
    script.onload = function() {
      console.log('3大指标判定引擎加载成功');
      resolve();
    };
    script.onerror = function() {
      console.error('3大指标判定引擎加载失败');
      reject(new Error('加载判定引擎失败'));
    };

    document.head.appendChild(script);
  });
}

// 页面加载完成后初始化
function initOnLoad() {
  setTimeout(async () => {
    try {
      // 先加载3大指标判定引擎
      await loadMetricsJudgmentEngine();

      // 初始化核心指标
      await initCoreMetrics();

      // 创建调试窗口（临时用于调试）
      createDebugWindow();
      await startDebugWindowUpdates();
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

  // 调试窗口快捷键：Windows/Linux (Ctrl+Alt+Q+E) / Mac (Command+Option+Q+E)
  if (event.key === 'e' || event.key === 'E') {
    // 检查是否按下了所需的前置键组合
    const isWindowsShortcut = event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey;
    const isMacShortcut = event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey;

    if (isWindowsShortcut || isMacShortcut) {
      event.preventDefault();
      toggleDebugWindow();
      console.log('[调试窗口] 快捷键触发:', isWindowsShortcut ? 'Ctrl+Alt+Q+E' : 'Command+Option+Q+E');
    }
  }
});

// 添加控制台命令（调试用）
if (typeof window !== 'undefined') {
  window.removeDebugWindow = removeDebugWindow;
  window.toggleDebugWindow = toggleDebugWindow;
  window.showDebugWindow = async function() {
    createDebugWindow();
    await startDebugWindowUpdates();
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

  window.testSmartReminder = async function() {
    console.log('测试智能提醒触发...');
    try {
      console.log('当前冷却状态:', {
        lastReminderTime: CoreMetricsState.lastReminderTime,
        cooldown: CoreMetricsState.reminderCooldown,
        timeSinceLastReminder: Date.now() - CoreMetricsState.lastReminderTime
      });

      // 重置冷却时间进行测试
      CoreMetricsState.lastReminderTime = 0;

      await triggerSmartReminder();
      console.log('智能提醒触发测试完成');
    } catch (error) {
      console.error('测试失败:', error);
    }
  };

  console.log('调试窗口控制命令:');
  console.log('- window.removeDebugWindow() 移除调试窗口');
  console.log('- window.showDebugWindow() 显示调试窗口');
  console.log('- window.toggleDebugWindow() 切换调试窗口显示/隐藏');
  console.log('- window.testCoreMetrics() 测试核心指标函数');
  console.log('- window.testSmartReminder() 测试智能提醒触发');
  console.log('- Ctrl+Shift+D 快捷键移除调试窗口');
  console.log('- Ctrl+Alt+Q+E (Windows/Linux) 或 Command+Option+Q+E (Mac) 快捷键切换调试窗口');
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


