# Changelog

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

### 中文
- 设置页：新增顶部标签（AI 摘要 / 广告过滤），并支持中英双语；将“基础配置 + 系统提示词 + 快捷键”与“广告过滤”分栏展示，结构更清晰。
- 标签样式：三面边框（上/左/右）圆角小方框；激活态为浅色微底纹、低对比度描边和轻微发光，低调不刺眼。
- 渐变下划线：保留“中间最亮，两侧渐隐”的蓝色横线，并与第一张卡片上浮联动，上下同步更自然。
- 视觉统一：去除标题栏与首卡片的缝隙；统一标题栏/卡片背景，减轻色差；左上高光过渡更柔和。
- 可读性：提升标签字号与字重；标签标题支持 i18n；保留键盘焦点样式与“减少动态效果”兼容。

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
