// 内容脚本 - 弹窗显示功能

// 全局集合用于跟踪已提醒的主域名，防止同一次会话中重复提醒
const remindedDomains = new Set();

// 提取主域名函数
function extractMainDomain(url) {
  try {
    // 处理没有协议的情况
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }
    
    const urlObj = new URL(url);
    const domainParts = urlObj.hostname.split('.');
    
    // 处理常见的二级域名情况
    if (domainParts.length >= 2) {
      return domainParts.slice(-2).join('.');
    }
    return urlObj.hostname;
  } catch (error) {
    return '';
  }
}

// 主域名去重检查函数 - 委托给EventDrivenReminder
function isDomainReminded(url) {
  if (typeof EventDrivenReminder !== 'undefined' && EventDrivenReminder.isDomainReminded) {
    return EventDrivenReminder.isDomainReminded(url);
  }
  // 降级到本地检查
  const domain = extractMainDomain(url);
  return remindedDomains.has(domain);
}

function markDomainAsReminded(url) {
  if (typeof EventDrivenReminder !== 'undefined' && EventDrivenReminder.markDomainAsReminded) {
    return EventDrivenReminder.markDomainAsReminded(url);
  }
  // 降级到本地标记
  const domain = extractMainDomain(url);
  if (domain) {
    remindedDomains.add(domain);
  }
}

// 监听来自popup的消息
function setupMessageListener() {
  if (!isExtensionContextValid()) {
        return;
  }
  
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
        // 主域名去重检查
        if (!isDomainReminded(window.location.href)) {
          // 检查是否在黑名单中
          checkUrlInBlacklist(window.location.href).then(isInBlacklist => {
            if (!isInBlacklist) {
              markDomainAsReminded(window.location.href);
              showReminderToast(request.data);
            }
          });
        }
        sendResponse({success: true});
      }
    });
  } catch (error) {
      }
}

// 设置消息监听器
setupMessageListener();

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
  
  // 获取主域名用于标题显示
  const mainDomain = analysis ? analysis.topLevelDomain : 'example.com';
  
  toast.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <div style="font-weight: 600; color: #f5f5f7; font-size: 15px; letter-spacing: -0.2px;">📌 要收藏 ${mainDomain} 吗？</div>
      <button id="btnDismiss" style="
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 16px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s ease;
      ">×</button>
    </div>
    
    <div style="margin-bottom: 8px; font-size: 13px; color: rgba(255, 255, 255, 0.9); font-weight: 500;">
    </div>
    
    ${urlOptionsHTML}
    
    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.15); display: flex; justify-content: space-between; align-items: center;">
      <button id="btnNeverRemind" style="
        background: none;
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: rgba(255, 255, 255, 0.8);
        font-size: 12px;
        cursor: pointer;
        padding: 6px 12px;
        border-radius: 6px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 4px;
      ">🔕 不再提醒</button>
      
      <button id="btnRemindLater" style="
        background: none;
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: rgba(255, 255, 255, 0.8);
        font-size: 12px;
        cursor: pointer;
        padding: 6px 12px;
        border-radius: 6px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 4px;
      ">⏰ 稍后提醒</button>
    </div>
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
  document.getElementById('btnDismiss').addEventListener('click', () => {
    // 出场动画
    toast.style.transform = 'translateX(400px)';
    setTimeout(() => toast.remove(), 400);
  });
  
  // 绑定不再提醒按钮事件
  document.getElementById('btnNeverRemind').addEventListener('click', () => {
    // 添加域名到黑名单
    const currentDomain = analysis ? analysis.topLevelDomain : extractMainDomain(currentUrl);
    if (currentDomain) {
      // 发送消息给background script添加域名到黑名单
      chrome.runtime.sendMessage({
        action: 'addDomainToBlacklist',
        domain: currentDomain
      }, (response) => {
        if (response && response.success) {
          console.log('域名已添加到黑名单:', currentDomain);
        } else {
          console.error('添加域名到黑名单失败:', response ? response.error : '未知错误');
        }
      });
    }
    // 出场动画
    toast.style.transform = 'translateX(400px)';
    setTimeout(() => toast.remove(), 400);
  });
  
  // 绑定稍后提醒按钮事件
  document.getElementById('btnRemindLater').addEventListener('click', () => {
    // 这里可以添加稍后提醒的逻辑
    console.log('稍后提醒');
    // 出场动画
    toast.style.transform = 'translateX(400px)';
    setTimeout(() => toast.remove(), 400);
  });
  
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
    // 检查Chrome API是否可用
    if (!chrome || !chrome.storage) {
      throw new Error('Chrome.storage API不可用');
    }
    
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.maxAttempts || error.message.includes('Extension context invalidated')) {
        throw error;
      }

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
          }),
    new Promise(resolve => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        resolve();
      } catch (error) {
                resolve(); // localStorage失败也继续
      }
    })
  ];

  await Promise.allSettled(promises);
}

// 智能读取策略
async function smartRead(key, defaultValue) {
  // 检查扩展上下文是否有效
  if (!chrome || !chrome.storage) {
        try {
      const localValue = localStorage.getItem(key);
      if (localValue !== null) {
        return JSON.parse(localValue);
      }
    } catch (error) {
          }
    return defaultValue;
  }
  
  // 优先级1: chrome.storage
  try {
    const result = await StorageRetry.retry(() =>
      chrome.storage.local.get([key])
    );
    if (result[key] !== undefined) return result[key];
  } catch (error) {
      }

  // 优先级2: localStorage
  try {
    const localValue = localStorage.getItem(key);
    if (localValue !== null) {
      return JSON.parse(localValue);
    }
  } catch (error) {
      }

  // 优先级3: 默认值
  return defaultValue;
}

// 存储健康状态监控
const StorageHealth = {
  isHealthy: true,
  lastCheck: 0,
  checkInterval: 30000, // 30秒检查一次
  monitoringInterval: null,

  async check() {
    // 检查Chrome API是否可用
    if (!chrome || !chrome.storage) {
      this.isHealthy = false;
            return;
    }
    
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
          }
    this.lastCheck = Date.now();
  },

  startMonitoring() {
    // 先清除之前的监控
    this.stopMonitoring();
    this.monitoringInterval = setInterval(() => this.check(), this.checkInterval);
  },
  
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
};

// 智能缓存管理
class StorageCache {
  constructor(ttl = 60000) { // 1分钟缓存
    this.ttl = ttl;
    this.recover();
  }
  
  recover() {
    try {
      this.cache = new Map();
    } catch (error) {
            this.cache = null;
    }
  }

  get(key) {
    if (!this.cache) return null;
    
    try {
      const item = this.cache.get(key);
      if (!item) return null;

      if (Date.now() - item.timestamp > this.ttl) {
        this.cache.delete(key);
        return null;
      }

      return item.value;
    } catch (error) {
            return null;
    }
  }

  set(key, value) {
    if (!this.cache) return;
    
    try {
      this.cache.set(key, {
        value,
        timestamp: Date.now()
      });
    } catch (error) {
          }
  }

  invalidate(key) {
    if (!this.cache) return;
    try {
      this.cache.delete(key);
    } catch (error) {
          }
  }

  clear() {
    if (!this.cache) return;
    try {
      this.cache.clear();
    } catch (error) {
          }
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
    try {
      this.cache = new StorageCache();
      this.eventSystem = new StorageEventSystem();
      this.health = StorageHealth;
      this.healthCheckInterval = null;
      this.isInitialized = false;
      this.initialize();
    } catch (error) {
            // 设置最小可用的状态
      this.cache = null;
      this.eventSystem = null;
      this.health = StorageHealth;
      this.isInitialized = false;
    }
  }

  initialize() {
    if (!this.cache || !this.eventSystem) {
            return;
    }
    
    try {
      // 监听存储变化，自动更新缓存
      this.eventSystem.on('storage:changed', ({changes}) => {
        if (!this.cache) return;
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
        if (!this.cache) return;
        if (event.key && event.newValue !== null) {
          try {
            this.cache.set(event.key, JSON.parse(event.newValue));
          } catch (error) {
                      }
        }
      });

      // 监听健康状态变化
      this.healthCheckInterval = setInterval(() => {
        if (this.health.isHealthy && this.cache && typeof this.cache.entries === 'function') {
          // 扩展恢复健康且缓存对象有效，刷新缓存
          this.refreshCache();
        }
      }, 5000);
      
      this.isInitialized = true;
          } catch (error) {
            this.isInitialized = false;
    }
  }

  async get(key, defaultValue = null) {
    // 如果缓存无效，直接读取
    if (!this.cache) {
      return await smartRead(key, defaultValue);
    }
    
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

    // 更新缓存（如果有效）
    if (this.cache) {
      this.cache.set(key, value);
    }

    // 触发事件（如果有效）
    if (this.eventSystem) {
      this.eventSystem.emit('value:changed', {key, value});
    }
  }

  async remove(key) {
    try {
      await StorageRetry.retry(() =>
        chrome.storage.local.remove([key])
      ).catch(() => {});

      localStorage.removeItem(key);

      if (this.cache) {
        this.cache.invalidate(key);
      }

      if (this.eventSystem) {
        this.eventSystem.emit('value:removed', {key});
      }
    } catch (error) {
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
    try {
      if (!this.cache || typeof this.cache.entries !== 'function') {
        // 尝试重新初始化缓存
        this.recover();
        if (!this.cache) {
                    return;
        }
      }
      
      const entries = this.cache.entries();
      if (!entries) {
                return;
      }
      
      for (const [key, item] of entries) {
        try {
          const freshValue = await smartRead(key, null);
          if (freshValue !== null) {
            this.cache.set(key, freshValue);
          } else {
            this.cache.invalidate(key);
          }
        } catch (error) {
                  }
      }
    } catch (error) {
          }
  }

  destroy() {
    // 清理健康检查定时器
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.eventSystem.destroy();
    if (this.cache) {
      this.cache.clear();
    }
  }
}

// 创建全局存储实例
let unifiedStorage = null;
let storageFallback = false;

function getUnifiedStorage() {
  if (!unifiedStorage) {
    try {
      unifiedStorage = new UnifiedStorage();
      // 检查是否初始化成功
      if (!unifiedStorage.isInitialized && !unifiedStorage.cache) {
                storageFallback = true;
      }
    } catch (error) {
            storageFallback = true;
    }
  }
  
  // 如果启用降级模式，创建一个简化的存储对象
  if (storageFallback || !unifiedStorage) {
    return {
      async get(key, defaultValue = null) {
        try {
          return await smartRead(key, defaultValue);
        } catch (error) {
                    return defaultValue;
        }
      },
      async set(key, value) {
        try {
          await syncWrite(key, value);
        } catch (error) {
                  }
      },
      async remove(key) {
        try {
          localStorage.removeItem(key);
          if (chrome && chrome.storage) {
            await StorageRetry.retry(() =>
              chrome.storage.local.remove([key])
            ).catch(() => {});
          }
        } catch (error) {
                  }
      }
    };
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

  // 浏览数据窗口相关
  browseWindow: null,
  updateInterval: null,

  // 事件驱动提醒机制
  remindedUrls: new Set(), // 本次会话已提醒的URL集合
  remindedDomains: new Set(), // 本次会话已提醒的主域名集合
  isEventDrivenInitialized: false, // 事件驱动是否已初始化

  // URL变化检测
  lastUrl: window.location.href, // 记录上一个URL
  lastHitDetectionUrl: null, // 记录上次进行命中检测的URL
  
  // 移除无意义的冷却时间机制
};

// 事件驱动提醒管理器
const EventDrivenReminder = {
  // 初始化事件监听
  init() {
    if (CoreMetricsState.isEventDrivenInitialized) return;
    
    this.setupThresholdListeners();
    this.setupUrlChangeListener();
    CoreMetricsState.isEventDrivenInitialized = true;
  },

  // 设置URL变化监听器
  setupUrlChangeListener() {
    // 监听单页应用的路由变化
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      EventDrivenReminder.handleUrlChange();
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      EventDrivenReminder.handleUrlChange();
    };
    
    // 监听popstate事件（浏览器前进/后退）
    window.addEventListener('popstate', () => {
      EventDrivenReminder.handleUrlChange();
    });
    
    // 监听hash变化
    window.addEventListener('hashchange', () => {
      EventDrivenReminder.handleUrlChange();
    });
    
    // 添加定期URL检查，防止遗漏某些单页应用的URL变化
    this.urlCheckInterval = setInterval(() => {
      EventDrivenReminder.checkUrlChange();
    }, 1000);
  },

  // 处理URL变化
  handleUrlChange() {
    const currentUrl = window.location.href;
    
    // 如果URL没有变化，不处理
    if (currentUrl === CoreMetricsState.lastUrl) {
      return;
    }
    
    // 重置浏览明细窗口中的状态
    this.resetBrowseWindowState();
    
    // 更新URL记录
    CoreMetricsState.lastUrl = currentUrl;
    CoreMetricsState.lastHitDetectionUrl = null;
    
    // 重要：URL变化时，清空已提醒的URL集合，但保留主域名去重
    CoreMetricsState.remindedUrls.clear();
    
    console.log('URL已变化，重置检测状态和URL去重集合:', currentUrl);
  },

  // 统一的主域名去重检查函数
  isDomainReminded(url) {
    const domain = extractMainDomain(url);
    return CoreMetricsState.remindedDomains.has(domain);
  },

  // 统一的主域名标记函数
  markDomainAsReminded(url) {
    const domain = extractMainDomain(url);
    if (domain) {
      CoreMetricsState.remindedDomains.add(domain);
    }
  },

  // 定期检查URL变化
  checkUrlChange() {
    const currentUrl = window.location.href;
    
    // 如果URL有变化，调用handleUrlChange
    if (currentUrl !== CoreMetricsState.lastUrl) {
      console.log('检测到URL变化（定期检查）:', currentUrl);
      this.handleUrlChange();
    }
  },

  // 重置浏览明细窗口状态
  resetBrowseWindowState() {
    if (!CoreMetricsState.browseWindow) return;
    
    try {
      // 重置命中检测状态
      const hitTextEl = document.getElementById('browse-hit-text');
      if (hitTextEl) {
        hitTextEl.textContent = '检测中...';
        hitTextEl.style.color = '#4caf50';
      }
      
      // 重置收藏夹检查状态
      updateBookmarkCheckStatusInWindow('pending');
      
      // 隐藏建议和错误信息
      const suggestionEl = document.getElementById('browse-hit-suggestion');
      const errorEl = document.getElementById('browse-bookmark-error');
      if (suggestionEl) suggestionEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
    } catch (error) {
      console.warn('重置浏览明细窗口状态失败:', error);
    }
  },
  
  // 设置阈值监听器
  setupThresholdListeners() {
    // 监听访问次数变化
    this.observeVisitCount();
    // 监听浏览时长变化  
    this.observeBrowseDuration();
    // 监听浏览深度变化
    this.observeBrowseDepth();
  },
  
  // 监听访问次数变化
  observeVisitCount() {
    const originalUpdateVisitCount = updateDomainVisitCount;
    updateDomainVisitCount = async function() {
      const oldCount = CoreMetricsState.visitCount || 0;
      await originalUpdateVisitCount.call(this);
      const newCount = CoreMetricsState.visitCount || 0;
      
      if (newCount > oldCount) {
        EventDrivenReminder.checkVisitCountThreshold(newCount);
      }
    };
  },
  
  // 监听浏览时长变化
  observeBrowseDuration() {
    setInterval(() => {
      if (CoreMetricsState.isActiveTab) {
        const duration = getBrowseDuration();
        EventDrivenReminder.checkDurationThreshold(duration);
      }
    }, 2000); // 每2秒检查一次时长变化
  },
  
  // 监听浏览深度变化
  observeBrowseDepth() {
    const originalHandleScroll = handleScroll;
    handleScroll = function() {
      originalHandleScroll.call(this);
      
      // 在滚动处理完成后检查深度
      setTimeout(() => {
        const depth = getBrowseDepth();
        EventDrivenReminder.checkDepthThreshold(depth);
      }, 1100); // 略长于滚动防抖时间
    };
  },
  
  // 检查访问次数阈值
  checkVisitCountThreshold(count) {
    this.evaluateAndTrigger('visitCount', count);
  },
  
  // 检查浏览时长阈值
  checkDurationThreshold(duration) {
    this.evaluateAndTrigger('browseDuration', duration);
  },
  
  // 检查浏览深度阈值
  checkDepthThreshold(depth) {
    this.evaluateAndTrigger('browseDepth', depth);
  },
  
  // 评估并触发提醒
  async evaluateAndTrigger(triggerType, value) {
    const currentUrl = window.location.href;
    
    // 检查是否已提醒过此URL
    if (CoreMetricsState.remindedUrls.has(currentUrl)) {
      return; // 本次会话已提醒过，不再重复触发
    }

    // 检查是否已经对当前URL进行过命中检测（避免重复检测）
    if (CoreMetricsState.lastHitDetectionUrl === currentUrl) {
      return; // 已经检测过，不再重复触发
    }

    // 检查提醒是否已启用
    const isReminderEnabled = await this.isReminderEnabled();
    if (!isReminderEnabled) {
      return; // 提醒已禁用，不触发
    }
    
    // 获取当前指标并检查是否达到阈值
    const metrics = await this.getCurrentMetrics();
    if (!metrics) return;
    
    // 获取用户设置的档位
    const userLevel = await this.getUserLevel();
    const thresholds = this.getThresholds(userLevel);
    
    // 检查是否所有关键指标都达到阈值
    const visitHit = metrics.visitCount >= thresholds.visit;
    const durationHit = thresholds.duration === 0 || metrics.browseDuration >= thresholds.duration;
    const depthHit = thresholds.depth === 0 || metrics.browseDepth >= thresholds.depth;
    
    if (visitHit && durationHit && depthHit) {
      // 标记此URL已进行命中检测
      CoreMetricsState.lastHitDetectionUrl = currentUrl;
      
      // 创建metrics副本并标记跳过收藏夹检查
      const displayMetrics = {...metrics, skipBookmarkCheck: true};
      
      // 更新浏览明细窗口的条件命中检测（只调用一次，避免闪烁）
      await updateHitDetection(displayMetrics);
      
      // 检查URL是否在收藏夹中
      const isInBookmarks = await this.checkUrlInBookmarks(metrics.url);
      
      // 只有不在收藏夹中的页面才触发提醒
      if (!isInBookmarks) {
        await this.triggerReminder(metrics, userLevel);

        // 标记此URL已提醒
        CoreMetricsState.remindedUrls.add(currentUrl);
      } else {
        console.log('智能提醒跳过：URL已在收藏夹中');
      }
    }
  },
  
  // 获取当前指标
  async getCurrentMetrics() {
    try {
      return {
        visitCount: await getVisitCount(),
        browseDuration: getBrowseDuration(),
        browseDepth: getBrowseDepth(),
        url: window.location.href
      };
    } catch (error) {
            return null;
    }
  },
  
  // 获取用户设置的档位
  async getUserLevel() {
    try {
      const storage = getUnifiedStorage();
      let userLevel = await storage.get('reminder-sensitivity-level', 2);
      
      // 确保值在有效范围内
      userLevel = Math.max(0, Math.min(4, userLevel));
      
      // 备用方案
      if (window.sensitivitySlider && typeof window.sensitivitySlider.currentLevel !== 'undefined') {
        userLevel = window.sensitivitySlider.currentLevel;
      }
      
      return userLevel;
    } catch (error) {
            return 2;
    }
  },

  // 检查提醒是否已启用
  async isReminderEnabled() {
    try {
      const storage = getUnifiedStorage();
      const isEnabled = await storage.get('reminder-enabled', false); // 默认 false（不启用）
      
      // 备用方案：检查全局变量（书签管理器页面）
      if (window.reminderEnabledSwitch && typeof window.reminderEnabledSwitch.isEnabled === 'function') {
        return window.reminderEnabledSwitch.isEnabled();
      }
      
      return isEnabled;
    } catch (error) {
            return false; // 出错时默认不启用
    }
  },
  
  // 获取阈值配置
  getThresholds(userLevel) {
    const thresholdConfigs = [
      { visit: 20, duration: 120, depth: 10 },   // 很少提醒
      { visit: 12, duration: 90, depth: 5 },     // 偶尔提醒
      { visit: 8, duration: 60, depth: 1.5 },    // 适中提醒
      { visit: 5, duration: 30, depth: 0 },      // 常常提醒
      { visit: 3, duration: 0, depth: 0 }        // 频繁提醒
    ];
    
    return thresholdConfigs[userLevel] || thresholdConfigs[2];
  },

  // 检查URL是否在收藏夹中
  async checkUrlInBookmarks(url) {
    try {
      if (!url || !isExtensionContextValid()) {
        throw new Error('URL无效或扩展上下文不可用');
      }

      // 更新浏览明细窗口状态为检查中
      this.updateBookmarkCheckStatus('checking');

      const response = await safeSendMessage({
        action: 'checkUrlInBookmarks',
        url: url
      });

      if (response && typeof response.isInBookmarks === 'boolean') {
        // 更新浏览明细窗口状态为检查成功
        this.updateBookmarkCheckStatus('success', response.isInBookmarks);
        return response.isInBookmarks;
      }

      throw new Error('检查收藏夹失败');
    } catch (error) {
      // 采用保守策略：检查失败时返回true（表示在收藏夹中，避免提醒）
      console.warn('收藏夹检查失败，跳过提醒:', error.message);
      
      // 更新浏览明细窗口状态为检查失败
      this.updateBookmarkCheckStatus('error', error.message);
      return true;
    }
  },

  // 更新浏览明细窗口中的收藏夹检查状态
  updateBookmarkCheckStatus(status, data = null) {
    // 映射状态到新的函数调用
    let newStatus = status;
    if (status === 'checking') {
      newStatus = 'checking';
    } else if (status === 'success') {
      newStatus = 'success';
    } else if (status === 'error') {
      newStatus = 'error';
    }
    
    // 调用独立的状态更新函数
    updateBookmarkCheckStatusInWindow(newStatus, data);
  },
  
  // 触发提醒
  async triggerReminder(metrics, userLevel) {
    try {
      const reminderData = {
        type: 'domain',
        url: metrics.url,
        title: document.title,
        metrics: metrics
      };
      
      // 使用统一的主域名去重检查
      if (!this.isDomainReminded(metrics.url)) {
        // 检查是否在黑名单中
        checkUrlInBlacklist(metrics.url).then(isInBlacklist => {
          if (!isInBlacklist) {
            this.markDomainAsReminded(metrics.url);
            showReminderToast(reminderData);
          }
        });
      }
    } catch (error) {
          }
  },
  
  // 重置状态（页面卸载时调用）
  reset() {
    // 清理定期检查定时器
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }
    
    CoreMetricsState.remindedUrls.clear();
    CoreMetricsState.remindedDomains.clear();
    CoreMetricsState.isEventDrivenInitialized = false;
  }
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

    return visitCount;

  } catch (error) {
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

// 智能提醒触发机制
// =============

/**
 * 档位配置映射 - 全局配置，确保所有函数都可以访问
 */
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

// 浏览数据窗口管理
// ===============

/**
 * 创建浏览数据窗口
 */
function createBrowseWindow() {
  // 如果窗口已存在，直接返回
  if (CoreMetricsState.browseWindow) {
    return;
  }

  // 创建窗口容器
  const browseWindow = document.createElement('div');
  browseWindow.id = 'core-metrics-browse-window';
  browseWindow.innerHTML = `
    <div class="browse-header">
      <span class="browse-title">📊 智能书签浏览数据窗口 v2.0</span>
      <span class="browse-close-btn" id="browse-close-btn">×</span>
    </div>

    <!-- 当前档位配置 -->
    <div class="browse-config-section">
      <div class="browse-config-header">
        📊 当前提醒配置
      </div>
      <div class="browse-config-content">
        <div class="browse-config-item">
          <span class="browse-label">档位:</span>
          <span class="browse-value" id="browse-config-level">适中提醒</span>
        </div>
        <div class="browse-config-item">
          <span class="browse-label">频率:</span>
          <span class="browse-value" id="browse-config-frequency">每周提醒</span>
        </div>
        <div class="browse-config-thresholds">
          <div class="browse-threshold-item">
            <span class="browse-label">• 访问次数:</span>
            <span class="browse-value" id="browse-threshold-visit">≥ 8次</span>
          </div>
          <div class="browse-threshold-item">
            <span class="browse-label">• 访问时长:</span>
            <span class="browse-value" id="browse-threshold-duration">≥ 60秒</span>
          </div>
          <div class="browse-threshold-item">
            <span class="browse-label">• 访问深度:</span>
            <span class="browse-value" id="browse-threshold-depth">≥ 1.5屏</span>
          </div>
        </div>
        <div class="browse-config-process">
          <span class="browse-label">流程:</span>
          <span class="browse-value" id="browse-config-process">(3档,2档,1档)</span>
        </div>
      </div>
    </div>

    <!-- 实时指标数据 -->
    <div class="browse-content">
      <div class="browse-item">
        <span class="browse-label">次数:</span>
        <span class="browse-value" id="browse-visit-count">0次</span>
      </div>
      <div class="browse-item">
        <span class="browse-label">时长:</span>
        <span class="browse-value" id="browse-duration">0:00</span>
      </div>
      <div class="browse-item">
        <span class="browse-label">深度:</span>
        <span class="browse-value" id="browse-depth">0.0屏</span>
      </div>

      <!-- 进度条显示 -->
      <div class="browse-progress-section">
        <div class="browse-progress-item">
          <span class="browse-progress-label">次数进度:</span>
          <div class="browse-progress-bar">
            <div class="browse-progress-fill" id="browse-visit-progress"></div>
          </div>
          <span class="browse-progress-text" id="browse-visit-percent">0%</span>
        </div>
        <div class="browse-progress-item">
          <span class="browse-progress-label">时长进度:</span>
          <div class="browse-progress-bar">
            <div class="browse-progress-fill" id="browse-duration-progress"></div>
          </div>
          <span class="browse-progress-text" id="browse-duration-percent">0%</span>
        </div>
        <div class="browse-progress-item">
          <span class="browse-progress-label">深度进度:</span>
          <div class="browse-progress-bar">
            <div class="browse-progress-fill" id="browse-depth-progress"></div>
          </div>
          <span class="browse-progress-text" id="browse-depth-percent">0%</span>
        </div>
      </div>
    </div>

    <!-- 收藏与黑名单检测 -->
    <div class="browse-detection-section" id="browse-detection-section">
      <div class="browse-detection-header">
        📋 收藏与黑名单检测
      </div>
      <div class="browse-detection-content" id="browse-detection-content">
        <div class="browse-detection-item">
          <span class="browse-detection-label">是否命中提醒:</span>
          <span class="browse-detection-value" id="browse-hit-status">检测中...</span>
        </div>
        <div class="browse-detection-item">
          <span class="browse-detection-label">是否在收藏夹:</span>
          <span class="browse-detection-value" id="browse-bookmark-status">待检查</span>
        </div>
        <div class="browse-detection-item">
          <span class="browse-detection-label">是否在黑名单:</span>
          <span class="browse-detection-value" id="browse-blacklist-status">待检查</span>
        </div>
      </div>
    </div>

        </div>
    </div>

  `;

  // 添加样式
  const style = document.createElement('style');
  style.setAttribute('data-browse-window', 'true');
  style.textContent = `
    #core-metrics-browse-window {
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

    .browse-header {
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

    .browse-title {
      flex: 1;
    }

    .browse-close-btn {
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

    .browse-close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .browse-content {
      padding: 0 15px 12px 15px;
    }

    .browse-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      line-height: 1.3;
    }

    .browse-label {
      color: rgba(255, 255, 255, 0.8);
    }

    .browse-value {
      font-weight: 500;
      color: #4fc3f7;
    }

    /* 档位配置区域 */
    .browse-config-section {
      border: 1px solid rgba(102, 126, 234, 0.3);
      border-radius: 8px;
      margin: 8px 15px;
      background: rgba(102, 126, 234, 0.1);
    }

    .browse-config-header {
      padding: 6px 12px 4px 12px;
      font-weight: 600;
      font-size: 11px;
      color: #667eea;
      border-bottom: 1px solid rgba(102, 126, 234, 0.3);
      margin-bottom: 6px;
    }

    .browse-config-content {
      padding: 0 12px 8px 12px;
    }

    .browse-config-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      font-size: 11px;
    }

    .browse-config-thresholds {
      margin: 6px 0;
      font-size: 10px;
    }

    .browse-threshold-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
      color: rgba(255, 255, 255, 0.7);
    }

    .browse-config-process {
      margin-top: 4px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.6);
      font-style: italic;
    }

    /* 进度条区域 */
    .browse-progress-section {
      margin-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 8px;
    }

    .browse-progress-item {
      margin-bottom: 6px;
    }

    .browse-progress-label {
      display: block;
      margin-bottom: 2px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.7);
    }

    .browse-progress-bar {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 2px;
    }

    .browse-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4fc3f7, #29b6f6);
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    .browse-progress-text {
      font-size: 9px;
      color: rgba(255, 255, 255, 0.6);
      text-align: right;
    }

    /* 条件命中检测区域 */
    .browse-hit-section {
      border: 1px solid rgba(76, 175, 80, 0.3);
      border-radius: 8px;
      margin: 8px 15px;
      background: rgba(76, 175, 80, 0.1);
    }

    .browse-hit-header {
      padding: 6px 12px 4px 12px;
      font-weight: 600;
      font-size: 11px;
      color: #4caf50;
      border-bottom: 1px solid rgba(76, 175, 80, 0.3);
      margin-bottom: 6px;
    }

    .browse-hit-content {
      padding: 0 12px 8px 12px;
    }

    .browse-hit-status {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      font-size: 11px;
    }

    .browse-hit-analysis {
      margin: 6px 0;
      font-size: 10px;
    }

    .browse-analysis-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }

    .browse-hit-suggestion {
      margin-top: 6px;
      padding: 4px 8px;
      background: rgba(76, 175, 80, 0.2);
      border-radius: 4px;
      border-left: 3px solid #4caf50;
    }

    .browse-suggestion-text {
      font-size: 10px;
      color: #a5d6a7;
      font-weight: 500;
    }

    /* 收藏与黑名单检测区域 */
    .browse-detection-section {
      border: 1px solid rgba(156, 39, 176, 0.3);
      border-radius: 8px;
      margin: 8px 15px;
      background: rgba(156, 39, 176, 0.1);
    }

    .browse-detection-header {
      padding: 6px 12px 4px 12px;
      font-weight: 600;
      font-size: 11px;
      color: #9c27b0;
      border-bottom: 1px solid rgba(156, 39, 176, 0.3);
      margin-bottom: 6px;
    }

    .browse-detection-content {
      padding: 0 12px 8px 12px;
    }

    .browse-detection-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      padding: 4px 0;
    }

    .browse-detection-label {
      font-size: 11px;
      color: #ddd;
      flex: 1;
    }

    .browse-detection-value {
      font-size: 11px;
      font-weight: 600;
      flex: 1.5;
      text-align: right;
    }

    /* 状态颜色 */
    .detection-success {
      color: #4caf50;
    }

    .detection-warning {
      color: #ff9800;
    }

    .detection-error {
      color: #f44336;
    }

    .detection-info {
      color: #2196f3;
    }

    .detection-pending {
      color: #ff9800;
    }

    /* 窗口说明区域 */
    .browse-info-section {
      margin: 8px 15px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .browse-info-content {
      text-align: center;
    }

    .browse-info-text {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.4;
    }
  `;

  try {
    document.head.appendChild(style);
    document.body.appendChild(browseWindow);
  } catch (error) {
      }

  // 保存引用
  CoreMetricsState.browseWindow = browseWindow;

  // 初始化检测状态
  setTimeout(async () => {
    try {
      const metrics = await getCoreMetrics();
      await updateAllDetectionStatus(metrics.url);
    } catch (error) {
      console.warn('初始化检测状态失败:', error);
    }
  }, 500);
}

/**
 * 更新浏览数据窗口显示的数据
 */
async function updateBrowseWindow() {
  if (!CoreMetricsState.browseWindow) {
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

    // 绑定控制按钮事件
    bindBrowseControlEvents(metrics);

  } catch (error) {
      }
}

/**
 * 更新基本指标数据显示
 */
function updateBasicMetrics(metrics) {
  const visitCountEl = document.getElementById('browse-visit-count');
  const durationEl = document.getElementById('browse-duration');
  const depthEl = document.getElementById('browse-depth');

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
    const configLevelEl = document.getElementById('browse-config-level');
    const configFreqEl = document.getElementById('browse-config-frequency');
    const thresholdVisitEl = document.getElementById('browse-threshold-visit');
    const thresholdDurationEl = document.getElementById('browse-threshold-duration');
    const thresholdDepthEl = document.getElementById('browse-threshold-depth');
    const processEl = document.getElementById('browse-config-process');

    if (configLevelEl) configLevelEl.textContent = config.name;
    if (configFreqEl) configFreqEl.textContent = config.frequency;
    if (thresholdVisitEl) thresholdVisitEl.textContent = config.thresholds.visit;
    if (thresholdDurationEl) thresholdDurationEl.textContent = config.thresholds.duration;
    if (thresholdDepthEl) thresholdDepthEl.textContent = config.thresholds.depth;
    if (processEl) processEl.textContent = config.process;

    // 缓存当前档位，供其他函数使用
    window.currentBrowseLevel = currentLevel;

  } catch (error) {
    
    // 使用统一存储系统的降级机制
    try {
      const storage = getUnifiedStorage();
      const fallbackLevel = await storage.get('reminder-sensitivity-level', 2);
      const fallbackConfig = levelConfigs[fallbackLevel];

      if (fallbackConfig) {
        const configLevelEl = document.getElementById('browse-config-level');
        const configFreqEl = document.getElementById('browse-config-frequency');
        const thresholdVisitEl = document.getElementById('browse-threshold-visit');
        const thresholdDurationEl = document.getElementById('browse-threshold-duration');
        const thresholdDepthEl = document.getElementById('browse-threshold-depth');
        const processEl = document.getElementById('browse-config-process');

        if (configLevelEl) configLevelEl.textContent = fallbackConfig.name;
        if (configFreqEl) configFreqEl.textContent = fallbackConfig.frequency;
        if (thresholdVisitEl) thresholdVisitEl.textContent = fallbackConfig.thresholds.visit;
        if (thresholdDurationEl) thresholdDurationEl.textContent = fallbackConfig.thresholds.duration;
        if (thresholdDepthEl) thresholdDepthEl.textContent = fallbackConfig.thresholds.depth;
        if (processEl) processEl.textContent = fallbackConfig.process;

        window.currentBrowseLevel = fallbackLevel;
      }
    } catch (fallbackError) {
            // 最后保底：使用硬编码默认值
      const configLevelEl = document.getElementById('browse-config-level');
      const configFreqEl = document.getElementById('browse-config-frequency');

      if (configLevelEl) configLevelEl.textContent = '适中提醒';
      if (configFreqEl) configFreqEl.textContent = '每周提醒';

      // 确保设置默认档位级别
      window.currentBrowseLevel = 2;
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
        currentLevel = 2;
  }

  // 确保值在有效范围内
  currentLevel = Math.max(0, Math.min(4, currentLevel));

  // 同步更新缓存变量
  window.currentBrowseLevel = currentLevel;

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
        return;
  }

  // 计算进度百分比
  const visitProgress = Math.min(100, (metrics.visitCount / thresholds.visit) * 100);
  const durationProgress = thresholds.duration > 0 ? Math.min(100, (metrics.browseDuration / thresholds.duration) * 100) : 100;
  const depthProgress = thresholds.depth > 0 ? Math.min(100, (metrics.browseDepth / thresholds.depth) * 100) : 100;

  // 更新进度条
  updateProgressBar('browse-visit-progress', 'browse-visit-percent', visitProgress);
  updateProgressBar('browse-duration-progress', 'browse-duration-percent', durationProgress);
  updateProgressBar('browse-depth-progress', 'browse-depth-percent', depthProgress);
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
        currentLevel = 2;
  }

  // 确保值在有效范围内
  currentLevel = Math.max(0, Math.min(4, currentLevel));

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
        return;
  }

  // 使用新的统一检测函数
  await performHitDetection(metrics, thresholds);
}

/**
 * 更新命中状态显示
 */
function updateHitStatus(isHit, metrics, thresholds) {
  const hitStatusEl = document.getElementById('browse-hit-status');

  if (hitStatusEl) {
    if (isHit) {
      hitStatusEl.textContent = '✅ 命中 (已达到提醒条件)';
      hitStatusEl.className = 'browse-detection-value detection-success';
    } else {
      hitStatusEl.textContent = '❌ 未命中 (暂未达到提醒条件)';
      hitStatusEl.className = 'browse-detection-value detection-warning';
    }
  }
}

/**
 * 更新浏览数据窗口中的收藏夹检查状态（独立函数）
 */
function updateBookmarkCheckStatusInWindow(status, data = null) {
  if (!CoreMetricsState.browseWindow) return;

  try {
    const statusEl = document.getElementById('browse-bookmark-status');

    if (statusEl) {
      switch (status) {
        case 'pending':
          statusEl.textContent = '⏳ 待检查';
          statusEl.className = 'browse-detection-value detection-pending';
          break;
        case 'checking':
          statusEl.textContent = '🔍 检查中...';
          statusEl.className = 'browse-detection-value detection-info';
          break;
        case 'success':
          if (data === true) {
            statusEl.textContent = '✅ 已收藏';
            statusEl.className = 'browse-detection-value detection-success';
          } else {
            statusEl.textContent = '❌ 未收藏';
            statusEl.className = 'browse-detection-value detection-warning';
          }
          break;
        case 'error':
          statusEl.textContent = '❌ 检查失败';
          statusEl.className = 'browse-detection-value detection-error';
          break;
      }
    }
  } catch (error) {
    console.warn('更新收藏夹检查状态失败:', error);
  }
}

/**
 * 更新黑名单检查状态
 */
function updateBlacklistCheckStatus(status, data = null) {
  if (!CoreMetricsState.browseWindow) return;

  try {
    const statusEl = document.getElementById('browse-blacklist-status');

    if (statusEl) {
      switch (status) {
        case 'pending':
          statusEl.textContent = '⏳ 待检查';
          statusEl.className = 'browse-detection-value detection-pending';
          break;
        case 'checking':
          statusEl.textContent = '🔍 检查中...';
          statusEl.className = 'browse-detection-value detection-info';
          break;
        case 'success':
          if (data === true) {
            statusEl.textContent = '✅ 在黑名单中';
            statusEl.className = 'browse-detection-value detection-error';
          } else {
            statusEl.textContent = '❌ 未在黑名单';
            statusEl.className = 'browse-detection-value detection-success';
          }
          break;
        case 'error':
          statusEl.textContent = '❌ 检查失败';
          statusEl.className = 'browse-detection-value detection-error';
          break;
      }
    }
  } catch (error) {
    console.warn('更新黑名单检查状态失败:', error);
  }
}

/**
 * 检查URL是否在黑名单中
 */
async function checkUrlInBlacklist(url) {
  try {
    // 更新状态为检查中
    updateBlacklistCheckStatus('checking');

    // 从chrome.storage.local获取新的黑名单数据
    const result = await chrome.storage.local.get(['blacklistedDomains']);
    const blacklistedDomains = result.blacklistedDomains || [];

    if (!Array.isArray(blacklistedDomains)) {
      throw new Error('黑名单数据格式错误');
    }

    // 提取当前页面的主域名
    const currentDomain = extractMainDomain(url);

    // 检查是否在黑名单中（新的数据结构：简单字符串数组）
    const isInBlacklist = blacklistedDomains.some(domain => {
      if (!domain) return false;
      const blacklistDomain = extractMainDomain(domain);
      return blacklistDomain === currentDomain;
    });

    // 更新状态
    updateBlacklistCheckStatus('success', isInBlacklist);

    return isInBlacklist;
  } catch (error) {
    console.warn('黑名单检查失败:', error.message);
    updateBlacklistCheckStatus('error', error.message);
    return false;
  }
}

/**
 * 统一更新所有检测状态
 */
async function updateAllDetectionStatus(url) {
  try {
    // 检查黑名单
    await checkUrlInBlacklist(url);

    // 检查收藏夹
    if (typeof EventDrivenReminder !== 'undefined') {
      await EventDrivenReminder.checkUrlInBookmarks(url);
    }
  } catch (error) {
    console.warn('更新检测状态失败:', error);
  }
}

/**
 * 更新命中检测和条件分析
 */
async function performHitDetection(metrics, thresholds) {
  try {
    // 计算是否命中
    const visitHit = metrics.visitCount >= thresholds.visit;
    const durationHit = thresholds.duration === 0 || metrics.browseDuration >= thresholds.duration;
    const depthHit = thresholds.depth === 0 || metrics.browseDepth >= thresholds.depth;
    const isHit = visitHit && durationHit && depthHit;

    // 更新命中状态
    updateHitStatus(isHit, metrics, thresholds);

    // 如果条件命中，执行后续检测
    if (isHit) {
      await updateAllDetectionStatus(metrics.url);
    } else {
      // 条件未命中，重置其他状态
      updateBookmarkCheckStatusInWindow('pending');
      updateBlacklistCheckStatus('pending');
    }

    return isHit;
  } catch (error) {
    console.warn('命中检测失败:', error);
    return false;
  }
}

/**
 * 绑定控制按钮事件
 */
function bindBrowseControlEvents(metrics) {
  // 只绑定一次事件
  if (window.browseEventsBound) return;
  window.browseEventsBound = true;

  // 关闭窗口按钮（标题栏右侧）
  const closeBtn = document.getElementById('browse-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      removeBrowseWindow();
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
 * 启动浏览数据窗口数据更新
 */
async function startBrowseWindowUpdates() {
  // 立即更新一次
  await updateBrowseWindow();

  // 设置定时更新 - 每秒更新访问时长
  CoreMetricsState.updateInterval = setInterval(async () => {
    await updateBrowseWindow();
  }, 1000); // 每1秒更新一次

  // 使用统一存储系统的事件监听
  try {
    const storage = getUnifiedStorage();

    // 监听档位配置变化
    CoreMetricsState.storageChangeListener = async ({key, value}) => {
      if (key === 'reminder-sensitivity-level') {
                await updateCurrentLevelConfig();
        await updateBrowseWindow();
      }
    };

    storage.onValueChanged(CoreMetricsState.storageChangeListener);
    
  } catch (error) {
    
    // 降级到传统监听方式
    CoreMetricsState.storageChangeListener = async function(changes, namespace) {
      if (namespace === 'local') {
        if (changes['reminder-sensitivity-level']) {
          await updateCurrentLevelConfig();
          await updateBrowseWindow();
        }
      }
    };

    if (chrome.storage) {
      chrome.storage.onChanged.addListener(CoreMetricsState.storageChangeListener);
          }
  }
}

/**
 * 停止浏览数据窗口更新
 */
function stopBrowseWindowUpdates() {
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
          } catch (error) {
      
      // 降级到传统方式移除
      if (chrome.storage) {
        chrome.storage.onChanged.removeListener(CoreMetricsState.storageChangeListener);
              }
    }
    CoreMetricsState.storageChangeListener = null;
  }
}

/**
 * 切换浏览数据窗口显示/隐藏状态
 */
function toggleBrowseWindow() {
  if (CoreMetricsState.browseWindow) {
    removeBrowseWindow();
      } else {
    window.showBrowseWindow();
      }
}

/**
 * 移除浏览数据窗口
 */
function removeBrowseWindow() {
  stopBrowseWindowUpdates();

  if (CoreMetricsState.browseWindow) {
    CoreMetricsState.browseWindow.remove();
    CoreMetricsState.browseWindow = null;
  }

  // 移除样式
  const style = document.querySelector('style[data-browse-window="true"]');
  if (style) {
    style.remove();
  }

  }

/**
 * @deprecated 此函数已被事件驱动机制替代，保留用于向后兼容
 * 基于3大指标判定结果触发智能提醒
 */
async function triggerSmartReminder() {
  try {
    // 移除冷却时间检查 - 即时触发提醒

    const metrics = await getCoreMetrics();

    if (!metrics || !metrics.visitCount) {
      return; // 数据无效，不触发提醒
    }

    // 获取用户设置的提醒档位（与调试窗口完全一致的方式）
    const storage = getUnifiedStorage();
    let userLevel;
    
    try {
      userLevel = await storage.get('reminder-sensitivity-level', 2); // 默认适中提醒
    } catch (error) {
            userLevel = 2;
    }
    
    // 确保值在有效范围内
    userLevel = Math.max(0, Math.min(4, userLevel));
    
    // 备用方案：如果window.sensitivitySlider存在，使用它的值（与调试窗口一致）
    if (window.sensitivitySlider && typeof window.sensitivitySlider.currentLevel !== 'undefined') {
      userLevel = window.sensitivitySlider.currentLevel;
    }
    
    // 使用与调试窗口完全相同的阈值配置
    const thresholdConfigs = [
      { visit: 20, duration: 120, depth: 10 },   // 很少提醒
      { visit: 12, duration: 90, depth: 5 },     // 偶尔提醒
      { visit: 8, duration: 60, depth: 1.5 },    // 适中提醒
      { visit: 5, duration: 30, depth: 0 },      // 常常提醒
      { visit: 3, duration: 0, depth: 0 }        // 频繁提醒
    ];
    
    const thresholds = thresholdConfigs[userLevel];
    if (!thresholds) {
            return;
    }

    // 调试日志（与调试窗口保持一致）

    // 使用与调试窗口完全相同的判定逻辑
    const visitHit = metrics.visitCount >= thresholds.visit;
    const durationHit = thresholds.duration === 0 || metrics.browseDuration >= thresholds.duration;
    const depthHit = thresholds.depth === 0 || metrics.browseDepth >= thresholds.depth;

    const shouldTrigger = visitHit && durationHit && depthHit;
    
    
    // 生成提醒消息
    let reminderMessage = '';
    if (shouldTrigger) {
      reminderMessage = `检测到您达到${levelConfigs[userLevel].name}条件：`;
      
      const details = [];
      if (visitHit) {
        details.push(`访问${metrics.visitCount}次`);
      }
      if (durationHit && thresholds.duration > 0) {
        details.push(`浏览${metrics.browseDuration}秒`);
      }
      if (depthHit && thresholds.depth > 0) {
        details.push(`深度${metrics.browseDepth.toFixed(1)}屏`);
      }
      
      reminderMessage += details.join('，');
    }

    if (shouldTrigger) {

      // 移除冷却时间更新 - 即时触发弹窗
      // 显示提醒弹窗
      const reminderData = {
        type: 'domain',
        url: metrics.url,
        title: document.title,
        metrics: metrics
      };

      // 主域名去重检查
      if (!isDomainReminded(metrics.url)) {
        // 检查是否在黑名单中
        checkUrlInBlacklist(metrics.url).then(isInBlacklist => {
          if (!isInBlacklist) {
            markDomainAsReminded(metrics.url);
            showReminderToast(reminderData);
          }
        });
      }
    }
  } catch (error) {
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

  // 移除复杂的判定引擎，直接返回基础指标数据

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

  // 初始化事件驱动提醒机制
  EventDrivenReminder.init();

  CoreMetricsState.isInitialized = true;
}

/**
 * 清理资源
 */
function cleanupCoreMetrics() {
  if (!CoreMetricsState.isInitialized) return;

  // 移除浏览数据窗口
  removeBrowseWindow();

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

  // 重置事件驱动提醒状态
  EventDrivenReminder.reset();

  CoreMetricsState.isInitialized = false;
  CoreMetricsState.isActiveTab = false;
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
      resolve();
    };
    script.onerror = function() {
            reject(new Error('加载判定引擎失败'));
    };

    document.head.appendChild(script);
  });
}

// 检查扩展上下文是否有效
function isExtensionContextValid() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (error) {
    return false;
  }
}

// 页面加载完成后初始化
function initOnLoad() {
  setTimeout(async () => {
    try {
      // 检查扩展上下文
      if (!isExtensionContextValid()) {
                return;
      }
      
      // 先加载3大指标判定引擎
      await loadMetricsJudgmentEngine();

      // 初始化核心指标
      await initCoreMetrics();

    } catch (error) {
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





// 发送消息到扩展
function safeSendMessage(message) {
  return new Promise((resolve, reject) => {
    if (!isExtensionContextValid()) {
      reject(new Error('扩展上下文无效'));      
      return;
    }
    
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

// 添加键盘快捷键
document.addEventListener('keydown', function(event) {
  // Ctrl+Shift+C 触发浏览数据窗口（Mac和Windows通用）
  if (event.ctrlKey && event.shiftKey && event.key === 'C') {
    event.preventDefault();
    toggleBrowseWindow();
      }

  // Ctrl+Shift+X 触发智能提醒弹窗
  if (event.ctrlKey && event.shiftKey && event.key === 'X') {
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
  
  // 主域名去重检查
  if (!isDomainReminded(window.location.href)) {
    // 检查是否在黑名单中
    checkUrlInBlacklist(window.location.href).then(isInBlacklist => {
      if (!isInBlacklist) {
        markDomainAsReminded(window.location.href);
        showReminderToast(testData);
      }
    });
  }
}

// 添加控制台命令（开发用）
if (typeof window !== 'undefined') {
  window.removeBrowseWindow = removeBrowseWindow;
  window.toggleBrowseWindow = toggleBrowseWindow;
  window.showBrowseWindow = async function() {
    createBrowseWindow();
    await startBrowseWindowUpdates();
  };
  window.testCoreMetrics = async function() {
        try {
                                    
      const metrics = await getCoreMetrics();
    } catch (error) {
          }
  };

    }

