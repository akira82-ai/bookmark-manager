/**
 * 链接检测器类 - 简单可靠检测
 */
class LinkChecker {
  constructor() {
    this.timeout = 8000; // 8秒超时
  }

  /**
   * 简单可靠检测主入口
   */
  async check(url) {
        
    try {
      const startTime = Date.now();
      const result = await this.performCheck(url);
      const responseTime = Date.now() - startTime;

      // 确保 result 有 status 字段
      if (!result || !result.status) {
        throw new Error('检测结果无效');
      }

      const finalResult = {
        ...result,
        responseTime,
        checkedAt: Date.now()
      };

      return finalResult;
      
    } catch (error) {
      const errorResult = {
        status: 'timeout',
        error: error.message,
        responseTime: this.timeout,
        checkedAt: Date.now()
      };
      
            return errorResult;
    }
  }

  /**
   * 执行实际的链接检查
   */
  async performCheck(url) {
    try {
      // 使用简单可靠的检测方法
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      clearTimeout(timeoutId);

      // 由于 no-cors 模式限制，我们无法读取真实状态码
      // 这里使用一些启发式方法判断状态
      if (response.type === 'opaque') {
        // opaque 响应通常意味着跨域成功但无法读取详情
        return {
          status: 'valid',
          statusCode: 200,
          url: url,
          finalUrl: url
        };
      }

      return {
        status: 'valid',
        statusCode: response.status || 200,
        url: url,
        finalUrl: response.url || url
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        return {
          status: 'timeout',
          statusCode: 0,
          error: '请求超时',
          url: url,
          finalUrl: url
        };
      }

      if (error.name === 'TypeError') {
        // 通常是由于 CORS 或网络错误
        return {
          status: 'invalid',
          statusCode: 0,
          error: '无法访问',
          url: url,
          finalUrl: url
        };
      }

      return {
        status: 'invalid',
        statusCode: 0,
        error: error.message,
        url: url,
        finalUrl: url
      };
    }
  }
}

/**
 * 批量处理器类
 */
class BatchProcessor {
  constructor() {
    // 串行处理器，不需要并发参数
  }

  /**
   * 串行处理批量任务
   */
  async process(items, processor) {
        const results = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
            
      try {
        const result = await processor(item, i);
        results[i] = result;
              } catch (error) {
                results[i] = {
          status: 'error',
          error: error.message
        };
      }
      
      // 在项目之间添加小延迟，避免过快请求
      if (i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

        return results;
  }
}

class BookmarkManager {
  constructor() {
    this.currentFolder = null;
    this.bookmarks = [];
    this.folders = [];
    this.searchTerm = '';
    this.searchTimeout = null;

    // 展开/收起状态管理
    this.expandedFolders = new Set(); // 记录展开的文件夹
    
    // 访问统计相关
    this.visitStatsCache = new Map(); // 简单缓存
    this.pendingVisitQueries = new Set(); // 进行中的查询
    
    // 域名级别访问统计 - 高性能优化
    this.domainVisitIndex = new Map(); // 域名 -> 访问次数
    this.urlToDomainMap = new Map(); // URL -> 域名映射
    this.domainIndexInitialized = false; // 索引初始化状态
    this.initializationPromise = null; // 初始化Promise
    this.useDomainStats = true; // 使用域名级别统计
    this.MAX_DOMAIN_CACHE_SIZE = 5000; // 最大域名缓存数量
    this.MAX_URL_CACHE_SIZE = 20000; // 最大URL映射数量
    
    // 智能检测相关属性
    this.linkChecker = new LinkChecker();
    this.checkResults = new Map(); // 存储检测结果
    this.isChecking = false;
    this.isCheckMode = false; // 检测模式状态
    this.checkStats = {
      total: 0,
      processed: 0,
      valid: 0,
      invalid: 0,
      redirect: 0,
      timeout: 0
    };
    
    // 显示模式状态
    this.isGroupedView = false; // false=正常显示, true=分组显示
    
    // 书签管理器初始化
    
    this.init();
  }

  init() {
    this.bindEvents();
    // 初始化搜索按钮状态
    this.updateSearchButtonVisibility('');
    // 确保初始状态下隐藏检测结果分组UI
    this.ensureCheckResultsHidden();
    this.loadBookmarks();
    
    // 预初始化域名索引（异步进行，不阻塞UI）
    if (this.useDomainStats) {
      this.initializeDomainIndex().catch(error => {
                // 失败时自动降级到URL级别统计
        this.useDomainStats = false;
      });
    }
    
  }

  bindEvents() {
    // 事件委托：处理书签卡片的按钮点击
    document.getElementById('bookmarks-grid').addEventListener('click', (e) => {
      // 处理清除搜索按钮
      if (e.target.closest('.clear-search-btn')) {
        this.clearSearch();
        return;
      }
      
      const card = e.target.closest('.bookmark-card');
      if (!card) return;
      
      if (e.target.closest('.open-btn')) {
        const url = card.dataset.bookmarkUrl;
        this.openBookmark(url);
      } else if (e.target.closest('.edit-btn')) {
        const bookmarkId = card.dataset.bookmarkId;
        this.editBookmark(bookmarkId);
      } else if (e.target.closest('.delete-btn')) {
        const bookmarkId = card.dataset.bookmarkId;
        this.deleteBookmark(bookmarkId);
      }
    });

    // 智能检测工具栏事件
    this.bindToolbarEvents();

    // 搜索相关事件
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    // 点击搜索按钮进行搜索或清空
    searchBtn.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query === '') {
        // 如果搜索框为空，不执行任何操作
        return;
      } else {
        // 如果搜索框有内容，清空搜索框
        this.clearSearch();
      }
    });
    
    // 回车键搜索
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });

    // 实时搜索（带防抖）
    searchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      const query = e.target.value.trim();
      
      // 根据搜索框内容控制按钮显示
      this.updateSearchButtonVisibility(query);
      
      if (query === '') {
        // 如果搜索框为空，清除搜索
        this.clearSearch();
      } else {
        // 防抖处理，400ms后执行搜索
        this.searchTimeout = setTimeout(() => {
          this.performSearch();
        }, 400);
      }
    });
    
    // 移除展开所有按钮相关代码

    // 智能提醒设置展开/收起 - 点击整个横条区域
    const settingsHeader = document.querySelector('.settings-header');
    if (settingsHeader) {
      settingsHeader.addEventListener('click', () => {
        const content = document.getElementById('reminder-settings-content');
        const icon = settingsHeader.querySelector('.toggle-icon');

        if (content.style.display === 'none') {
          content.style.display = 'block';
          icon.textContent = '▲';
        } else {
          content.style.display = 'none';
          icon.textContent = '▼';
        }
      });
    }

    // 启用提醒开关逻辑
    class ReminderEnabledSwitch {
      constructor() {
        this.switchInput = document.getElementById('reminder-enabled');
        this.storageKey = 'reminder-enabled';
        this.defaultValue = false; // 默认不启用
        
        this.init();
      }

      init() {
        if (!this.switchInput) {
                    return;
        }

        this.loadSavedState();
        this.bindEvents();
      }

      // 加载保存的开关状态
      async loadSavedState() {
        try {
          let isEnabled = this.defaultValue;
          
          if (typeof chrome !== 'undefined' && chrome.storage) {
            // 优先使用 Chrome storage
            const result = await chrome.storage.local.get([this.storageKey]);
            isEnabled = result[this.storageKey] ?? this.defaultValue;
          } else {
            // 降级到 localStorage
            const savedValue = localStorage.getItem(this.storageKey);
            isEnabled = savedValue === null ? this.defaultValue : savedValue === 'true';
          }

          // 设置开关状态（不触发 change 事件）
          this.switchInput.checked = isEnabled;
                    
        } catch (error) {
                    this.switchInput.checked = this.defaultValue;
        }
      }

      // 保存开关状态
      async saveState(isEnabled) {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.set({ [this.storageKey]: isEnabled });
          } else {
            localStorage.setItem(this.storageKey, isEnabled.toString());
          }
                  } catch (error) {
                  }
      }

      // 绑定事件
      bindEvents() {
        this.switchInput.addEventListener('change', async (e) => {
          const isEnabled = e.target.checked;
          await this.saveState(isEnabled);
          
          // 提供用户反馈
          this.showStatusFeedback(isEnabled);
        });
      }

      // 显示状态反馈
      showStatusFeedback(isEnabled) {
        // 创建临时提示
        const toast = document.createElement('div');
        toast.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: ${isEnabled ? '#4CAF50' : '#FF5722'};
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 14px;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transform: translateX(100%);
          transition: transform 0.3s ease;
        `;
        toast.textContent = isEnabled ? '✅ 智能提醒已启用' : '❌ 智能提醒已禁用';
        
        document.body.appendChild(toast);
        
        // 动画显示
        setTimeout(() => {
          toast.style.transform = 'translateX(0)';
        }, 100);
        
        // 3秒后自动消失
        setTimeout(() => {
          toast.style.transform = 'translateX(100%)';
          setTimeout(() => {
            if (toast.parentNode) {
              toast.parentNode.removeChild(toast);
            }
          }, 300);
        }, 3000);
      }

      // 获取当前状态（供外部使用）
      isEnabled() {
        return this.switchInput.checked;
      }
    }

    // 敏感度滑块交互
    class SensitivitySlider {
      constructor() {
        this.track = document.querySelector('.sensitivity-track');
        this.thumb = document.querySelector('.sensitivity-thumb');
        this.fill = document.querySelector('.sensitivity-fill');
        this.isDragging = false;

        // 从chrome.storage.local恢复设置，默认适中提醒（第3刻度）
        let savedLevel = 2; // 默认值
        try {
          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['reminder-sensitivity-level']).then(result => {
              savedLevel = result['reminder-sensitivity-level'] || 2;
              this.currentLevel = Math.max(0, Math.min(4, savedLevel));
              this.updateUI(); // 确保UI更新
            }).catch(error => {
                            savedLevel = parseInt(localStorage.getItem('reminder-sensitivity-level')) || 2;
              this.currentLevel = Math.max(0, Math.min(4, savedLevel));
              this.updateUI(); // 确保UI更新
            });
          } else {
            // 降级到localStorage
            savedLevel = parseInt(localStorage.getItem('reminder-sensitivity-level')) || 2;
            this.currentLevel = Math.max(0, Math.min(4, savedLevel));
          }
        } catch (error) {
                    savedLevel = parseInt(localStorage.getItem('reminder-sensitivity-level')) || 2;
          this.currentLevel = Math.max(0, Math.min(4, savedLevel));
        }
        // 设置初始值（异步加载会覆盖）
        this.currentLevel = savedLevel;

        this.levels = [
          {
            name: '很少',
            frequency: '每月提醒',
            description: '重要资料，每月提醒一次',
            color: '#4CAF50',
            interval: 30,
            triggerConditions: {
              visitCount: '≥ 20次',
              browseDuration: '≥ 120秒',
              browseDepth: '≥ 10屏',
              process: '(5档,4档,3档)'
            },
            scenarios: ['极度重要的资料', '需要深度关注的内容', '每月回顾一次']
          },
          {
            name: '偶尔',
            frequency: '每两周提醒',
            description: '定期查看，每两周一次',
            color: '#8BC34A',
            interval: 14,
            triggerConditions: {
              visitCount: '≥ 12次',
              browseDuration: '≥ 90秒',
              browseDepth: '≥ 5屏',
              process: '(4档,3档,2档)'
            },
            scenarios: ['重要资料', '定期回顾的内容', '每两周检查一次']
          },
          {
            name: '适中',
            frequency: '每周提醒',
            description: '适度关注，每周一次',
            color: '#CDDC39',
            interval: 7,
            triggerConditions: {
              visitCount: '≥ 8次',
              browseDuration: '≥ 60秒',
              browseDepth: '≥ 1.5屏',
              process: '(3档,2档,1档)'
            },
            scenarios: ['工作学习资料', '常用参考内容', '每周回顾一次']
          },
          {
            name: '常常',
            frequency: '每三天提醒',
            description: '经常关注，每三天一次',
            color: '#FFC107',
            interval: 3,
            triggerConditions: {
              visitCount: '≥ 5次',
              browseDuration: '≥ 30秒',
              browseDepth: '无要求',
              process: '(2档,1档,?)'
            },
            scenarios: ['需要关注的内容', '项目相关资料', '每三天检查一次']
          },
          {
            name: '频繁',
            frequency: '每天提醒',
            description: '持续关注，每天一次',
            color: '#FF5722',
            interval: 1,
            triggerConditions: {
              visitCount: '≥ 3次',
              browseDuration: '无要求',
              browseDepth: '无要求',
              process: '(1档,?,?)'
            },
            scenarios: ['临时资料和待办事项', '需要每天关注的内容', '短期项目资料']
          }
        ];

        this.init();
      }

      init() {
        this.updateUI();
        this.attachEvents();
      }

      attachEvents() {
        // 鼠标事件
        this.thumb.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.track.addEventListener('click', this.handleTrackClick.bind(this));

        // 触摸事件
        this.thumb.addEventListener('touchstart', this.handleTouchStart.bind(this));

        // 全局事件
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        document.addEventListener('touchmove', this.handleTouchMove.bind(this));
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
      }

      handleMouseDown(e) {
        e.preventDefault();
        this.isDragging = true;
        this.thumb.style.cursor = 'grabbing';
      }

      handleTouchStart(e) {
        e.preventDefault();
        this.isDragging = true;
      }

      handleMouseMove(e) {
        if (!this.isDragging) return;
        this.updatePosition(e.clientX);
      }

      handleTouchMove(e) {
        if (!this.isDragging) return;
        this.updatePosition(e.touches[0].clientX);
      }

      handleMouseUp() {
        this.isDragging = false;
        this.thumb.style.cursor = 'grab';
      }

      handleTouchEnd() {
        this.isDragging = false;
      }

      handleTrackClick(e) {
        if (e.target === this.thumb) return;
        this.updatePosition(e.clientX);
      }

      updatePosition(clientX) {
        const rect = this.track.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));

        // 计算最近的档位 (0-4)，基于5个刻度点
        const level = Math.round(percentage / 25); // 100% / 4个间隔 = 25%
        this.setLevel(Math.max(0, Math.min(4, level)));
      }

      setLevel(level) {
        this.currentLevel = level;
        this.updateUI();
      }

      updateUI() {
        // 更新滑块位置 - 使用transform确保滑块中心对齐刻度
        const percentage = (this.currentLevel / 4) * 100;
        this.thumb.style.left = `${percentage}%`;
        this.fill.style.width = `${percentage}%`;

        // 更新模式信息
        const levelData = this.levels[this.currentLevel];
        if (!levelData) {
                    return;
        }

        document.getElementById('current-mode-name').textContent = `${levelData.name}提醒`;

        // 更新颜色主题
        if (levelData.color) {
          this.thumb.style.backgroundColor = levelData.color;
          this.fill.style.backgroundColor = levelData.color;
        }

        // 更新触发条件显示
        this.updateTriggerConditions(levelData);

        // 使用增强的存储机制保存配置
        this.saveConfigWithRetry(this.currentLevel, levelData.interval);
      }

      
      /**
       * 更新触发条件显示
       * @param {Object} levelData 当前级别的数据
       */
      updateTriggerConditions(levelData) {
        // 查找或创建触发条件显示区域
        let conditionsDiv = document.getElementById('trigger-conditions');
        if (!conditionsDiv) {
          conditionsDiv = document.createElement('div');
          conditionsDiv.id = 'trigger-conditions';
          conditionsDiv.style.cssText = `
            margin-top: 15px;
            padding: 15px;
            background: rgba(102, 126, 234, 0.08);
            border-radius: 8px;
            border-left: 4px solid #667eea;
            font-size: 0.9em;
            transition: all 0.3s ease;
          `;

          // 插入到mode-description后面
          const descriptionEl = document.getElementById('mode-description');
          if (descriptionEl) {
            descriptionEl.parentNode.insertBefore(conditionsDiv, descriptionEl.nextSibling);
          }
        }

        // 更新触发条件内容
        conditionsDiv.innerHTML = `
          <div style="margin-bottom: 10px;">
            <strong style="color: #667eea;">📋 触发条件：</strong>
          </div>
          <div style="margin-left: 20px; margin-bottom: 8px;">
            <span style="color: #666;">• 访问次数：</span>
            <span style="color: #333; font-weight: 600;">${levelData.triggerConditions.visitCount}</span>
          </div>
          <div style="margin-left: 20px; margin-bottom: 8px;">
            <span style="color: #666;">• 访问时长：</span>
            <span style="color: #333; font-weight: 600;">${levelData.triggerConditions.browseDuration}</span>
          </div>
          <div style="margin-left: 20px; margin-bottom: 12px;">
            <span style="color: #666;">• 访问深度：</span>
            <span style="color: #333; font-weight: 600;">${levelData.triggerConditions.browseDepth}</span>
          </div>
          <div style="margin-bottom: 10px;">
            <strong style="color: #667eea;">🎯 适用场景：</strong>
          </div>
          <div style="margin-left: 20px;">
            ${levelData.scenarios.map(scenario =>
              `<div style="margin-bottom: 4px; color: #666;">• ${scenario}</div>`
            ).join('')}
          </div>
          <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(102, 126, 234, 0.2);">
            <span style="color: #999; font-size: 0.85em;">流程顺序：${levelData.triggerConditions.process}</span>
          </div>
        `;
      }

      /**
       * 获取当前配置
       * @returns {Object} 当前敏感度级别的配置信息
       */
      getCurrentConfig() {
        const levelData = this.levels[this.currentLevel];
        return {
          frequency: levelData.name,
          interval: levelData.interval,
          level: this.currentLevel
        };
      }

      /**
       * 获取提醒间隔天数
       * @returns {number} 提醒间隔天数
       */
      getReminderInterval() {
        const levelData = this.levels[this.currentLevel];
        return levelData.interval;
      }

      /**
       * 获取提醒频率名称
       * @returns {string} 提醒频率名称
       */
      getFrequencyName() {
        const levelData = this.levels[this.currentLevel];
        return levelData.name;
      }

      /**
       * 使用增强机制保存配置（带重试和双写同步）
       * @param {number} level - 当前档位级别
       * @param {number} interval - 提醒间隔天数
       */
      async saveConfigWithRetry(level, interval) {
        const maxRetries = 3;
        const retryDelay = 500;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            // Chrome.storage保存
            if (typeof chrome !== 'undefined' && chrome.storage) {
              await new Promise((resolve, reject) => {
                chrome.storage.local.set({
                  'reminder-sensitivity-level': level,
                  'reminder-frequency-interval': interval
                }, () => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else {
                    resolve();
                  }
                });
              });
            }

            // localStorage保存（始终执行作为备份）
            localStorage.setItem('reminder-sensitivity-level', level.toString());
            localStorage.setItem('reminder-frequency-interval', interval.toString());

            return;

          } catch (error) {

            if (attempt === maxRetries) {
              // 最后一次尝试失败，至少确保localStorage有值
              try {
                localStorage.setItem('reminder-sensitivity-level', level.toString());
                localStorage.setItem('reminder-frequency-interval', interval.toString());
                              } catch (localError) {
                              }
              break;
            }

            // 等待延迟后重试
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          }
        }
      }
    }

    // 初始化启用提醒开关
    const reminderEnabledSwitch = new ReminderEnabledSwitch();
    // 暴露到全局作用域，供智能提醒功能使用
    window.reminderEnabledSwitch = reminderEnabledSwitch;

    // 初始化敏感度滑块
    const sensitivitySlider = new SensitivitySlider();

    // 暴露到全局作用域，供智能提醒功能使用
    window.sensitivitySlider = sensitivitySlider;

    
  
    // 模态框事件
    document.getElementById('modal-close').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('save-btn').addEventListener('click', () => {
      this.saveBookmark();
    });


    // 点击模态框外部关闭模态框
    document.getElementById('edit-modal').addEventListener('click', (e) => {
      if (e.target.id === 'edit-modal') {
        this.closeModal();
      }
    });
  }

  async loadBookmarks() {
    this.showLoading();
    
    try {
      // 获取所有书签
      const bookmarkTree = await chrome.bookmarks.getTree();
      this.processBookmarkTree(bookmarkTree[0]);
      
      this.renderFolderTree();
      this.renderBookmarks();
      this.updateStats();
      
      this.hideLoading();
    } catch (error) {
            this.hideLoading();
    }
  }

  processBookmarkTree(node) {
    if (node.url) {
      // 这是一个书签
      this.bookmarks.push({
        id: node.id,
        title: node.title || '无标题',
        url: node.url,
        parentId: node.parentId,
        dateAdded: node.dateAdded
      });
    } else if (node.children) {
      // 这是一个文件夹
      this.folders.push({
        id: node.id,
        title: node.title || '无标题文件夹',
        parentId: node.parentId,
        children: node.children
      });

      // 递归处理子节点
      node.children.forEach(child => {
        this.processBookmarkTree(child);
      });
    }
  }

  /**
   * 计算文件夹层级
   */
  calculateFolderLevel(folderId) {
    // 检查是否为顶级文件夹
    const isTopLevel = folderId === '0' ||
                      folderId === '1' ||
                      folderId === '2' ||
                      folderId === null ||
                      this.folders.find(f => f.id === folderId &&
                        (f.parentId === '0' || f.parentId === '1' || f.parentId === '2' || f.parentId === null));

    if (isTopLevel) {
      return 0; // 顶级文件夹级别为0
    }

    let level = 0;
    let currentId = folderId;

    while (currentId && currentId !== '0' && currentId !== '1' && currentId !== '2') {
      const parent = this.folders.find(f => f.id === currentId);
      if (!parent) break;
      currentId = parent.parentId;
      level++;

      // 如果到达了根文件夹，停止计算
      if (currentId === '0' || currentId === '1' || currentId === '2' || currentId === null) {
        break;
      }
    }

    return level;
  }

  /**
   * 获取文件夹的所有子文件夹（递归）
   */
  getAllChildFolders(folderId, includeSelf = false) {
    let folders = [];

    if (includeSelf) {
      const self = this.folders.find(f => f.id === folderId);
      if (self) folders.push(self);
    }

    // 查找直接子文件夹
    const directChildren = this.folders.filter(f => f.parentId === folderId);
    folders.push(...directChildren);

    // 递归查找子文件夹的子文件夹
    directChildren.forEach(child => {
      folders.push(...this.getAllChildFolders(child.id));
    });

    return folders;
  }

  /**
   * 按层级获取所有文件夹
   */
  getFoldersByLevel() {
    const folderLevels = {};

    this.folders.forEach(folder => {
      const level = this.calculateFolderLevel(folder.id);
      if (!folderLevels[level]) {
        folderLevels[level] = [];
      }
      folderLevels[level].push(folder);
    });

    return folderLevels;
  }

  /**
   * 检查文件夹是否有子文件夹
   */
  hasChildFolders(folderId) {
    return this.folders.some(f => f.parentId === folderId);
  }

  /**
   * 展开/收起文件夹
   */
  toggleFolder(folderId) {
    if (this.expandedFolders.has(folderId)) {
      // 收起文件夹
      this.expandedFolders.delete(folderId);
      // 同时收起所有子文件夹
      this.collapseChildFolders(folderId);
    } else {
      // 展开文件夹，同时收起所有子文件夹以确保只展开一级
      this.collapseChildFolders(folderId); // 先收起子文件夹
      this.expandedFolders.add(folderId);   // 再展开当前文件夹
    }
  }

  /**
   * 检查文件夹是否已展开
   */
  isFolderExpanded(folderId) {
    return this.expandedFolders.has(folderId);
  }

  /**
   * 收起指定文件夹的所有子文件夹（递归）
   */
  collapseChildFolders(parentId) {
    // 获取直接子文件夹
    const childFolders = this.folders.filter(f => f.parentId === parentId);

    // 收起每个子文件夹
    childFolders.forEach(child => {
      // 从展开状态中移除
      this.expandedFolders.delete(child.id);

      // 递归收起子文件夹的子文件夹
      this.collapseChildFolders(child.id);
    });
  }

  /**
   * 折叠所有已展开的文件夹
   */
  collapseAllFolders() {
    // 清空所有展开状态
    this.expandedFolders.clear();
  }

  /**
   * 判断文件夹是否为二级分类（父类是0、1、2的顶级文件夹）
   */
  isSecondLevelFolder(folderId) {
    const folder = this.folders.find(f => f.id === folderId);
    if (!folder) return false;

    // 检查父文件夹是否是顶级文件夹（0、1、2）
    return folder.parentId === '0' || folder.parentId === '1' || folder.parentId === '2';
  }

  /**
   * 判断两个文件夹是否属于同一个二级分类
   */
  isInSameSecondLevel(folderId1, folderId2) {
    // 获取两个文件夹的顶级父文件夹
    const topLevel1 = this.getTopLevelParent(folderId1);
    const topLevel2 = this.getTopLevelParent(folderId2);

    // 如果顶级父文件夹相同，则属于同一个二级分类
    return topLevel1 === topLevel2;
  }

  /**
   * 获取文件夹的顶级父文件夹（二级分类）
   */
  getTopLevelParent(folderId) {
    // 如果文件夹本身就是二级分类，返回自己
    if (this.isSecondLevelFolder(folderId)) {
      return folderId;
    }

    // 否则向上查找，直到找到二级分类
    const folder = this.folders.find(f => f.id === folderId);
    if (!folder) return null;

    let currentId = folder.parentId;
    while (currentId) {
      if (this.isSecondLevelFolder(currentId)) {
        return currentId;
      }

      const parentFolder = this.folders.find(f => f.id === currentId);
      if (!parentFolder) break;

      currentId = parentFolder.parentId;
    }

    return null;
  }

  renderFolderTree() {
    const folderTree = document.getElementById('folder-tree');
    folderTree.innerHTML = '';

    // 获取二级文件夹（跳过顶级目录，直接显示子文件夹）
    const secondLevelFolders = this.getSecondLevelFolders();

    // 将「最近收藏」和「黑名单」文件夹固定在前两位
    const recentFolder = secondLevelFolders.find(f => f.title === '📌 最近收藏');
    const blacklistFolder = secondLevelFolders.find(f => f.title === '🚫 黑名单');
    const otherFolders = secondLevelFolders.filter(f =>
      f.title !== '📌 最近收藏' && f.title !== '🚫 黑名单'
    );

    // 其他文件夹按标题排序
    otherFolders.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));

    // 先添加最近收藏文件夹（如果存在）
    if (recentFolder) {
      const recentFolderElement = this.createFolderElement(recentFolder);
      folderTree.appendChild(recentFolderElement);

      // 如果展开，添加子文件夹
      if (this.isFolderExpanded(recentFolder.id)) {
        this.addChildFolders(recentFolder.id, folderTree, 1);
      }
    }

    // 然后添加黑名单文件夹（如果存在）
    if (blacklistFolder) {
      const blacklistFolderElement = this.createFolderElement(blacklistFolder);
      folderTree.appendChild(blacklistFolderElement);

      // 如果展开，添加子文件夹
      if (this.isFolderExpanded(blacklistFolder.id)) {
        this.addChildFolders(blacklistFolder.id, folderTree, 1);
      }
    }

    // 最后添加其他二级分类及其子文件夹
    otherFolders.forEach(folder => {
      // 添加二级文件夹
      const folderElement = this.createFolderElement(folder);
      folderTree.appendChild(folderElement);

      // 如果展开，递归添加子文件夹
      if (this.isFolderExpanded(folder.id)) {
        this.addChildFolders(folder.id, folderTree, 1);
      }
    });
  }

  /**
   * 获取二级文件夹（跳过顶级目录，直接显示子文件夹）
   */
  getSecondLevelFolders() {
    // 根据Chrome书签结构，主要的顶级文件夹ID是：
    // 1: 收藏夹栏, 2: 其他收藏夹
    // 我们要直接显示这些文件夹的子文件夹作为二级分类
    const mainTopLevelIds = new Set(['1', '2']);

    // 返回所有父文件夹是主要顶级文件夹的二级文件夹
    return this.folders.filter(folder => {
      return mainTopLevelIds.has(folder.parentId);
    });
  }

  /**
   * 添加子文件夹（递归添加已展开的子文件夹）
   */
  addChildFolders(parentId, container, parentLevel) {
    // 获取当前文件夹的子文件夹
    const childFolders = this.folders.filter(f => f.parentId === parentId);

    // 按标题排序子文件夹
    childFolders.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));

    // 只有当有子文件夹时才创建容器
    if (childFolders.length === 0) return;

    // 创建子文件夹容器
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'folder-children';
    childrenContainer.dataset.parentId = parentId;

    // 设置展开状态
    const isExpanded = this.isFolderExpanded(parentId);
    if (isExpanded) {
      childrenContainer.classList.add('expanded');
      // 为展开状态的容器设置实际高度，避免固定高度导致的跳跃感
      setTimeout(() => {
        this.setContainerHeight(childrenContainer);
      }, 0);
    }

    // 渲染子文件夹，使用更自然的延迟时间
    childFolders.forEach((childFolder, index) => {
      const childElement = this.createFolderElement(childFolder);
      childElement.classList.add('folder-child');

      // 优化的渐进动画延迟 - 更短的时间间隔，更流畅的展开效果
      const delay = Math.min(index * 0.035, 0.2); // 最大延迟0.2秒
      childElement.style.transitionDelay = `${delay}s`;

      childrenContainer.appendChild(childElement);

      // 如果子文件夹也展开了，递归添加它的子文件夹
      // 这样用户可以逐级点击展开深层文件夹
      if (this.isFolderExpanded(childFolder.id)) {
        this.addChildFolders(childFolder.id, childrenContainer, parentLevel + 1);
      }
    });

    container.appendChild(childrenContainer);
  }

  /**
   * 动态设置容器高度，实现真正的滑动下拉效果
   */
  setContainerHeight(container) {
    if (!container || !container.classList.contains('expanded')) return;

    // 先设置一个足够大的高度，让滑动动画开始
    container.style.maxHeight = '1000px';

    // 在动画进行中计算并设置精确高度，确保滑动效果流畅
    requestAnimationFrame(() => {
      const actualHeight = container.scrollHeight;
      container.style.maxHeight = `${actualHeight}px`;
    });
  }

  /**
   * 优化的文件夹展开/收起动画
   */
  toggleFolderAnimation(folderId) {
    const folderElement = document.querySelector(`[data-folder-id="${folderId}"]`);
    if (!folderElement) return;

    const childrenContainer = folderElement.nextElementSibling;
    if (!childrenContainer || !childrenContainer.classList.contains('folder-children')) return;

    const expandIcon = folderElement.querySelector('.expand-icon');
    const isExpanding = !childrenContainer.classList.contains('expanded');

    if (isExpanding) {
      // 展开动画
      childrenContainer.classList.add('expanded');
      expandIcon?.classList.add('expanded');

      // 设置精确高度
      requestAnimationFrame(() => {
        this.setContainerHeight(childrenContainer);
      });
    } else {
      // 收起动画
      childrenContainer.classList.remove('expanded');
      expandIcon?.classList.remove('expanded');
    }
  }

  /**
   * 优化的文件夹树重新渲染 - 保持动画流畅
   */
  animateFolderTreeUpdate() {
    // 保存当前展开的文件夹列表
    const expandedFolders = [...this.expandedFolders];

    // 重新渲染文件夹树
    setTimeout(() => {
      this.renderFolderTree();

      // 为所有已展开的子容器设置正确的高度
      expandedFolders.forEach(folderId => {
        const folderElement = document.querySelector(`[data-folder-id="${folderId}"]`);
        if (folderElement) {
          const childrenContainer = folderElement.nextElementSibling;
          if (childrenContainer && childrenContainer.classList.contains('folder-children')) {
            setTimeout(() => {
              this.setContainerHeight(childrenContainer);
            }, 50); // 稍微延迟确保DOM完全更新
          }
        }
      });
    }, 10);
  }

  createFolderElement(folder) {
    const folderElement = document.createElement('div');
    folderElement.className = 'folder-item';
    folderElement.dataset.folderId = folder.id;

    // 计算并设置层级
    const level = this.calculateFolderLevel(folder.id);
    folderElement.dataset.level = level;

    // 根据层级添加对应的CSS类，用于不同层级的选中颜色
    if (level === 0) {
      folderElement.classList.add('folder-level-0'); // 二级分类（第一级显示）
    } else if (level === 1) {
      folderElement.classList.add('folder-level-1'); // 三级分类
    } else if (level === 2) {
      folderElement.classList.add('folder-level-2'); // 四级分类
    } else if (level >= 3) {
      folderElement.classList.add('folder-level-3-plus'); // 五级及更深层级
    }

    // 展开指示器（只有有子文件夹时才显示）
    const expandIcon = document.createElement('span');
    expandIcon.className = 'expand-icon';
    const hasChildren = this.hasChildFolders(folder.id);
    expandIcon.textContent = hasChildren ? '▶' : '';
    expandIcon.style.visibility = hasChildren ? 'visible' : 'hidden';

    // 设置展开指示器状态
    if (hasChildren && this.isFolderExpanded(folder.id)) {
      expandIcon.textContent = '▼';
      expandIcon.classList.add('expanded');
    }

    const folderIcon = document.createElement('span');
    folderIcon.className = 'folder-icon';
    folderIcon.textContent = '📁';

    const folderName = document.createElement('span');
    folderName.className = 'folder-name';
    folderName.textContent = folder.title;

    // 计算该文件夹内的书签数量（包括子文件夹中的书签）
    const totalBookmarks = this.countTotalBookmarks(folder.id);

    const folderCount = document.createElement('span');
    folderCount.className = 'folder-count';
    folderCount.textContent = totalBookmarks;

    folderElement.appendChild(expandIcon);
    folderElement.appendChild(folderIcon);
    folderElement.appendChild(folderName);
    folderElement.appendChild(folderCount);

    // 点击文件夹
    folderElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleFolderClick(folderElement, folder.id, folder.title);
    });

    return folderElement;
  }

  /**
   * 处理文件夹点击事件 - 支持丝滑展开/收起动画
   */
  handleFolderClick(folderElement, folderId, folderTitle) {
    const hasChildren = this.hasChildFolders(folderId);
    const isExpanded = this.isFolderExpanded(folderId);

    // 如果有子文件夹，切换展开/收起状态
    if (hasChildren) {
      // 先更新状态
      this.toggleFolder(folderId);

      // 使用优化的动画方式处理展开/收起
      this.toggleFolderAnimation(folderId);

      // 更新展开指示器图标
      const expandIcon = folderElement.querySelector('.expand-icon');
      if (expandIcon) {
        const newExpandedState = this.isFolderExpanded(folderId);
        expandIcon.textContent = newExpandedState ? '▼' : '▶';

        if (newExpandedState) {
          expandIcon.classList.add('expanded');
        } else {
          expandIcon.classList.remove('expanded');
        }
      }
    }

    // 选择文件夹并显示书签
    this.selectFolder(folderId, folderTitle);
  }

  /**
   * 动画方式更新文件夹树
   */
  animateFolderTreeUpdate() {
    const folderTree = document.getElementById('folder-tree');
    const currentExpanded = new Set(this.expandedFolders);

    // 重新渲染文件夹树
    this.renderFolderTree();

    // 触发动画
    setTimeout(() => {
      const allChildrenContainers = folderTree.querySelectorAll('.folder-children');
      allChildrenContainers.forEach(container => {
        const parentId = container.dataset.parentId;
        if (currentExpanded.has(parentId)) {
          // 强制触发展开动画
          container.style.maxHeight = '0';
          container.style.opacity = '0';
          container.style.transform = 'scaleY(0)';

          setTimeout(() => {
            container.classList.add('expanded');
            // 计算实际高度
            const height = container.scrollHeight;
            container.style.maxHeight = height + 'px';
            container.style.opacity = '1';
            container.style.transform = 'scaleY(1)';
          }, 50);
        }
      });
    }, 10);
  }

  /**
   * 计算文件夹内总书签数量（包括子文件夹中的书签）
   */
  countTotalBookmarks(folderId) {
    let count = 0;

    // 直接子书签
    count += this.bookmarks.filter(b => b.parentId === folderId).length;

    // 递归计算子文件夹中的书签
    const childFolders = this.folders.filter(f => f.parentId === folderId);
    childFolders.forEach(childFolder => {
      count += this.countTotalBookmarks(childFolder.id);
    });

    return count;
  }

  
  selectFolder(folderId, folderTitle) {
    // 如果当前在搜索状态，先退出搜索
    if (this.searchTerm) {
      this.exitSearchState();
    }

    // 如果当前在检测模式，先退出检测模式
    if (this.isCheckMode) {
      this.exitCheckMode();
    }

    // 只有切换到不同的二级分类时才折叠所有展开的文件夹
    if (this.currentFolder !== folderId &&
        this.isSecondLevelFolder(folderId) &&
        (!this.currentFolder || !this.isInSameSecondLevel(this.currentFolder, folderId))) {
      this.collapseAllFolders();
    }

    // 更新当前文件夹
    this.currentFolder = folderId;

    // 更新侧边栏状态
    document.querySelectorAll('.folder-item').forEach(item => {
      item.classList.remove('active');
    });

    const selectedFolder = document.querySelector(`[data-folder-id="${folderId}"]`);
    if (selectedFolder) {
      selectedFolder.classList.add('active');
    }

    // 重新渲染文件夹树以应用折叠状态
    this.renderFolderTree();

    // 渲染书签
    this.renderBookmarks();
  }

  // 面包屑导航功能已移除

  renderBookmarks() {
    const grid = document.getElementById('bookmarks-grid');
    const welcomePage = document.getElementById('welcome-page');
    
    grid.innerHTML = '';
    
    // 确保在未检测状态下隐藏分组容器
    if (!this.isCheckMode || this.checkResults.size === 0) {
      const groupedContainer = document.getElementById('results-grouped');
      if (groupedContainer) {
        groupedContainer.style.display = 'none';
      }
    }
    
    // 如果有搜索词，显示搜索结果
    if (this.searchTerm) {
      this.showBookmarksView();
      this.renderSearchResults();
      return;
    }
    
    // 如果没有选择文件夹，显示欢迎页面
    if (this.currentFolder === null) {
      this.showWelcomePage();
      return;
    }
    
    // 否则显示书签列表
    this.showBookmarksView();
    
    // 获取当前文件夹的书签
    let bookmarks;
    if (this.currentFolder === null) {
      // 显示根目录书签（parentId为"0"或书签栏/其他书签栏的根节点）
      bookmarks = this.bookmarks.filter(b => b.parentId === "0" || b.parentId === "1" || b.parentId === "2");
    } else {
      bookmarks = this.bookmarks.filter(b => b.parentId === this.currentFolder);
    }
    
    // 过滤有URL的书签进行统计
    const displayBookmarks = bookmarks.filter(b => b.url && b.url.trim() !== '');
        
    // 按标题排序（默认）
    bookmarks = this.sortBookmarksArray(bookmarks);
    
    if (bookmarks.length === 0) {
      this.showEmptyState();
      return;
    }
    
    this.hideEmptyState();
    
    let cardCount = 0;
    bookmarks.forEach(bookmark => {
      const card = this.createBookmarkCard(bookmark, { mode: 'normal' });
      grid.appendChild(card);
      cardCount++;
    });
    
      }

  /**
 * 创建统一的书签卡片
 * @param {Object} bookmark - 书签对象
 * @param {Object} options - 配置选项
 * @param {string} options.mode - 显示模式: 'normal'(默认) | 'search'
 * @param {string} options.searchTerm - 搜索关键词(仅search模式)
 * @returns {HTMLElement} 书签卡片元素
 */
createBookmarkCard(bookmark, options = {}) {
  const { mode = 'normal', searchTerm = '' } = options;
  
  const card = document.createElement('div');
  card.className = 'bookmark-card';
  card.dataset.bookmarkId = bookmark.id;
  card.dataset.bookmarkUrl = bookmark.url;
  card.dataset.bookmarkTitle = bookmark.title;
  
  // 获取favicon
  const favicon = this.getFaviconUrl(bookmark.url);
  
  // 处理文本内容（支持搜索高亮）
  let titleContent = this.escapeHtml(bookmark.title);
  let urlContent = this.escapeHtml(bookmark.url);
  
  if (mode === 'search' && searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    const lowerTitle = bookmark.title.toLowerCase();
    const lowerUrl = bookmark.url.toLowerCase();
    
    if (lowerTitle.includes(searchLower)) {
      titleContent = this.highlightText(bookmark.title, searchTerm);
    }
    if (lowerUrl.includes(searchLower)) {
      urlContent = this.highlightText(bookmark.url, searchTerm);
    }
  }
  
  card.innerHTML = `
    <div class="bookmark-header">
      <img class="bookmark-favicon" src="${favicon}" alt="favicon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI0U1RTVFNSIvPgo8cGF0aCBkPSJNMTIgN0M5LjI0IDcgNyA5LjI0IDcgMTJDMiAxNC43NiA5LjI0IDE3IDEyIDE3QzE0Ljc2IDE3IDE3IDE0Ljc2IDE3IDEyQzE3IDkuMjQgMTQuNzYgNyAxMiA3WiIgZmlsbD0iIzk5OTk5OSIvPgo8L3N2Zz4K'">
      <div class="bookmark-title">${titleContent}</div>
    </div>
    <div class="bookmark-url">${urlContent}</div>
    <div class="bookmark-actions">
      <div class="action-buttons">
        <button class="bookmark-action-btn edit-btn">编辑</button>
        <button class="bookmark-action-btn delete-btn">删除</button>
      </div>
      <span class="visit-count" data-url="${this.escapeHtml(bookmark.url)}">👁 加载中...</span>
    </div>
  `;
  
  // 绑定事件监听器
  this.bindCardEvents(card, bookmark);
  
  // 添加点击选择功能（用于批量操作）
  card.addEventListener('click', (e) => {
    // 如果按住Ctrl键，切换选择状态
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      card.classList.toggle('selected');
    }
  });
  
  // 异步获取并显示访问次数
  this.loadAndDisplayVisitCount(card, bookmark.url);
  
  return card;
}

/**
 * 为书签卡片绑定事件监听器
 * @param {HTMLElement} card - 书签卡片元素
 * @param {Object} bookmark - 书签对象
 */
bindCardEvents(card, bookmark) {
  
  // 单击打开书签（点击卡片空白区域）
  card.addEventListener('click', (e) => {
    // 如果点击的是按钮区域，不触发跳转
    if (e.target.closest('.action-buttons')) {
      return;
    }
    // 如果卡片处于编辑模式，不触发跳转
    if (card.classList.contains('editing')) {
      return;
    }
    this.openBookmark(bookmark.url);
  });
  
  // 按钮事件
  const editBtn = card.querySelector('.edit-btn');
  const deleteBtn = card.querySelector('.delete-btn');
  
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleEditMode(card, bookmark);
    });
  }
  
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteBookmark(bookmark.id);
    });
  }
}

  getFaviconUrl(url) {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch (e) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI0U1RTVFNSIvPgo8cGF0aCBkPSJNMTIgN0M5LjI0IDcgNyA5LjI0IDcgMTJDMiAxNC43NiA5LjI0IDE3IDEyIDE3QzE0Ljc2IDE3IDE3IDE0Ljc2IDE3IDEyQzE3IDkuMjQgMTQuNzYgNyAxMiA3WiIgZmlsbD0iIzk5OTk5OSIvPgo8L3N2Zz4K';
    }
  }

  openBookmark(url) {
    chrome.tabs.create({ url: url });
  }

  editBookmark(bookmarkId) {
    const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
    if (!bookmark) return;
    
    // 填充表单
    document.getElementById('edit-title').value = bookmark.title;
    document.getElementById('edit-url').value = bookmark.url;
    
    // 填充文件夹选项
    const folderSelect = document.getElementById('edit-folder');
    folderSelect.innerHTML = '';
    
    // 添加根目录选项
    const rootOption = document.createElement('option');
    rootOption.value = '0';
    rootOption.textContent = '🏠 根目录';
    folderSelect.appendChild(rootOption);
    
    // 添加其他文件夹选项
    this.folders.forEach(folder => {
      const option = document.createElement('option');
      option.value = folder.id;
      option.textContent = folder.title;
      option.selected = folder.id === bookmark.parentId;
      folderSelect.appendChild(option);
    });
    
    // 显示模态框
    document.getElementById('edit-modal').style.display = 'flex';
    
    // 保存当前编辑的书签ID
    this.editingBookmarkId = bookmarkId;
  }

  /**
   * 切换书签卡片的编辑模式
   * @param {HTMLElement} card - 书签卡片元素
   * @param {Object} bookmark - 书签对象
   */
  toggleEditMode(card, bookmark) {
    const isEditing = card.classList.contains('editing');
    
    if (isEditing) {
      // 保存编辑
      this.saveInlineEdit(card, bookmark);
    } else {
      // 进入编辑模式
      this.enterEditMode(card, bookmark);
    }
  }

  /**
   * 进入编辑模式
   * @param {HTMLElement} card - 书签卡片元素
   * @param {Object} bookmark - 书签对象
   */
  enterEditMode(card, bookmark) {
    const titleElement = card.querySelector('.bookmark-title');
    const urlElement = card.querySelector('.bookmark-url');
    const editBtn = card.querySelector('.edit-btn');
    
    // 保存原始值
    card.dataset.originalTitle = bookmark.title;
    card.dataset.originalUrl = bookmark.url;
    
    // 替换标题为输入框
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'bookmark-title-input';
    titleInput.value = bookmark.title;
    titleInput.placeholder = '请输入书签标题';
    titleElement.innerHTML = '';
    titleElement.appendChild(titleInput);
    
    // 替换URL为输入框
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.className = 'bookmark-url-input';
    urlInput.value = bookmark.url;
    urlInput.placeholder = '请输入书签URL';
    urlElement.innerHTML = '';
    urlElement.appendChild(urlInput);
    
    // 更改按钮文本
    editBtn.textContent = '保存';
    editBtn.classList.add('save-btn');
    
    // 添加编辑模式样式
    card.classList.add('editing');
    
    // 聚焦到标题输入框
    titleInput.focus();
    titleInput.select();
    
    // 绑定回车键保存
    const saveOnEnter = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.saveInlineEdit(card, bookmark);
        titleInput.removeEventListener('keydown', saveOnEnter);
        urlInput.removeEventListener('keydown', saveOnEnter);
      }
    };
    
    titleInput.addEventListener('keydown', saveOnEnter);
    urlInput.addEventListener('keydown', saveOnEnter);
  }

  /**
   * 保存内联编辑
   * @param {HTMLElement} card - 书签卡片元素
   * @param {Object} bookmark - 书签对象
   */
  async saveInlineEdit(card, bookmark) {
    const titleInput = card.querySelector('.bookmark-title-input');
    const urlInput = card.querySelector('.bookmark-url-input');
    
    const newTitle = titleInput.value.trim();
    const newUrl = urlInput.value.trim();
    
    // 验证输入
    if (!newTitle) {
      alert('请输入书签标题');
      titleInput.focus();
      return;
    }
    
    if (!newUrl) {
      alert('请输入书签URL');
      urlInput.focus();
      return;
    }
    
    // 验证URL格式
    try {
      new URL(newUrl);
    } catch (e) {
      alert('请输入有效的URL');
      urlInput.focus();
      return;
    }
    
    // 检查是否有实际变化
    if (newTitle === bookmark.title && newUrl === bookmark.url) {
      // 没有变化，直接退出编辑模式
      this.exitEditMode(card, bookmark);
      return;
    }
    
    try {
      // 更新书签
      await chrome.bookmarks.update(bookmark.id, { 
        title: newTitle, 
        url: newUrl 
      });
      
      // 更新本地数据
      const localBookmark = this.bookmarks.find(b => b.id === bookmark.id);
      if (localBookmark) {
        localBookmark.title = newTitle;
        localBookmark.url = newUrl;
      }
      
      // 退出编辑模式
      this.exitEditMode(card, bookmark, newTitle, newUrl);
      
    } catch (error) {
            alert('保存书签失败，请重试');
    }
  }

  /**
   * 退出编辑模式
   * @param {HTMLElement} card - 书签卡片元素
   * @param {Object} bookmark - 书签对象
   * @param {string} [newTitle] - 新标题（可选）
   * @param {string} [newUrl] - 新URL（可选）
   */
  exitEditMode(card, bookmark, newTitle, newUrl) {
    const titleElement = card.querySelector('.bookmark-title');
    const urlElement = card.querySelector('.bookmark-url');
    const editBtn = card.querySelector('.edit-btn');
    
    // 恢复标题显示
    const finalTitle = newTitle || bookmark.title;
    const finalUrl = newUrl || bookmark.url;
    
    titleElement.innerHTML = this.escapeHtml(finalTitle);
    urlElement.innerHTML = this.escapeHtml(finalUrl);
    
    // 恢复按钮文本
    editBtn.textContent = '编辑';
    editBtn.classList.remove('save-btn');
    
    // 移除编辑模式样式
    card.classList.remove('editing');
    
    // 清理数据
    delete card.dataset.originalTitle;
    delete card.dataset.originalUrl;
  }

  async saveBookmark() {
    const bookmarkId = this.editingBookmarkId;
    const title = document.getElementById('edit-title').value.trim();
    const url = document.getElementById('edit-url').value.trim();
    const parentId = document.getElementById('edit-folder').value;
    
    if (!title || !url) {
      alert('请填写标题和URL');
      return;
    }
    
    try {
      await chrome.bookmarks.update(bookmarkId, { title, url });
      await chrome.bookmarks.move(bookmarkId, { parentId });
      
      // 重新加载书签
      this.loadBookmarks();
      this.closeModal();
      
    } catch (error) {
            alert('保存书签失败');
    }
  }

  async deleteBookmark(bookmarkId) {
    if (!confirm('确定要删除这个书签吗？')) {
      return;
    }
    
    try {
      await chrome.bookmarks.remove(bookmarkId);
      
      // 从数组中移除
      this.bookmarks = this.bookmarks.filter(b => b.id !== bookmarkId);
      
      // 如果当前在检测模式，从检测结果中移除
      if (this.checkResults.has(bookmarkId)) {
        this.checkResults.delete(bookmarkId);
        // 如果检测结果为空，退出检测模式
        if (this.checkResults.size === 0) {
          this.exitCheckMode();
        } else {
          // 重新渲染检测结果，保持在分组显示模式
          this.renderGroupedResults();
          // 确保分组显示容器可见
          document.getElementById('results-grouped').style.display = 'flex';
          document.getElementById('bookmarks-grid').style.display = 'none';
        }
      }
      
      // 重新渲染（如果在检测模式，不调用renderBookmarks，避免冲突）
      if (!this.isCheckMode) {
        this.renderBookmarks();
      }
      this.updateStats();
      this.renderFolderTree();
      
      // 恢复当前选中文件夹的焦点状态
      setTimeout(() => {
        this.restoreFolderSelection();
      }, 10);
      
    } catch (error) {
            alert('删除书签失败');
    }
  }

  /**
   * 恢复文件夹选中状态
   */
  restoreFolderSelection() {
    // 移除所有文件夹的选中状态
    document.querySelectorAll('.folder-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // 如果有当前选中的文件夹，恢复其选中状态
    if (this.currentFolder) {
      const selectedFolder = document.querySelector(`[data-folder-id="${this.currentFolder}"]`);
      if (selectedFolder) {
        selectedFolder.classList.add('active');
      }
    }
  }

  closeModal() {
    document.getElementById('edit-modal').style.display = 'none';
    this.editingBookmarkId = null;
  }




  sortBookmarksArray(bookmarks) {
    return bookmarks.sort((a, b) => {
      const aValue = a.title.toLowerCase();
      const bValue = b.title.toLowerCase();
      
      if (aValue < bValue) return -1;
      if (aValue > bValue) return 1;
      return 0;
    });
  }

  
  updateStats() {
    const totalBookmarks = this.bookmarks.length;
    const totalFolders = this.folders.length;
    
    document.getElementById('total-bookmarks').textContent = totalBookmarks;
    document.getElementById('total-folders').textContent = totalFolders;
  }
  
  
  showWelcomePage() {
    const welcomePage = document.getElementById('welcome-page');
    const bookmarksGrid = document.getElementById('bookmarks-grid');
    const toolbarContainer = document.getElementById('toolbar-container');
    
    welcomePage.style.display = 'block';
    bookmarksGrid.style.display = 'none';
    
    // 隐藏工具栏
    if (toolbarContainer) {
      toolbarContainer.style.display = 'none';
    }
    
    // 隐藏其他视图
    const groupedContainer = document.getElementById('results-grouped');
    if (groupedContainer) {
      groupedContainer.style.display = 'none';
    }
    
    // 加载版本记录
    this.loadVersionHistory();
  }
  
  showBookmarksView() {
    const welcomePage = document.getElementById('welcome-page');
    const bookmarksGrid = document.getElementById('bookmarks-grid');
    const toolbarContainer = document.getElementById('toolbar-container');
    
    welcomePage.style.display = 'none';
    bookmarksGrid.style.display = 'grid';
    
    // 显示工具栏
    if (toolbarContainer) {
      toolbarContainer.style.display = 'block';
    }
  }
  
  async loadVersionHistory() {
    try {
      // 尝试从扩展目录读取release.md文件
      const response = await fetch('release.md');
      if (response.ok) {
        const releaseContent = await response.text();
        const versions = this.parseReleaseHistory(releaseContent);
        this.renderVersionHistory(versions);
      } else {
        // 如果无法读取文件，使用预设的版本信息
        this.loadDefaultVersionHistory();
      }
    } catch (error) {
            this.loadDefaultVersionHistory();
    }
  }
  
  loadDefaultVersionHistory() {
    const versions = [
      {
        date: '2025-09-21',
        changes: [
          { icon: '🔧', text: '实现三个核心参数计算规则完整功能' },
          { icon: '🐛', text: '修复内存泄漏和消息传递超时问题' },
          { icon: '📊', text: '添加右下角实时调试窗口显示' },
          { icon: '🔒', text: '移除CSP配置避免功能冲突' },
          { icon: '📝', text: '完善文档同步和用户体验优化' }
        ]
      },
      {
        date: '2025-09-19',
        changes: [
          { icon: '🌐', text: '实现URL组件提取和多选项收藏功能' },
          { icon: '🎨', text: '设计个性化弹窗标题和引导文案' },
          { icon: '🏗️', text: '重新设计弹窗布局和宽度优化' },
          { icon: '🧠', text: '开发智能推荐矩阵决策模型' }
        ]
      },
      {
        date: '2025-09-18',
        changes: [
          { icon: '🗑️', text: '彻底清理智能提醒逻辑代码' },
          { icon: '⌨️', text: '实现Ctrl+Shift+T全局快捷键' },
          { icon: '💎', text: '设计三套酷炫弹窗UI方案' },
          { icon: '🎯', text: '创建综合测试页面' }
        ]
      },
      {
        date: '2025-09-17',
        changes: [
          { icon: '🔍', text: '设计智能书签提醒完整架构' },
          { icon: '📊', text: '实现访问记录和触发条件机制' },
          { icon: '🚫', text: '添加排除列表和数据清理功能' },
          { icon: '🎨', text: '开发非侵入式弹出提醒界面' }
        ]
      },
      {
        date: '2025-09-16',
        changes: [
          { icon: '🔧', text: '修复检测模式书签删除同步问题' },
          { icon: '✨', text: '优化即时响应检测动画效果' },
          { icon: '🎨', text: '实现书签编辑框现代化样式' },
          { icon: '📱', text: '改进文件夹状态管理功能' }
        ]
      },
      {
        date: '2025-09-12',
        changes: [
          { icon: '🔍', text: '新增智能链接检测系统，支持批量检查链接有效性' },
          { icon: '📊', text: '实现检测结果分组显示，包含有效、重定向、超时、无效分类' },
          { icon: '🎨', text: '统一三页面视觉样式，彻底解决横向滚动条问题' },
          { icon: '📱', text: '完善响应式设计，支持大、中、小三种屏幕尺寸' },
          { icon: '🔧', text: '修复关键UI显示Bug，提升用户体验和界面稳定性' }
        ]
      }
    ];
    
    this.renderVersionHistory(versions);
  }
  
  parseReleaseHistory(releaseContent) {
    const versions = [];
    const lines = releaseContent.split('\n');

    // 查找每日开发进展部分
    let inDailyProgress = false;
    let dailyVersionsCount = 0;
    const maxDailyVersions = 5; // 只显示近5天

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 检查是否进入每日开发进展部分
      if (line === '### 📅 每日开发进展') {
        inDailyProgress = true;
        continue;
      }

      // 如果离开每日开发进展部分或已经收集了足够的天数，停止
      if ((inDailyProgress && line.startsWith('###') && line !== '### 📅 每日开发进展') ||
          dailyVersionsCount >= maxDailyVersions) {
        break;
      }

      if (inDailyProgress) {
        // 匹配日期行，如 "**2025-09-21**"
        const dateMatch = line.match(/^\*\*(\d{4})-(\d{1,2})-(\d{1,2})\*\*$/);
        if (dateMatch) {
          const year = dateMatch[1];
          const month = dateMatch[2].padStart(2, '0');
          const day = dateMatch[3].padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          // 查找该日期下的更新内容
          const changes = [];

          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].trim();

            // 如果遇到下一个日期或章节结束，停止
            if (nextLine.match(/^\*\*\d{4}-\d{1,2}-\d{1,2}\*\*$/) ||
                nextLine.startsWith('###') || j === lines.length - 1) {
              break;
            }

            // 匹配图标+描述，如 "🔧 实现三个核心参数计算规则完整功能"
            const changeMatch = nextLine.match(/^([^\s]+)\s+(.+)$/);
            if (changeMatch) {
              const icon = changeMatch[1];
              const description = changeMatch[2];

              // 不需要简化描述，因为已经很短
              changes.push({
                icon: icon,
                text: description
              });
            }
          }

          if (changes.length > 0) {
            versions.push({
              date: dateStr,
              changes: changes
            });
            dailyVersionsCount++;
          }
        }
      }
    }

    return versions; // 已经在前面的逻辑中限制了近5天
  }

  getChangeIcon(description) {
    const iconMap = {
      '新增': '🚀',
      '优化': '⚡', 
      '修复': '🔧',
      '实现': '✨',
      '添加': '➕',
      '改进': '🎨',
      '更新': '🔄',
      '重构': '🏗️',
      '移除': '🗑️',
      '完善': '✅',
      '创建': '🏗️',
      '支持': '🛡️',
      '集成': '🔗',
      '提升': '📈',
      '增强': '💪',
      '简化': '📝',
      '统一': '🎯',
      '解决': '🎯',
      '建立': '🏗️',
      '设计': '🎨',
      '适配': '📱',
      '美化': '✨',
      '修复': '🔧'
    };
    
    // 根据描述内容匹配图标
    for (const [keyword, icon] of Object.entries(iconMap)) {
      if (description.includes(keyword)) {
        return icon;
      }
    }
    
    // 默认图标
    return '📝';
  }
  
  renderVersionHistory(versions) {
    const timeline = document.getElementById('version-timeline');
    if (!timeline) return;
    
    timeline.innerHTML = '';
    
    versions.forEach(version => {
      const versionItem = document.createElement('div');
      versionItem.className = 'version-item';
      
      let changesHtml = '';
      if (version.changes && version.changes.length > 0) {
        changesHtml = version.changes.map(change => 
          `<div class="version-change">
            <span class="change-icon">${change.icon}</span>
            <span class="change-text">${change.text}</span>
          </div>`
        ).join('');
      }
      
      versionItem.innerHTML = `
        <div class="version-header">
          <span class="version-date">${version.date}</span>
        </div>
        <div class="version-changes">
          ${changesHtml}
        </div>
      `;
      timeline.appendChild(versionItem);
    });
  }

  showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('bookmarks-grid').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';
  }

  hideLoading() {
    document.getElementById('loading').style.display = 'none';
    // 不在这里显示书签网格，让 renderBookmarks 决定显示欢迎页面还是书签网格
  }

  showEmptyState() {
    document.getElementById('empty-state').style.display = 'block';
    document.getElementById('bookmarks-grid').style.display = 'none';
  }

  hideEmptyState() {
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('bookmarks-grid').style.display = 'grid';
  }

  // 退出搜索状态
  exitSearchState() {
    this.searchTerm = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // 更新搜索按钮显示状态
    this.updateSearchButtonVisibility('');
    
    // 恢复原来的网格布局
    const grid = document.getElementById('bookmarks-grid');
    grid.style.display = '';
    grid.style.flexDirection = '';
    grid.style.gridTemplateColumns = '';
    
    // 移除搜索结果头部
    const searchHeader = document.querySelector('.search-results-header');
    if (searchHeader) {
      searchHeader.remove();
    }
    
    // 移除搜索结果容器
    const searchContainer = document.querySelector('.search-results-container');
    if (searchContainer) {
      searchContainer.remove();
    }
    
    // 重新显示智能检测工具栏 - 退出搜索模式后恢复正常功能
    const toolbar = document.querySelector('.toolbar-container');
    if (toolbar) {
      toolbar.style.display = '';
    }
  }

  // 更新搜索按钮显示状态
  updateSearchButtonVisibility(query) {
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      if (query) {
        searchBtn.classList.add('visible');
        searchBtn.innerHTML = '✕';
        searchBtn.title = '清空搜索';
      } else {
        searchBtn.classList.remove('visible');
        searchBtn.innerHTML = '🔍';
        searchBtn.title = '搜索';
      }
    }
  }

  // 搜索功能方法
  performSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    this.searchTerm = searchInput.value.trim();
    
    // 更新搜索按钮显示状态
    this.updateSearchButtonVisibility(this.searchTerm);
    
    if (!this.searchTerm) {
      this.clearSearch();
      return;
    }
    
    // 给搜索按钮一个反馈效果
    searchBtn.style.transform = 'translateY(-50%) scale(0.9)';
    setTimeout(() => {
      searchBtn.style.transform = 'translateY(-50%) scale(1)';
    }, 100);
    
    this.renderBookmarks();
  }

  renderSearchResults() {
    const grid = document.getElementById('bookmarks-grid');
    grid.innerHTML = '';
    
    // 临时移除网格布局，改用flex布局实现水平排列
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    
    // 隐藏智能检测工具栏 - 搜索结果页不需要检测功能
    const toolbar = document.querySelector('.toolbar-container');
    if (toolbar) {
      toolbar.style.display = 'none';
    }
    grid.style.gridTemplateColumns = 'none';
    
    // 全局搜索过滤所有书签，添加匹配信息
    const allBookmarks = this.bookmarks.map(bookmark => {
      const title = bookmark.title.toLowerCase();
      const url = bookmark.url.toLowerCase();
      const searchLower = this.searchTerm.toLowerCase();
      
      const titleMatch = title.includes(searchLower);
      const urlMatch = url.includes(searchLower);
      
      if (titleMatch || urlMatch) {
        return {
          ...bookmark,
          matchType: titleMatch && urlMatch ? 'both' : (titleMatch ? 'title' : 'url'),
          matchScore: this.calculateMatchScore(bookmark.title, bookmark.url, this.searchTerm)
        };
      }
      return null;
    }).filter(Boolean);
    
    if (allBookmarks.length === 0) {
      this.showSearchEmptyState();
      return;
    }
    
    // 按匹配度排序
    allBookmarks.sort((a, b) => b.matchScore - a.matchScore);
    
    // 显示搜索统计
    const statsDiv = document.createElement('div');
    statsDiv.className = 'search-results-header';
    statsDiv.innerHTML = `
      <div class="search-results-title">搜索结果</div>
      <div class="search-results-meta">
        <span class="search-results-count">已搜索到 <strong>${allBookmarks.length}</strong> 个结果</span>
        <div class="search-results-actions">
          <button class="clear-search-btn" data-action="clear-search">清除搜索</button>
        </div>
      </div>
    `;
    grid.appendChild(statsDiv);
    
    // 创建水平排列的容器
    const containerDiv = document.createElement('div');
    containerDiv.className = 'search-results-container';
    
    // 按文件夹分组
    const groupedResults = this.groupBookmarksByFolder(allBookmarks);
    
    // 按文件夹名称排序
    const sortedFolderIds = Object.keys(groupedResults).sort((a, b) => {
      const folderA = this.folders.find(f => f.id === a);
      const folderB = this.folders.find(f => f.id === b);
      const nameA = folderA ? folderA.title : '其他';
      const nameB = folderB ? folderB.title : '其他';
      return nameA.localeCompare(nameB, 'zh-CN');
    });
    
    // 渲染每个分组
    sortedFolderIds.forEach((folderId, index) => {
      const folder = this.folders.find(f => f.id === folderId);
      const folderName = folder ? folder.title : '其他';
      const bookmarks = groupedResults[folderId];
      
      // 创建文件夹区域（可展开/收起）
      const folderSection = this.createSearchResultSection(folderId, folderName, bookmarks);
      containerDiv.appendChild(folderSection);
    });
    
    grid.appendChild(containerDiv);
  }

  groupBookmarksByFolder(bookmarks) {
    const grouped = {};
    
    bookmarks.forEach(bookmark => {
      const folderId = bookmark.parentId;
      if (!grouped[folderId]) {
        grouped[folderId] = [];
      }
      grouped[folderId].push(bookmark);
    });
    
    // 对每个文件夹内的书签按匹配度和名称排序
    Object.keys(grouped).forEach(folderId => {
      grouped[folderId].sort((a, b) => {
        // 首先按匹配度排序
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;
        }
        // 匹配度相同则按名称排序
        return a.title.localeCompare(b.title, 'zh-CN');
      });
    });
    
    return grouped;
  }

  createSearchResultSection(folderId, folderName, bookmarks) {
    const section = document.createElement('div');
    section.className = 'search-result-group';
    section.dataset.folderId = folderId;
    
    // 创建可折叠的文件夹标题
    const header = document.createElement('div');
    header.className = 'search-group-header';
    header.innerHTML = `
      <div class="folder-info">
        <span class="folder-icon">📁</span>
        <span class="folder-name">${this.escapeHtml(folderName)}</span>
      </div>
      <div class="result-info">
        <span class="result-count">${bookmarks.length}</span>
        <span class="collapse-icon">▼</span>
      </div>
    `;
    
    // 点击标题展开/收起
    header.addEventListener('click', () => {
      this.toggleSearchSection(section);
    });
    
    section.appendChild(header);
    
    // 创建书签网格容器
    const bookmarksGrid = document.createElement('div');
    bookmarksGrid.className = 'search-bookmarks-grid';
    
    // 创建书签网格（横向布局）
    bookmarks.forEach(bookmark => {
      const card = this.createSearchResultCard(bookmark);
      bookmarksGrid.appendChild(card);
    });
    
    section.appendChild(bookmarksGrid);
    
    return section;
  }

  toggleSearchSection(section) {
    const isCollapsed = section.classList.contains('collapsed');
    const collapseIcon = section.querySelector('.collapse-icon');
    const grid = section.querySelector('.search-bookmarks-grid');
    
    if (isCollapsed) {
      section.classList.remove('collapsed');
      collapseIcon.textContent = '▼';
      grid.style.display = 'flex';
    } else {
      section.classList.add('collapsed');
      collapseIcon.textContent = '▶';
      grid.style.display = 'none';
    }
  }

  /**
 * 创建搜索结果书签卡片（统一函数的便捷方法）
 * @param {Object} bookmark - 书签对象
 * @returns {HTMLElement} 书签卡片元素
 */
createSearchResultCard(bookmark) {
  return this.createBookmarkCard(bookmark, { 
    mode: 'search', 
    searchTerm: this.searchTerm 
  });
}

  clearSearch() {
    this.exitSearchState();
    this.renderBookmarks();
  }

  showSearchEmptyState() {
    const grid = document.getElementById('bookmarks-grid');
    const emptyState = document.createElement('div');
    emptyState.className = 'search-empty-state';
    emptyState.innerHTML = `
      <div class="search-empty-icon">🔍</div>
      <h3>未找到匹配的书签</h3>
      <p>尝试使用不同的关键词进行搜索</p>
      <button class="clear-search-btn" data-action="clear-search">清空搜索</button>
    `;
    
    grid.appendChild(emptyState);
    
    // 隐藏智能检测工具栏 - 搜索空状态页也不需要检测功能
    const toolbar = document.querySelector('.toolbar-container');
    if (toolbar) {
      toolbar.style.display = 'none';
    }
  }

  // 高亮文本中的关键词
  highlightText(text, query) {
    if (!query) return this.escapeHtml(text);
    
    const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<mark class="highlight">$1</mark>');
  }

  // 转义正则表达式特殊字符
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 计算匹配度分数
  calculateMatchScore(title, url, query) {
    const lowerQuery = query.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const lowerUrl = url.toLowerCase();
    
    let score = 0;
    
    // 标题完全匹配
    if (lowerTitle === lowerQuery) {
      score += 100;
    }
    // 标题开头匹配
    else if (lowerTitle.startsWith(lowerQuery)) {
      score += 80;
    }
    // 标题包含匹配
    else if (lowerTitle.includes(lowerQuery)) {
      score += 60;
    }
    
    // URL完全匹配
    if (lowerUrl === lowerQuery) {
      score += 70;
    }
    // URL开头匹配
    else if (lowerUrl.startsWith(lowerQuery)) {
      score += 50;
    }
    // URL包含匹配
    else if (lowerUrl.includes(lowerQuery)) {
      score += 30;
    }
    
    // 匹配位置因素（越靠前越相关）
    const titleMatchIndex = lowerTitle.indexOf(lowerQuery);
    if (titleMatchIndex !== -1) {
      score += Math.max(0, 20 - titleMatchIndex);
    }
    
    return score;
  }

  // ==================== 智能检测相关方法 ====================
  
  /**
   * 绑定工具栏事件
   */
  bindToolbarEvents() {
    // 健康检查按钮 - 动态处理，根据当前状态决定功能
    const checkAllBtn = document.getElementById('check-all-btn');
    if (checkAllBtn) {
      checkAllBtn.addEventListener('click', () => {
        // 检查按钮当前显示的文本来决定功能
        const buttonText = checkAllBtn.querySelector('.toolbar-text').textContent;
        if (buttonText === '检测书签是否有效') {
          this.startCheckAll();
        } else if (buttonText === '退出检测模式') {
          // 如果正在检测中，先停止检测
          if (this.isChecking) {
            this.isChecking = false;
          }
          this.exitCheckMode();
        }
      });
    }
  }

  /**
   * 开始检查所有书签
   */
  async startCheckAll() {
    if (this.isChecking) {
      return;
    }

                
    const bookmarksToCheck = this.getCurrentBookmarks();
            
    if (bookmarksToCheck.length === 0) {
      return;
    }

    // 进入检测模式
    this.isCheckMode = true;

    // 立即将按钮改为"退出检测模式"
    const checkAllBtn = document.getElementById('check-all-btn');
    if (checkAllBtn) {
      checkAllBtn.innerHTML = '<span class="toolbar-icon">🔍</span><span class="toolbar-text">退出检测模式</span>';
    }

    const folderName = this.getCurrentFolderName();
    const rangeText = folderName ? `当前分类"${folderName}"` : '所有书签';

    await this.performBatchCheck(bookmarksToCheck);
      }

  /**
   * 开始检查选中的书签
   */
  async startCheckSelected() {
    if (this.isChecking) {
      return;
    }

    const selectedCards = document.querySelectorAll('.bookmark-card.selected');
    if (selectedCards.length === 0) {
      return;
    }

    // 进入检测模式
    this.isCheckMode = true;

    const selectedBookmarks = Array.from(selectedCards).map(card => ({
      id: card.dataset.bookmarkId,
      url: card.dataset.bookmarkUrl,
      title: card.dataset.bookmarkTitle
    }));

    await this.performBatchCheck(selectedBookmarks);
  }

  /**
   * 执行批量检查
   */
  async performBatchCheck(bookmarks) {
    this.isChecking = true;
    this.checkStats = {
      total: bookmarks.length,
      processed: 0,
      valid: 0,
      invalid: 0,
      redirect: 0,
      timeout: 0
    };

        this.showProgress();
    this.updateProgress();
    
    // 触发书签卡片的随机延迟渐隐动画
    this.triggerRandomFadeOutAnimation();

    try {
      const batchProcessor = new BatchProcessor(); // 串行处理器
      
      await batchProcessor.process(bookmarks, async (bookmark, index) => {
        // 检查是否已停止检测
        if (!this.isChecking) {
                    return false; // 停止处理
        }
        
        const result = await this.linkChecker.check(bookmark.url);
                
        // 只有在真正处理了书签时才增加计数
        const wasProcessed = this.processCheckResult(bookmark, result);
        if (wasProcessed !== false) { // false表示跳过重复
          this.checkStats.processed++;
        }
        this.updateProgress();
        
        return result; // 明确返回结果
      });

      // 只有在检测正常完成时才显示完成信息
      if (this.isChecking) {
        this.showCheckComplete();
      }
      
    } catch (error) {
          } finally {
      this.isChecking = false;
    }
  }

  /**
   * 处理检测结果
   */
  processCheckResult(bookmark, result) {
    // 检查结果是否有效
    if (!result || typeof result !== 'object') {
      return false;
    }
    
    // 串行处理通常不会有重复问题，但保留检查作为保护
    if (this.checkResults.has(bookmark.id)) {
      return false; // 表示跳过处理
    }
    
    this.checkResults.set(bookmark.id, {
      ...bookmark,
      ...result,
      checkedAt: Date.now()
    });

    // 更新统计
    switch (result.status) {
      case 'valid':
        this.checkStats.valid++;
        break;
      case 'invalid':
        this.checkStats.invalid++;
        break;
      case 'redirect':
        this.checkStats.redirect++;
        break;
      case 'timeout':
        this.checkStats.timeout++;
        break;
      default:
                break;
    }
    
    // 显示检测方法
    if (result.method) {
      const methodIcons = {
        'quick_skip': '⚡',
        'quick_validate': '📄', 
        'standard_check': '🔍'
      };
    }
    
    return true; // 表示成功处理
  }

  /**
   * 显示进度条
   */
  showProgress() {
    const progressContainer = document.getElementById('check-progress');
    progressContainer.style.display = 'block';
  }

  /**
   * 更新进度
   */
  updateProgress() {
    const { total, processed, valid, invalid, redirect, timeout } = this.checkStats;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

    document.getElementById('progress-count').textContent = `${processed}/${total}`;
    document.getElementById('progress-percent').textContent = `(${percentage}%)`;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
  }

  /**
   * 触发书签卡片的随机延迟渐隐动画
   */
  triggerRandomFadeOutAnimation() {
    const cards = document.querySelectorAll('.bookmark-card');
    
    cards.forEach((card, index) => {
      // 立即启动动画，无需延迟
      card.classList.add('checking');
    });
  }

  /**
   * 触发书签卡片的恢复动画
   */
  triggerFadeInAnimation() {
    const cards = document.querySelectorAll('.bookmark-card.checking');
    
    cards.forEach((card, index) => {
      // 为每个卡片生成随机延迟 (0-1秒)
      const randomDelay = Math.random() * 1000;
      
      setTimeout(() => {
        card.classList.remove('checking');
        card.classList.add('check-complete');
        
        // 动画完成后移除check-complete类
        setTimeout(() => {
          card.classList.remove('check-complete');
        }, 600);
      }, randomDelay);
    });
  }

  /**
   * 显示检测完成
   */
  showCheckComplete() {
    setTimeout(() => {
      document.getElementById('check-progress').style.display = 'none';
      const { total, processed, valid, invalid, redirect, timeout } = this.checkStats;
      
      // 验证统计数量是否正确
      const statsSum = valid + invalid + redirect + timeout;
      if (statsSum !== processed) {
      }
      if (processed !== total) {
              }
      
      // 触发书签卡片恢复动画
      this.triggerFadeInAnimation();
      
      // 将"分类检测"按钮改为"退出检测模式"
      const checkAllBtn = document.getElementById('check-all-btn');
      if (checkAllBtn) {
        checkAllBtn.innerHTML = '<span class="toolbar-icon">🔍</span><span class="toolbar-text">退出检测模式</span>';
      }
      
      // 只有在有检测结果时才显示筛选工具栏和切换到分组显示
      if (this.checkResults.size > 0) {
        this.showFilterToolbar();
        this.switchToGroupedView();
      }
    }, 2000);
  }

  /**
   * 显示筛选工具栏
   */
  showFilterToolbar() {
    // 筛选工具栏已移除，此方法保留以避免错误
  }





  /**
   * 清理无效书签
   */
  cleanupInvalidBookmarks() {
    const invalidBookmarks = [];
    this.checkResults.forEach((result, bookmarkId) => {
      if (result.status === 'invalid' || result.status === 'timeout') {
        invalidBookmarks.push(result);
      }
    });

    if (invalidBookmarks.length === 0) {
      return;
    }

    const timeoutCount = invalidBookmarks.filter(b => b.status === 'timeout').length;
    const invalidCount = invalidBookmarks.filter(b => b.status === 'invalid').length;
    
    if (confirm(`确定要删除 ${invalidBookmarks.length} 个无效书签吗？\n(无效: ${invalidCount}, 超时: ${timeoutCount})`)) {
      invalidBookmarks.forEach(bookmark => {
        this.deleteBookmark(bookmark.id);
      });
    }
  }

  /**
   * 更新单个书签的URL
   */
  async updateBookmarkUrl(bookmarkId, newUrl) {
    try {
      await chrome.bookmarks.update(bookmarkId, { url: newUrl });
      
      // 更新本地数据
      const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
      if (bookmark) {
        bookmark.url = newUrl;
      }
      
      // 更新检测结果
      if (this.checkResults.has(bookmarkId)) {
        const result = this.checkResults.get(bookmarkId);
        result.url = newUrl;
        result.finalUrl = newUrl;
        result.status = 'valid';
      }
      
      // 重新渲染书签卡片
      this.renderBookmarks();
      
    } catch (error) {
            throw error;
    }
  }

  /**
   * 更新重定向链接
   */
  async updateRedirects() {
    const redirects = [];
    this.checkResults.forEach((result, bookmarkId) => {
      if (result.status === 'redirect' && result.finalUrl && result.finalUrl !== result.url) {
        redirects.push(result);
      }
    });

    if (redirects.length === 0) {
      return;
    }

    const confirmed = confirm(`发现 ${redirects.length} 个重定向链接，是否要更新为最终URL？`);
    if (!confirmed) return;

    for (const bookmark of redirects) {
      try {
        await this.updateBookmarkUrl(bookmark.id, bookmark.finalUrl);
      } catch (error) {
              }
    }

  }

  /**
   * 导出检测结果
   */
  exportCheckResults() {
    const results = Array.from(this.checkResults.values());
    const csv = this.convertToCSV(results);
    this.downloadCSV(csv, `bookmark-check-results-${new Date().toISOString().split('T')[0]}.csv`);
    
  }

  /**
   * 转换为CSV格式
   */
  convertToCSV(data) {
    const headers = ['ID', '标题', '原始URL', '状态', 'HTTP状态码', '最终URL', '响应时间', '检测时间'];
    const rows = data.map(item => [
      item.id,
      `"${item.title}"`,
      `"${item.url}"`,
      item.status,
      item.statusCode || '',
      `"${item.finalUrl || ''}"`,
      item.responseTime || '',
      new Date(item.checkedAt).toLocaleString()
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * 下载CSV文件
   */
  downloadCSV(csv, filename) {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /**
   * 显示消息提示
   */
  showMessage(message) {
    // 创建临时提示元素
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2c3e50;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      font-size: 14px;
      max-width: 300px;
      word-wrap: break-word;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // ==================== 分组显示相关方法 ====================

  /**
   * 切换显示模式
   */
  toggleViewMode() {
    if (this.isGroupedView) {
      this.switchToNormalView();
    } else {
      this.switchToGroupedView();
    }
  }

  /**
   * 切换到分组显示
   */
  switchToGroupedView() {
    if (this.checkResults.size === 0) {
      return;
    }

    this.isGroupedView = true;
    
    // 隐藏正常书签网格
    document.getElementById('bookmarks-grid').style.display = 'none';
    
    // 显示分组容器
    const groupedContainer = document.getElementById('results-grouped');
    groupedContainer.style.display = 'flex';
    
    // 渲染分组内容
    this.renderGroupedResults();
    
    // 绑定分组事件
    this.bindGroupEvents();
    
  }

  /**
   * 切换到正常显示
   */
  switchToNormalView() {
    this.isGroupedView = false;
    
    // 显示正常书签网格
    document.getElementById('bookmarks-grid').style.display = 'grid';
    
    // 隐藏分组容器
    document.getElementById('results-grouped').style.display = 'none';
    
  }

  /**
   * 渲染分组结果
   */
  renderGroupedResults() {
    // 按状态分组结果
    const groupedResults = {
      valid: [],
      redirect: [],
      timeout: [],
      invalid: []
    };

    this.checkResults.forEach((result) => {
      if (groupedResults[result.status]) {
        groupedResults[result.status].push(result);
      }
    });

    // 渲染每个分组
    Object.keys(groupedResults).forEach(status => {
      this.renderResultGroup(status, groupedResults[status]);
    });
  }

  /**
   * 渲染单个结果分组
   */
  renderResultGroup(status, bookmarks) {
    const group = document.querySelector(`[data-status="${status}"]`);
    if (!group) return;

    // 更新分组数量
    const countElement = group.querySelector('.group-count');
    countElement.textContent = `(${bookmarks.length})`;

    // 获取分组内容容器
    const content = group.querySelector('.group-bookmarks-grid');
    content.innerHTML = '';

    // 如果没有书签，显示空状态
    if (bookmarks.length === 0) {
      content.innerHTML = `
        <div class="empty-group-state">
          <div class="empty-icon">📭</div>
          <p>此分组暂无书签</p>
        </div>
      `;
      return;
    }

    // 渲染书签卡片
    bookmarks.forEach(bookmark => {
      const card = this.createBookmarkCard(bookmark);
      
      content.appendChild(card);
    });
  }

  /**
   * 绑定分组事件
   */
  bindGroupEvents() {
    // 使用事件委托处理分组折叠/展开
    const groupedContainer = document.getElementById('results-grouped');
    if (groupedContainer) {
      // 分组折叠按钮点击事件
      groupedContainer.addEventListener('click', (e) => {
        if (e.target.closest('.group-collapse-btn')) {
          e.stopPropagation();
          const group = e.target.closest('.result-group');
          if (group) {
            group.classList.toggle('collapsed');
          }
        }
      });
      
      // 分组头部点击事件
      groupedContainer.addEventListener('click', (e) => {
        if (e.target.closest('.group-header') && !e.target.closest('.group-collapse-btn')) {
          const group = e.target.closest('.result-group');
          if (group) {
            group.classList.toggle('collapsed');
          }
        }
      });
    }
    
    // 绑定分组操作按钮事件
    this.bindGroupActionEvents();
  }

  /**
   * 绑定分组操作按钮事件
   */
  bindGroupActionEvents() {
    // 使用事件委托处理分组操作按钮
    const groupedContainer = document.getElementById('results-grouped');
    if (groupedContainer) {
      groupedContainer.addEventListener('click', (e) => {
        // 重定向分组 - 批量更新
        if (e.target.closest('[data-status="redirect"] .group-action-btn')) {
          this.updateRedirects();
        }
        
        // 超时分组 - 重新检测
        if (e.target.closest('[data-status="timeout"] .group-action-btn')) {
          this.recheckTimeoutBookmarks();
        }
        
        // 无效分组 - 批量删除
        if (e.target.closest('[data-status="invalid"] .group-action-btn')) {
          this.cleanupInvalidBookmarks();
        }
      });
    }
  }

  /**
   * 重新检测超时书签
   */
  async recheckTimeoutBookmarks() {
    const timeoutBookmarks = Array.from(this.checkResults.values())
      .filter(result => result.status === 'timeout');

    if (timeoutBookmarks.length === 0) {
      return;
    }

    if (confirm(`确定要重新检测 ${timeoutBookmarks.length} 个超时书签吗？`)) {
      
      // 从结果中移除超时书签，然后重新检测
      timeoutBookmarks.forEach(bookmark => {
        this.checkResults.delete(bookmark.id);
      });

      await this.performBatchCheck(timeoutBookmarks);
    }
  }

  /**
   * 获取当前文件夹名称
   */
  getCurrentFolderName() {
    if (this.currentFolder === null) {
      return null;
    }
    
    const folder = this.folders.find(f => f.id === this.currentFolder);
    return folder ? folder.title : '未知分类';
  }

  /**
   * 退出检测模式
   */
  exitCheckMode() {
    // 退出检测模式
    this.isCheckMode = false;

    // 隐藏进度条（如果正在显示）
    const progressContainer = document.getElementById('check-progress');
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }

    // 如果在分组显示模式，先切换到正常模式
    if (this.isGroupedView) {
      this.switchToNormalView();
    }

    // 恢复所有书签卡片状态
    const cards = document.querySelectorAll('.bookmark-card');
    cards.forEach(card => {
      // 移除检测相关类
      card.classList.remove('valid', 'invalid', 'redirect', 'timeout', 'checking', 'check-complete');
      
      // 确保卡片可见
      card.style.display = 'block';
    });

  
    // 清空检测结果
    this.checkResults.clear();
    
    // 清空分组内容
    const groupContainers = document.querySelectorAll('.group-bookmarks-grid');
    groupContainers.forEach(container => {
      container.innerHTML = '';
    });
    
    // 重置分组计数
    const countElements = document.querySelectorAll('.group-count');
    countElements.forEach(element => {
      element.textContent = '(0)';
    });

    // 恢复"检测书签是否有效"按钮
    const checkAllBtn = document.getElementById('check-all-btn');
    if (checkAllBtn) {
      checkAllBtn.innerHTML = '<span class="toolbar-icon">🔍</span><span class="toolbar-text">检测书签是否有效</span>';
    }

    // 退出检测模式
  }

  /**
   * 获取当前显示的书签
   */
  getCurrentBookmarks() {
    let bookmarksToCheck;
    
    if (this.currentFolder === null) {
      // 如果没有选择文件夹，只检测根目录书签（与renderBookmarks保持一致）
      bookmarksToCheck = this.bookmarks.filter(b => b.parentId === "0" || b.parentId === "1" || b.parentId === "2");
    } else {
      // 只检测当前文件夹的书签
      bookmarksToCheck = this.bookmarks.filter(b => b.parentId === this.currentFolder);
    }
    
        bookmarksToCheck.forEach((bookmark, index) => {
    });
    
    // 过滤有效的URL
    const validBookmarks = bookmarksToCheck.filter(bookmark => {
      const hasUrl = bookmark.url && bookmark.url.trim() !== '';
      if (!hasUrl) {
              }
      return hasUrl;
    });
    
        
    const result = validBookmarks.map(bookmark => ({
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title
    }));
    
        result.forEach((bookmark, index) => {
    });
    
    return result;
  }

  ensureCheckResultsHidden() {
    // 强制确保分组容器隐藏
    const groupedContainer = document.getElementById('results-grouped');
    if (groupedContainer) {
      groupedContainer.style.display = 'none';
      // 移除所有可能影响显示的类
      groupedContainer.classList.remove('show', 'active', 'visible');
    }
    
    // 确保筛选工具栏隐藏
    // 筛选工具栏已移除，此方法保留以避免错误
    
    // 重置分组状态
    this.isGroupedView = false;
  }

  // ==================== 访问统计功能 ====================

  /**
   * 获取书签访问次数 - 极简实现
   */
  async getVisitCount(url) {
    if (!url) return 0;
    
    // 检查缓存
    const cacheKey = this.getCacheKey(url);
    if (this.visitStatsCache.has(cacheKey)) {
      return this.visitStatsCache.get(cacheKey);
    }
    
    // 避免重复查询
    if (this.pendingVisitQueries.has(cacheKey)) {
      return 0; // 返回0，避免UI闪烁
    }
    
    this.pendingVisitQueries.add(cacheKey);
    
    try {
      const visits = await chrome.history.getVisits({ url });
      const count = visits.length;
      
      // 缓存结果
      this.visitStatsCache.set(cacheKey, count);
      
      // 限制缓存大小
      if (this.visitStatsCache.size > 1000) {
        // 简单清理：删除最旧的缓存项
        const firstKey = this.visitStatsCache.keys().next().value;
        this.visitStatsCache.delete(firstKey);
      }
      
      return count;
    } catch (error) {
            return 0;
    } finally {
      this.pendingVisitQueries.delete(cacheKey);
    }
  }

  /**
   * 生成缓存键
   */
  getCacheKey(url) {
    return url; // 直接使用URL作为缓存键
  }

  /**
   * 批量获取访问次数 - 多线程优化
   */
  async batchGetVisitCounts(urls) {
    const uniqueUrls = [...new Set(urls)].filter(url => url);
    const promises = uniqueUrls.map(url => this.getVisitCount(url));
    
    try {
      const results = await Promise.all(promises);
      const countMap = new Map();
      
      uniqueUrls.forEach((url, index) => {
        countMap.set(url, results[index]);
      });
      
      return countMap;
    } catch (error) {
            return new Map();
    }
  }

  /**
   * 异步加载并显示访问次数
   */
  async loadAndDisplayVisitCount(card, url) {
    const visitCountElement = card.querySelector('.visit-count');
    if (!visitCountElement || !url) return;
    
    // 显示等待占位符
    visitCountElement.textContent = '👁 加载中...';
    visitCountElement.style.opacity = '0.7';
    
    try {
      let visitCount;
      if (this.useDomainStats) {
        // 使用域名级别统计
        visitCount = await this.getDomainVisitCount(url);
      } else {
        // 使用原有的URL级别统计
        visitCount = await this.getVisitCount(url);
      }
      
      visitCountElement.textContent = `👁 ${visitCount}`;
      
      // 根据访问次数添加样式
      if (visitCount === 0) {
        visitCountElement.style.opacity = '0.5';
      } else if (visitCount > 50) {
        visitCountElement.style.fontWeight = '600';
        visitCountElement.style.color = '#667eea';
      }
    } catch (error) {
            visitCountElement.textContent = '👁 -';
    }
  }

  /**
   * 清除访问统计缓存
   */
  clearVisitStatsCache() {
    this.visitStatsCache.clear();
    this.pendingVisitQueries.clear();
    this.domainVisitIndex.clear();
    this.urlToDomainMap.clear();
    this.domainIndexInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * 提取主域名 - 标准化处理
   */
  extractMainDomain(url) {
    try {
      const domain = new URL(url).hostname;
      // 移除 www. 前缀并转为小写
      return domain.replace(/^www\./, '').toLowerCase();
    } catch {
      // 如果 URL 解析失败，尝试提取域名部分
      const match = url.match(/^https?:\/\/([^\/]+)/);
      if (match) {
        return match[1].replace(/^www\./, '').toLowerCase();
      }
      return url;
    }
  }

  /**
   * 初始化域名索引 - 单次API调用获取全量数据
   */
  async initializeDomainIndex() {
    if (this.domainIndexInitialized) return;
    
    try {
      // 单次API调用获取所有历史记录
      const history = await chrome.history.search({
        text: '',
        startTime: 0,
        maxResults: 100000  // 获取足够多的记录
      });
      
      // 构建域名访问次数索引
      this.domainVisitIndex.clear();
      this.urlToDomainMap.clear();
      
      history.forEach(item => {
        const domain = this.extractMainDomain(item.url);
        const currentCount = this.domainVisitIndex.get(domain) || 0;
        this.domainVisitIndex.set(domain, currentCount + (item.visitCount || 1));
        
        // 限制URL映射数量，避免内存占用过大
        if (this.urlToDomainMap.size < this.MAX_URL_CACHE_SIZE) {
          this.urlToDomainMap.set(item.url, domain);
        }
      });
      
      // 如果域名数量过多，清理访问次数较少的域名
      if (this.domainVisitIndex.size > this.MAX_DOMAIN_CACHE_SIZE) {
        this.cleanupDomainCache();
      }
      
      this.domainIndexInitialized = true;
          } catch (error) {
            this.domainIndexInitialized = false;
      throw error;
    }
  }

  /**
   * 清理域名缓存 - 保留高访问次数的域名
   */
  cleanupDomainCache() {
    if (this.domainVisitIndex.size <= this.MAX_DOMAIN_CACHE_SIZE) return;
    
    // 按访问次数排序，保留访问次数最多的域名
    const sortedDomains = Array.from(this.domainVisitIndex.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.MAX_DOMAIN_CACHE_SIZE);
    
    this.domainVisitIndex.clear();
    sortedDomains.forEach(([domain, count]) => {
      this.domainVisitIndex.set(domain, count);
    });
    
      }

  /**
   * 确保域名索引已初始化 - 懒加载机制
   */
  async ensureDomainIndex() {
    if (this.domainIndexInitialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this.initializeDomainIndex();
    return this.initializationPromise;
  }

  /**
   * 获取域名级别访问次数 - O(1)复杂度
   */
  async getDomainVisitCount(url) {
    try {
      await this.ensureDomainIndex();
      
      const domain = this.extractMainDomain(url);
      return this.domainVisitIndex.get(domain) || 0;
    } catch (error) {
            // 自动降级到URL级别统计
      this.useDomainStats = false;
      return await this.getVisitCount(url);
    }
  }

  /**
   * 批量获取域名级别访问次数 - 复用同一索引
   */
  async batchGetDomainVisitCounts(urls) {
    await this.ensureDomainIndex();
    
    const results = new Map();
    urls.forEach(url => {
      const domain = this.extractMainDomain(url);
      results.set(url, this.domainVisitIndex.get(domain) || 0);
    });
    
    return results;
  }

  /**
   * 添加到「最近收藏」
   */
  async addToRecentFolder(url, title) {
    try {
      const recentFolderId = await this.getOrCreateRecentFolder();
      
      // 检查是否已存在相同的URL
      const isDuplicate = await this.checkDuplicateInRecentFolder(url, recentFolderId);
      if (isDuplicate) {
        this.showMessage('已在「最近收藏」中！');
        return;
      }
      
      // 添加书签到最近收藏文件夹
      await chrome.bookmarks.create({
        title: title || '无标题',
        url: url,
        parentId: recentFolderId
      });
      
      // 显示成功消息
      this.showMessage('书签已添加到「最近收藏」！');
      
    } catch (error) {
            this.showMessage('添加失败，请重试');
    }
  }

  /**
   * 获取或创建「最近收藏」文件夹
   */
  async getOrCreateRecentFolder() {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const recentFolder = this.findRecentFolder(bookmarkTree[0]);
      
      if (recentFolder) {
        return recentFolder.id;
      } else {
        const newFolder = await chrome.bookmarks.create({
          title: '📌 最近收藏',
          parentId: '1'
        });
        return newFolder.id;
      }
    } catch (error) {
            return '1';
    }
  }

  /**
   * 查找「最近收藏」文件夹
   */
  findRecentFolder(node) {
    if (node.title === '📌 最近收藏' && !node.url) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findRecentFolder(child);
        if (found) return found;
      }
    }
    
    return null;
  }

  /**
   * 检查URL是否在「最近收藏」文件夹中已存在
   */
  async checkDuplicateInRecentFolder(url, recentFolderId) {
    try {
      if (!recentFolderId) return false;
      
      const bookmarks = await chrome.bookmarks.getChildren(recentFolderId);
      return bookmarks.some(bookmark => bookmark.url === url);
    } catch (error) {
            return false;
    }
  }

  /**
   * 显示消息
   */
  showMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'bookmark-message';
    messageEl.textContent = message;
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      messageEl.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      messageEl.classList.remove('show');
      setTimeout(() => {
        messageEl.remove();
      }, 300);
    }, 2000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}



/**
 * 深色模式管理器
 */
class DarkModeManager {
  constructor() {
    this.isDarkMode = this.loadTheme();
    this.init();
  }

  init() {
    this.applyTheme();
    this.bindEvents();
  }

  bindEvents() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme();
    this.saveTheme();
    this.updateThemeIcon();
  }

  applyTheme() {
    if (this.isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  updateThemeIcon() {
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
      themeIcon.textContent = this.isDarkMode ? '☀️' : '🌙';
    }
  }

  saveTheme() {
    try {
      localStorage.setItem('darkMode', this.isDarkMode);
    } catch (error) {
          }
  }

  loadTheme() {
    try {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) {
        return JSON.parse(saved);
      }

      // 检测系统主题偏好
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return true;
      }
    } catch (error) {
          }

    return false; // 默认浅色模式
  }
}

let bookmarkManager;
let darkModeManager;
document.addEventListener('DOMContentLoaded', () => {
  bookmarkManager = new BookmarkManager();
  darkModeManager = new DarkModeManager();
});
