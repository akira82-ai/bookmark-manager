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

## 📖 使用指南

### 🚀 快速上手

#### 🔍 检测链接健康状态
1. 打开书签管理器
2. 选择要检测的文件夹
3. 点击 **"分类检测"** 按钮
4. 查看检测结果，支持批量操作

#### 📊 查看访问统计
1. 在书签卡片底部查看访问次数
2. 访问次数从浏览器历史记录实时获取
3. 根据访问热度了解您的浏览习惯

#### 🌙 切换深色模式
1. 点击侧边栏的主题切换按钮 🌙/☀️
2. 自动保存您的偏好设置
3. 享受护眼的深色主题

### 🎮 基本操作

| 操作 | 方法 |
|------|------|
| **打开书签** | 点击书签标题或卡片 |
| **编辑书签** | 右键菜单 → 编辑，或点击编辑按钮 |
| **删除书签** | 右键菜单 → 删除，或点击删除按钮 |
| **搜索书签** | 使用顶部搜索框，支持实时搜索 |
| **添加书签** | 弹出窗口 → "添加当前页面" |
| **移动书签** | 拖拽到目标文件夹，或使用编辑功能 |

---

## 🏗️ 技术架构

<div align="center">

### 🛠️ 技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| ![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=for-the-badge&logo=javascript) | 核心逻辑 | ES6+ |
| ![CSS3](https://img.shields.io/badge/CSS3-Modern-blue?style=for-the-badge&logo=css3) | 样式设计 | CSS3 |
| ![HTML5](https://img.shields.io/badge/HTML5-Semantic-orange?style=for-the-badge&logo=html5) | 页面结构 | HTML5 |
| ![Manifest V3](https://img.shields.io/badge/Manifest-V3-red?style=for-the-badge&logo=googlechrome) | 扩展标准 | V3 |

</div>

### 🎯 核心特性

#### 🔗 智能链接检测
```javascript
// 多线程并发检测，支持批量处理
async checkLinks(bookmarks) {
  const results = await Promise.all(
    bookmarks.map(bookmark => this.linkChecker.check(bookmark.url))
  );
  return this.groupResultsByStatus(results);
}
```

#### 📊 访问统计
```javascript
// 通过浏览器历史记录获取真实访问数据
async getVisitCount(url) {
  const visits = await chrome.history.getVisits({url});
  return visits.length; // 真实访问次数
}
```

#### 🎨 响应式设计
```css
/* 适配各种屏幕尺寸 */
@media (max-width: 767px) {
  .bookmarks-grid {
    grid-template-columns: 1fr;
  }
}
```

### 📁 项目结构

```
bookmark-manager/
├── 📋 manifest.json          # 扩展配置
├── 🌐 popup.html            # 弹出窗口
├── 📝 popup.js              # 弹出逻辑
├── 🎨 popup.css             # 弹出样式
├── 📚 bookmarks.html        # 主管理界面
├── ⚙️ bookmarks.js          # 核心业务逻辑
├── 🎭 bookmarks.css         # 界面样式
├── 🔧 background.js         # 后台服务
├── 🖼️ icons/                # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── 📜 release.md            # 更新日志
├── 📝 log.md               # 开发日志
└── 📖 README.md             # 项目说明
```

---

## 📈 性能特点

| 特性 | 描述 | 优势 |
|------|------|------|
| **⚡ 异步加载** | 书签数据异步加载 | 避免界面卡顿 |
| **🧠 智能缓存** | 访问统计缓存机制 | 减少重复查询 |
| **🎯 事件委托** | 高效事件处理 | 提升响应速度 |
| **📱 响应式** | 适配各种设备 | 完美用户体验 |
| **🔒 隐私保护** | 数据本地存储 | 安全可靠 |

---

## 🤝 贡献指南

我们欢迎任何形式的贡献！无论是发现问题、提出建议，还是直接提交代码。

### 🚀 如何贡献

1. **Fork 本项目**
2. **创建功能分支** (`git checkout -b feature/AmazingFeature`)
3. **提交更改** (`git commit -m 'Add some AmazingFeature'`)
4. **推送分支** (`git push origin feature/AmazingFeature`)
5. **创建 Pull Request**

### 🐛 问题反馈

- 📋 **功能请求** - [创建 Issue](https://github.com/akira82-ai/bookmark-manager/issues/new?template=feature_request.md)
- 🐞 **Bug 报告** - [创建 Issue](https://github.com/akira82-ai/bookmark-manager/issues/new?template=bug_report.md)
- 💡 **改进建议** - [创建 Issue](https://github.com/akira82-ai/bookmark-manager/issues/new?template=improvement.md)

### 📝 开发规范

- ✅ 遵循 ESLint 代码规范
- ✅ 添加必要的注释和文档
- ✅ 确保所有功能正常工作
- ✅ 更新相关文档

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

- 💚 **贡献者** - 感谢所有提交代码和提出建议的朋友
- 🌟 **用户** - 感谢使用和支持本项目的用户
- 📚 **开源社区** - 感谢开源软件生态系统的支持

---

<div align="center">

**如果这个项目对您有帮助，请考虑给我们一个 ⭐️**

[![Star History Chart](https://api.star-history.com/svg?repos=akira82-ai/bookmark-manager&type=Date)](https://star-history.com/#akira82-ai/bookmark-manager&Date)

</div>

---

## 📋 更新日志

查看详细的更新历史：[更新日志](release.md)

### 🌟 最近更新 (2025-09-16)
- ✨ **智能链接检测** - 批量检测链接有效性，告别死链烦恼
- 📊 **访问统计功能** - 真实访问次数统计，了解浏览习惯
- 🎨 **界面优化** - 简约设计，提升用户体验
- 🌙 **深色模式** - 完整的深色主题支持
- ⚡ **性能优化** - 多线程并发，响应更迅速

---

<div align="center">

## 📞 联系我们

| 方式 | 链接 |
|------|------|
| **GitHub Issues** | [问题反馈](https://github.com/akira82-ai/bookmark-manager/issues) |
| **作者邮箱** | [联系作者](mailto:your-email@example.com) |
| **项目主页** | [GitHub](https://github.com/akira82-ai/bookmark-manager) |

---

**⭐ 如果这个项目对您有帮助，请给我们一个Star！**

![Star History](https://img.shields.io/github/stars/akira82-ai/bookmark-manager?style=social)

</div>
