/**
 * options.js - 设置页面脚本
 * 管理插件的各项配置设置
 */

// 默认设置
const DEFAULT_SETTINGS = {
  // 常规设置
  defaultView: 'list',
  defaultFolder: '1',
  openInNewTab: false,
  confirmBeforeDelete: true,
  
  // 智能提示设置
  notificationEnabled: true,
  visitThreshold: 5,
  dayRange: 10,
  maxNotificationsPerDay: 1,
  
  // 自动分类设置
  autoCategorizationEnabled: true,
  createCategoryFolders: true,
  autoCategories: {
    'social': ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com'],
    'news': ['news.google.com', 'bbc.com', 'cnn.com', 'nytimes.com'],
    'tech': ['github.com', 'stackoverflow.com', 'dev.to', 'medium.com'],
    'shopping': ['amazon.com', 'ebay.com', 'taobao.com', 'jd.com']
  },
  
  // URL有效性检查设置
  validationFrequency: 'manual',
  validationTimeout: 5000,
  validationConcurrency: 3,
  validationCacheDuration: 24,
  notifyBrokenLinks: true,
  
  // 界面与主题
  theme: 'system',
  popupWidth: 760,
  popupHeight: 500,
  folderTreeWidth: 30,
  fontSize: 'medium',
  showFavicons: true,
  showVisitCount: true,
  
  // 高级设置
  historyRetention: 30,
  trackIncognito: false,
  debugMode: false,
  
  // 内部状态
  lastNotificationDate: null,
  notifiedUrls: {}
};

/**
 * 初始化设置页面
 */
async function initOptionsPage() {
  // 为标签切换添加事件监听
  initTabNavigation();
  
  // 加载存储的设置
  await loadSettings();
  
  // 绑定表单元素事件
  bindFormEvents();
  
  // 绑定按钮事件
  bindButtonEvents();
  
  // 初始化分类规则界面
  initCategoryRules();
  
  // 加载存储使用情况
  loadStorageUsage();
}

/**
 * 初始化标签导航
 */
function initTabNavigation() {
  const navLinks = document.querySelectorAll('.settings-nav a');
  const sections = document.querySelectorAll('.settings-section');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // 移除所有导航链接的活动状态
      navLinks.forEach(link => link.classList.remove('active'));
      
      // 添加当前链接的活动状态
      link.classList.add('active');
      
      // 隐藏所有部分
      sections.forEach(section => section.classList.remove('active'));
      
      // 显示目标部分
      const targetId = link.getAttribute('href').substring(1);
      document.getElementById(targetId).classList.add('active');
    });
  });
}

/**
 * 从存储中加载设置并填充表单
 */
async function loadSettings() {
  try {
    // 获取存储的设置
    const storage = await chrome.storage.local.get(['settings']);
    const settings = storage.settings || DEFAULT_SETTINGS;
    
    // 填充表单
    fillSettingsForm(settings);
  } catch (error) {
    console.error('加载设置失败:', error);
    showNotification('加载设置失败', error.message, 'error');
    
    // 如果加载失败，使用默认设置
    fillSettingsForm(DEFAULT_SETTINGS);
  }
}

/**
 * 使用设置填充表单
 * @param {Object} settings - 设置对象
 */
function fillSettingsForm(settings) {
  // 常规设置
  setFormValue('defaultView', settings.defaultView);
  setFormValue('defaultFolder', settings.defaultFolder);
  setFormValue('openInNewTab', settings.openInNewTab);
  setFormValue('confirmBeforeDelete', settings.confirmBeforeDelete);
  
  // 智能提示设置
  setFormValue('notificationEnabled', settings.notificationEnabled);
  setFormValue('visitThreshold', settings.visitThreshold);
  setFormValue('dayRange', settings.dayRange);
  setFormValue('maxNotificationsPerDay', settings.maxNotificationsPerDay);
  
  // 自动分类设置
  setFormValue('autoCategorizationEnabled', settings.autoCategorizationEnabled);
  setFormValue('createCategoryFolders', settings.createCategoryFolders);
  
  // URL有效性检查设置
  setFormValue('validationFrequency', settings.validationFrequency);
  setFormValue('validationTimeout', settings.validationTimeout);
  setFormValue('validationConcurrency', settings.validationConcurrency);
  setFormValue('validationCacheDuration', settings.validationCacheDuration);
  setFormValue('notifyBrokenLinks', settings.notifyBrokenLinks);
  
  // 界面与主题
  setFormValue('theme', settings.theme);
  setFormValue('popupWidth', settings.popupWidth);
  setFormValue('popupHeight', settings.popupHeight);
  setFormValue('folderTreeWidth', settings.folderTreeWidth);
  setFormValue('fontSize', settings.fontSize);
  setFormValue('showFavicons', settings.showFavicons);
  setFormValue('showVisitCount', settings.showVisitCount);
  
  // 高级设置
  setFormValue('historyRetention', settings.historyRetention);
  setFormValue('trackIncognito', settings.trackIncognito);
  setFormValue('debugMode', settings.debugMode);
  
  // 填充分类规则
  fillCategoryRules(settings.autoCategories || {});
  
  // 应用主题预览
  applyThemePreview(settings.theme);
  
  // 应用字体大小预览
  applyFontSizePreview(settings.fontSize);
}

/**
 * 设置表单元素值
 * @param {string} id - 元素ID
 * @param {any} value - 要设置的值
 */
function setFormValue(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  
  const type = element.type;
  
  if (type === 'checkbox') {
    element.checked = Boolean(value);
  } else if (type === 'radio') {
    const radio = document.querySelector(`input[name="${id}"][value="${value}"]`);
    if (radio) radio.checked = true;
  } else {
    element.value = value;
  }
}

/**
 * 从表单获取值
 * @param {string} id - 元素ID
 * @returns {any} 元素值
 */
function getFormValue(id) {
  const element = document.getElementById(id);
  if (!element) return null;
  
  const type = element.type;
  
  if (type === 'checkbox') {
    return element.checked;
  } else if (type === 'number') {
    return Number(element.value);
  } else {
    return element.value;
  }
}

/**
 * 填充分类规则
 * @param {Object} categories - 分类规则
 */
function fillCategoryRules(categories) {
  const container = document.getElementById('categoryRulesContainer');
  
  // 清空现有规则（保留前两个作为模板）
  while (container.children.length > 2) {
    container.removeChild(container.lastChild);
  }
  
  // 为每个自定义规则添加元素
  let index = 2; // 跳过前两个默认规则
  for (const [name, domains] of Object.entries(categories)) {
    // 跳过默认的社交和新闻类别，因为它们已经作为模板存在
    if (index < 2 || name === 'social' || name === 'news') {
      index++;
      continue;
    }
    
    addCategoryRule(name, domains);
  }
}

/**
 * 添加分类规则到界面
 * @param {string} name - 类别名称
 * @param {Array<string>} domains - 域名数组
 */
function addCategoryRule(name = '', domains = []) {
  const container = document.getElementById('categoryRulesContainer');
  
  // 创建规则元素
  const ruleElement = document.createElement('div');
  ruleElement.className = 'category-rule';
  
  const domainsText = Array.isArray(domains) ? domains.join('\n') : '';
  
  ruleElement.innerHTML = `
    <div class="form-group">
      <label>类别名称</label>
      <input type="text" class="form-control category-name" value="${name}" placeholder="例如：技术">
    </div>
    <div class="form-group">
      <label>域名列表（每行一个）</label>
      <textarea class="form-control category-domains" rows="3" placeholder="例如：github.com">${domainsText}</textarea>
    </div>
    <button type="button" class="btn btn-danger btn-sm delete-rule">删除</button>
  `;
  
  // 绑定删除按钮事件
  const deleteButton = ruleElement.querySelector('.delete-rule');
  deleteButton.addEventListener('click', () => {
    container.removeChild(ruleElement);
  });
  
  // 添加到容器
  container.appendChild(ruleElement);
}

/**
 * 初始化分类规则界面
 */
function initCategoryRules() {
  // 为现有的删除按钮添加事件监听
  const deleteButtons = document.querySelectorAll('.delete-rule');
  deleteButtons.forEach(button => {
    button.addEventListener('click', () => {
      const rule = button.closest('.category-rule');
      if (rule) {
        rule.parentElement.removeChild(rule);
      }
    });
  });
  
  // 为添加按钮添加事件监听
  const addButton = document.getElementById('addCategoryRule');
  addButton.addEventListener('click', () => {
    addCategoryRule();
  });
}

/**
 * 绑定表单元素事件
 */
function bindFormEvents() {
  // 主题切换预览
  const themeSelect = document.getElementById('theme');
  themeSelect.addEventListener('change', () => {
    applyThemePreview(themeSelect.value);
  });
  
  // 字体大小预览
  const fontSizeSelect = document.getElementById('fontSize');
  fontSizeSelect.addEventListener('change', () => {
    applyFontSizePreview(fontSizeSelect.value);
  });
  
  // 文件选择显示
  const importInput = document.getElementById('importSettings');
  const selectedFileSpan = document.getElementById('selectedFile');
  const restoreButton = document.getElementById('restoreSettings');
  
  importInput.addEventListener('change', () => {
    if (importInput.files.length > 0) {
      selectedFileSpan.textContent = importInput.files[0].name;
      restoreButton.disabled = false;
    } else {
      selectedFileSpan.textContent = '未选择文件';
      restoreButton.disabled = true;
    }
  });
}

/**
 * 绑定按钮事件
 */
function bindButtonEvents() {
  // 保存设置按钮
  const saveButton = document.getElementById('saveSettings');
  saveButton.addEventListener('click', saveSettings);
  
  // 恢复默认设置按钮
  const resetButton = document.getElementById('resetToDefault');
  resetButton.addEventListener('click', resetToDefaultSettings);
  
  // 导出设置按钮
  const exportButton = document.getElementById('exportSettings');
  exportButton.addEventListener('click', exportSettings);
  
  // 恢复设置按钮
  const restoreButton = document.getElementById('restoreSettings');
  restoreButton.addEventListener('click', importSettings);
  
  // 清除验证缓存按钮
  const clearCacheButton = document.getElementById('clearValidationCache');
  clearCacheButton.addEventListener('click', clearValidationCache);
  
  // 清除所有数据按钮
  const clearDataButton = document.getElementById('clearAllData');
  clearDataButton.addEventListener('click', confirmClearAllData);
  
  // 导出书签按钮
  const exportHtmlButton = document.getElementById('exportBookmarksHtml');
  exportHtmlButton.addEventListener('click', () => exportBookmarks('html'));
  
  const exportJsonButton = document.getElementById('exportBookmarksJson');
  exportJsonButton.addEventListener('click', () => exportBookmarks('json'));
}

/**
 * 从表单收集设置
 * @returns {Object} 设置对象
 */
function collectSettings() {
  const settings = {
    // 常规设置
    defaultView: getFormValue('defaultView'),
    defaultFolder: getFormValue('defaultFolder'),
    openInNewTab: getFormValue('openInNewTab'),
    confirmBeforeDelete: getFormValue('confirmBeforeDelete'),
    
    // 智能提示设置
    notificationEnabled: getFormValue('notificationEnabled'),
    visitThreshold: getFormValue('visitThreshold'),
    dayRange: getFormValue('dayRange'),
    maxNotificationsPerDay: getFormValue('maxNotificationsPerDay'),
    
    // 自动分类设置
    autoCategorizationEnabled: getFormValue('autoCategorizationEnabled'),
    createCategoryFolders: getFormValue('createCategoryFolders'),
    
    // URL有效性检查设置
    validationFrequency: getFormValue('validationFrequency'),
    validationTimeout: getFormValue('validationTimeout'),
    validationConcurrency: getFormValue('validationConcurrency'),
    validationCacheDuration: getFormValue('validationCacheDuration'),
    notifyBrokenLinks: getFormValue('notifyBrokenLinks'),
    
    // 界面与主题
    theme: getFormValue('theme'),
    popupWidth: getFormValue('popupWidth'),
    popupHeight: getFormValue('popupHeight'),
    folderTreeWidth: getFormValue('folderTreeWidth'),
    fontSize: getFormValue('fontSize'),
    showFavicons: getFormValue('showFavicons'),
    showVisitCount: getFormValue('showVisitCount'),
    
    // 高级设置
    historyRetention: getFormValue('historyRetention'),
    trackIncognito: getFormValue('trackIncognito'),
    debugMode: getFormValue('debugMode'),
  };
  
  // 收集分类规则
  settings.autoCategories = collectCategoryRules();
  
  // 保留内部状态
  if (window.currentSettings) {
    settings.lastNotificationDate = window.currentSettings.lastNotificationDate;
    settings.notifiedUrls = window.currentSettings.notifiedUrls;
  }
  
  // 处理清除已通知记录选项
  if (getFormValue('clearNotifiedUrls')) {
    settings.notifiedUrls = {};
  }
  
  return settings;
}

/**
 * 收集分类规则
 * @returns {Object} 分类规则对象
 */
function collectCategoryRules() {
  const categories = {};
  const rules = document.querySelectorAll('.category-rule');
  
  rules.forEach(rule => {
    const nameInput = rule.querySelector('.category-name');
    const domainsTextarea = rule.querySelector('.category-domains');
    
    if (nameInput && domainsTextarea) {
      const name = nameInput.value.trim();
      const domainsText = domainsTextarea.value.trim();
      
      if (name && domainsText) {
        const domains = domainsText
          .split('\n')
          .map(domain => domain.trim())
          .filter(domain => domain.length > 0);
        
        if (domains.length > 0) {
          categories[name] = domains;
        }
      }
    }
  });
  
  return categories;
}

/**
 * 应用主题预览
 * @param {string} theme - 主题名称
 */
function applyThemePreview(theme) {
  const body = document.body;
  
  // 移除现有主题类
  body.classList.remove('theme-light', 'theme-dark', 'theme-system');
  
  // 添加新主题类
  body.classList.add(`theme-${theme}`);
  
  // 如果是系统主题，则使用媒体查询检测
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    body.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
  }
}

/**
 * 应用字体大小预览
 * @param {string} size - 字体大小
 */
function applyFontSizePreview(size) {
  const body = document.body;
  
  // 移除现有字体大小类
  body.classList.remove('font-small', 'font-medium', 'font-large');
  
  // 添加新字体大小类
  body.classList.add(`font-${size}`);
}

/**
 * 保存设置
 */
async function saveSettings() {
  try {
    // 收集表单值
    const settings = collectSettings();
    
    // 验证设置
    const validationErrors = validateSettings(settings);
    if (validationErrors.length > 0) {
      showValidationErrors(validationErrors);
      return;
    }
    
    // 保存到存储
    await chrome.storage.local.set({ settings });
    
    // 保存到当前内存
    window.currentSettings = settings;
    
    // 显示成功通知
    showNotification('保存成功', '设置已成功保存', 'success');
  } catch (error) {
    console.error('保存设置失败:', error);
    showNotification('保存失败', error.message, 'error');
  }
}

/**
 * 验证设置有效性
 * @param {Object} settings - 设置对象
 * @returns {Array<Object>} 错误信息数组
 */
function validateSettings(settings) {
  const errors = [];
  
  // 访问阈值必须是正整数
  if (!Number.isInteger(settings.visitThreshold) || settings.visitThreshold < 1) {
    errors.push({
      field: 'visitThreshold',
      message: '访问次数阈值必须是大于0的整数'
    });
  }
  
  // 天数范围必须是正整数
  if (!Number.isInteger(settings.dayRange) || settings.dayRange < 1 || settings.dayRange > 60) {
    errors.push({
      field: 'dayRange',
      message: '统计天数范围必须是1到60之间的整数'
    });
  }
  
  // 每日最大提示次数必须是非负整数
  if (!Number.isInteger(settings.maxNotificationsPerDay) || settings.maxNotificationsPerDay < 0) {
    errors.push({
      field: 'maxNotificationsPerDay',
      message: '每日最大提示次数必须是非负整数'
    });
  }
  
  // 检查超时时间必须是合理的正整数
  if (!Number.isInteger(settings.validationTimeout) || settings.validationTimeout < 1000) {
    errors.push({
      field: 'validationTimeout',
      message: '检查超时时间必须至少为1000毫秒'
    });
  }
  
  // 并发检查数量必须是正整数
  if (!Number.isInteger(settings.validationConcurrency) || settings.validationConcurrency < 1) {
    errors.push({
      field: 'validationConcurrency',
      message: '并发检查数量必须是大于0的整数'
    });
  }
  
  // 弹出窗口尺寸必须在合理范围内
  if (settings.popupWidth < 300 || settings.popupWidth > 800) {
    errors.push({
      field: 'popupWidth',
      message: '弹出窗口宽度必须在300到800像素之间'
    });
  }
  
  if (settings.popupHeight < 300 || settings.popupHeight > 600) {
    errors.push({
      field: 'popupHeight',
      message: '弹出窗口高度必须在300到600像素之间'
    });
  }
  
  // 文件夹树宽度必须是合理的百分比
  if (settings.folderTreeWidth < 10 || settings.folderTreeWidth > 50) {
    errors.push({
      field: 'folderTreeWidth',
      message: '文件夹树宽度必须在10%到50%之间'
    });
  }
  
  return errors;
}

/**
 * 显示验证错误
 * @param {Array<Object>} errors - 错误信息数组
 */
function showValidationErrors(errors) {
  // 移除所有现有错误提示
  const existingErrors = document.querySelectorAll('.validation-error');
  existingErrors.forEach(el => el.parentNode.removeChild(el));
  
  // 显示新的错误提示
  errors.forEach(error => {
    const field = document.getElementById(error.field);
    if (field) {
      // 创建错误元素
      const errorElement = document.createElement('div');
      errorElement.className = 'validation-error';
      errorElement.textContent = error.message;
      
      // 添加到对应字段后面
      field.parentNode.appendChild(errorElement);
      
      // 添加错误样式
      field.classList.add('input-error');
      
      // 焦点事件移除错误样式
      field.addEventListener('focus', () => {
        field.classList.remove('input-error');
        if (errorElement.parentNode) {
          errorElement.parentNode.removeChild(errorElement);
        }
      }, { once: true });
    }
  });
  
  // 如果有错误，滚动到第一个错误字段
  if (errors.length > 0) {
    const firstErrorField = document.getElementById(errors[0].field);
    if (firstErrorField) {
      firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // 显示错误通知
    showNotification('验证错误', '请修正表单中的错误', 'error');
  }
}

/**
 * 恢复默认设置
 */
function resetToDefaultSettings() {
  if (confirm('确定要恢复默认设置吗？这将覆盖所有当前设置。')) {
    fillSettingsForm(DEFAULT_SETTINGS);
    showNotification('已重置', '设置已恢复为默认值，请点击保存以应用', 'info');
  }
}

/**
 * 导出设置
 */
function exportSettings() {
  try {
    // 收集当前设置
    const settings = collectSettings();
    
    // 转换为 JSON 字符串
    const settingsJson = JSON.stringify(settings, null, 2);
    
    // 创建 Blob
    const blob = new Blob([settingsJson], { type: 'application/json' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookmark-manager-settings.json';
    
    // 触发下载
    document.body.appendChild(a);
    a.click();
    
    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('导出成功', '设置已导出为JSON文件', 'success');
  } catch (error) {
    console.error('导出设置失败:', error);
    showNotification('导出失败', error.message, 'error');
  }
}

/**
 * 导入设置
 */
async function importSettings() {
  try {
    const fileInput = document.getElementById('importSettings');
    
    if (!fileInput.files || fileInput.files.length === 0) {
      showNotification('导入失败', '请选择设置文件', 'error');
      return;
    }
    
    const file = fileInput.files[0];
    
    // 读取文件内容
    const content = await readFileAsText(file);
    
    // 解析 JSON
    const settings = JSON.parse(content);
    
    // 验证设置有效性
    if (!isValidSettingsObject(settings)) {
      showNotification('导入失败', '无效的设置文件格式', 'error');
      return;
    }
    
    // 应用设置到表单
    fillSettingsForm(settings);
    
    // 提示用户保存
    showNotification('导入完成', '设置已导入，请点击保存以应用更改', 'success');
  } catch (error) {
    console.error('导入设置失败:', error);
    showNotification('导入失败', error.message, 'error');
  }
}

/**
 * 读取文件内容为文本
 * @param {File} file - 文件对象
 * @returns {Promise<string>} 文件内容
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取文件失败'));
    
    reader.readAsText(file);
  });
}

/**
 * 验证对象是否为有效的设置对象
 * @param {Object} obj - 要验证的对象
 * @returns {boolean} 是否有效
 */
function isValidSettingsObject(obj) {
  // 检查是否为对象
  if (!obj || typeof obj !== 'object') return false;
  
  // 检查必要属性
  const requiredProps = [
    'defaultView',
    'notificationEnabled',
    'visitThreshold',
    'dayRange'
  ];
  
  return requiredProps.every(prop => prop in obj);
}

/**
 * 导出书签
 * @param {string} format - 格式，'html' 或 'json'
 */
async function exportBookmarks(format) {
  try {
    let content = '';
    let mimeType = '';
    let filename = '';
    
    if (format === 'html') {
      // 调用后台脚本获取HTML格式的书签
      const response = await chrome.runtime.sendMessage({
        action: 'exportBookmarksAsHtml'
      });
      
      if (!response || !response.success) {
        throw new Error('导出书签失败: ' + (response?.error || '未知错误'));
      }
      
      content = response.html;
      mimeType = 'text/html';
      filename = 'bookmarks.html';
    } else if (format === 'json') {
      // 调用后台脚本获取JSON格式的书签
      const response = await chrome.runtime.sendMessage({
        action: 'exportBookmarksAsJson'
      });
      
      if (!response || !response.success) {
        throw new Error('导出书签失败: ' + (response?.error || '未知错误'));
      }
      
      content = response.json;
      mimeType = 'application/json';
      filename = 'bookmarks.json';
    } else {
      throw new Error('不支持的格式: ' + format);
    }
    
    // 创建 Blob
    const blob = new Blob([content], { type: mimeType });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    
    // 触发下载
    document.body.appendChild(a);
    a.click();
    
    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('导出成功', `书签已导出为${format.toUpperCase()}格式`, 'success');
  } catch (error) {
    console.error('导出书签失败:', error);
    showNotification('导出失败', error.message, 'error');
  }
}

/**
 * 清除URL有效性检查缓存
 */
async function clearValidationCache() {
  try {
    await chrome.runtime.sendMessage({ action: 'clearValidationCache' });
    showNotification('缓存已清除', 'URL有效性检查缓存已清除', 'success');
  } catch (error) {
    console.error('清除缓存失败:', error);
    showNotification('清除失败', error.message, 'error');
  }
}

/**
 * 确认清除所有数据
 */
function confirmClearAllData() {
  // 使用更严格的确认对话框
  if (confirm('警告：这将删除所有设置和访问记录！此操作不可恢复。\n\n请在下面输入"删除"确认操作。')) {
    const confirmation = prompt('请输入"删除"确认操作');
    if (confirmation === '删除') {
      clearAllData();
    } else {
      showNotification('操作取消', '数据未删除', 'info');
    }
  }
}

/**
 * 清除所有数据
 */
async function clearAllData() {
  try {
    // 清除存储
    await chrome.storage.local.clear();
    
    // 重置表单
    fillSettingsForm(DEFAULT_SETTINGS);
    
    showNotification('数据已清除', '所
