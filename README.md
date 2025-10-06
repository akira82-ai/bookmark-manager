# 📚 Bookmark Manager - 智能书签管理器

<div align="center">

![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-brightgreen?style=for-the-badge&logo=googlechrome)
![Edge Add-ons](https://img.shields.io/badge/Edge-Add%20Ons-brightgreen?style=for-the-badge&logo=microsoftedge)
![Version](https://img.shields.io/badge/Version-3.0.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Stars](https://img.shields.io/github/stars/akira82-ai/bookmark-manager?style=for-the-badge&logo=github)

**一款功能强大、注重隐私的智能书签管理Chrome扩展，基于事件驱动架构和智能行为分析**

[产品哲学](#-产品哲学) • [核心功能](#-核心功能) • [技术架构](#-技术架构) • [安装使用](#-安装使用) • [开发文档](#-开发文档)

</div>

---

## 🎯 产品哲学

**技术向善，正道而行**

- **数据自主权** - 坚信用户的个人数据应该完全由用户掌控，采用纯本地存储架构，零云端依赖
- **技术赋能** - 用真正的技术实力为用户创造价值，基于事件驱动的高性能架构设计
- **长期主义** - 做经得起时间考验的产品，不为短期利益牺牲用户体验和隐私安全

---

## ✨ 核心功能

### 🧠 智能书签提醒系统
- **三级行为分析模型** - 基于访问次数(50%)、浏览时长(30%)、浏览深度(20%)的多维度智能分析
- **5级敏感度调节** - 支持从"很少提醒"到"频繁提醒"的个性化提醒设置
- **收藏夹感知提醒** - 智能检测已收藏内容，避免重复提醒，确保用户体验的精准性
- **事件驱动触发** - 零轮询架构，毫秒级实时响应，每个URL会话期间仅提醒一次

### 🔗 链接健康检测系统
- **批量并发检测** - 基于Promise.all()的高效并发架构，支持大规模书签快速检测
- **智能分类管理** - 自动识别有效链接、重定向、超时和失效链接，提供分类处理建议
- **实时状态反馈** - 检测过程可视化，提供详细的状态信息和错误诊断

### 🚀 现代化书签管理界面
- **完整书签管理器** - 独立网页界面(bookmarks.html)，支持树状文件夹结构和双视图模式
- **优雅下划线选中状态** - v3.0.0全新UI设计，采用现代化下划线交互效果
- **书签搜索功能** - 支持关键词高亮显示，快速定位所需书签
- **基础右键菜单** - 浏览器原生右键菜单快速添加，支持页面和链接收藏

### 🌙 深色模式与响应式设计
- **完整深色模式** - 基于CSS变量系统的主题切换，支持智能记忆用户偏好
- **响应式布局** - 支持大、中、小三种屏幕尺寸的自适应布局
- **现代化UI组件** - 采用CSS Grid/Flexbox布局，提供流畅的用户交互体验

---

## 🛠️ 技术架构

### 📋 项目概览
- **代码规模**: 8,400+ 行高质量JavaScript/HTML/CSS代码
- **架构模式**: Manifest V3 + Service Worker + 事件驱动
- **技术栈**: 纯原生JavaScript (ES6+)，零第三方依赖
- **浏览器兼容**: Chrome 90+/Edge 90+，Firefox支持计划中

### ⚡ 高性能异步处理架构
- **并发链接检测** - Promise.all()批量处理，显著提升检测效率
- **智能缓存策略** - Chrome History API调用优化，有效降低查询频次
- **事件委托优化** - DOM操作性能优化，支持数千书签流畅渲染

### 🔒 隐私优先本地化存储
- **Chrome Storage API** - 全本地数据架构，零网络传输
- **分层缓存设计** - 历史记录统计数据持久化存储
- **无服务器依赖** - 用户拥有完全的数据控制权

---

## 💿 安装使用

### 🌟 支持的浏览器

| 浏览器 | 版本要求 | 安装状态 | 支持程度 |
|--------|----------|----------|----------|
| ![Chrome](https://img.shields.io/badge/Chrome-90+-brightgreen?style=for-the-badge&logo=googlechrome) | 90+ | ✅ 完全支持 | 100% |
| ![Edge](https://img.shields.io/badge/Edge-90+-brightgreen?style=for-the-badge&logo=microsoftedge) | 90+ | ✅ 完全支持 | 100% |
| ![Firefox](https://img.shields.io/badge/Firefox-Planning-lightgrey?style=for-the-badge&logo=firefox) | - | 🚧 开发计划 | 待定 |

### 📦 安装步骤

#### Chrome 浏览器
1. **启用开发者模式**
   ```
   访问: chrome://extensions/
   启用: 右上角"开发者模式"开关
   ```

2. **加载扩展**
   ```
   点击: "加载已解压的扩展程序"
   选择: bookmark-manager 文件夹
   ```

#### Edge 浏览器
1. **启用开发人员模式**
   ```
   访问: edge://extensions/
   启用: 左下角"开发人员模式"开关
   ```

2. **加载扩展**
   ```
   点击: "加载解压缩的扩展"
   选择: bookmark-manager 文件夹
   ```

### 🎯 快速开始

1. **定位扩展图标** - 浏览器工具栏中的 ⭐️ 图标
2. **打开书签管理器** - 右键图标 → "打开书签管理器"
3. **启用智能提醒** - 在管理器中开启智能提醒开关，调整敏感度滑块
4. **开始智能收藏** - 浏览网页时享受智能提醒服务

---

## 📚 开发文档

### 📁 项目结构
```
bookmark-manager/
├── manifest.json           # Manifest V3配置 (v3.0.0)
├── background.js           # Service Worker (459行)
├── content.js             # 内容脚本 (2915行)
├── popup.js/html/css      # 扩展弹窗界面 (610行)
├── bookmarks.js/html/css  # 完整管理界面 (3754行)
├── metrics-judgment-engine.js # 智能引擎 (317行)
└── icons/                 # 扩展图标资源
```

### ⚙️ 权限说明
- `storage`: 本地数据存储
- `tabs`: 获取当前标签页信息
- `bookmarks`: 读取和创建书签
- `history`: 访问历史记录(智能提醒)
- `contextMenus`: 右键菜单功能
- `notifications`: 系统通知
- `activeTab`: 获取当前活动标签页

---

## 📋 更新日志

### 🌟 v3.0.0 - 全新UI设计 (最新版本)
- 🎨 优雅下划线选中状态 - 全新UI设计语言，现代化交互体验
- 🎯 重要分类固定显示 - 「最近收藏」和「黑名单」固定在前两位
- 🌳 多级目录手风琴效果 - 支持任意层级折叠展开
- ⚡ 性能优化升级 - 事件驱动架构优化，响应速度提升

### 📊 历史版本亮点
- **v2.11.2** - 优化书签分类树UI设计和交互体验
- **v2.10.6** - 实现多级目录手风琴效果
- **v2.9** - 书签列表固定位置优化与多级分类方案
- **v2.8** - 收藏夹检查状态显示与事件驱动优化
- **v2.6** - 防止重复提醒优化

---

## ⚠️ 重要说明

### 🚫 功能限制
本项目坚持**隐私优先**原则，**不提供**以下功能：
- ❌ 跨浏览器书签同步
- ❌ 云端备份与恢复
- ❌ 高级书签分析(标签、分类、趋势)
- ❌ 第三方账号集成

### ✅ 设计优势
- ✅ **100%本地存储** - 数据完全由用户掌控
- ✅ **零网络依赖** - 离线使用，无隐私泄露风险
- ✅ **高性能架构** - 事件驱动，毫秒级响应
- ✅ **现代UI设计** - 符合Web标准，美观易用

---

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进项目！

### 📝 开发流程
1. Fork项目到个人仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

### 📋 代码规范
- 使用ES6+语法
- 遵循现有代码风格
- 添加适当的注释
- 确保功能正常工作

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给我们一个Star！**

**📧 联系我们**: [GitHub Issues](https://github.com/akira82-ai/bookmark-manager/issues)

**🔗 项目地址**: [https://github.com/akira82-ai/bookmark-manager](https://github.com/akira82-ai/bookmark-manager)

![Star History](https://img.shields.io/github/stars/akira82-ai/bookmark-manager?style=social)

</div>