# SummarizerX v1.9.0

## English
- UI/UX: High-transparency frosted blank state with no opaque center; rounded outer frame; consistent Chrome-like corner radius by platform
- Empty State: Cards hidden by default; panel width adjustable even when empty; middle area compressed (configurable) with smooth expand-on-run (scroll-like)
- Arrow Guide: Upward arrow centered under the “Extract & Summarize” button; stays aligned while resizing; refined baseline and anti-jitter behavior
- Animations: Synchronized middle+footer expansion; removed flickery clip-path; refined pull-in for cards; progress bar gains non-transparent glass base
- Dark Mode: Fixed transparency “leak” at bottom in folded state; tuned glass opacity for bars; consistent glass tokens across themes
- Options (Compliance): Removed inline scripts for MV3 CSP; added Trial-mode consent checkbox with i18n; block trial without consent; prompt to auto-switch to OpenAI on save when not consented
- Accessibility: Bilingual labels, improved focus and visual clarity; reduced-motion respects

## 中文
- UI/UX：默认空白态为高透磨砂、去中心块；整体外框圆角；按平台对齐 Chrome 原生圆角
- 空态：默认隐藏卡片；空态也可拖拽改宽；中间压缩（可调），点击“提取并摘要”先展开、再加载卡片，类似“卷轴展开”效果
- 引导箭头：小箭头固定指向“提取并摘要”按钮中心；拖动改宽时保持居中；优化基线与抖动
- 动效：中间磨砂与底栏同步下移；移除导致闪烁的 clip-path；精修卡片下拉入场；进度条拥有与标题栏一致的玻璃底色
- 深色模式：修复折叠态底部“露馅”；调整顶/底栏玻璃透明度；统一玻璃变量
- 设置页（合规）：移除内联脚本以满足 MV3 CSP；新增试用模式同意勾选并支持中英；未同意时阻止 trial 调用；保存时提示并可改为 OpenAI
- 可访问性：文案双语、对比与焦点更清晰；尊重降低动效偏好

