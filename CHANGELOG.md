# Changelog

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

## v1.6.8

### English
- 🖱️ New: Translate Selection via context menu (quick AI bubble translate).
- 🧾 New: Translate Full Page shows inline quote blocks under originals; toggle with Show Original.
- 🎨 Inline translation blocks now use an opaque light background in light mode with dark text, improving readability on dark sites.
- 🔄 Theme selection is synchronized in real-time between the settings page and the floating panel.
- 🧼 Minor polishing on settings footer alignment and meta text width.
 - 🧭 Translation mode now enforces PLAIN TEXT output: no Markdown, no extra commentary, preserved paragraph breaks.

### 中文
- 🖱️ 新增：右键翻译选中文本（在气泡中即时显示 AI 译文）。
- 🧾 新增：全文翻译，在原文下方内联显示引用块译文；可切换“显示原文”。
- 🎨 内联翻译区域在亮色模式下使用不透明浅灰底、深色文字，避免深色站点上看不清。
- 🔄 设置页与浮窗面板主题选择可实时双向同步。
- 🧼 设置页底部对齐与 meta 文本显示宽度小优化。
 - 🧭 翻译模式严格输出纯文本：不含 Markdown/额外说明，保持原段落换行。
