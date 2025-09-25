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


  // 事件驱动提醒机制
  remindedUrls: new Set(), // 本次会话已提醒的URL集合
  isEventDrivenInitialized: false, // 事件驱动是否已初始化

  // 移除无意义的冷却时间机制
};

// 事件驱动提醒管理器
const EventDrivenReminder = {
  // 初始化事件监听
  init() {
    if (CoreMetricsState.isEventDrivenInitialized) return;
    
    this.setupThresholdListeners();
    CoreMetricsState.isEventDrivenInitialized = true;
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
      await this.triggerReminder(metrics, userLevel);
      
      // 标记此URL已提醒
      CoreMetricsState.remindedUrls.add(currentUrl);
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
      console.warn('获取指标失败:', error);
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
      console.warn('获取档位失败:', error);
      return 2;
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
  
  // 触发提醒
  async triggerReminder(metrics, userLevel) {
    try {
      const reminderData = {
        type: 'domain',
        url: metrics.url,
        title: document.title,
        metrics: metrics
      };
      
      showReminderToast(reminderData);
    } catch (error) {
      console.error('事件驱动提醒失败:', error);
    }
  },
  
  // 重置状态（页面卸载时调用）
  reset() {
    CoreMetricsState.remindedUrls.clear();
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
      console.warn('获取档位配置失败，使用默认值:', error);
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
      console.warn('无效的档位级别:', userLevel);
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


