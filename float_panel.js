// float_panel.js —— 页面内右侧悬浮面板（Shadow DOM，零样式污染）
// 两阶段：先显示“摘要”(partial)，随后自动补“可读正文”(done)
// 增强：广播 + 轮询兜底（避免错过后台广播导致停在 partial）

(() => {
  // 导入国际化模块
  let i18nModule = null;
  
  // 异步加载国际化模块
  async function loadI18n() {
    if (i18nModule) return i18nModule;
    try {
      const moduleUrl = chrome.runtime.getURL('i18n.js');
      i18nModule = await import(moduleUrl);
      return i18nModule;
    } catch (e) {
      console.warn('Failed to load i18n module:', e);
      return null;
    }
  }
  
  const PANEL_ID = "sx-float-panel";
  const MARK = "__SX_FLOAT_PANEL_READY__";
  if (window[MARK]) return;
  window[MARK] = true;

  // ========== 工具 ==========
  const escapeHtml = (str) =>
    String(str || "").replace(/[&<>"']/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));

  function renderNoticeMarkdown(md = "") {
    md = collapseBlankLines(md);
    if (typeof md !== "string") md = String(md ?? "");
    let html = escapeHtml(md);
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHtml(code)}</code></pre>`);
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
               .replace(/\*(.+?)\*/g, "<em>$1</em>")
               .replace(/`([^`]+?)`/g, "<code>$1</code>");
    html = html.replace(/^(?:- |\* )(.*)(?:\n(?:- |\* ).*)*/gm, (block) => {
      const items = block.split(/\n/).map((l) => l.replace(/^(?:- |\* )/, "").trim()).filter(Boolean);
      return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    });
    html = html.replace(/^(?:\d+\. )(.*)(?:\n(?:\d+\. ).*)*/gm, (block) => {
      const items = block.split(/\n/).map((l) => l.replace(/^\d+\. /, "").trim()).filter(Boolean);
      return `<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
    });
    html = html.replace(/\n{2,}/g, "</p><p>");
    html = html.replace(/(?:<\/p>\s*<p>\s*){2,}/gi, "</p><p>");
    return `<p>${html}</p>`;
  }

  function collapseBlankLines(txt = "") {
    return String(txt)
      .replace(/\r\n?/g, "\n")
      .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n");
  }

  // 更新UI文本为当前语言
  async function updateUIText() {
    const i18n = await loadI18n();
    if (!i18n) return;
    
    try {
      const currentLang = await i18n.getCurrentLanguage();
      
      // 更新应用标题
      const appTitle = shadow.getElementById('sx-app-title');
      if (appTitle) {
        if (currentLang === 'zh') {
          appTitle.textContent = '麦乐可 AI 摘要阅读器';
        } else {
          appTitle.textContent = 'SummarizerX AI Reader';
        }
      }
      
      // 更新按钮文本
      const runBtn = shadow.getElementById('sx-run');
      if (runBtn) {
        if (currentLang === 'zh') {
          runBtn.textContent = '提取并摘要';
        } else {
          runBtn.textContent = 'Extract & Summarize';
        }
      }
      
      // 更新设置按钮
      const settingsBtn = shadow.getElementById('sx-settings');
      if (settingsBtn) {
        if (currentLang === 'zh') {
          settingsBtn.textContent = '设置';
          settingsBtn.title = '设置';
        } else {
          settingsBtn.textContent = 'Settings';
          settingsBtn.title = 'Settings';
        }
      }
      
      // 更新关闭按钮
      const closeBtn = shadow.getElementById('sx-close');
      if (closeBtn) {
        if (currentLang === 'zh') {
          closeBtn.title = '关闭';
          closeBtn.setAttribute('aria-label', '关闭');
        } else {
          closeBtn.title = 'Close';
          closeBtn.setAttribute('aria-label', 'Close');
        }
      }
      
      // 更新主题标签
      const themeLabel = shadow.getElementById('sx-theme-label');
      if (themeLabel) {
        themeLabel.textContent = currentLang === 'zh' ? '外观' : 'Appearance';
      }
      
      // 更新底部说明
      const footerNote = shadow.getElementById('sx-footer-note');
      if (footerNote) {
        if (currentLang === 'zh') {
          footerNote.textContent = '注：部分页面（如 chrome://、扩展页、PDF 查看器）不支持注入。';
        } else {
          footerNote.textContent = 'Note: Some pages (like chrome://, extension pages, PDF viewers) do not support injection.';
        }
      }
      
      // 更新卡片标题
      const summaryCard = shadow.getElementById('sx-summary');
      const cleanedCard = shadow.getElementById('sx-cleaned');
      
      if (summaryCard) {
        summaryCard.setAttribute('data-title', currentLang === 'zh' ? '摘要' : 'Summary');
      }
      
      if (cleanedCard) {
        cleanedCard.setAttribute('data-title', currentLang === 'zh' ? '可读正文' : 'Readable Content');
      }
      
    } catch (e) {
      console.warn('Failed to update UI text:', e);
    }
  }

  // 安全构建扩展资源 URL（内容脚本/非扩展环境下兜底）
  function extURL(p){ try{ return (chrome?.runtime?.getURL ? chrome.runtime.getURL(p) : p); }catch{ return p; } }

  // ===== 明/暗主题自动切换：根据页面背景亮度 =====
  function parseColorToRGB(str){
    if(!str) return null;
    str = String(str).trim().toLowerCase();
    if (str === "transparent") return { r: 255, g: 255, b: 255, a: 0 };
    // rgb/rgba
    let m = str.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\)$/);
    if(m){ return { r:+m[1], g:+m[2], b:+m[3], a: m[4]!==undefined ? +m[4] : 1 }; }
    // #rgb / #rrggbb
    m = str.match(/^#([0-9a-f]{3})$/i);
    if(m){
      const hex = m[1];
      return { r: parseInt(hex[0]+hex[0],16), g: parseInt(hex[1]+hex[1],16), b: parseInt(hex[2]+hex[2],16), a:1 };
    }
    m = str.match(/^#([0-9a-f]{6})$/i);
    if(m){
      const hex = m[1];
      return { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16), a:1 };
    }
    return null;
  }
  function relLuminance({r,g,b}){
    // WCAG relative luminance
    const srgb = [r,g,b].map(v=>v/255).map(v=> v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
    return 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
  }
  function isNearlyTransparent(rgb){
    if (!rgb) return true;
    const a = rgb.a === undefined ? 1 : +rgb.a;
    return a <= 0.01;
  }
  function getBgFromComputed(el){
    try{
      const cs = getComputedStyle(el);
      // 1) 优先 background-color
      const c = parseColorToRGB(cs.backgroundColor);
      if (c && !isNearlyTransparent(c)) return c;
      // 2) 若有纯色渐变（linear-gradient + 背景色），Chromium 会返回 backgroundColor 为 rgba(...,0)
      // 此时尝试用 color 反推：若文字色很亮，极可能深色背景；反之亦然（作为兜底）
      const tc = parseColorToRGB(cs.color);
      if (tc){
        const tl = relLuminance(tc);
        // 文字很亮 → 深色底；文字很暗 → 浅色底（用近似值推断）
        if (tl > 0.72) return { r: 20, g: 24, b: 31, a: 1 };   // 深色近似
        if (tl < 0.28) return { r: 255, g: 255, b: 255, a: 1 }; // 浅色近似
      }
    }catch{}
    return null;
  }
  function getAncestorBg(start){
    let el = start;
    while (el && el !== document.documentElement){
      const c = getBgFromComputed(el);
      if (c) return c;
      el = el.parentElement || el.parentNode;
    }
    // 尝试 html/body
    const bodyC = getBgFromComputed(document.body || document.createElement('body'));
    if (bodyC) return bodyC;
    const htmlC = getBgFromComputed(document.documentElement);
    if (htmlC) return htmlC;
    return null;
  }
  function getEffectiveBg(){
    // 取页面中部的节点向上寻找背景；必要时多点采样
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const points = [
      [Math.round(vw*0.5), Math.round(vh*0.5)],
      [Math.round(vw*0.5), Math.round(vh*0.3)],
      [Math.round(vw*0.5), Math.round(vh*0.7)]
    ];
    for (const [x,y] of points){
      let node = document.elementFromPoint(x,y);
      if (!node) continue;
      // 若命中的是 text node
      if (node.nodeType === 3) node = node.parentElement;
      if (!node) continue;
      const col = getAncestorBg(node);
      if (col) return col;
    }
    return null;
  }
  function getPageBgColor(){
    // 先尽力探测真实渲染背景
    const eff = getEffectiveBg();
    if (eff && !isNearlyTransparent(eff)) return eff;

    // 退回 body/html 背景
    const chain = [document.body, document.documentElement].filter(Boolean);
    for (const el of chain){
      const c = getBgFromComputed(el);
      if (c && !isNearlyTransparent(c)) return c;
    }

    // 移动端窄屏时才参考 theme-color（桌面常设为黑，易误判）
    try{
      const isNarrow = Math.max(window.innerWidth||0, document.documentElement.clientWidth||0) <= 768;
      if (isNarrow){
        const meta = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
        const mc = parseColorToRGB(meta||'');
        if (mc && !isNearlyTransparent(mc)) return mc;
      }
    }catch{}

    // 最终兜底：白色
    return { r:255, g:255, b:255, a:1 };
  }
  function isDarkBackground(){
    const rgb = getPageBgColor();
    if (!rgb || isNearlyTransparent(rgb)){
      // 无法判断时，依据正文文字颜色推断
      const base = getComputedStyle(document.body || document.documentElement);
      const tc = parseColorToRGB(base.color || '#111');
      if (tc){
        const tl = relLuminance(tc);
        return tl > 0.72; // 文字很亮 → 深色底
      }
      // 再退回系统偏好
      const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      return !!prefersDark;
    }
    const L = relLuminance(rgb);
    return L < 0.5;
  }

  // ===== 手动主题覆盖（auto / light / dark） =====
  let themeOverride = 'auto';
  function computeTheme(){
    // AUTO：优先跟随系统 prefers-color-scheme；获取不到时再退回旧的亮度推断
    try{
      const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      if (mq && typeof mq.matches === 'boolean') {
        return mq.matches ? 'dark' : 'light';
      }
    }catch{}
    return isDarkBackground() ? 'dark' : 'light';
  }
  function applyThemeWithOverride(shadow){
    const mode = themeOverride || 'auto';
    const theme = (mode === 'light' || mode === 'dark') ? mode : computeTheme();
    if (shadow.host.getAttribute('data-theme') !== theme){
      shadow.host.setAttribute('data-theme', theme);
    }
  }
  function markThemeButtonsActive(shadow){
    const wrap = shadow.getElementById('sx-theme');
    if (!wrap) return;
    const btns = wrap.querySelectorAll('.theme-btn');
    btns.forEach(b => {
      const active = (b.dataset.mode === themeOverride);
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function renderMarkdown(md = "") {
    if (typeof md !== "string") md = String(md ?? "");
    md = collapseBlankLines(md);
    const notices = [];
    md = md.replace(/:::notice\s*([\s\S]*?)\s*:::/g, (_, inner) => {
      notices.push((inner || "").trim());
      return `__ALERT_TOKEN_${notices.length - 1}__`;
    });

    let html = escapeHtml(md);

    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHtml(code)}</code></pre>`);

    html = html.replace(/(^|\n)((?:&gt;\s?.*(?:\n|$))+)/g, (_, pfx, block) => {
      const inner = block.split("\n").filter(Boolean).map((line) => line.replace(/^&gt;\s?/, "").trim()).join("<br>");
      return `${pfx}<blockquote>${inner}</blockquote>`;
    });

    html = html
      .replace(/^######\s?(.*)$/gm, "<h6>$1</h6>")
      .replace(/^#####\s?(.*)$/gm, "<h5>$1</h5>")
      .replace(/^####\s?(.*)$/gm, "<h4>$1</h4>")
      .replace(/^###\s?(.*)$/gm, "<h3>$1</h3>")
      .replace(/^##\s?(.*)$/gm, "<h2>$1</h2>")
      .replace(/^#\s?(.*)$/gm, "<h1>$1</h1>");

    html = html.replace(/^(?:- |\* )(.*)(?:\n(?:- |\* ).*)*/gm, (block) => {
      const items = block.split(/\n/).map((l) => l.replace(/^(?:- |\* )/, "").trim()).filter(Boolean);
      return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    });
    html = html.replace(/^(?:\d+\. )(.*)(?:\n(?:\d+\. ).*)*/gm, (block) => {
      const items = block.split(/\n/).map((l) => l.replace(/^\d+\. /, "").trim()).filter(Boolean);
      return `<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
    });

    html = html
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+?)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    html = html.replace(/\n{2,}/g, "<br><br>");
    html = html.replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>");
    // —— 清理块元素附近多余的 <br>，避免出现大段空白 ——
    html = html.replace(
      /(<\/(?:h[1-6]|p|ul|ol|pre|blockquote)>)\s*(?:<br\s*\/?>(?:\s|&nbsp;)*?)+/gi,
      "$1"
    );
    html = html.replace(
      /(?:<br\s*\/?>(?:\s|&nbsp;)*?)+(?!<br)(?=\s*<(?:h[1-6]|p|ul|ol|pre|blockquote)\b)/gi,
      ""
    );
    // —— 进一步收紧 notice 与正文之间的空行 ——
    html = html.replace(/(<div class="alert"[^>]*>.*?<\/div>)\s*(?:<br\s*\/?>(?:\s|&nbsp;)*?)+/gis, "$1");
    html = html.replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*?)+(?=<div class="alert"[^>]*>)/gis, "");
    html = html.replace(/<\/div>\s*<br\s*\/?>/gis, '</div>');
    html = `<div class="md">${html}</div>`;

    notices.forEach((txt, i) => {
      const alertHtml =
        `<div class="alert" data-alert>
          <button class="alert-close" type="button" aria-label="关闭" title="关闭" data-alert-close>&times;</button>
          <div class="alert-content">${renderNoticeMarkdown(txt)}</div>
        </div>`;
      html = html.replace(`__ALERT_TOKEN_${i}__`, alertHtml);
    });

    return html;
  }

  function stripInlineColor(html = "") {
    const dropProps = /\b(?:color|background-color|white-space)\s*:[^;"'}]+;?/gi;

    html = html.replace(/style\s*=\s*"([^"]*)"/gi, (m, css) => {
      const cleaned = css.replace(dropProps, "");
      return cleaned.trim() ? `style="${cleaned.trim()}"` : "";
    });
    html = html.replace(/style\s*=\s*'([^']*)'/gi, (m, css) => {
      const cleaned = css.replace(dropProps, "");
      return cleaned.trim() ? `style='${cleaned.trim()}'` : "";
    });
    html = html.replace(/<font\b([^>]*?)\scolor=(["']).*?\2([^>]*)>/gi, "<font$1$3>");
    return html;
  }

  function applyTrialLabelToFloatButton(shadowRoot) {
    const btn = shadowRoot.getElementById("sx-run");
    if (!btn) return;
    chrome.storage.sync.get(["aiProvider"]).then(async ({ aiProvider }) => {
      const i18n = await loadI18n();
      const currentLang = i18n ? await i18n.getCurrentLanguage() : 'zh';
      
      if ((aiProvider || "trial") === "trial") {
        btn.textContent = currentLang === 'zh' ? "试用摘要" : "Trial Summary";
        btn.title = currentLang === 'zh' ? "当前为试用模式（通过代理调用），点击开始试用摘要" : "Currently in trial mode (via proxy), click to start trial summary";
      } else {
        btn.textContent = currentLang === 'zh' ? "提取并摘要" : "Extract & Summarize";
        btn.title = currentLang === 'zh' ? "点击提取正文并生成摘要" : "Click to extract content and generate summary";
      }
    }).catch(() => {
      btn.textContent = "提取并摘要";
      btn.title = "点击提取正文并生成摘要";
    });
  }
  
  // ========== DOM & 样式（Shadow） ==========
  function ensurePanel() {
    let host = document.getElementById(PANEL_ID);
    if (host) return host;

    host = document.createElement("div");
    host.id = PANEL_ID;
    host.style.position = "fixed";
    host.style.top = "0";
    host.style.right = "0";
    host.style.width = "420px";
    host.style.height = "100vh";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "auto";
    host.setAttribute("lang", "zh-CN");

    const shadow = host.attachShadow({ mode: "open" });
    // ⬇️ 内联注入 CSS（合并版：不依赖外部 CSS 文件）
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      :host{
        --primary:#6f87a8;
        --primary-600:#4a6691;
        --accent:#10b981;

        --bg:#eef3fb;           /* 面板背景（浅） */
        --bg-grad: linear-gradient(180deg,#f6f9ff,#eef3fb);
        --card:#ffffff;
        --border:#dfe6f3;
        --muted:#667085;
        --text:#0f172a;

        --warn-bg:#fff8dc;
        --warn-border:#f1e2a8;

        --ring: 0 0 0 3px rgba(37,99,235,0.15);
        --font-stack: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "PingFang SC", "Noto Sans SC", sans-serif;
        color-scheme: light;
      }
      :host, :host * { box-sizing: border-box; font-family: var(--font-stack) !important; }

      /* —— 外框 —— */
      .wrap{
        position:relative; height:100vh; display:flex; flex-direction:column;
        background: var(--bg-grad);
        border-left:1px solid var(--border);
        box-shadow:-6px 0 16px rgba(17,24,39,.06);
        color: var(--text);
      }

      /* —— 可拖拽调宽手柄 —— */
      .dragbar{
        position:absolute; top:0; left:0; height:100%; width:12px;
        cursor: col-resize; user-select:none; -webkit-user-select:none;
        background: transparent; /* 默认透明，保持零视觉干扰 */
      }
      /* 悬停时给出视觉暗示（细竖条） */
      .dragbar::after{
        content:""; position:absolute; top:0; bottom:0; right:-1px; width:3px;
        background: linear-gradient(180deg, rgba(102,112,133,.15), rgba(102,112,133,.02));
        opacity:.0; transition: opacity .15s ease;
      }
      .dragbar:hover::after{ opacity:.85; }
      .wrap.dragging{ cursor: col-resize; }

      /* 顶栏 + 按钮（与 options 风格一致的扁平风） */
      .appbar{ flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:linear-gradient(180deg,#ffffff,#f4f7ff); border-bottom:1px solid var(--border); }
      .brand{ display:flex; align-items:center; gap:10px; }
      .logo{ width:10px; height:10px; border-radius:50%; background: var(--primary); box-shadow:0 0 0 4px rgba(37,99,235,.12); }
      .title{ font-size:14px; font-weight:800; color: var(--text); }

      .actions{ display:flex; gap:8px; }
      .btn{
        padding:8px 12px; border:1px solid var(--border); border-radius:10px;
        cursor:pointer; background:#fff; color:var(--text); font-weight:600;
        transition: transform .05s ease, box-shadow .2s ease, background .2s, border-color .2s;
      }
      .btn:hover{ background:#f8fafc; border-color:#dbe2f1; }
      .btn:active{ transform: translateY(1px); }
      .btn.primary{
        background: linear-gradient(180deg, var(--primary), var(--primary-600));
        color:#fff; border-color: var(--primary-600);
        box-shadow: 0 6px 16px rgba(111,135,168,.18), inset 0 -1px 0 rgba(255,255,255,.15);
      }
      .btn.icon{
        width:36px; height:36px; padding:0; display:grid; place-items:center; line-height:1;
        font-size:18px; border-radius:10px;
      }
      .btn[disabled]{ opacity:.6; cursor:not-allowed; }

      /* 进度条 */
      .progress{ height:2px; background:transparent; position:relative; overflow:hidden; }
      .progress .bar{ position:absolute; left:-18%; width:18%; min-width:110px; max-width:240px; top:0; bottom:0; background:var(--primary); border-radius:999px; animation:slide 1.25s linear infinite; box-shadow:0 0 8px rgba(37,99,235,.55); }
      @keyframes slide { 0%{left:-18%;} 100%{left:100%;} }
      .progress.hidden{ display:none; }

      .container{ flex:1 1 auto; padding:12px; overflow:auto; }
      .section{ margin:10px 0 14px; }

      /* 卡片 + 标题条（与按钮同色、高度适中） */
      .card{
        position:relative;
        background: var(--card);
        border:1px solid var(--border);
        border-radius:12px;
        padding:54px 20px 18px;        /* 给标题条留出空间 */
        line-height:1.7; font-size:15px;
        box-shadow: 0 2px 8px rgba(17,24,39,0.03);
        color: var(--text);
      }
      .card.card-head::before{
        content:"";
        position:absolute; left:0; right:0; top:0; height:42px;
        background: linear-gradient(180deg, var(--primary), var(--primary-600));
        border-radius:12px 12px 0 0;
        border-bottom:1px solid var(--primary-600);
      }
      .card.card-head::after{
        content: attr(data-title);
        position:absolute; left:14px; top:10px;
        font-weight:700; font-size:14px; letter-spacing:.2px;
        color:#fff;
      }

      /* Markdown 基础 */
      .md{ font-size:15px; line-height:1.75; color: var(--text); word-break:break-word; overflow-wrap:anywhere; }
      .md h1{ margin:16px 0 10px; font-size:20px; line-height:1.4; font-weight:800; }
      .md h2{ margin:14px 0 8px;  font-size:18px; line-height:1.4; font-weight:800; }
      .md h3{ margin:12px 0 8px;  font-size:16px; line-height:1.4; font-weight:700; }
      .md p{ margin:6px 0; }
      .md ul, .md ol{ margin:6px 0; padding-left:18px; }
      .md li{ margin:2px 0; }
      /* 统一列表与段落的相邻间距，避免列表→段落比段落→段落更大 */
      .md p + ul,
      .md p + ol{ margin-top:4px; }
      .md ul + p,
      .md ol + p{ margin-top:6px; }
      .md ul:last-child, .md ol:last-child{ margin-bottom:6px; }
      .md ul + h1, .md ul + h2, .md ul + h3, .md ul + h4, .md ul + h5, .md ul + h6,
      .md ol + h1, .md ol + h2, .md ol + h3, .md ol + h4, .md ol + h5, .md ol + h6{ margin-top:6px; }
      .md ul + blockquote, .md ul + pre,
      .md ol + blockquote, .md ol + pre{ margin-top:6px; }
      .md blockquote{ margin:12px 0; padding:8px 12px; border-left:3px solid #cfe0ff; border-radius:8px; background:#f8fbff; color:#0f172a; }
      .md code{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size:.92em; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:4px; padding:0 .25em; }
      .md pre{ margin:10px 0; padding:12px; background:#f7f9ff; border:1px solid #e6e8f0; border-radius:10px; overflow:auto; line-height:1.6; }
      .md pre code{ background:transparent; border:none; padding:0; display:block; font-size:.92em; }
      .md table{ width:100%; border-collapse:collapse; display:block; overflow:auto; margin:10px 0; }
      .md thead th{ background:#f8fafc; color:#0f172a; font-weight:700; }
      .md th, .md td{ border:1px solid #e5e7eb; padding:8px 10px; text-align:left; vertical-align:top; }
      .md img{ display:block; margin:8px 0; }
      .md hr{ border:0; border-top:1px solid #e6e8f0; margin:12px 0; }
      .md > :first-child{ margin-top:0; }
      .md > :last-child{ margin-bottom:0; }

      /* 空态/骨架/提示 */
      .empty{ text-align:center; padding:28px 10px; color:var(--muted); }
      .empty .icon{ font-size:28px; }
      .empty .title{ font-weight:700; margin-top:8px; }
      .empty .hint{ font-size:12px; margin-top:4px; }
      .skl{ height:12px; background:#eee; border-radius:6px; margin:8px 0; animation:skl 1.2s ease-in-out infinite; }
      @keyframes skl{ 0%{opacity:.6;} 50%{opacity:1;} 100%{opacity:.6;} }
      .alert{
          border-radius:10px;
          border:1px solid var(--warn-border);
          background:var(--warn-bg);
          padding:10px 36px 10px 12px;
          margin:6px 0;                   /* 更紧凑的上下间距 */
          position:relative;
          font-size:13px;
          line-height:1.6;                /* 略紧凑的行高 */
        }
      .alert-close{ position:absolute; top:4px; right:4px; border:none; background:transparent; font-size:16px; cursor:pointer; line-height:1; }
      /* 让提示与相邻正文的间距统一、不过大 */
      /* 提示块与前后正文的间距更紧凑，并清理遗留的 <br> */
      .md :where(*:not(.alert) + .alert) { margin-top: 6px !important; }  /* 前一个是正文 → alert */
      .md :where(.alert + *:not(.alert)) { margin-top: 4px !important; }  /* alert → 后一个是正文 */
      .md .alert + br { display:none !important; }
      .md .alert + br + br { display:none !important; }
      /* 页脚 + 主题开关 */
      .footer{ flex:0 0 auto; font-size:12px; color:#6b7280; border-top:1px solid var(--border); padding:8px 12px; }
      .footer-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:nowrap; }
      .theme-toggle{ display:flex; align-items:center; gap:8px; flex-shrink:0; }
      .theme-toggle .label{ 
        color:#475569; 
        white-space:nowrap; 
        font-weight:600; 
        font-size:12px; 
        letter-spacing:.02em; 
        line-height:1; 
        margin-right:2px; 
        align-self:center; 
      }
      .theme-toggle .seg{ display:flex; gap:6px; background:#fff; border:1px solid var(--border); border-radius:999px; padding:2px; }
      .theme-btn{ width:28px; height:28px; padding:0; border:none; border-radius:999px; background:transparent; cursor:pointer; color:#334155; display:grid; place-items:center; }
      .theme-btn:hover{ background:rgba(0,0,0,0.06); }
      .theme-btn.active{ background:var(--primary); color:#fff; }
      .theme-btn svg{ width:16px; height:16px; display:block; stroke:currentColor; }
      .sr-only{ position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

      /* 深色模式（由 JS 在宿主上设置 data-theme="dark"） */
      :host([data-theme="dark"]) {
        --bg:#0b1220;
        --bg-grad: radial-gradient(120% 80% at 100% 0%, #0b1220 0%, #0d1424 60%, #0b1220 100%);
        --card:#0f172a;
        --border:#1f2a44;
        --muted:#94a3b8;
        --text:#e5e7eb;

        --warn-bg: rgba(255, 240, 175, 0.08);
        --warn-border: rgba(250, 204, 21, 0.35);
      }
      :host([data-theme="dark"]) .appbar{ background: linear-gradient(180deg,#0f172a,#0c1323); border-bottom:1px solid var(--border); }
      :host([data-theme="dark"]) .btn{ background:#0f172a; color:var(--text); border-color:var(--border); }
      :host([data-theme="dark"]) .btn:hover{ background:#111a2e; border-color:#2a3a5b; }
      :host([data-theme="dark"]) .container{ color:var(--text); }
      :host([data-theme="dark"]) .card{ background: var(--card); border-color: var(--border); color: var(--text); }
      :host([data-theme="dark"]) .md{ color: var(--text); }
      :host([data-theme="dark"]) .md blockquote{ background: rgba(255,255,255,0.06); border-left-color: rgba(37,99,235,0.45); color: var(--text); }
      :host([data-theme="dark"]) .md code{ background:#0b1220; border-color:#1f2a44; color:#e5e7eb; }
      :host([data-theme="dark"]) .md pre{ background:#0b1220; border-color:#1f2a44; color:#e5e7eb; }
      :host([data-theme="dark"]) .md thead th{ background:#111a2e; color:#e5e7eb; }
      :host([data-theme="dark"]) .alert{ background: var(--warn-bg); border-color: var(--warn-border); color: var(--text); }
      :host([data-theme="dark"]) .theme-toggle .seg{ background:#0f172a; border-color: var(--border); }
      :host([data-theme="dark"]) .theme-btn{ color:#d1d5db; }
      :host([data-theme="dark"]) .theme-btn:hover{ background:rgba(255,255,255,0.08); }
      :host([data-theme="dark"]) .theme-toggle .label{ color:#cbd5e1; opacity:.9; }
    `;
    shadow.appendChild(styleEl);

    const root = document.createElement("div");
    shadow.appendChild(root);
    document.documentElement.appendChild(host);

    // === 异步加载模板 HTML（外部化），加载失败则回退到内置最小骨架 ===
    const fallbackHTML = `
      <div class="wrap">
        <div class="dragbar" id="sx-drag"></div>
        <div class="appbar">
          <div class="brand"><span class="logo"></span><div class="title" id="sx-app-title">麦乐可 AI 摘要阅读器</div></div>
          <div class="actions">
            <button id="sx-settings" class="btn" title="设置">设置</button>
            <button id="sx-run" class="btn primary" id="sx-run-btn">提取并摘要</button>
            <button id="sx-close" class="btn icon" title="关闭" aria-label="关闭">✕</button>
          </div>
        </div>
        <div id="sx-progress" class="progress hidden"><div class="bar"></div></div>
        <div class="container">
          <section class="section">
            <div id="sx-summary" class="card card-head" data-title="摘要"></div>
          </section>
          <section class="section">
            <div id="sx-cleaned" class="card card-head" data-title="可读正文"></div>
          </section>
        </div>
        <div class="footer">
          <div class="footer-row">
            <small id="sx-footer-note">注：部分页面（如 chrome://、扩展页、PDF 查看器）不支持注入。</small>
            <div class="theme-toggle" id="sx-theme">
              <span class="label" id="sx-theme-label">外观</span>
              <div class="seg" role="tablist" aria-label="外观切换">
                <button class="theme-btn" data-mode="auto" role="tab" aria-selected="true" aria-label="自动" title="自动">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <!-- half sun -->
                    <circle cx="12" cy="12" r="4"></circle>
                    <line x1="12" y1="2" x2="12" y2="5"></line>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"></line>
                    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"></line>
                    <!-- moon overlay -->
                    <path d="M21 12.8a9 9 0 1 1-9.8-9 7 7 0 0 0 9.8 9z"></path>
                  </svg>
                  <span class="sr-only">自动</span>
                </button>
                <button class="theme-btn" data-mode="light" role="tab" aria-selected="false" aria-label="浅色" title="浅色">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4"></circle>
                    <line x1="12" y1="2" x2="12" y2="5"></line>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"></line>
                    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"></line>
                    <line x1="2" y1="12" x2="5" y2="12"></line>
                    <line x1="19" y1="12" x2="22" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"></line>
                    <line x1="17.66" y1="6.34" x2="19.78" y2="4.22"></line>
                  </svg>
                  <span class="sr-only">浅色</span>
                </button>
                <button class="theme-btn" data-mode="dark" role="tab" aria-selected="false" aria-label="深色" title="深色">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M21 12.8a9 9 0 1 1-9.8-9 7 7 0 0 0 9.8 9z"></path>
                  </svg>
                  <span class="sr-only">深色</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    // 将初始化逻辑封装，待模板插入后执行
    const initAfterHTML = async () => {
      // 更新UI文本为当前语言
      await updateUIText();
      
      // ===== 根据页面背景亮度设置主题，并保持监听 =====
      try { applyThemeWithOverride(shadow); } catch {}

      // 监听 html/body 的属性/内联样式变化（站点切换主题时同步）
      const themeObserver = new MutationObserver(() => { try { if (themeOverride === 'auto') applyThemeWithOverride(shadow); } catch {} });
      themeObserver.observe(document.documentElement, { attributes:true, attributeFilter:["class","style"] });
      if (document.body) themeObserver.observe(document.body, { attributes:true, attributeFilter:["class","style"] });

      // 定时兜底：防止站点通过样式表切换未触发属性变化
      let themeTick = setInterval(() => { try { if (themeOverride === 'auto') applyThemeWithOverride(shadow); } catch {} }, 1500);

      // 系统主题切换监听：AUTO 跟随系统变化
      try {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onSystemThemeChange = () => { if (themeOverride === 'auto') applyThemeWithOverride(shadow); };
        if (mq && mq.addEventListener) mq.addEventListener('change', onSystemThemeChange);
        else if (mq && mq.addListener) mq.addListener(onSystemThemeChange);
      } catch {}

      // 交互：关闭
      shadow.getElementById("sx-close")?.addEventListener("click", () => {
        try { themeObserver.disconnect(); } catch {}
        try { clearInterval(themeTick); } catch {}
        host.remove();
        window[MARK] = false;
      });

      // 交互：设置
      shadow.getElementById("sx-settings")?.addEventListener("click", async () => {
        try { await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" }); } catch {}
      });

      // 交互：拖宽（支持鼠标/触摸，限制最小/最大宽度）
      const drag = shadow.getElementById("sx-drag");
      const wrapEl = shadow.querySelector('.wrap');
      let dragging = false;

      function clampWidth(px){
        const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        const minW = Math.min(320, vw - 80);        // 至少留一点页面可见
        const maxW = Math.max(320, Math.min(720, vw - 80));
        return Math.max(minW, Math.min(maxW, px));
      }
      function startDrag(){
        dragging = true;
        wrapEl && wrapEl.classList.add('dragging');
        // 禁止选中
        document.documentElement.style.userSelect = 'none';
      }
      function endDrag(){
        dragging = false;
        wrapEl && wrapEl.classList.remove('dragging');
        document.documentElement.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove, true);
        window.removeEventListener('mouseup', onMouseUp, true);
        window.removeEventListener('touchmove', onTouchMove, { capture:true, passive:false });
        window.removeEventListener('touchend', onTouchEnd, { capture:true });
      }
      function setWidthByClientX(clientX){
        const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        const fromRight = vw - clientX;            // 右侧固定，算到右边的距离
        const w = clampWidth(fromRight);
        host.style.width = `${w}px`;
      }

      function onMouseMove(ev){ if(!dragging) return; ev.preventDefault(); setWidthByClientX(ev.clientX); }
      function onMouseUp(){ if(!dragging) return; endDrag(); }

      function onTouchMove(ev){ if(!dragging) return; if(ev.touches && ev.touches[0]){ setWidthByClientX(ev.touches[0].clientX); } ev.preventDefault(); }
      function onTouchEnd(){ if(!dragging) return; endDrag(); }

      drag?.addEventListener('mousedown', (e) => {
        startDrag();
        e.preventDefault();
        window.addEventListener('mousemove', onMouseMove, true);
        window.addEventListener('mouseup', onMouseUp, true);
      });
      drag?.addEventListener('touchstart', (e) => {
        startDrag();
        e.preventDefault();
        window.addEventListener('touchmove', onTouchMove, { capture:true, passive:false });
        window.addEventListener('touchend', onTouchEnd, { capture:true });
      }, { passive:false });

      // 双击手柄在两档宽度间快速切换（适配窄屏时自动夹在范围内）
      drag?.addEventListener('dblclick', () => {
        const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        const cur = parseInt(getComputedStyle(host).width, 10) || 420;
        const target = cur < 520 ? 560 : 380;
        host.style.width = `${clampWidth(target)}px`;
      });

      // 关闭 notice（并清理相邻多余 <br>，消除关闭后顶部大空隙）
      shadow.addEventListener("click", (e) => {
        const btn = e.target.closest(".alert-close");
        if (!btn) return;
        const box = btn.closest(".alert");
        if (!box) return;

        // 1) 清理 alert 前后的连续 <br>（有些站点/渲染会在提示块周围插入换行）
        const removeAdjacentBRs = (start, dir = "nextSibling") => {
          let n = start[dir];
          while (n && n.nodeType === 1 && n.tagName === "BR") {
            const toDel = n;
            n = n[dir];
            toDel.remove();
          }
        };
        removeAdjacentBRs(box, "previousSibling");
        removeAdjacentBRs(box, "nextSibling");

        // 2) 删除提示框本体
        const md = box.closest(".md");
        box.remove();

        // 3) 若提示本来位于卡片最上方，确保后续第一个元素紧贴标题栏显示
        if (md) {
          const firstEl = md.firstElementChild;
          if (firstEl) {
            // 直接把第一个块的顶部外边距压到 0，避免残留空白
            firstEl.style.marginTop = "0px";
          }
        }
      });

      // 读取已保存的外观偏好并初始化按钮状态
      try{
        chrome.storage.sync.get(['options_theme_override','float_theme_override']).then(({ options_theme_override, float_theme_override }) => {
          const pick = (v)=> (['auto','light','dark'].includes(v) ? v : null);
          const v = pick(options_theme_override) || pick(float_theme_override) || 'auto';
          themeOverride = v;
          applyThemeWithOverride(shadow);
          markThemeButtonsActive(shadow);
        }).catch(() => {
          applyThemeWithOverride(shadow);
          markThemeButtonsActive(shadow);
        });
      }catch{
        applyThemeWithOverride(shadow);
        markThemeButtonsActive(shadow);
      }

      // 绑定按钮点击
      const themeWrap = shadow.getElementById('sx-theme');
      if (themeWrap){
        themeWrap.addEventListener('click', (e) => {
          const btn = e.target.closest('.theme-btn');
          if (!btn) return;
          const mode = btn.dataset.mode;
          if (!['auto','light','dark'].includes(mode)) return;
          themeOverride = mode;
          // 双向联动：同时写入浮窗与设置页 key
          try{ chrome.storage.sync.set({ float_theme_override: themeOverride, options_theme_override: themeOverride }); }catch{}
          applyThemeWithOverride(shadow);
          markThemeButtonsActive(shadow);
        });
      }

      await setEmpty(shadow);
    };

    // 合并版：直接使用内置模板，不依赖外部 HTML 文件
    root.innerHTML = fallbackHTML;
    initAfterHTML();

    return host;
  }

  async function setEmpty(shadow) {
    const i18n = await loadI18n();
    const currentLang = i18n ? await i18n.getCurrentLanguage() : 'zh';
    
    shadow.getElementById("sx-summary").innerHTML =
      `<div class="empty"><div class="icon">📝</div><div class="title">${currentLang === 'zh' ? '暂无摘要' : 'No Summary'}</div><div class="hint">${currentLang === 'zh' ? '点击上方"提取并摘要"' : 'Click "Extract & Summarize" above'}</div></div>`;
    shadow.getElementById("sx-cleaned").innerHTML =
      `<div class="empty"><div class="icon">📄</div><div class="title">${currentLang === 'zh' ? '暂无可读正文' : 'No Readable Content'}</div><div class="hint">${currentLang === 'zh' ? '点击上方"提取并摘要"' : 'Click "Extract & Summarize" above'}</div></div>`;
  }
  function setSkeleton(shadow) {
    shadow.getElementById("sx-summary").innerHTML =
      `<div class="skl" style="width:90%"></div><div class="skl" style="width:72%"></div><div class="skl" style="width:84%"></div>`;
    shadow.getElementById("sx-cleaned").innerHTML =
      `<div class="skl" style="width:96%"></div><div class="skl" style="width:64%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`;
  }
  function setLoading(shadow, loading) {
    shadow.getElementById("sx-run").disabled = !!loading;
    shadow.getElementById("sx-progress").classList.toggle("hidden", !loading);
  }

  async function renderToDom(shadow, summary, cleaned) {
    const i18n = await loadI18n();
    const currentLang = i18n ? await i18n.getCurrentLanguage() : 'zh';
    
    const $s = shadow.getElementById("sx-summary");
    const $c = shadow.getElementById("sx-cleaned");

    $s.innerHTML = summary
      ? stripInlineColor(renderMarkdown(summary))
      : `<div class="empty"><div class="icon">📝</div><div class="title">${currentLang === 'zh' ? '暂无摘要' : 'No Summary'}</div></div>`;

    if (cleaned === null) {
      $c.innerHTML =
        `<div class="skl" style="width:96%"></div>` +
        `<div class="skl" style="width:88%"></div>` +
        `<div class="skl" style="width:76%"></div>`;
    } else {
      $c.innerHTML = cleaned
        ? stripInlineColor(renderMarkdown(cleaned))
        : `<div class="empty"><div class="icon">📄</div><div class="title">${currentLang === 'zh' ? '暂无可读正文' : 'No Readable Content'}</div></div>`;
    }
  }

  // ===== 打开/绑定 =====
  const host = ensurePanel();
  const shadow = host.shadowRoot;
  applyTrialLabelToFloatButton(shadow);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.aiProvider) {
      applyTrialLabelToFloatButton(shadow);
    }
  });

  async function getActiveTabId() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB_ID" });
      return resp?.ok ? (resp.tabId ?? null) : null;
    } catch { return null; }
  }
  async function getState(tabId) {
    const resp = await chrome.runtime.sendMessage({ type: "PANEL_GET_STATE", tabId });
    if (!resp?.ok) throw new Error(resp?.error || "无法获取状态");
    return resp.data;
  }

  // ====== 轮询兜底 ======
  let pollTimer = null;
  function stopPolling(){ if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } }

  async function pollUntilDone(tabId, opts = {}) {
    stopPolling();
    const start = Date.now();
    let interval = 600;
    const maxInterval = 2000;
    const hardTimeout = 120000;

    const step = async () => {
      try {
        const st = await getState(tabId);
        if (st.status === "done") {
          setLoading(shadow, false);
          await renderToDom(shadow, st.summary, st.cleaned);
          stopPolling();
          return;
        }
        if (st.status === "error") {
          setLoading(shadow, false);
          const i18n = await loadI18n();
          const currentLang = i18n ? await i18n.getCurrentLanguage() : 'zh';
          shadow.getElementById("sx-summary").innerHTML =
            `<div class="alert"><div class="alert-content"><p>${currentLang === 'zh' ? '发生错误，请重试。' : 'An error occurred, please try again.'}</p></div></div>`;
          stopPolling();
          return;
        }
        if (st.status === "partial") {
          setLoading(shadow, true);
          await renderToDom(shadow, st.summary, null);
        } else if (st.status === "running") {
          setLoading(shadow, true);
          setSkeleton(shadow);
        }
      } catch {}
      if (Date.now() - start > hardTimeout) {
        setLoading(shadow, false);
        stopPolling();
        return;
      }
      interval = Math.min(maxInterval, Math.round(interval * 1.25));
      pollTimer = setTimeout(step, interval);
    };

    pollTimer = setTimeout(step, interval);
  }

  // 按钮：启动任务
  shadow.getElementById("sx-run").addEventListener("click", async () => {
    try {
      setLoading(shadow, true);
      setSkeleton(shadow);
      const tabId = await getActiveTabId();
      if (!tabId) throw new Error("未找到活动标签页");

      const resp = await chrome.runtime.sendMessage({ type: "PANEL_RUN_FOR_TAB", tabId });
      if (!resp || resp.ok !== true) throw new Error(resp?.error || "运行失败");

      try {
        const st = await getState(tabId);
        if (st.status === "partial") {
          renderToDom(shadow, st.summary, null);
        } else if (st.status === "done") {
          setLoading(shadow, true);
          setSkeleton(shadow);
        }
      } catch {}
      await pollUntilDone(tabId);
    } catch (e) {
      setLoading(shadow, false);
      shadow.getElementById("sx-summary").innerHTML =
        `<div class="alert"><div class="alert-content"><p>运行失败：${escapeHtml(e?.message||String(e))}</p></div></div>`;
    }
  });

  // 启动时恢复
  (async () => {
    try {
      const tabId = await getActiveTabId();
      if (!tabId) return;
      const st = await getState(tabId);
      if (st.status === "running") { setLoading(shadow, true); setSkeleton(shadow); pollUntilDone(tabId); }
      else if (st.status === "partial") { setLoading(shadow, true); renderToDom(shadow, st.summary, null); pollUntilDone(tabId); }
      else if (st.status === "done") { setLoading(shadow, false); renderToDom(shadow, st.summary, st.cleaned); stopPolling(); }
    } catch {}
  })();

  // 广播
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (!msg) return;
    if (msg.type === "PANEL_STATE_UPDATED") {
      const curId = await getActiveTabId();
      if (msg.tabId !== curId) return;
      try {
        const st = await getState(curId);
        if (st.status === "running") { setLoading(shadow, true); setSkeleton(shadow); }
        else if (st.status === "partial") { setLoading(shadow, true); renderToDom(shadow, st.summary, null); }
        else if (st.status === "done") { setLoading(shadow, false); renderToDom(shadow, st.summary, st.cleaned); stopPolling(); }
        else if (st.status === "error") {
          setLoading(shadow, false);
          shadow.getElementById("sx-summary").innerHTML =
            `<div class="alert"><div class="alert-content"><p>发生错误，请重试。</p></div></div>`;
          stopPolling();
        }
      } catch {}
    } else if (msg.type === "SX_CLOSE_FLOAT_PANEL") {
      const btn = shadow.getElementById("sx-close");
      if (btn) {
        btn.click(); // 复用关闭流程，负责清理 observer / 定时器
      } else {
        const host = document.getElementById(PANEL_ID);
        if (host) { host.remove(); window[MARK] = false; }
        stopPolling();
      }
    }
  });

  // 监听存储变更：当设置页切换主题时，浮窗跟随更新并高亮按钮
  try{
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (!changes.options_theme_override && !changes.float_theme_override) return;
      const next = (changes.options_theme_override?.newValue) ?? (changes.float_theme_override?.newValue);
      if (['auto','light','dark'].includes(next)) {
        themeOverride = next;
        try { applyThemeWithOverride(shadow); } catch {}
        try { markThemeButtonsActive(shadow); } catch {}
      }
    });
  }catch{}
})();