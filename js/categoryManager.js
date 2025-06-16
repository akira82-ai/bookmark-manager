/**
 * 分类管理模块
 * 用于自动分类书签和管理分类规则
 */

class CategoryManager {
  constructor() {
    this.initialized = false;
    this.categories = {};
    this.categoryRules = {};
    this.userCustomRules = {};
    this.categoryConflictStrategy = 'first-match'; // 'first-match', 'most-specific', 'ask-user'
    this.init();
  }

  /**
   * 初始化分类管理器
   */
  async init() {
    if (this.initialized) return;
    
    try {
      // 从存储中加载分类规则
      const data = await chrome.storage.local.get(['categoryRules', 'userCustomRules', 'categoryConflictStrategy']);
      
      // 如果没有预定义的分类规则，则创建默认规则
      if (!data.categoryRules) {
        this.categoryRules = this._getDefaultCategoryRules();
        await chrome.storage.local.set({ categoryRules: this.categoryRules });
      } else {
        this.categoryRules = data.categoryRules;
      }
      
      // 加载用户自定义规则
      this.userCustomRules = data.userCustomRules || {};
      
      // 加载冲突策略
      this.categoryConflictStrategy = data.categoryConflictStrategy || 'first-match';
      
      // 标记为已初始化
      this.initialized = true;
    } catch (error) {
      console.error('初始化分类管理器失败:', error);
      // 初始化失败时使用默认规则
      this.categoryRules = this._getDefaultCategoryRules();
    }
  }

  /**
   * 获取默认分类规则
   * @returns {Object} 默认分类规则
   * @private
   */
  _getDefaultCategoryRules() {
    return {
      // 社交媒体
      'social': {
        name: '社交媒体',
        patterns: [
          'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 
          'pinterest.com', 'tumblr.com', 'reddit.com', 'weibo.com', 
          'douban.com', 'zhihu.com', 'quora.com', 'discord.com',
          'telegram.org', 'whatsapp.com', 'snapchat.com', 'tiktok.com',
          'qq.com', 'wechat.com'
        ],
        keywords: ['social', 'media', 'network', '社交', '媒体', '平台'],
        weight: 10
      },
      
      // 新闻资讯
      'news': {
        name: '新闻资讯',
        patterns: [
          'news', 'nytimes.com', 'bbc.com', 'cnn.com', 'reuters.com',
          'washingtonpost.com', 'theguardian.com', 'bloomberg.com',
          'wsj.com', 'ft.com', 'economist.com', 'apnews.com',
          'caixin.com', 'sina.com.cn', 'sohu.com', 'ifeng.com',
          'cnbc.com', 'nbcnews.com', 'foxnews.com', 'abcnews.go.com'
        ],
        keywords: ['news', 'breaking', 'report', 'headlines', '新闻', '资讯', '头条'],
        weight: 8
      },
      
      // 技术开发
      'tech': {
        name: '技术开发',
        patterns: [
          'github.com', 'stackoverflow.com', 'gitlab.com', 'bitbucket.org',
          'dev.to', 'medium.com', 'hackernews', 'techcrunch.com',
          'developer.mozilla.org', 'w3schools.com', 'codeproject.com',
          'codecademy.com', 'freecodecamp.org', 'leetcode.com',
          'geeksforgeeks.org', 'csdn.net', 'juejin.cn', 'infoq.com'
        ],
        keywords: ['code', 'programming', 'developer', 'software', 'tech', '编程', '技术', '开发'],
        weight: 9
      },
      
      // 购物电商
      'shopping': {
        name: '购物电商',
        patterns: [
          'amazon.com', 'ebay.com', 'taobao.com', 'jd.com', 'tmall.com',
          'aliexpress.com', 'walmart.com', 'target.com', 'bestbuy.com',
          'etsy.com', 'wish.com', 'newegg.com', 'homedepot.com',
          'wayfair.com', 'zalando.com', 'shopee.com', 'rakuten.com'
        ],
        keywords: ['shopping', 'shop', 'store', 'buy', 'price', 'discount', '购物', '商城', '折扣'],
        weight: 7
      },
      
      // 视频娱乐
      'video': {
        name: '视频娱乐',
        patterns: [
          'youtube.com', 'netflix.com', 'hulu.com', 'disney.com',
          'bilibili.com', 'iqiyi.com', 'youku.com', 'twitch.tv',
          'vimeo.com', 'dailymotion.com', 'tiktok.com', 'hbomax.com',
          'primevideo.com', 'paramount.com', 'peacocktv.com',
          'crunchyroll.com'
        ],
        keywords: ['video', 'stream', 'watch', 'movie', 'tv', 'show', 'film', '视频', '电影', '电视剧'],
        weight: 8
      },
      
      // 音乐
      'music': {
        name: '音乐',
        patterns: [
          'spotify.com', 'music.apple.com', 'soundcloud.com', 'pandora.com',
          'last.fm', 'bandcamp.com', 'tidal.com', 'deezer.com',
          'music.163.com', 'y.qq.com', 'kugou.com', 'xiami.com'
        ],
        keywords: ['music', 'song', 'audio', 'listen', 'playlist', 'album', '音乐', '歌曲', '播放'],
        weight: 8
      },
      
      // 旅游出行
      'travel': {
        name: '旅游出行',
        patterns: [
          'booking.com', 'airbnb.com', 'expedia.com', 'tripadvisor.com',
          'hotels.com', 'ctrip.com', 'agoda.com', 'kayak.com',
          'skyscanner.com', 'trivago.com', 'priceline.com', 'hotwire.com',
          'mafengwo.cn', 'tuniu.com'
        ],
        keywords: ['travel', 'hotel', 'flight', 'booking', 'vacation', 'trip', '旅游', '酒店', '机票'],
        weight: 7
      },
      
      // 教育学习
      'education': {
        name: '教育学习',
        patterns: [
          'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org',
          'udacity.com', 'duolingo.com', 'mooc.org', 'pluralsight.com',
          'brilliant.org', 'skillshare.com', 'masterclass.com',
          'xuexi.cn', 'icourse163.org'
        ],
        keywords: ['learn', 'course', 'education', 'study', 'class', 'tutorial', '教育', '学习', '课程'],
        weight: 9
      },
      
      // 办公工具
      'productivity': {
        name: '办公工具',
        patterns: [
          'office.com', 'docs.google.com', 'sheets.google.com', 'slides.google.com',
          'drive.google.com', 'dropbox.com', 'onedrive.com', 'notion.so',
          'evernote.com', 'onenote.com', 'trello.com', 'asana.com',
          'monday.com', 'clickup.com', 'todoist.com', 'slack.com',
          'workflowy.com', 'feishu.cn', 'shimo.im'
        ],
        keywords: ['productivity', 'work', 'office', 'document', 'spreadsheet', '办公', '文档', '工作'],
        weight: 8
      }
    };
  }

  /**
   * 根据URL自动分类
   * @param {string} url - 要分类的URL
   * @param {string} [title] - 页面标题（可选）
   * @param {string} [content] - 页面内容（可选）
   * @returns {Promise<Object>} 分类结果对象，包含categoryId和confidence属性
   */
  async categorizeUrl(url, title = '', content = '') {
    await this.init();
    
    try {
      // 解析URL获取域名
      let domain;
      try {
        domain = new URL(url).hostname;
      } catch (error) {
        domain = url;
      }
      
      // 候选分类列表，保存匹配分类和评分
      const candidates = [];
      
      // 1. 首先检查完整域名是否匹配规则
      await this._checkDomainMatches(domain, candidates);
      
      // 2. 检查URL路径部分
      await this._checkUrlPathMatches(url, candidates);
      
      // 3. 如果提供了标题，检查标题关键词
      if (title) {
        await this._checkTitleMatches(title, candidates);
      }
      
      // 4. 如果提供了内容，检查内容关键词（权重低）
      if (content) {
        await this._checkContentMatches(content, candidates);
      }
      
      // 5. 应用用户自定义规则（权重最高）
      await this._applyUserCustomRules(domain, url, candidates);
      
      // 根据评分排序候选分类
      candidates.sort((a, b) => b.score - a.score);
      
      // 如果存在分类冲突，应用冲突解决策略
      if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
        return await this._resolveConflict(candidates, url, title);
      }
      
      // 如果没有匹配的分类，返回null
      if (candidates.length === 0 || candidates[0].score === 0) {
        return null;
      }
      
      return {
        categoryId: candidates[0].categoryId,
        name: candidates[0].name,
        confidence: this._calculateConfidence(candidates[0].score),
        isUserDefined: candidates[0].isUserDefined || false
      };
    } catch (error) {
      console.error('分类URL时出错:', error);
      return null;
    }
  }

  /**
   * 检查域名是否与分类规则匹配
   * @param {string} domain - 域名
   * @param {Array} candidates - 候选分类数组
   * @private
   */
  async _checkDomainMatches(domain, candidates) {
    // 检查预定义规则
    for (const categoryId in this.categoryRules) {
      const category = this.categoryRules[categoryId];
      for (const pattern of category.patterns) {
        if (domain.includes(pattern)) {
          candidates.push({
            categoryId,
            name: category.name,
            score: category.weight * 10, // 域名匹配权重最高
            isUserDefined: false
          });
          break;
        }
      }
    }
    
    // 检查二级域名，逐级降低权重
    const domainParts = domain.split('.');
    if (domainParts.length > 2) {
      for (let i = 0; i < domainParts.length - 1; i++) {
        const subDomain = domainParts.slice(i).join('.');
        for (const categoryId in this.categoryRules) {
          const category = this.categoryRules[categoryId];
          for (const pattern of category.patterns) {
            if (subDomain === pattern) {
              // 二级域名确切匹配，权重较高
              const existingCandidate = candidates.find(c => c.categoryId === categoryId);
              if (existingCandidate) {
                existingCandidate.score = Math.max(existingCandidate.score, category.weight * 8);
              } else {
                candidates.push({
                  categoryId,
                  name: category.name,
                  score: category.weight * 8,
                  isUserDefined: false
                });
              }
              break;
            }
          }
        }
      }
    }
  }

  /**
   * 检查URL路径部分是否与分类规则匹配
   * @param {string} url - 完整URL
   * @param {Array} candidates - 候选分类数组
   * @private
   */
  async _checkUrlPathMatches(url, candidates) {
    try {
      const urlPath = new URL(url).pathname.toLowerCase();
      
      if (urlPath && urlPath !== '/') {
        for (const categoryId in this.categoryRules) {
          const category = this.categoryRules[categoryId];
          // 检查URL路径中是否包含关键词
          if (category.keywords) {
            for (const keyword of category.keywords) {
              if (urlPath.includes(keyword.toLowerCase())) {
                const existingCandidate = candidates.find(c => c.categoryId === categoryId);
                if (existingCandidate) {
                  existingCandidate.score += category.weight * 2;
                } else {
                  candidates.push({
                    categoryId,
                    name: category.name,
                    score: category.weight * 2, // URL路径匹配权重较低
                    isUserDefined: false
                  });
                }
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      // 忽略URL解析错误
      console.warn('解析URL路径时出错:', error);
    }
  }

  /**
   * 检查标题是否与分类规则匹配
   * @param {string} title - 页面标题
   * @param {Array} candidates - 候选分类数组
   * @private
   */
  async _checkTitleMatches(title, candidates) {
    const titleLower = title.toLowerCase();
    
    for (const categoryId in this.categoryRules) {
      const category = this.categoryRules[categoryId];
      if (category.keywords) {
        for (const keyword of category.keywords) {
          if (titleLower.includes(keyword.toLowerCase())) {
            const existingCandidate = candidates.find(c => c.categoryId === categoryId);
            if (existingCandidate) {
              existingCandidate.score += category.weight * 3;
            } else {
              candidates.push({
                categoryId,
                name: category.name,
                score: category.weight * 3, // 标题匹配权重中等
                isUserDefined: false
              });
            }
            break;
          }
        }
      }
    }
  }

  /**
   * 检查内容是否与分类规则匹配
   * @param {string} content - 页面内容
   * @param {Array} candidates - 候选分类数组
   * @private
   */
  async _checkContentMatches(content, candidates) {
    // 仅使用内容的前2000字符进行分析，避免性能问题
    const contentSnippet = content.substring(0, 2000).toLowerCase();
    
    for (const categoryId in this.categoryRules) {
      const category = this.categoryRules[categoryId];
      if (category.keywords) {
        let keywordMatches = 0;
        
        for (const keyword of category.keywords) {
          const keywordLower = keyword.toLowerCase();
          // 计算关键词在内容中出现的次数
          const regex = new RegExp(keywordLower, 'g');
          const matches = contentSnippet.match(regex);
          if (matches) {
            keywordMatches += matches.length;
          }
        }
        
        if (keywordMatches > 0) {
          // 根据匹配次数增加分数，但设置上限
          const matchScore = Math.min(keywordMatches * category.weight / 2, category.weight * 5);
          
          const existingCandidate = candidates.find(c => c.categoryId === categoryId);
          if (existingCandidate) {
            existingCandidate.score += matchScore;
          } else {
            candidates.push({
              categoryId,
              name: category.name,
              score: matchScore,
              isUserDefined: false
            });
          }
        }
      }
    }
  }

  /**
   * 应用用户自定义规则
   * @param {string} domain - 域名
   * @param {string} url - 完整URL
   * @param {Array} candidates - 候选分类数组
   * @private
   */
  async _applyUserCustomRules(domain, url, candidates) {
    // 检查用户是否为特定域名定义了规则
    if (this.userCustomRules[domain]) {
      const customCategory = this.userCustomRules[domain];
      // 用户自定义规则优先级最高
      candidates.push({
        categoryId: customCategory.categoryId,
        name: customCategory.name,
        score: 100, // 用户自定义规则权重最高
        isUserDefined: true
      });
    }
    
    // 检查用户是否为特定URL模式定义了规则
    for (const pattern in this.userCustomRules) {
      if (pattern !== domain && url.includes(pattern)) {
        const customCategory = this.userCustomRules[pattern];
        candidates.push({
          categoryId: customCategory.categoryId,
          name: customCategory.name,
          score: 90, // URL模式匹配权重略低于完全域名匹配
          isUserDefined: true
        });
      }
    }
  }

  /**
   * 解决分类冲突
   * @param {Array} candidates - 候选分类数组
   * @param {string} url - URL
   * @param {string} title - 标题
   * @returns {Promise<Object>} 解决后的分类
   * @private
   */
  async _resolveConflict(candidates, url, title) {
    const topCandidates = candidates.filter(c => c.score === candidates[0].score);
    
    switch (this.categoryConflictStrategy) {
      case 'most-specific':
        // 尝试选择最具体的分类
        for (const candidate of topCandidates) {
          if (candidate.isUserDefined) {
            return {
              categoryId: candidate.categoryId,
              name: candidate.name,
              confidence: this._calculateConfidence(candidate.score),
              isUserDefined: true
            };
          }
        }
        // 如果没有用户自定义分类，使用第一个匹配项
        return {
          categoryId: candidates[0].categoryId,
          name: candidates[0].name,
          confidence: this._calculateConfidence(candidates[0].score),
          isUserDefined: candidates[0].isUserDefined || false
        };
        
      case 'ask-user':
        // 在实际应用中，应该显示选择UI让用户选择
        // 在此实现中，暂时返回第一个
        console.log('分类冲突:', topCandidates.map(c => c.name).join(', '));
        return {
          categoryId: candidates[0].categoryId,
          name: candidates[0].name,
          confidence: this._calculateConfidence(candidates[0].score),
          isUserDefined: candidates[0].isUserDefined || false,
          hasConflict: true,
          conflictOptions: topCandidates
        };
        
      case 'first-match':
      default:
        // 使用第一个匹配项
        return {
          categoryId: candidates[0].categoryId,
          name: candidates[0].name,
          confidence: this._calculateConfidence(candidates[0].score),
          isUserDefined: candidates[0].isUserDefined || false
        };
    }
  }

  /**
   * 计算分类置信度
   * @param {number} score - 分类评分
   * @returns {number} 0-1之间的置信度值
   * @private
   */
  _calculateConfidence(score) {
    // 将评分转换为0-1之间的置信度
    if (score >= 100) return 1;
    if (score <= 0) return 0;
    
    return Math.min(score / 100, 1);
  }

  /**
   * 添加或创建书签分类文件夹
   * @param {string} categoryId - 分类ID
   * @returns {Promise<string>} 创建的分类文件夹ID
   */
  async createCategoryFolder(categoryId) {
    await this.init();
    
    try {
      const category = this.categoryRules[categoryId];
      if (!category) {
        throw new Error(`未找到分类: ${categoryId}`);
      }
      
      // 检查分类文件夹是否存在
      const searchResults = await chrome.bookmarks.search({ title: category.name });
      const folders = searchResults.filter(bookmark => !bookmark.url);
      
      if (folders.length > 0) {
        // 使用已存在的文件夹
        return folders[0].id;
      }
      
      // 查找或创建"智能分类"根文件夹
      const rootFolderName = '智能分类';
      const rootFolderResults = await chrome.bookmarks.search({ title: rootFolderName });
      const rootFolders = rootFolderResults.filter(bookmark => !bookmark.url);
      
      let rootFolderId;
      if (rootFolders.length > 0) {
        rootFolderId = rootFolders[0].id;
      } else {
        // 创建根文件夹
        const newRootFolder = await chrome.bookmarks.create({
          title: rootFolderName,
          parentId: '1' // 书签栏
        });
        rootFolderId = newRootFolder.id;
      }
      
      // 创建分类文件夹
      const newFolder = await chrome.bookmarks.create({
        title: category.name,
        parentId: rootFolderId
      });
      
      return newFolder.id;
    } catch (error) {
      console.error('创建分类文件夹失败:', error);
      throw error;
    }
  }

  /**
   * 将书签移动到对应的分类文件夹中
   * @param {string} bookmarkId - 书签ID
   * @param {string} categoryId - 分类ID
   * @returns {Promise<Object>} 移动后的书签对象
   */
  async moveBookmarkToCategory(bookmarkId, categoryId) {
    try {
      // 获取或创建分类文件夹
      const folderId = await this.createCategoryFolder(categoryId);
      
      // 移动书签
      return await chrome.bookmarks.move(bookmarkId, { parentId: folderId });
    } catch (error) {
      console.error('移动书签到分类失败:', error);
      throw error;
    }
  }

  /**
   * 处理新添加的书签
   * @param {Object} bookmark - 书签对象
   * @returns {Promise<Object>} 处理结果
   */
  async processNewBookmark(bookmark) {
    if (!bookmark.url) {
      // 不处理文件夹
      return { processed: false, reason: 'is_folder' };
    }
    
    try {
      // 尝试根据URL和标题分类
      const category = await this.categorizeUrl(bookmark.url, bookmark.title);
      
      if (!category) {
        return { processed: false, reason: 'no_category_match' };
      }
      
      if (category.confidence < 0.7) {
        return { 
          processed: false, 
          reason: 'low_confidence',
          suggestedCategory: category
        };
      }
      
      // 移动书签到对应分类
      const movedBookmark = await this.moveBookmarkToCategory(bookmark.id, category.categoryId);
      
      return { 
        processed: true, 
        bookmark: movedBookmark,
        category: category
      };
    } catch (error) {
      console.error('处理新书签时出错:', error);
      return { processed: false, reason: 'error', error: error.message };
    }
  }

  /**
   * 批量处理书签分类
   * @param {Array} bookmarks - 书签数组
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Object>} 处理结果
   */
  async batchCategorizeBookmarks(bookmarks, progressCallback = null) {
    const results = {
      total: bookmarks.length,
      processed: 0,
      categorized: 0,
      skipped: 0,
      failed: 0,
      categories: {}
    };
    
    for (let i = 0; i < bookmarks.length; i++) {
      const bookmark = bookmarks[i];
      
      try {
        // 只处理URL书签，跳过文件夹
        if (!bookmark.url) {
          results.skipped++;
          continue;
        }
        
        const result = await this.processNewBookmark(bookmark);
        
        if (result.processed) {
          results.categorized++;
          
          // 记录分类统计
          const categoryId = result.category.categoryId;
          if (!results.categories[categoryId]) {
            results.categories[categoryId] = {
              name: result.category.name,
              count: 1
            };
          } else {
            results.categories[categoryId].count++;
          }
        } else {
          results.skipped++;
        }
      } catch (error) {
        results.failed++;
        console.error('批量分类书签时出错:', error);
      }
      
      results.processed++;
      
      // 报告进度
      if (progressCallback && typeof progressCallback === 'function') {
        progressCallback(results.processed, results.total, results);
      }
    }
    
    return results;
  }

  /**
   * 添加自定义分类规则
   * @param {string} pattern - URL模式或域名
   * @param {string} categoryId - 分类ID
   * @returns {Promise<boolean>} 是否添加成功
   */
  async addCustomRule(pattern, categoryId) {
    await this.init();
    
    try {
      // 检查分类是否存在
      if (!this.categoryRules[categoryId]) {
        throw new Error(`未找到分类: ${categoryId}`);
      }
      
      // 添加或更新规则
      this.userCustomRules[pattern] = {
        categoryId: categoryId,
        name: this.categoryRules[categoryId].name,
        timestamp: Date.now()
      };
      
      // 保存到存储
      await chrome.storage.local.set({ userCustomRules: this.userCustomRules });
      
      return true;
    } catch (error) {
      console.error('添加自定义规则失败:', error);
      return false;
    }
  }

  /**
   * 删除自定义分类规则
   * @param {string} pattern - 要删除的URL模式或域名
   * @returns {Promise<boolean>} 是否删除成功
   */
  async removeCustomRule(pattern) {
    await this.init();
    
    if (this.userCustomRules[pattern]) {
      delete this.userCustomRules[pattern];
      await chrome.storage.local.set({ userCustomRules: this.userCustomRules });
      return true;
    }
    
    return false;
  }

  /**
   * 获取所有分类
   * @returns {Promise<Object>} 分类对象
   */
  async getCategories() {
    await this.init();
    return this.categoryRules;
  }

  /**
   * 获取用户自定义规则
   * @returns {Promise<Object>} 用户自定义规则
   */
  async getUserCustomRules() {
    await this.init();
    return this.userCustomRules;
  }

  /**
   * 添加新分类
   * @param {string} categoryId - 分类ID
   * @param {Object} category - 分类对象
   * @returns {Promise<boolean>} 是否添加成功
   */
  async addCategory(categoryId, category) {
    await this.init();
    
    try {
      // 检查分类ID是否已存在
      if (this.categoryRules[categoryId]) {
        throw new Error(`分类ID已存在: ${categoryId}`);
      }
      
      // 验证分类对象
      if (!category.name || !category.patterns || !Array.isArray(category.patterns)) {
        throw new Error('无效的分类对象');
      }
      
      // 设置默认权重
      if (!category.weight) {
        category.weight = 5;
      }
      
      // 添加分类
      this.categoryRules[categoryId] = category;
      
      // 保存到存储
      await chrome.storage.local.set({ categoryRules: this.categoryRules });
      
      return true;
    } catch (error) {
      console.error('添加分类失败:', error);
      return false;
    }
  }

  /**
   * 更新分类
   * @param {string} categoryId - 分类ID
   * @param {Object} category - 分类对象
   * @returns {Promise<boolean>}
   */
  async updateCategory(categoryId, category) {
    await this.init();
    try {
        if (!this.categoryRules[categoryId]) {
            throw new Error(`分类ID不存在: ${categoryId}`);
        }
        // 验证分类对象
        if (!category.name || !category.patterns || !Array.isArray(category.patterns)) {
          throw new Error('无效的分类对象');
        }
        // 更新分类
        this.categoryRules[categoryId] = { ...this.categoryRules[categoryId], ...category };
        // 保存到存储
        await chrome.storage.local.set({ categoryRules: this.categoryRules });
        return true;
    } catch (error) {
        console.error('更新分类失败:', error);
        return false;
    }
  }

  /**
   * 删除分类
   * @param {string} categoryId - 分类ID
   * @returns {Promise<boolean>}
   */
  async deleteCategory(categoryId) {
    await this.init();
    try {
        if (!this.categoryRules[categoryId]) {
            throw new Error(`分类ID不存在: ${categoryId}`);
        }
        // 删除分类
        delete this.categoryRules[categoryId];
        // 保存到存储
        await chrome.storage.local.set({ categoryRules: this.categoryRules });
        return true;
    } catch (error) {
        console.error('删除分类失败:', error);
        return false;
    }
  }

  /**
   * 获取分类冲突策略
   * @returns {Promise<string>} 冲突策略
   */
  async getConflictStrategy() {
    await this.init();
    return this.categoryConflictStrategy;
  }

  /**
   * 设置分类冲突策略
   * @param {string} strategy - 'first-match', 'most-specific', 'ask-user'
   * @returns {Promise<boolean>} 是否设置成功
   */
  async setConflictStrategy(strategy) {
    await this.init();
    const validStrategies = ['first-match', 'most-specific', 'ask-user'];
    if (!validStrategies.includes(strategy)) {
      console.error('无效的冲突策略:', strategy);
      return false;
    }
    this.categoryConflictStrategy = strategy;
    await chrome.storage.local.set({ categoryConflictStrategy: strategy });
    return true;
  }
}

export default new CategoryManager();