# Changelog

# v2.3.13 - 2026-01-19

### English
- Share card image: refreshed to a flatter style with tighter corner radius, cleaner header band, and simplified borders for better readability.
- Summary card: added a title block above key points, with output-language label and auto-translation to match the configured output language.
- Title translation caching: cached translated titles locally to avoid repeated translation calls and improve load smoothness.
- Layout polish: fixed history badge overlap with the new title block.

### 中文
- 分享卡片图片：升级为扁平风格，圆角更小、标题区更清爽、边框更简洁，提升观感与可读性。
- 摘要卡片：在要点前加入标题块，标签随输出语言切换，并自动翻译标题以匹配输出语言。
- 标题翻译缓存：本地缓存已翻译标题，避免重复请求，加载更顺滑。
- 布局细节：修复历史标记与标题块的重叠问题。

## v2.3.12 - 2025-12-03

### English
- Fix: Updated the NYTimes subscription blocker so the optional toggle also hides the newly introduced sticky bottom upsell banner without touching other site UI.
- Polish: README/Chrome listing copy now clarifies the fix and keeps the stable/beta badges aligned with v2.3.12 for the release.

### 中文
- 修复：纽约时报订阅屏蔽开关现已覆盖最新上线的底部粘性订阅浮层，同时保持站内其它界面不受影响。
- 优化：README 与说明同步更新，稳定/测试版本号统一为 v2.3.12，方便追踪最新版本。

## v2.3.11 - 2025-11-11

### English
- Feature: Added a “triple-space” typing shortcut—press the spacebar three times in any editable field to instantly translate your draft to English via the configured AI backend, complete with a sticky spinner badge and caret restore.
- UX: Inline translation quote blocks now surface a speaker icon (matching the selection bubble control) whenever English text is translated to Chinese, letting you hear the original via speech synthesis without re-opening the floating panel.
- Polish: The typing spinner inherits the user’s light/dark theme, and failures now show the exact error returned by the backend so you can quickly fix missing API keys or quota issues.

### 中文
- 新功能：在任意输入框/可编辑区域输入内容后连按三次空格，即可调用当前 AI 设置自动翻译成英文，过程中会显示跟随视图的悬浮指示并恢复光标位置。
- 体验：全文对照的每段译文与选区浮窗一致，在英文译中文时会出现朗读图标，可直接朗读原文，无需重新打开浮窗。
- 优化：三连空格的提示气泡会跟随亮/暗皮肤变化，翻译失败会展示具体报错信息，方便快速排查 API Key 或额度问题。

# v2.3.9 - 2025-09-27

### English
- UX: Added a speech button to the selection translation bubble that appears when translating English into Chinese, letting you play the original text via the browser's speech synthesis without extra permissions.
- Polish: Tuned language detection and bubble layout so the speak control only shows when useful and aligns with neighbouring buttons.

### 中文
- 体验：在选区翻译面板中新增朗读按钮，当英文翻译成中文时可直接调用浏览器语音朗读原文，无需额外权限。
- 优化：调整语言判定与浮窗排版，仅在合适场景显示朗读按钮，并让图标与周围控件对齐。

## v2.3.8 - 2025-09-26

### English
- UX: Refined the sidepanel empty-state hint with clearer copy about using the context menu for full-page or selection translation, tightened spacing, and ensured the floating arrow sits correctly under the run button.

### 中文
- 体验：优化侧边栏空状态提示，明确说明可通过右键菜单翻译全文或选区，同时调整间距与箭头定位，让提示在默认高度下完整呈现。

## v2.3.7 - 2025-09-25

### English
- Feature: Added first-class presets for Anthropic Claude, Google Gemini, and Azure OpenAI alongside existing OpenAI/DeepSeek/custom options, including tailored API-key testing and helper guides.
- UX: Settings picker now highlights the active provider guide and buy links for all supported platforms.

### 中文
- 新功能：新增 Anthropic Claude、Google Gemini、Azure OpenAI 的预设支持，连同原有的 OpenAI/DeepSeek/自定义，可直接填写并测试 API Key。
- 体验：设置页会根据所选平台突出对应的购买/开通指引链接，方便快速跳转。

## v2.3.6 - 2025-09-24

### English
- Feature: Added cross-device settings snapshots that persist AI provider/API keys, language, prompts, and ad-filter preferences through `chrome.storage.sync`, plus a local cache for fast reads.
- Behavior: When synced settings enable Ad Filtering with lists selected, the background worker now auto-downloads the corresponding rules on each device so list choices stay in lockstep.
- UX: Removed the forced page scroll used to trigger lazy loaders while running “Extract & Summarize”, eliminating the brief jump some pages exhibited at kickoff.

### 中文
- 新功能：引入跨设备设置快照，通过 `chrome.storage.sync` 同步 AI 平台/API Key、语言、提示词、广告过滤等配置，并在本地存一份缓存加速读取。
- 行为优化：同步到启用广告过滤且勾选列表的配置后，后台会在各设备上自动下载对应规则，保持列表选择一致。
- 体验：移除先前触发懒加载的强制滚动，解决“提取并摘要”启动时页面轻微跳动的问题。

## v2.3.5 - 2025-09-23

### English
- Feature: Added per-page/PDF summary history with automatic recall. The panel now reuses the latest saved summary when reopened and lets you browse, copy, apply, or delete past outputs from a floating “History” popover.
- UX: Summary card toolbar gains a History button; the history badge styling was refined so the timestamp chip leaves consistent spacing above the card content.

### 中文
- 新功能：新增按页面/PDF 保存的摘要历史并支持自动回填。重新打开浮窗时会优先恢复最近的摘要，并可通过“历史”弹窗浏览、复制、套用或删除以往结果。
- 体验优化：摘要卡片工具栏新增历史按钮，同时重新调整历史标签与正文的间距，让“历史 · 刚刚”提示与内容排版更协调。

## v2.3.4 - 2025-09-22

### English
- Fix: Disable "Extract & Summarize" while the PDF card is open until a PDF is fully loaded and the page/range selection is valid. Prevents accidental runs that led to inconsistent states.
- Behavior: Button re-enables automatically after PDF loads and inputs validate; closes or hides the PDF card restores normal behavior.

### 中文
- 修复：当 PDF 卡片打开时，禁用“提取并摘要”按钮，直到 PDF 成功加载且页码/范围有效为止，避免误触导致状态异常。
- 行为：PDF 加载完成且输入校验通过后自动恢复；关闭/隐藏 PDF 卡片后恢复正常。

## v2.3.3 - 2025-09-21

### English
- PDF Export (Reader Mode): Strip hyperlinks and normalize whitespace before rendering to prevent linked words (e.g., "rate cut") from being isolated on their own lines in the exported PDF.
- Text layout: Removed per-text-node extra spacing that could cause unintended breaks around previously linked words.
- Reliability: Keeps images inlined and preserves crisp A4 pagination.

### 中文
- PDF 导出（阅读模式）：在渲染前移除超链接并规范空白，避免带链接的词语（如 “rate cut”）在导出 PDF 时两端出现不必要的回行，单独占一行。
- 文本排版：移除逐文本节点的额外间距，减少因链接去除而出现的意外换行。
- 稳定性：继续内联图片，保持清晰的 A4 分页。

## v2.3.2 - 2025-01-XX

### English
- **PDF Export (Reader Mode)**: Robust CJK line wrapping
  - Force-break Chinese at 40 characters per line with a 90% width guard
  - Canvas-space pagination to prevent overlap/stretching
  - Multi-page slicing for crisp A4 PDFs without distortion
- Minor: Better stability when exporting long articles with images

### 中文
- **PDF 导出（阅读模式）**：增强中文换行
  - 中文每行最多 40 个汉字，且在 90% 宽度处保守换行
  - 在画布像素空间分页，避免重叠与拉伸
  - A4 多页切片导出，页面比例准确、清晰
- 其它：长文与图片导出稳定性优化

## v2.3.1 - 2025-01-XX

### English
- **Bug Fix**: Fixed Q&A chat context switching between PDF and web page content
  - Q&A now correctly follows the last summarization source (PDF or web page)
  - Chat context automatically switches when changing between PDF and web page summarization
  - Prevents confusion when PDF panel is hidden but PDF content should still be used for Q&A
  - Improved chat history management when switching content sources

### 中文
- **错误修复**: 修复了PDF和网页内容之间的问答聊天上下文切换问题
  - 问答现在正确跟随最后一次摘要的来源（PDF或网页）
  - 在PDF和网页摘要之间切换时，聊天上下文自动切换
  - 防止PDF面板隐藏时仍应使用PDF内容进行问答的混淆
  - 改进了切换内容源时的聊天历史管理

## v2.3.0 - 2025-01-XX

### English
- **PDF AI Summarization**: Major new feature supporting both local PDF files and online PDF URLs
  - Import PDFs via drag-and-drop or file picker in the floating side panel
  - Preview PDF pages with navigation controls (previous/next page, direct page input)
  - Select specific page ranges for AI summarization (e.g., "1-3,5" or "10-15")
  - Real-time page range validation with clear error messages
  - PDF text extraction and AI processing with the same providers (OpenAI, DeepSeek, Trial, Custom)
  - Integrated PDF.js for robust PDF rendering and text extraction
- **PDF Panel UI**: Dedicated PDF preview card with modern interface
  - Collapsible PDF panel with smooth animations
  - Page navigation toolbar with current page indicator
  - Range input with placeholder examples and validation
  - Error handling with user-friendly messages in both languages
  - Theme-aware styling (light/dark mode support)
- **Error Handling**: Improved PDF range validation and error clearing
  - Clear previous error messages when correcting page ranges
  - Automatic error clearing when starting new summarization runs
  - Bilingual error messages for better user guidance
- **Performance**: Optimized PDF processing with local PDF.js integration
  - No external dependencies for PDF handling
  - Efficient text extraction from PDF pages
  - Memory management for large PDF files

### 中文
- **PDF AI 摘要**：重大新功能，支持本地 PDF 文件和在线 PDF 链接
  - 在浮动侧边栏中通过拖拽或文件选择器导入 PDF
  - 预览 PDF 页面，支持导航控制（上一页/下一页、直接输入页码）
  - 选择特定页面范围进行 AI 摘要（例如："1-3,5" 或 "10-15"）
  - 实时页面范围验证，提供清晰的错误提示
  - PDF 文本提取和 AI 处理，支持所有现有提供商（OpenAI、DeepSeek、试用、自定义）
  - 集成 PDF.js 实现稳定的 PDF 渲染和文本提取
- **PDF 面板界面**：专用的 PDF 预览卡片，采用现代化界面
  - 可折叠的 PDF 面板，带有流畅动画
  - 页面导航工具栏，显示当前页码指示器
  - 范围输入框，带有示例占位符和验证
  - 错误处理，提供中英双语用户友好提示
  - 主题感知样式（支持明暗模式）
- **错误处理**：改进的 PDF 范围验证和错误清除
  - 修正页面范围时清除之前的错误消息
  - 开始新的摘要运行时自动清除错误
  - 双语错误消息，提供更好的用户指导
- **性能**：通过本地 PDF.js 集成优化 PDF 处理
  - PDF 处理无外部依赖
  - 高效的 PDF 页面文本提取
  - 大文件的内存管理

## v2.2.5-beta - 2025-09-18

### English
- New: Reader Mode — open via the book icon in the side panel; centered overlay with a frosted header, isolated scrolling that never scrolls the page, expanded side padding, and live theme sync (Auto/Light/Dark).
- Reader Mode overlay: Title bar stays frosted and always visible; the vertical scrollbar is now confined to the content area and never overlaps the Close button.
- Scroll containment: Continued wheel/middle‑click/trackpad scroll inside the overlay no longer scrolls the underlying page; touch scrolling is also contained. Mask layer absorbs scroll events.
- Padding: Increased inner horizontal padding for more comfortable reading, with responsive behavior preserved.
- Theme sync: Overlay now follows the panel theme (Auto/Light/Dark) in real time when toggled from the side panel.
- Icon polish: Replaced the book glyph with a clearer open‑book silhouette and switched to a distinct reader accent color that stands out on both light/dark themes; added a tooltip for the reader icon.
 - Ad Filtering indicator: OFF state is now a red shield with a white slash; ON remains a green shield with a check. Colors adapt to light/dark themes. Tooltip remains fast and prominent.
 - Fix: Force Dark Mode — masthead wordmarks now stay readable on nytimes.com and washingtonpost.com. The header logos are selectively lightened (invert/brightness) and black SVG fills are mapped to light text in both the Dark Reader path and our local fallback. Scope is limited to header/logo selectors to avoid over‑inversion of inline icons.

### 中文
- 新增：阅读模式（从侧栏标题行的小书图标进入）；居中浮窗，带磨砂标题栏；滚动事件被容器吸收不影响背景；两侧留白更宽；与外观（自动/浅色/深色）实时联动。
- 阅读模式浮窗：标题栏保持磨砂半透明并始终可见；垂直滚动条仅出现在正文区域，不再遮挡关闭按钮。
- 滚动隔离：在浮窗内继续滚动（鼠标滚轮/中键/触控板）不会再带动页面滚动；触摸滚动同样被容器捕获；遮罩层也会吞掉滚动事件。
- 边距：增大正文左右内边距，阅读更舒适（保留自适应）。
- 主题联动：从侧边栏切换外观（自动/浅色/深色）时，阅读浮窗的配色即时同步。
- 图标优化：更换更易识别的“打开的书”图标，并用更醒目的阅读强调色，在明暗主题下都有良好对比；为图标新增悬浮提示。
 - 广告过滤指示：关闭态改为红色盾牌 + 白色斜杠，开启态保持绿色带对勾；两种主题下对比清晰，提示气泡依旧醒目。
 - 修复：强制深色模式下，nytimes.com 与 washingtonpost.com 页首字标（The New York Times / The Washington Post）在暗底上自动反白，显著提升可读性。该修复同时覆盖 Dark Reader 动态引擎与本地回退样式，选择器仅作用于页首 logo，避免误伤站内其他图标。

## v2.2.3-beta - 2025-09-17

### English
- Ad Filtering toggle in panel: Redesigned the status icon (shield with check/slash), with a fast, prominent tooltip; fully accessible (role=switch) and keyboard‑toggleable; z-index fixes ensure the tooltip appears above the body.
- Quick toggle sync: Toggling ad filtering from the panel now writes to storage and the Options page live-syncs its UI without requiring a full reload (enabled switch, strength, selected lists, popup blocker, custom rules text).
- Network rules control: `adblock_enabled` now also enables/disables DNR (dynamic and session) site packs — rules are installed/removed immediately when toggled off/on, so closing the switch actually stops network-level blocking too.
- CSP compliance: Removed inline script injections. Replaced with extension-hosted stubs (`stubs/allow_popups.js`, `stubs/nyt-noads-shim.js`) to satisfy strict page CSPs.
- Options toasts: Removed Petite‑Vue usage in options app to avoid `unsafe-eval` under MV3 CSP; replaced with a lightweight vanilla implementation while keeping the same events and ARIA live region.
- Panel reliability: Action click prefers reusing an existing panel instance (ping/show) before re-injecting; fixed a duplicate `clampFloatWithinContainer` redeclaration edge case when reloading the panel.

### 中文
- 面板广告过滤开关：状态图标改为“盾牌 + 勾/斜杠”，提示气泡更大更快；支持键盘切换；修复层级，提示不会被主体遮挡。
- 快捷开关同步：从面板切换广告过滤后，设置页（若已打开）会即时联动（开关、强度、勾选列表、弹窗拦截、自定义规则文本），无需刷新。
- 网络规则联动：`adblock_enabled` 现在同时启用/移除 DNR（动态 + 会话）规则，关闭后立即停止网络级拦截。
- CSP 兼容：去除内联脚本注入，改为使用扩展资源脚本（`stubs/allow_popups.js`、`stubs/nyt-noads-shim.js`），避免严格 CSP 报错。
- 设置页提示：移除 Petite‑Vue 以消除 MV3 `unsafe-eval` 报错，改为原生轻量实现，保留原有事件与 ARIA。
- 面板稳定性：点击图标优先唤醒已存在的面板（ping/show），避免重复注入；修复二次注入下 `clampFloatWithinContainer` 重复声明的问题。

## v2.2.1-beta - 2025-09-16

### English
- Extraction: prefer the DOM-provided Markdown when available, normalize newlines, and fall back to saved custom Markdown or auto-converted text.
- Fast mode body reuses the sanitized Markdown so the summary and readable body stay consistent.
- Cleaner heuristics skip navigation/aside sections via tag and ARIA role detection, treat block containers recursively, and honor `<br>` for better spacing.
- Version: bumped to 2.2.1-beta.

### 中文
- 正文提取：优先使用内容脚本返回的 Markdown，并标准化换行；若无则回退到自定义 Markdown 或自动转换文本。
- 快速模式正文复用同一份清洗后的 Markdown，让摘要与正文内容保持一致。
- 清理规则：通过标签和 ARIA role 识别导航/侧边栏，递归处理块级容器、保留 `<br>`，减少多余空行。
- 版本：升级至 2.2.1-beta。

## v2.2.0-beta - 2025-09-15

### English
- Q&A Chat Mode: Bottom bar now supports page-scoped Q&A with continuous bubbles (user right, AI left). Typing indicator (three bouncing dots), clean Markdown rendering, and smart scroll (align top for long answers, scroll to bottom for short ones).
- Inline Translate Zoom: Per-paragraph +/- for long quotes; controls pinned top-right; hover lift; non-overlapping text.
- UX Polish: Reduced paragraph spacing inside chat bubbles; increased bubble padding; removed first-replace flicker; cleaned extra breaks only within chat bubbles.
- Panel Behavior: Q&A send auto-expands the panel (same as summarize) with progress bar; summary/cleaned cards hide during ask; clicking Summarize fades chat away and restores the two cards.
- Adblock Safety: Do not hide ChatGPT/OpenAI sticky UI when collapsing floating overlays.

### 中文
- 你问我答（气泡模式）：底部输入支持基于当前网页的连续对话，用户气泡在右、AI 气泡在左；新增三点打字指示；Markdown 排版整洁；智能滚动（长答顶部对齐，短答自动滚底）。
- 全文对照放大：对较长段落的引用块提供 +/- 放缩；按钮固定在右上角并带轻微悬停上浮；文本不与按钮重叠。
- 交互优化：气泡内段落间距更紧凑；气泡内边距更舒适；首次替换不闪烁；仅在聊天域清理多余换行，不影响摘要/正文。
- 面板行为：发送后自动展开浮窗并显示顶部进度条；对话期间隐藏“摘要/正文”；点击“提取并摘要”淡出对话并恢复两卡模式。
- 广告过滤安全：避免在 ChatGPT/OpenAI 站点上误隐藏粘附式界面元素。

## v2.1.1 - 2025-09-14

### English
- Inline translate: Added per-paragraph zoom controls (+ / −) for long translated quotes; zoom only affects the current quote.
- UX: Reserve right padding to avoid text overlapping controls; center glyphs in buttons for better alignment.
- UI: Pin the +/- controls to the top-right of each quote so they don’t shift while zooming; add a subtle hover lift for feedback.
- Version: Bumped to 2.1.1.

### 中文
- 全文对照：为较长段落的内联译文块新增 +/- 放大缩小按钮；仅作用于当前段落。
- 交互：自动为右侧按钮预留内边距，避免与文字遮挡；优化按钮图标的居中显示。
- 体验：将 +/- 固定在段落右上角，缩放时按钮不再随文字漂移；悬停有轻微上浮反馈。
- 版本：升级至 2.1.1。

## v2.1.0 - 2025-09-14

### English
- Fix: Prevented the floating overlay cleaner from hiding ChatGPT’s bottom‑left avatar/settings panel on `chatgpt.com`.
- Safety: Added a domain safeguard in `collapseFloatingOverlays()` to skip ChatGPT/OpenAI properties.
- Version: Bumped extension version to 2.1.0 in `manifest.json`.

### 中文
- 修复：广告浮层清理会误伤 ChatGPT 左下角头像/设置区的问题（`chatgpt.com`）。
- 安全：为 ChatGPT/OpenAI 域名加入白名单保护，跳过浮动层清理逻辑。
- 版本：`manifest.json` 升级为 2.1.0。

## v2.0.9-beta

### English
- Float panel: Added a coordinated “Hide element” control (icon + label) next to Force Dark.
- Picker UX: Clicking Confirm now exits picking mode immediately; clicking Cancel returns to picking; Esc exits.
- Reliability: Confirmation dialog no longer blocked by global capture; works consistently.
- Generalized selectors: Prefer stable IDs and simple, stable class tokens; fall back to heading tags (h1–h3) if necessary. Improves reusability across the same site.
- Batch hide on confirm: Immediately hides all elements matching the generated selector for instant feedback; the rule is saved under user hides (per-domain cosmetic) and applied by the engine.
- Settings: Inline hint to recommend Medium strength when using custom/user rules; i18n for all new strings.

### 中文
- 浮窗面板：在“强制深色”旁新增“隐藏元素”控件（图标 + 文字），风格统一。
- 选择器交互：点击“确认添加”后立即退出隐藏模式；点击“取消”则继续框选；按 Esc 退出。
- 稳定性：确认对话框不再被全局捕获阻挡，按钮可正常点击。
- 通用选择器：优先稳定 ID 和简单稳定类名；必要时回退到标题标签（h1–h3），提升同站点复用性。
- 批量隐藏：确认后立即隐藏当前页所有匹配的元素，并保存到“用户隐藏（按域名）”规则，由引擎统一应用。
- 设置：在“过滤强度”右侧加入提示——使用自定义/用户规则时，推荐选择“中”；相关文案均已双语化。

## v2.0.8-beta

### English
- Ad Filtering → Custom rules: Added a bottom section to import custom lists from URL (txt) with strict validation and to save fully manual rules via a large textarea. Both appear as selectable items with per-item sync (URL lists) and a section-level “Update All”.
- Validation: Reject unsupported network/scriptlet rules (e.g., `||`, `@@`, `$`, `##+js(...)`); allow only cosmetic subset (##, ###, #@#) with domain scoping and negations.
- i18n: All new labels, placeholders, buttons, and the syntax guide localized (中文/English). Integrated with the existing language switcher.

### 中文
- 广告过滤 → 自定义规则：在底部新增“自定义规则”区域，支持两种方式：
  1) 通过 URL 导入 txt（下载后严格校验，合格才允许添加）；
  2) 完全自定义（大文本框输入）。
  导入/保存后会显示在“自定义规则”列表，可勾选启用；带 URL 的条目支持逐条/全部更新。
- 校验：拒绝不支持的网络/脚本规则（如 `||`、`@@`、`$`、`##+js(...)`），仅允许外观隐藏子集（##、###、#@#），支持域名与否定域名。
- 多语言：新增标题、按钮、占位符与语法说明的中英双语，并与现有语言切换联动。

## v2.0.7-beta

### English
- Ad Filtering UI: The first four controls (Enable ad filtering / Popup blocking / NYTimes upsell / Strength) are now stacked vertically with a small right indent for cleaner layout.
- NYTimes upsell control: Added a dedicated toggle to hide the “Family subscriptions / All Access Family” floating upsell popup; fully localized (中文/English).
- Fresh install defaults: Ad filtering, popup blocking, and NYTimes upsell hiding are OFF by default.
- Housekeeping: Removed obsolete `RELEASE_NOTES_v1.9.0.md`.

### 中文
- 广告过滤 UI：顶部四项（启用广告过滤 / 弹窗拦截 / 纽约时报浮窗 / 过滤强度）改为竖向排列，并整体右侧缩进，版面更整洁。
- 纽约时报浮窗：新增独立开关，屏蔽 “Family subscriptions / All Access Family” 浮动弹窗；支持中英双语。
- 初装默认：广告过滤开关、弹窗拦截、纽约时报浮窗屏蔽均为关闭状态。
- 清理：移除 `RELEASE_NOTES_v1.9.0.md` 旧文件。

## v2.0.6

### English
- Settings UI: Added top tabs (AI Summary / Ad Filtering) with i18n text; the page now separates AI configuration (Basic, System Prompt, Shortcuts) from Ad Filtering for clearer navigation.
- Tab polish: Converted to three‑sided rounded boxes (top/left/right), subtle tint, low‑contrast border, and a gentle glow for the active tab.
- Active underline: Kept a center‑strong gradient line that fades to the edges; it now moves in sync with the first card’s hover lift for a more natural connection.
- Visual alignment: Eliminated the gap between header and first card; unified header/card background to remove color shift; softened top‑left highlight.
- Accessibility: Increased tab label size/weight; i18n for tab titles (English/中文); maintained focus and reduced motion compatibility.

- Adblock: NYTimes pre-roll filtering now uses a safer strategy (limit to DoubleClick/Google Ads/gampad; remove IMA override; improved auto-skip); synced related logic.

### 中文
- 设置页：新增顶部标签（AI 摘要 / 广告过滤），并支持中英双语；将“基础配置 + 系统提示词 + 快捷键”与“广告过滤”分栏展示，结构更清晰。
- 标签样式：三面边框（上/左/右）圆角小方框；激活态为浅色微底纹、低对比度描边和轻微发光，低调不刺眼。
- 渐变下划线：保留“中间最亮，两侧渐隐”的蓝色横线，并与第一张卡片上浮联动，上下同步更自然。
- 视觉统一：去除标题栏与首卡片的缝隙；统一标题栏/卡片背景，减轻色差；左上高光过渡更柔和。
- 可读性：提升标签字号与字重；标签标题支持 i18n；保留键盘焦点样式与“减少动态效果”兼容。

- 广告过滤：纽约时报预卷广告采用更安全的方案（仅限 DoubleClick/Google Ads/gampad；取消 IMA 覆写；改进自动跳过）；同步相关逻辑。

## v2.0.5

### English
- Video ads filtering (site packs, session rules):
  - Added NYTimes Betamax ads module redirection to a safe stub; keep player intact.
  - Added first batch of news/portal site packs (CNN/Reuters/Bloomberg/Guardian/Yahoo/CNET):
    - Redirect Google IMA3 loader to a minimal no‑op module to avoid player breakage.
    - Block FreeWheel (fwmrm.net), GPT, Amazon A9, and Media.net per site, with initiator scoping.
  - Session rules: rules are installed only when a tab of the target site is open, and removed automatically when leaving, minimizing side effects.
  - Prepared no‑op stubs for common ad plugins: IMA3, videojs-contrib-ads, videojs-ima (not used by default unless needed for a specific site).

### 中文
- 视频广告过滤（站点包 + 会话规则）：
  - NYTimes：将 Betamax 广告模块重定向到安全空实现，确保播放器不受影响。
  - 第一批新闻/门户站点包（CNN/路透/彭博/卫报/Yahoo/CNET）：
    - 将 Google IMA3 加载器重定向到最小空模块，避免播放器因缺少对象报错。
    - 按站点限定阻断 FreeWheel（fwmrm.net）、GPT、Amazon A9、Media.net（仅在这些站点发起时生效）。
  - 会话规则：仅在打开相应站点页面时装载规则，离开时自动卸载，最大程度降低副作用。
  - 预置常见广告插件的空实现：IMA3、videojs-contrib-ads、videojs-ima（默认不启用，仅在特定站点需要时使用）。

## v2.0.4

### English
- Adblock UI i18n: Localized the entire Ad Filtering card (title, labels, strength buttons, sync text, summaries) for 中文/English.
- New category: Cookie Notice Hiding with EasyList Cookie General Hide; renders as a third list section with its own “Update All”.
- Auto-sync on selection: When Ad Filtering is enabled, checking a list immediately triggers a one-time sync for that list.
- Robust sync: Allow front-end to pass list URL/name to background for single-item sync, avoiding “Unknown list” before the service worker reloads.
- UI polish: Center-aligned the first-row controls and adjusted spacing; moved the Ad Filtering card below System Prompt.

### 中文
- 广告过滤多语言化：卡片标题、标签、强度按钮、同步状态与汇总均支持中英双语。
- 新增分类：Cookie 提示隐藏，内置 EasyList Cookie General Hide；独立显示并支持“一键全部更新”。
- 勾选自动同步：启用广告过滤时，勾选任意规则会自动执行一次同步，无需手动再点“同步”。
- 同步更稳健：支持前端在单项同步时传递 URL/名称，避免后台 Service Worker 未刷新时提示“Unknown list”。
- 交互与排版：第一行控件居中对齐，微调间距；将“广告过滤”卡片移动到“系统提示词”下方。

## v2.0.3

### English
- Tighten heuristics: Remove risky substring selectors from placeholder collapsing; only consider explicit ad attributes (`data-ad*`, `aria-label*=advert`, `ins.adsbygoogle`, Google ads ids). Added token-based matching with denylist (e.g., `masthead`, `header`, `badge`) to prevent false positives.
- Strength-aware: When strength is Low, skip placeholder collapsing entirely (keep safe direct removals and floating overlay cleanup).

### 中文
- 收紧启发式：占位符折叠不再使用高风险的 `[id*="ad"]`/`[class*="ad"]` 模糊匹配，仅依据明确属性（`data-ad*`、`aria-label*=advert`、`ins.adsbygoogle`、Google 广告 id 前缀）。并加入基于 token 的判断和常见误伤词拒绝列表（如 `masthead`、`header`、`badge`）。
- 强度感知：在“低”强度时，完全跳过占位符折叠（保留安全 DOM 删除与浮动层清理）。

## v2.0.2

### English
- Safety: Disabled cosmetic element hiding and generic DOM removal on YouTube domains to prevent UI breakage. Popup blocking remains active.
- Note: A per-site allowlist UI will be considered; this is a safe default hotfix.

### 中文
- 安全：在 YouTube 域名上禁用元素隐藏与通用 DOM 清理，避免界面异常。保留弹窗拦截功能。
- 说明：后续考虑加入站点白名单设置；当前为安全默认修复。

## v2.0.1

### English
- Fix: Remove persistent bottom-corner floating ads on missav.* with a targeted, safe heuristic (detect fixed/sticky, corner-anchored, overlay-ish elements containing ad-like media/text/classes) and collapse trivial wrappers.
- Robustness: Run floater collapse even when no cosmetic CSS is produced (ensures site-specific cleanup still applies if lists are disabled or not yet synced).

### 中文
- 修复：针对 missav.* 右下角顽固浮动广告，新增更强但安全的启发式清理（检测固定/粘性、贴边的覆盖元素，且包含广告类媒体/文本/类名），并尝试合并空壳父容器。
- 稳健性：即使未生成规则 CSS（例如未选择列表或列表未同步），也会执行浮窗折叠，确保站点专用清理生效。

## v2.0.0

### English
- Ad Filtering (ABP 2.0 cosmetic): New Settings section “广告过滤” with on/off switch.
- Lists: Choose global/regional lists (EasyList, EasyPrivacy, Fanboy’s Annoyance/Social, Germany/Poland/Spain/Italy/China/Russia, etc.).
- Per‑list Sync: Click the circular arrows to download the latest TXT; a preview dialog shows the first 10 lines to verify content.
- Rule Storage: Rules are downloaded and stored locally; preferences sync across devices.
- Engine: Applies Adblock Plus 2.0 element‑hiding rules (##, ###, #@#; domain and negated domains). Safe subset compiled per host.
- Strength: Low/Medium/High selector to control aggressiveness and selector complexity.
- Page Apply: Injects CSS at document_start and also removes simple matches from DOM to “directly” eliminate ad nodes.
- Flash Reduction: Session cache of compiled CSS to minimize first‑paint flashing on reload.
- UI/Theme: Improved toggle visibility in light mode; segmented strength control with clear active/hover states; full dark‑mode support.

### 中文
- 广告过滤（ABP 2.0 元素隐藏）：设置新增“广告过滤”开关。
- 规则列表：支持选择全球/区域列表（EasyList、EasyPrivacy、Fanboy’s 烦扰/社交、德国/波兰/西班牙/意大利/中国/俄罗斯等）。
- 单条同步：点击每条规则后的循环箭头即可下载最新 TXT；弹窗预览前 10 行以核对内容。
- 存储：规则内容保存在本地（storage.local），勾选与强度等偏好同步（storage.sync）。
- 引擎：按站点编译并应用 Adblock Plus 2.0 的元素隐藏规则（##、###、#@#，支持域名与否定域名）；采用安全子集。
- 强度：提供低/中/高三档，控制选择器复杂度与拦截激进程度。
- 页面应用：在 document_start 注入 CSS，同时对简单匹配进行 DOM 删除，实现“直接去除”。
- 闪烁优化：会话级 CSS 预缓存，减少页面刷新时广告短暂露出的闪现。
- 界面/主题：亮色模式下开关更显眼；强度分段按钮高亮/悬停更清晰；完整适配暗色主题。

## v1.9.1

### English
- Trial Mode UX: Improved consent flow with better user guidance and visual feedback
- Settings Integration: Enhanced trial consent checkbox with attention-grabbing animations when needed
- Panel Feedback: Clear error messages in floating panel when trial consent is required
- User Flow: Streamlined experience - users can now save settings without auto-switching to OpenAI when trial consent is missing
- Visual Cues: Added flashing animation to draw attention to trial consent checkbox when accessed from panel
- Fix: In light theme, the consent “breathing” pulse did not replay after unchecking; aligned CSS specificity with dark theme and force-restarted the animation in JS to ensure consistent behavior.

### 中文
- 试用模式体验：改进同意流程，提供更好的用户引导和视觉反馈
- 设置页集成：增强试用同意复选框，在需要时提供醒目的动画提醒
- 面板反馈：在浮动面板中提供清晰的错误信息，当需要试用同意时
- 用户流程：简化体验 - 用户现在可以在缺少试用同意的情况下保存设置，而不会自动切换到 OpenAI
- 视觉提示：添加闪烁动画，在从面板访问时吸引用户注意试用同意复选框
- 修复：亮色模式下在取消勾选后不会重新出现“同意提示”呼吸动画；通过提升与暗色模式一致的 CSS 选择器优先级并在 JS 中强制重启动画，确保两种主题表现一致。

## v1.9.0

### English
- UI/UX: High-transparency frosted blank state with no opaque center; rounded outer frame; consistent Chrome-like corner radius by platform
- Empty State: Cards hidden by default; panel width adjustable even when empty; middle area compressed (configurable) with smooth expand-on-run (scroll-like)
- Arrow Guide: Upward arrow centered under the “Extract & Summarize” button; stays aligned while resizing; refined baseline and anti-jitter behavior
- Animations: Synchronized middle+footer expansion; removed flickery clip-path; refined pull-in for cards; progress bar gains non-transparent glass base
- Dark Mode: Fixed transparency “leak” at bottom in folded state; tuned glass opacity for bars; consistent glass tokens across themes
- Options (Compliance): Removed inline scripts for MV3 CSP; added Trial-mode consent checkbox with i18n; block trial without consent; prompt to auto-switch to OpenAI on save when not consented
- Accessibility: Bilingual labels, improved focus and visual clarity; reduced-motion respects

### 中文
- UI/UX：默认空白态为高透磨砂、去中心块；整体外框圆角；按平台对齐 Chrome 原生圆角
- 空态：默认隐藏卡片；空态也可拖拽改宽；中间压缩（可调），点击“提取并摘要”先展开、再加载卡片，类似“卷轴展开”效果
- 引导箭头：小箭头固定指向“提取并摘要”按钮中心；拖动改宽时保持居中；优化基线与抖动
- 动效：中间磨砂与底栏同步下移；移除导致闪烁的 clip-path；精修卡片下拉入场；进度条拥有与标题栏一致的玻璃底色
- 深色模式：修复折叠态底部“露馅”；调整顶/底栏玻璃透明度；统一玻璃变量
- 设置页（合规）：移除内联脚本以满足 MV3 CSP；新增试用模式同意勾选并支持中英；未同意时阻止 trial 调用；保存时提示并可改为 OpenAI
- 可访问性：文案双语、对比与焦点更清晰；尊重降低动效偏好

## v1.8.0

### English
- 🔧 **Chrome Web Store Compliance**: Fixed ESM remote dependencies to comply with 'Blue Argon' requirements
- 🚫 **Removed External Dependencies**: Eliminated vendor/petite-vue.es.js that contained external link fragments
- ⚡ **MV3 Manifest Compliance**: Ensured all resources are local and properly packaged
- 🎯 **Maintained Functionality**: Preserved all features with vanilla DOM rendering fallback
- 🛡️ **Security Enhancement**: Removed potential security risks from external dependencies

### 中文
- 🔧 **Chrome扩展商店合规性**: 修复ESM远程依赖以符合'Blue Argon'要求
- 🚫 **移除外部依赖**: 删除包含外部链接片段的vendor/petite-vue.es.js文件
- ⚡ **MV3清单合规性**: 确保所有资源都是本地且正确打包的
- 🎯 **保持功能完整**: 通过vanilla DOM渲染降级保留所有功能
- 🛡️ **安全性增强**: 移除外部依赖带来的潜在安全风险

## v1.7.9

### English
- 🎨 **Enhanced UI Improvements**: Comprehensive glass morphism effects across all components
- 🔧 **Translation Popup Optimization**: Better visual design and user experience
- 📱 **Options Page Enhancement**: Improved layout and interaction design
- ✨ **Float Panel Refinement**: Enhanced styling and smooth animations
- 🌙 **Dark Mode Enhancement**: Better support and accessibility features
- 📱 **Responsive Design**: Improved mobile compatibility and responsive behavior
- 🎯 **User Experience**: Overall UI/UX improvements and optimizations

### 中文
- 🎨 **UI增强改进**: 所有组件采用全面的玻璃拟态效果
- 🔧 **翻译弹窗优化**: 更好的视觉设计和用户体验
- 📱 **设置页面增强**: 改进布局和交互设计
- ✨ **浮动面板优化**: 增强样式和平滑动画
- 🌙 **暗色模式增强**: 更好的支持和可访问性功能
- 📱 **响应式设计**: 改进移动端兼容性和响应式行为
- 🎯 **用户体验**: 整体UI/UX改进和优化

## v1.7.8

### English
- 🎨 **Enhanced Translation Bubble**: Added resize functionality to translation popup for better user control
- 🔧 **Improved Text Formatting**: Better paragraph handling and line spacing in translation results
- 🎯 **Enhanced User Experience**: Removed selection-based positioning constraints for more flexible bubble placement
- ✨ **Visual Improvements**: Added resize handle with subtle visual design for intuitive interaction
- 🌟 **Better Responsiveness**: Improved bubble positioning with optimized spacing and gap calculations
- 🔮 **Glass Morphism System**: Comprehensive glass effect system with CSS variables for consistent UI
- 🎨 **Card Header Enhancement**: Fixed card title bar colors and inset glass effects for better visual hierarchy
- 🌙 **Dark Mode Optimization**: Enhanced readability and contrast in dark theme across all components
- 📱 **Options Page Upgrade**: Applied glass morphism effects to settings page for unified design language

### 中文
- 🎨 **增强翻译弹窗**: 为翻译弹出框添加调整大小功能，提供更好的用户控制
- 🔧 **改进文本格式**: 优化翻译结果的段落处理和行间距
- 🎯 **增强用户体验**: 移除基于选区的定位限制，提供更灵活的弹窗放置
- ✨ **视觉改进**: 添加调整大小手柄，具有微妙的视觉设计，提供直观的交互
- 🌟 **更好的响应性**: 改进弹窗定位，优化间距和间隙计算
- 🔮 **玻璃拟态系统**: 完整的玻璃效果系统，使用CSS变量确保UI一致性
- 🎨 **卡片标题栏增强**: 修复卡片标题栏颜色和内凹玻璃效果，改善视觉层次
- 🌙 **暗色模式优化**: 在所有组件中增强暗色主题的可读性和对比度
- 📱 **设置页面升级**: 为设置页面应用玻璃拟态效果，统一设计语言

## v1.7.7

### English
- 🎨 **Enhanced Button Feedback**: Improved visual feedback for the force dark mode toggle button
- 🔘 **Better UX**: Added hover effects, shadows, and click animations to make the toggle button more interactive
- 🎯 **Visual Clarity**: Users can now clearly see that the force dark mode button is clickable
- 🌙 **Theme Consistency**: Enhanced button styling for both light and dark themes
- 🎨 **Dark Mode Icon Fix**: Fixed the white gradient background of empty state icons in dark mode
- 🌙 **Theme Consistency**: Empty state icons now use blue gradient background in dark mode for better visual harmony
- 🎯 **Visual Improvement**: Removed the abrupt white rounded rectangle around icons in dark theme
- 🎨 **Enhanced Glass Effect**: Improved glass morphism effect for translation popup with higher transparency
- 🌟 **Better Visual Clarity**: Enhanced title text and button contrast for better readability in both light and dark modes
- 🔮 **Advanced Backdrop Filter**: Increased blur and saturation for more pronounced glass effect
- ✨ **Interactive Feedback**: Added hover animations and transitions for buttons and close button
- 🔧 **Rounded Corner Transparency Fix**: Fixed issue where rounded corners of translation popup were not transparent
- 🎨 **Browser Compatibility**: Added `isolation: isolate` and `overflow: hidden` to ensure proper rendering of rounded corners with backdrop-filter
- 🌟 **Visual Consistency**: Ensured consistent transparency across all rounded corners in both light and dark modes
- 🎨 **Morandi Blue Header**: Added subtle Morandi blue background to translation popup header in light mode
- 🌟 **Enhanced Visual Appeal**: Replaced plain white header with elegant blue gradient for better visual interest
- 🎯 **Color Harmony**: Updated button and close button colors to match the new Morandi blue theme
- ✨ **Refined Aesthetics**: Improved overall visual consistency and elegance in light mode
- 🎨 **Enhanced Blue Visibility**: Increased opacity and saturation of Morandi blue in light mode header
- 🌟 **Better Contrast**: Made the blue background more prominent and visible in translation popup
- 🎯 **Improved Button Styling**: Enhanced button colors to match the more visible blue theme
- ✨ **Stronger Visual Impact**: Increased overall blue presence for better visual distinction
- 🔮 **Enhanced Glass Morphism**: Added stronger glass effect to light mode header with improved backdrop-filter
- ✨ **Glass Texture**: Enhanced glass texture with inner shadows and gradient overlays
- 🌟 **Button Glass Effect**: Added glass morphism to buttons with backdrop-filter and shadows
- 🎨 **Visual Depth**: Improved visual depth with layered shadows and glass reflections
- 🔮 **Dark Mode Glass Effect**: Enhanced glass morphism for dark mode translation popup header
- ✨ **Consistent Glass Texture**: Applied same glass effects to dark mode as light mode for visual consistency
- 🌟 **Enhanced Button Glass**: Improved glass effect for buttons in dark mode with backdrop-filter and shadows
- 🎨 **Unified Visual Experience**: Both light and dark modes now have consistent glass morphism aesthetics

### 中文
- 🎨 **增强按钮反馈**：改进强制深色模式切换按钮的视觉反馈
- 🔘 **更好的用户体验**：添加悬停效果、阴影和点击动画，使切换按钮更具交互性
- 🎯 **视觉清晰度**：用户可以清楚地看到强制深色模式按钮是可点击的
- 🌙 **主题一致性**：增强亮色和暗色主题下的按钮样式
- 🎨 **暗色模式图标修复**：修复暗色模式下空状态图标的白色渐变背景问题
- 🌙 **主题一致性**：空状态图标在暗色模式下现在使用蓝色渐变背景，视觉更协调
- 🎯 **视觉改进**：移除暗色主题下图标的突兀白色圆角矩形
- 🎨 **增强玻璃效果**：改进翻译弹窗的玻璃拟态效果，提高透明度
- 🌟 **更好的视觉清晰度**：增强标题文字和按钮对比度，在亮色和暗色模式下都有更好的可读性
- 🔮 **高级背景模糊**：增加模糊和饱和度，使玻璃效果更明显
- ✨ **交互反馈**：为按钮和关闭按钮添加悬停动画和过渡效果
- 🔧 **圆角透明度修复**：修复翻译弹窗圆角不透明的问题
- 🎨 **浏览器兼容性**：添加`isolation: isolate`和`overflow: hidden`确保圆角与背景模糊的正确渲染
- 🌟 **视觉一致性**：确保亮色和暗色模式下所有圆角都有一致的透明度
- 🎨 **莫兰迪蓝标题栏**：在亮色模式下为翻译弹窗标题栏添加淡淡的莫兰迪蓝色背景
- 🌟 **增强视觉吸引力**：用优雅的蓝色渐变替换纯白标题栏，提升视觉趣味性
- 🎯 **色彩协调**：更新按钮和关闭按钮颜色以匹配新的莫兰迪蓝色主题
- ✨ **精致美学**：改善亮色模式下的整体视觉一致性和优雅度
- 🎨 **增强蓝色可见度**：增加亮色模式标题栏中莫兰迪蓝色的透明度和饱和度
- 🌟 **更好的对比度**：使翻译弹窗中的蓝色背景更加突出和可见
- 🎯 **改进按钮样式**：增强按钮颜色以匹配更明显的蓝色主题
- ✨ **更强的视觉冲击**：增加整体蓝色存在感以获得更好的视觉区分
- 🔮 **增强玻璃拟态**：为亮色模式标题栏添加更强的玻璃效果，改进背景模糊
- ✨ **玻璃质感**：通过内阴影和渐变叠加增强玻璃质感
- 🌟 **按钮玻璃效果**：为按钮添加玻璃拟态效果，包括背景模糊和阴影
- 🎨 **视觉深度**：通过分层阴影和玻璃反射改善视觉深度
- 🔮 **暗色模式玻璃效果**：增强暗色模式翻译弹窗标题栏的玻璃拟态效果
- ✨ **一致的玻璃质感**：为暗色模式应用与亮色模式相同的玻璃效果，保持视觉一致性
- 🌟 **增强按钮玻璃效果**：改进暗色模式按钮的玻璃效果，包括背景模糊和阴影
- 🎨 **统一的视觉体验**：亮色和暗色模式现在都具有一致的玻璃拟态美学

---

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
# Changelog

## v2.2.2-beta - 2025-09-16

### English
- Q&A window bounds: Never auto-resize or auto-reposition the Q&A bubble when the side panel width changes. Enforce a 10px safe margin on both left and right. If shrinking the side panel would push the Q&A window within 10px of either edge, shrinking is blocked instead of squeezing the bubble. When near the right edge, the bubble no longer auto-moves inward.
- Resize reliability: Fixed an issue where the Q&A bubble could continue resizing after mouse release. Added robust pointer capture + global listeners and immediate stop on buttons==0.
- Summarize lockout: While Extract & Summarize is running (running/partial), the Q&A input and Send button are disabled and visually dimmed; they restore on done/error.
- Safety polish: Hide horizontal overflow in the container and unify boundary margins to 10px during drag/resize.
- Version: Bumped to 2.2.2-beta in manifest and docs.

### 中文
- 你问我答边界：不再因 sidepanel 宽度变化而“弹性”改变浮窗尺寸或位置；左右各保留 10px 安全边距。当收窄 sidepanel 会导致浮窗距任一侧低于 10px 时，改为阻止继续收窄；右侧接近边缘时，浮窗不再向内自动移动。
- 缩放稳定性：修复“松开鼠标后仍继续改变大小”的问题；加入更稳健的指针捕获与全局监听，并在鼠标按钮抬起时立刻结束缩放。
- 运行期禁用：执行“提取并摘要”期间（running/partial），禁用问答输入与发送按钮并灰显；处理完成或出错后自动恢复。
- 安全细化：容器横向溢出隐藏；卡片拖动/缩放边界统一为 10px。
- 版本：升级至 2.2.2-beta（manifest 与文档）。
# Changelog

## v2.2.4-beta - 2025-09-17

### English
- Force Dark Mode: integrated Dark Reader (MIT) dynamic theme by default with a safe local fallback. The floating sidepanel is now excluded from darkening to preserve its own theme. Dark Reader files are bundled locally (no remote fetch) and the upstream LICENSE is included.
- Readable Body (Local Fast): integrated Mozilla Readability (Apache‑2.0) for offline extraction, with our previous heuristic as fallback; keeps headings/lists/quotes and reduces boilerplate. Upstream LICENSE is bundled.
- Q&A chat polish: increased bubble spacing for readability; input bar styling aligned with the chat card; in light theme the textarea uses white background for clarity.
- Scroll behavior: prevented scroll chaining from the floating Q&A window into the sidepanel (overscroll-behavior: contain); fine‑tuned top/bottom paddings when scrolling.
- UX: when the Q&A window floats above, background cards (Summary/Readable) no longer lift on hover; restored after closing the chat float.

### 中文
- 强制深色模式：默认集成 Dark Reader（MIT）动态主题，并提供本地轻量回退。浮窗面板本身不会被“变黑”，其明/暗外观保持不变。Dark Reader 以本地文件打包（不走远程），并附带上游 LICENSE。
- 可读正文（本地快速）：集成 Mozilla Readability（Apache‑2.0）进行离线提取，保留原启发式作为回退；更好地保留标题/列表/引用并减少噪声。已打包上游 LICENSE。
- 你问我答细节：增大气泡间距；提问输入区配色与卡片统一；亮色模式下输入框采用白色底，易于辨认。
- 滚动体验：阻止你问我答浮窗的滚动链路传导到侧边面板（overscroll-behavior: contain）；滚动到顶/底时的上下留白更合适。
- 交互：当你问我答浮窗在前台时，背后“摘要/可读正文”卡片不再触发悬浮上浮；关闭浮窗后恢复。
## 2.2.6 — Reader Translate Improvements

- Reader Mode: Added Translate Original button with per-paragraph progressive translation. Each block replaces in place as soon as it’s done, so users don’t wait for the whole article.
- Provider selector: choose between Free service (Cloudflare Worker + Gemini 2.5‑flash) and the AI provider configured in Settings. The option reflects your current provider (ChatGPT/OpenAI, DeepSeek, Trial, or Custom) and persists across pages.
- Caching: Re-entering Reader Mode on the same page reuses completed translations; only untranslated blocks are requested again. A one‑click toggle switches between Show Original and Show Translation without new requests.
- Concurrency + timeout: Parallelize translation (3 concurrent blocks) and raise per-block timeout to 3 minutes to improve reliability on long articles.
- Integrated progress: The translate button now shows an in‑button progress bar with stronger contrast for better visibility in both light/dark themes.
- Robustness: Better error surfacing from the free worker path; trims accidental wrappers like <article>…</article> and code fences in responses. Fixed an async usage issue in content scripts.
