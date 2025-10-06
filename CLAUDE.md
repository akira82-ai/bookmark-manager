# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言偏好

**请使用中文进行交流、代码注释和文档编写。**

## 项目概述

Bookmark Manager 是一个智能书签管理 Chrome 扩展，具备智能提醒功能。基于 Manifest V3 构建，专注于隐私保护和本地性能。

## 核心架构

**扩展结构：**
- `manifest.json` - Manifest V3 配置文件
- `background.js` - Service Worker 处理核心功能、右键菜单和书签操作
- `content.js` - 内容脚本，智能提醒功能
- `popup.js/popup.html/popup.css` - 扩展弹窗界面
- `bookmarks.js/bookmarks.html/bookmarks.css` - 完整书签管理界面
- `metrics-judgment-engine.js` - 智能提醒引擎

**智能提醒系统：**
`MetricsJudgmentEngine` 实现三级行为分析模型：
1. 访问次数（50%权重）- 3天内域名访问频率
2. 浏览时长（30%权重）- 页面停留时间（30-180秒阈值）
3. 浏览深度（20%权重）- 滚动深度监控参与度

**数据存储：**
使用 Chrome Storage API 本地存储，无外部依赖。

## 开发流程

**加载扩展：**
1. Chrome: `chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序
2. Edge: `edge://extensions/` → 开发人员模式 → 加载解压缩的扩展

**调试方式：**
- Service Worker: 扩展页面 → Service worker 链接 → DevTools
- 弹窗: 右键扩展图标 → 检查弹出内容
- 内容脚本: 任意页面 DevTools → 控制台

**开发命令：**
本项目是纯 Chrome 扩展项目，无需传统构建工具。开发流程如下：
```bash
# 加载/重新加载扩展
# 在Chrome扩展管理页面点击"重新加载"按钮

# 查看Service Worker日志
# Chrome扩展页面 → Service worker → 链接 → DevTools控制台

# 测试代码更改
# 1. 修改相应文件
# 2. 在扩展管理页面重新加载扩展
# 3. 测试功能是否正常
```

**文件修改后重新加载：**
- 修改 `background.js`、`content.js` 或 `manifest.json`：需要重新加载整个扩展
- 修改 `popup.*` 文件：关闭重新打开弹窗即可
- 修改 `bookmarks.*` 文件：刷新书签管理页面即可

## 开发规范

**代码质量：**
- 每次提交必须扩展功能正常且通过测试
- 遵循项目现有的代码风格和命名规范
- 提交前自审更改，确保功能完整性
- 提交信息要说明"为什么"而非"做了什么"

**错误处理：**
- 快速失败并提供描述性消息
- 包含调试上下文
- 适当级别处理错误
- 绝不静默吞并异常

**架构原则：**
- 组合优于继承，使用依赖注入
- 接口优于单例，便于测试和灵活性
- 显式优于隐式，清晰的数据流和依赖
- 尽可能测试驱动，绝不禁用测试

**关键设计模式：**
- 事件驱动架构 - Service Worker处理核心事件
- 消息传递 - 跨脚本通信使用Chrome消息API
- 类组件设计 - UI组件采用面向对象设计
- 异步处理 - 链接检测和API调用使用async/await

## 重要限制

- **无云端同步** - 数据仅本地存储，需手动备份
- **无高级分析** - 无书签分类、标签系统或趋势分析
- **浏览器兼容性** - Chrome 90+/Edge 90+，Firefox 支持计划中

## 项目特定信息

**权限使用：**
- `storage`: 本地数据存储
- `tabs`: 获取当前标签页信息
- `bookmarks`: 读取和创建书签
- `history`: 访问历史记录（智能提醒功能）
- `contextMenus`: 右键菜单功能
- `notifications`: 系统通知
- `activeTab`: 获取当前活动标签页

**核心功能实现：**
- 智能提醒：`MetricsJudgmentEngine` 类实现多维度分析
- 链接检测：`LinkChecker` 类实现批量检测
- 书签管理：事件委托和异步处理优化性能
- 数据持久化：Chrome Storage API 分层存储

**调试技巧：**
- 使用 `chrome.storage.local.get()` 查看存储数据
- Service Worker 控制台查看后台日志
- 内容脚本使用 `console.log()` 输出到页面控制台
- 使用 Chrome DevTools 断点调试 JavaScript 代码

## 技术栈说明

**前端技术：**
- **原生HTML5/CSS3/JavaScript** - 无框架依赖，纯原生实现
- **Chrome Extension API** - Manifest V3标准
- **CSS Grid/Flexbox** - 现代布局技术
- **ES6+** - 现代JavaScript语法

**设计原则：**
- **零依赖** - 不依赖任何第三方库或框架
- **轻量级** - 代码体积小，加载速度快
- **高性能** - 优化的DOM操作和事件处理
- **可维护** - 清晰的代码结构和注释

