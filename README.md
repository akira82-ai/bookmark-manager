# 📚 Bookmark Manager - 智能书签管理器

<div align="center">

![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-brightgreen?style=for-the-badge&logo=googlechrome)
![Edge Add-ons](https://img.shields.io/badge/Edge-Add%20Ons-brightgreen?style=for-the-badge&logo=microsoftedge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Stars](https://img.shields.io/github/stars/akira82-ai/bookmark-manager?style=for-the-badge&logo=github)
![Forks](https://img.shields.io/github/forks/akira82-ai/bookmark-manager?style=for-the-badge&logo=github)

**一款现代化的智能书签管理器，让您的书签管理变得简单高效**

[产品哲学](#-产品哲学) • [功能亮点](#-功能亮点) • [技术亮点](#-技术亮点) • [局限性](#-局限性) • [安装指南](#-安装指南) • [使用演示](#-使用演示) • [更新日志](#-更新日志)

</div>

---

## 🎯 产品哲学

**技术向善，正道而行**

- **数据自主权** - 坚信用户的个人数据应该完全由用户掌控，这是数字时代的基本权利
- **技术赋能** - 用真正的技术实力为用户创造价值，而非用营销话术包装平庸产品
- **长期主义** - 做经得起时间考验的产品，不为短期利益牺牲用户体验

---

## ✨ 功能亮点

### 🧠 智能书签提醒 - 从不忘记收藏
- 当您频繁访问某个网站时，会智能弹出收藏建议
- 提供4个层级选项（主域名、子域名、路径等），想收藏哪个就收藏哪个
- 5档敏感度调节，从不打扰到贴心提醒，随您喜好设置
- 每个网址只提醒一次，烦人程度降到最低

### 🔗 链接健康检测 - 告别死链烦恼
- 一键检测所有书签，自动标记失效链接
- 智能识别重定向，帮您更新到最新地址
- 批量清理死链，让您的书签保持整洁

### 🚀 便捷操作体验 - 书签管理从未如此简单
- 浏览网页时右键即可添加到「最近收藏」
- 点击插件图标快速查看和访问书签
- 支持搜索、批量操作，整理书签效率翻倍

---

## 🛠️ 技术亮点

### 🎯 事件驱动智能提醒引擎
- 基于三大维度行为分析模型（访问频次、停留时长、浏览深度）构建实时触发机制
- 采用Set数据结构实现O(1)时间复杂度的URL去重管理，确保会话级别唯一提醒
- 多级敏感度配置算法，支持从「很少提醒」到「频繁提醒」的个性化阈值调节

### ⚡ 高并发异步处理架构
- 基于Promise.all的批量并发链接检测，显著提升大规模书签的健康检查效率
- async/await异步编程模式配合智能缓存策略，有效降低Chrome History API调用频次
- 事件委托机制优化DOM操作性能，支持数千书签的流畅渲染与交互

### 🔒 隐私优先本地化存储
- 采用Chrome Storage API构建全本地数据架构，零网络传输确保用户数据隐私安全
- 智能分层缓存设计，历史记录统计数据持久化存储避免重复查询
- 无服务器依赖架构，用户拥有完全的数据控制权与离线使用能力

---

## ⚠️ 局限性

### 本项目不提供以下功能：

**1. 跨浏览器同步功能**
- **不支持**多设备间的书签实时同步
- 数据仅存储在本地浏览器中，更换设备或重装浏览器会丢失数据
- 无法与Chrome账号的书签同步功能集成

**2. 云端备份与恢复**
- **不支持**云端备份，没有网络存储能力
- 无法提供版本历史记录或误删恢复功能
- 用户需要手动导出备份重要书签数据

**3. 高级书签分析**
- **不支持**书签分类、标签系统或智能文件夹
- 缺乏书签使用趋势分析、热力图等深度统计功能
- 无法识别重复书签或相似内容推荐

---

### 设计理念
这是一个专注于**个人隐私**和**本地性能**的书签管理工具，在安全性和便捷性之间选择了前者。如需云端同步等高级功能，建议配合使用第三方同步工具。

## 💿 安装指南

<div align="center">

### 🌟 支持的浏览器

| 浏览器 | 版本要求 | 安装状态 |
|--------|----------|----------|
| ![Chrome](https://img.shields.io/badge/Chrome-90+-brightgreen?style=for-the-badge&logo=googlechrome) | 90+ | ✅ 完全支持 |
| ![Edge](https://img.shields.io/badge/Edge-90+-brightgreen?style=for-the-badge&logo=microsoftedge) | 90+ | ✅ 完全支持 |
| ![Firefox](https://img.shields.io/badge/Firefox-Coming%20Soon-lightgrey?style=for-the-badge&logo=firefox) | - | 🚧 开发中 |

</div>

### 📥 快速安装

#### 🟡 Chrome 浏览器

1. **打开扩展管理页面**
   ```
   在地址栏输入: chrome://extensions/
   ```

2. **启用开发者模式**
   - 点击右上角的 **"开发者模式"** 开关

3. **加载扩展**
   - 点击 **"加载已解压的扩展程序"**
   - 选择 `bookmark-manager` 文件夹
   - ✅ 安装完成！

#### 🔵 Edge 浏览器

1. **打开扩展管理页面**
   ```
   在地址栏输入: edge://extensions/
   ```

2. **启用开发人员模式**
   - 点击左下角的 **"开发人员模式"** 开关

3. **加载扩展**
   - 点击 **"加载解压缩的扩展"**
   - 选择 `bookmark-manager` 文件夹
   - ✅ 安装完成！

### 🎯 首次使用

1. **寻找图标** - 在浏览器工具栏找到 ⭐️ 图标
2. **点击打开** - 点击图标，选择"打开书签管理器"
3. **开始使用** - 享受现代化的书签管理体验！

---

## 📋 更新日志

查看详细的更新历史：[更新日志](release.md)

### 🌟 最近更新 (v2.6 - 2025-09-25)
- 🎯 **明确产品哲学** - 技术向善，正道而行
- ✨ **提炼核心亮点** - 智能提醒、健康检测、便捷操作
- 🛠️ **展现技术实力** - 事件驱动引擎、高并发架构、隐私优先设计
- ⚠️ **诚实说明局限** - 云端同步、备份恢复、高级分析
- 📝 **重构文档结构** - 突出产品价值观和技术实力

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给我们一个Star！**

![Star History](https://img.shields.io/github/stars/akira82-ai/bookmark-manager?style=social)

</div>
