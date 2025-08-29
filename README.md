# Summary

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

### Chrome Web Store / 官方页面

- English: Get it on the Chrome Web Store → <a href="https://chromewebstore.google.com/detail/summarizerx-ai-reader/okpefajonbfdnojdmobecjdajcohhoje?hl=en&authuser=0" target="_blank" rel="noopener noreferrer">SummarizerX AI Reader</a>
  - If you find it helpful, please consider leaving a **5-star review** — thank you!
- 中文：从 Chrome 应用商店安装 → <a href="https://chromewebstore.google.com/detail/summarizerx-ai-reader/okpefajonbfdnojdmobecjdajcohhoje?hl=en&authuser=0" target="_blank" rel="noopener noreferrer">SummarizerX AI Reader（官方页面）</a>
  - 如果觉得好用，诚邀给我们一个**五星好评**，非常感谢！

---

## English

Current stable: v1.7.4

**Summary** is a Chrome extension that helps you quickly extract, summarize, and translate webpage content with AI-powered enhancements. It offers a clean reading experience with customizable settings and a floating panel.

### ✨ Features

- 📰 Clean Content Extraction: Remove ads, navigation, and clutter for focused reading  
- 🤖 AI-Powered Summarization & Translation: Generate concise summaries or translations in one click  
- ⚙️ Customizable Settings: Adjust prompts, modes, shortcuts, and UI preferences  
- 📑 Floating Panel: View summaries without leaving the current page  
- 🌙 Theming Support: Light and dark modes for comfortable reading  
- 🖱️ Context Menu Translate: Right-click on selected text and instantly translate it with AI
 - 🧾 Full Page Translate: Translate the entire visible page; show translations inline as quote blocks under the originals, and toggle via context menu (Translate full page / Show original)
 - 🌍 Bilingual UI (中文/English): Switch in settings; all UI texts update instantly
- ⚡ Vue.js Integration: Modern reactive UI with improved performance and user experience

### 🖼 Screenshots

<p align="center">
  <img src="images/1.png" width="820" alt="Screenshot 1" />
</p>
<p align="center">
  <img src="images/2.png" width="820" alt="Screenshot 2" />
</p>
<p align="center">
  <img src="images/3.png" width="820" alt="Screenshot 3" />
</p>
<p align="center">
  <img src="images/4.png" width="820" alt="Screenshot 4" />
</p>
<p align="center">
  <img src="images/8.png" width="820" alt="Screenshot 8" />
</p>
<p align="center">
  <img src="images/9.png" width="820" alt="Screenshot 9" />
</p>

### 🚀 Installation

1. Clone the repository:  
   ```bash
   git clone https://github.com/mallocfeng/SummarizerX.git
   ```
2. Open Chrome extensions page: `chrome://extensions/`  
3. Enable **Developer Mode**  
4. Click **Load unpacked** and select the project folder  

> Note: Do not load ZIP files directly; unzip first.

### ⚡ Quick Start

- Click the **Summary** icon in the toolbar to open the floating panel  
- Select text or let it auto-extract the main content  
- Choose summarize or translate options  
- Customize prompts and modes in settings  
- Use the new **right-click menu** to translate selected text instantly
 - Use **Translate full page** from the right-click menu to insert translations below each paragraph as quote blocks; switch back via **Show original**

### ⚙️ Settings Reference

- **Prompt templates:** Customize AI instructions  
- **Default mode:** Summarize, translate, or AI rewrite  
- **Keyboard shortcuts:** Configure quick actions  
- **Theme:** Light or dark mode  

### 🎨 Theming

Supports light and dark themes to reduce eye strain and match your browser preferences.

### 🔒 Privacy

All processing happens locally or via your configured AI API key. No data is sent to third parties without your consent.

### 🛠 Troubleshooting

- If extraction fails, try selecting text manually  
- Reload the extension or browser if UI glitches occur  
- Check console logs for errors in developer tools  

### 🧭 Translation Mode — Output Rules

- **English**: In translation mode, AI outputs plain text only. No Markdown, no quotes, no extra commentary. Preserve paragraph breaks.
- **中文**：翻译模式下严格输出纯文本；不包含 Markdown/引号/额外说明，保持原段落换行。

## 中文简介

当前稳定版：v1.7.4

**Summary** 是一款 Chrome 浏览器扩展，利用 AI 技术快速提取、摘要和翻译网页内容，提供简洁流畅的阅读体验和丰富的个性化设置，支持浮动面板查看摘要。

### ✨ 功能亮点

- 📰 干净的内容提取：去除广告、导航和杂乱内容，专注阅读  
- 🤖 AI 驱动的摘要与翻译：一键生成简洁摘要或翻译  
- ⚙️ 个性化设置：自定义提示词、模式、快捷键和界面偏好  
- 📑 浮动面板：无需跳转页面即可查看摘要  
- 🌙 主题支持：明亮和暗黑模式，保护视力  
- 🖱️ 右键菜单翻译：在网页中选中文本，右键即可快速调用 AI 翻译
 - 🧾 全文翻译：将整页可见内容按段落翻译，在原文下方以引用块内联展示；可在右键菜单“全文翻译 / 显示原文”间切换  
 - 🌍 双语界面（中文/English）：设置页可切换语言，界面文案即时更新
 - ⚡ Vue.js 集成：现代化响应式界面，提升性能和用户体验

### 🖼 软件截图

<p align="center">
  <img src="images/1.png" width="820" alt="截图 1" />
</p>
<p align="center">
  <img src="images/2.png" width="820" alt="截图 2" />
</p>
<p align="center">
  <img src="images/3.png" width="820" alt="截图 3" />
</p>
<p align="center">
  <img src="images/4.png" width="820" alt="截图 4" />
</p>
<p align="center">
  <img src="images/8.png" width="820" alt="截图 8" />
</p>
<p align="center">
  <img src="images/9.png" width="820" alt="截图 9" />
</p>

### 🚀 安装方法

1. 克隆仓库：  
   ```bash
   git clone https://github.com/mallocfeng/SummarizerX.git
   ```
2. 打开 Chrome 扩展页面：`chrome://extensions/`  
3. 启用 **开发者模式**  
4. 点击 **加载已解压的扩展程序**，选择项目文件夹  

> 注意：请先解压，不要直接加载 ZIP 文件。

### ⚡ 快速开始

- 点击工具栏中的 **Summary** 图标，打开浮动面板  
- 选中文本或自动提取正文  
- 选择摘要或翻译功能  
- 在设置中自定义提示词和模式  
- 使用新增的 **右键菜单翻译** 功能，立即翻译所选文本
 - 在网页空白处右键选择 **全文翻译**，系统会在每段原文下方插入引用块译文；需要恢复时选择 **显示原文**
 - 使用 **全文翻译** 右键菜单，在原文下方以引用块展示译文，并可在“全文翻译 / 显示原文”间切换

### ⚙️ 设置说明

- **提示词模板：** 自定义 AI 指令  
- **默认模式：** 摘要、翻译或 AI 重写  
- **快捷键：** 配置快速操作  
- **主题：** 明亮或暗黑模式  

### 🎨 主题支持

支持明亮和暗黑主题，减少眼睛疲劳，适配浏览器偏好。

### 🔒 隐私说明

所有处理均在本地或通过您配置的 AI API 密钥完成，未经允许不会发送数据给第三方。

### 🛠 常见问题

- 提取失败时，尝试手动选中文本  
- UI 异常时，重启扩展或浏览器  
- 使用开发者工具查看控制台日志排查错误  

### 🧭 翻译模式输出规则

- **中文**：翻译模式下严格输出纯文本；不包含 Markdown/引号/额外说明，保持原段落换行。
- **English**: In translation mode, AI outputs plain text only. No Markdown, no quotes, no extra commentary. Preserve paragraph breaks.


## 📜 License

MIT License © 2025 [Malloc Feng](https://github.com/mallocfeng)