# Changelog

## v1.7.6

### English
- 🌙 **Force Dark Mode**: New toggle in the floating panel footer to force dark mode on any webpage
- 🎨 **Text Color Optimization**: Automatically converts colored text to readable light colors for better contrast
- 💾 **Persistent Settings**: Force dark mode preference is saved and restored across sessions
- 🌐 **Internationalization**: Full support for Chinese and English UI text

### 中文
- 🌙 **强制深色模式**：浮动面板底部新增开关，可强制任何网页开启深色模式
- 🎨 **文字颜色优化**：自动将彩色文字转换为可读的亮色，确保对比度
- 💾 **设置持久化**：强制深色模式偏好会被保存并在会话间恢复
- 🌐 **国际化支持**：完整支持中英文界面文本

---

## v1.7.5

### English
- 🎯 **Smart Layout Alignment**: Improved full-page translation positioning for complex website layouts
- 🔧 **CSS Grid Support**: Translations now properly respect grid-area, grid-column, and justify-self properties
- 📱 **Responsive Design**: Auto margins and max-width ensure translations stay centered when browser window is resized
- 🎨 **Geometry Mirroring**: Translation blocks now copy original element's box constraints for better alignment
- 🐛 **Layout Fix**: Resolved issue where translated content appeared at page edges instead of matching article layout

### 中文
- 🎯 **智能布局对齐**：改进全文翻译在复杂网站布局中的定位
- 🔧 **CSS Grid 支持**：翻译块现在正确遵循 grid-area、grid-column 和 justify-self 属性
- 📱 **响应式设计**：自动边距和最大宽度确保浏览器窗口调整时翻译内容保持居中
- 🎨 **几何镜像**：翻译块现在复制原元素的盒模型约束以实现更好的对齐
- 🐛 **布局修复**：解决翻译内容显示在页面边缘而非文章布局位置的问题

---

## v1.7.4

### English
- ⚡ **Vue.js Integration**: Introduced Petite Vue for modern reactive UI components
- 🎨 **Enhanced UI/UX**: Improved floating panel and options page with better responsiveness
- 🔧 **Performance Optimization**: Refactored core components for better performance and maintainability
- 📱 **Better Responsiveness**: More fluid interactions and smoother animations
- 🧹 **Code Cleanup**: Streamlined codebase with modern JavaScript practices

### 中文
- ⚡ **Vue.js 集成**：引入 Petite Vue 实现现代化响应式界面组件
- 🎨 **界面体验优化**：改进浮动面板和设置页面，提升响应性和用户体验
- 🔧 **性能优化**：重构核心组件，提升性能和可维护性
- 📱 **更好的响应性**：更流畅的交互和更平滑的动画效果
- 🧹 **代码清理**：使用现代 JavaScript 实践优化代码结构

---

## v1.6.6

### English
We are excited to announce a new feature in **SummarizerX v1.6.6** 🎉  

- **Context Menu Translation**  
  Now you can **select text on any webpage**, right-click, and choose  
  **“SummarizerX: Translate Selection”** to instantly translate the highlighted content.  
  The translation will be shown in a lightweight floating bubble right next to your selection, without leaving the page.  

This makes SummarizerX more convenient for bilingual reading and quick translations while browsing.  

---

### 中文
我们很高兴在 **SummarizerX v1.6.6** 中推出一个全新功能 🎉  

- **右键菜单翻译**  
  现在你可以在网页中**选中文本**，然后右键点击，选择  
  **“SummarizerX：翻译所选文本”**，即可在页面中弹出的轻量气泡中即时查看翻译结果。  
  不需要跳转页面或复制粘贴，非常适合双语阅读和浏览时的快速翻译。  

---

## v1.6.7

### English
- ✨ Added bilingual UI (Chinese/English). Language switcher added to settings header.  
- 🔧 Introduced centralized `i18n.js` with `t()`, `tSync()`, `getCurrentLanguage()`, `updatePageLanguage()`.  
- 🎨 Localized texts across settings page, floating panel, and translation bubble.  
- 🧩 Context menu label now reflects UI language and output target.  
- 📝 Updated docs and internal structure for future languages.

### 中文
- ✨ 新增中英文双语界面（设置页顶部可切换）。  
- 🔧 引入统一的 `i18n.js`（含 `t()`、`tSync()`、`getCurrentLanguage()`、`updatePageLanguage()`）。  
- 🎨 设置页、浮窗面板、翻译气泡全面本地化。  
- 🧩 右键菜单标题会根据 UI 语言与目标语言同步变化。  
- 📝 完善文档与工程结构，便于后续扩展更多语言。

---

## v1.7.1

### English (Patch)
- 🛠 Fix: Options – auto-hide API key when switching to Trial even if eye toggle was previously open.

### 中文（补丁）
- 🛠 修复：切换到试用模式时自动隐藏 API Key，即便之前“眼睛”处于打开状态。

---

## v1.7.0

### English (Stable)
- 🖱️ Translate Selection via context menu (quick AI bubble translate).
- 🧾 Translate Full Page with inline quote blocks; toggle with Show Original.
- 🎨 Inline translations respect theme with improved light/dark readability.
- 🔄 Real-time theme sync between settings and floating panel.
- 🧼 UI polish on settings alignment and meta width.
- 🧭 Translation mode enforces PLAIN TEXT output (no Markdown/extras).
- 🐛 Fix: context menu title stays in sync with inline translation state (reset on navigation, cleanup on tab close, immediate update on state change).

### 中文（稳定版）
- 🖱️ 右键翻译选中文本（气泡即时显示 AI 译文）。
- 🧾 全文翻译：原文下方内联显示引用块译文；可切换“显示原文”。
- 🎨 内联翻译块随主题联动，亮/暗模式可读性更好。
- 🔄 设置页与浮窗面板主题选择实时双向同步。
- 🧼 设置页底部对齐与 meta 文本显示宽度优化。
- 🧭 翻译模式严格输出纯文本：不含 Markdown/额外说明，保持原段落换行。
- 🐛 修复：右键菜单标题与内联翻译实际状态保持同步（导航重置、标签页关闭清理、状态变更即时更新）。
