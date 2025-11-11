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
  
  // Keep-alive so the translate bubble won't be removed by other cleanup logic (e.g., floatpanel close)
  let keepAliveMO = null;
  // Set to false only when user explicitly closes the bubble
  window.__sxTranslateKeepAlive = true;

  // 与设置页一致的两个 Key；优先使用 float_theme_override（面板所见即所得）
  const THEME_KEYS = ['options_theme_override', 'float_theme_override'];

  // Track whether the user has manually moved the bubble; if true, we never auto-reposition
  let __sxUserMovedBubble = false;

  /* ===================== 主题解析 ===================== */
  function getSystemTheme() {
    try {
      return window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark' : 'light';
    } catch { return 'light'; }
  }

  async function resolveBubbleTheme() {
    try {
      const all = await chrome.storage.sync.get(THEME_KEYS);
      const fromOptions = all['options_theme_override'];
      const fromFloat   = all['float_theme_override'];
      // 优先采用浮窗里的手动设置，其次才是设置页；两者都为 auto 或未设置时再跟随系统
      const pref = (['light','dark','auto'].includes(fromFloat)   && fromFloat)
                || (['light','dark','auto'].includes(fromOptions) && fromOptions)
                || 'auto';
      return pref === 'auto' ? getSystemTheme() : pref;
    } catch {
      return getSystemTheme();
    }
  }

  function applyBubbleTheme(el, theme) {
    const t = theme === 'dark' ? 'dark' : 'light';
    el.classList.remove('light','dark');
    el.classList.add(t);
    el.setAttribute('data-theme', t); // 冗余标记，增强选择器稳定性
  }

  async function getTranslateTargetLang(){
    try{
      const { output_lang = 'zh' } = await chrome.storage.sync.get({ output_lang: 'zh' });
      const v = String(output_lang || '').trim().toLowerCase();
      if (['en','en-us','english','英语','英語'].includes(v)) return 'en';
      return 'zh';
    }catch{ return 'zh'; }
  }

  function looksLikeEnglish(text = ''){
    const cleaned = String(text || '').replace(/[\s0-9.,;:!?'"()\-_/\\]+/g, '');
    if (!cleaned) return false;
    const latin = (cleaned.match(/[A-Za-z]/g) || []).length;
    const cjk = (cleaned.match(/[\u4E00-\u9FFF]/g) || []).length;
    if (cjk > 0) return false;
    const ratio = latin / cleaned.length;
    return latin >= 3 && ratio >= 0.6;
  }

  function shouldEnableSpeakButton(originalText, targetLang){
    return targetLang === 'zh' && looksLikeEnglish(originalText);
  }

  function stopSpeech(){
    try{ window.speechSynthesis?.cancel(); }catch{}
    if (activeSpeakButton){
      activeSpeakButton.classList.remove('playing');
      activeSpeakButton.setAttribute('aria-pressed','false');
      activeSpeakButton = null;
    } else if (speakBtn){
      speakBtn.classList.remove('playing');
      speakBtn.setAttribute('aria-pressed','false');
    }
    isSpeaking = false;
  }

  function playSpeech(text, buttonEl = null){
    if (!text || !window.speechSynthesis) return;
    stopSpeech();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = (() => {
      try { return window.speechSynthesis.getVoices?.() || []; } catch { return []; }
    })();
    const prefer = voices.find(v => /en[-_]?US/i.test(v.lang))
                  || voices.find(v => /^en/i.test(v.lang));
    if (prefer) utter.voice = prefer;
    else utter.lang = 'en-US';
    utter.rate = 1;
    utter.pitch = 1;
    utter.onstart = () => {
      isSpeaking = true;
      const btn = buttonEl || speakBtn || null;
      activeSpeakButton = btn;
      if (btn){
        btn.classList.add('playing');
        btn.setAttribute('aria-pressed','true');
      }
    };
    const clear = () => {
      isSpeaking = false;
      if (activeSpeakButton){
        activeSpeakButton.classList.remove('playing');
        activeSpeakButton.setAttribute('aria-pressed','false');
        activeSpeakButton = null;
      }
    };
    utter.onend = clear;
    utter.onerror = clear;
    try{ window.speechSynthesis.speak(utter); }catch{ clear(); }
  }

  function configureSpeakButton(show, text){
    if (!speakBtn) return;
    if (!show){
      speakBtn.style.display = 'none';
      speakBtn.dataset.original = '';
      speakBtn.classList.remove('playing');
      speakBtn.setAttribute('aria-pressed','false');
      currentOriginalText = '';
      stopSpeech();
      return;
    }
    if (!('speechSynthesis' in window)){
      speakBtn.style.display = 'none';
      return;
    }
    currentOriginalText = text || '';
    speakBtn.dataset.original = currentOriginalText;
    speakBtn.style.display = '';
    speakBtn.classList.remove('playing');
    speakBtn.setAttribute('aria-pressed','false');
  }

  async function ensureSpeechSupported(){
    if ('speechSynthesis' in window) return true;
    const i18n = await loadI18n();
    const lang = i18n ? await i18n.getCurrentLanguage() : 'zh';
    const msg = lang === 'zh'
      ? '当前浏览器不支持朗读功能。'
      : 'Speech synthesis is not supported in this browser.';
    try { alert(msg); } catch {}
    return false;
  }

  // ===== 内联译文块样式（随主题联动） =====
  function styleInlineQuoteForTheme(q, theme){
    const isDark = theme === 'dark';
    // 统一基本样式（间距已在调用处设置）
    q.style.borderLeft = isDark ? '3px solid #64748b' : '3px solid #94a3b8';
    // 深色：深底 + 白字；浅色：不透明浅灰底 + 深色字（避免透明导致暗底站点上看不清）
    const bg = isDark ? '#0f172a' : '#f1f5f9';
    const fg = isDark ? '#ffffff' : '#0f172a';
    try {
      q.style.setProperty('background-color', bg, 'important');
      q.style.setProperty('color', fg, 'important');
    } catch {
      q.style.backgroundColor = bg;
      q.style.color = fg;
    }
  }

  // 将原节点的几何约束（宽度与水平外边距）尽量镜像到译文块上
  function mirrorBlockGeometryFrom(el, q){
    try{
      const cs = getComputedStyle(el);
      const parent = el.parentElement;
      const parentCS = parent ? getComputedStyle(parent) : null;
      const erect = el.getBoundingClientRect();

      // 复制盒模型类型，避免宽度解释差异
      if (cs.boxSizing) { q.style.boxSizing = cs.boxSizing; }

      // 响应式优先：限制最大宽度，宽度不超过原段落，水平用 auto 实现弹性居中
      if (erect && erect.width){
        const widthPx = Math.round(erect.width);
        q.style.maxWidth = widthPx + 'px';
        q.style.width = 'min(100%, ' + widthPx + 'px)';
      }

      // 若父容器为 grid，交由上游 grid 定位与 justifySelf/alignSelf 决定；否则使用居中 auto
      if (!(parentCS && parentCS.display && parentCS.display.includes('grid'))){
        q.style.marginLeft = 'auto';
        q.style.marginRight = 'auto';
      }
    }catch{}
  }
  async function restyleAllInlineTranslations(){
    const theme = await resolveBubbleTheme();
    document.querySelectorAll('blockquote[data-sx-inline-translation="1"]').forEach((q)=>{
      try{ styleInlineQuoteForTheme(q, theme); }catch{}
    });
  }

  // 绑定主题监听：当主题切换时，实时重渲染已插入的译文块
  let __sxInlineThemeWatchersBound = false;
  function bindInlineThemeWatchersOnce(){
    if (__sxInlineThemeWatchersBound) return;
    __sxInlineThemeWatchersBound = true;
    try {
      chrome.storage.onChanged.addListener(async (changes, area)=>{
        if (area==='sync' && (changes.options_theme_override || changes.float_theme_override)) {
          try { await restyleAllInlineTranslations(); } catch {}
        }
      });
    } catch {}
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const fn = async ()=> { try { await restyleAllInlineTranslations(); } catch {} };
      if (mq && mq.addEventListener) mq.addEventListener('change', fn);
      else if (mq && mq.addListener) mq.addListener(fn);
    } catch {}
  }

  // --- 在开始翻译前关闭 floatpanel，避免遮挡 ---
  async function closeFloatPanelIfAny() {
    try {
      // 1) 广播给可能在监听的脚本（内容脚本/面板脚本）
      try { window.dispatchEvent(new CustomEvent('SX_FLOATPANEL_CLOSE')); } catch {}
      try { chrome.runtime.sendMessage({ type: 'SX_FLOATPANEL_CLOSE' }); } catch {}

      // 2) DOM 兜底处理：尽量优雅关闭；没有关闭按钮则隐藏/移除
      const hostCandidates = [
        '#sx-floatpanel-host',
        '.sx-floatpanel-host',
        '[data-sx-floatpanel]',
        '[data-sx-floatpanel-host]'
      ];
      for (const sel of hostCandidates) {
        document.querySelectorAll(sel).forEach((host) => {
          // 尝试触发它自身的“关闭按钮”
          const closeBtn = host.querySelector('[data-sx-floatpanel-close], .sx-float-close, [aria-label="Close"], button[title="Close"]');
          if (closeBtn) {
            try { closeBtn.click(); return; } catch {}
          }
          // 再尝试派发自定义事件（如果面板脚本内部监听）
          try {
            host.dispatchEvent(new CustomEvent('SX_FLOATPANEL_CLOSE', { bubbles: true }));
          } catch {}
          // 最后兜底：先隐藏避免遮挡；如需彻底移除可改为 host.remove()
          host.style.display = 'none';
        });
      }
      // 3) 给对方一点点时间完成动画/收起（非常短）
      await new Promise(r => setTimeout(r, 60));
    } catch {}
  }

  /* ===================== UI 构建 ===================== */
  let host, wrap, contentEl, closeBtn, spinner, shadowRootEl, copyBtn, speakBtn;
  let resizeHandle;
  let currentOriginalText = '';
  let isSpeaking = false;
  let activeSpeakButton = null;

  function ensureUI() {
    if (host) return;
    host = document.createElement('div');
    // Mark as sticky so generic cleanups can skip it
    host.dataset.sxSticky = '1';
    host.classList.add('sx-translate-root');
    host.id = 'sx-translate-host';
    host.style.position = 'fixed';
    host.style.left = '0px';
    host.style.top  = '0px';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'auto';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    shadowRootEl = shadow;
    shadow.innerHTML = `
      <style>
        :host { all: initial; }

        .bubble{
          max-width: 480px;
          min-width: 260px;
          background: rgba(17, 24, 39, 0.55);
          color: #f8fafc;
          border-radius: 16px;
          box-shadow:
            0 20px 40px rgba(0,0,0,.25),
            0 0 0 1px rgba(255,255,255,.12) inset,
            0 8px 32px rgba(0,0,0,.15);
          padding: 8px 10px 10px;
          font: 14px/1.6 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          position: relative;
          /* 修复圆角透明问题 */
          isolation: isolate;
          /* enter/leave base */
          opacity: 0;
          transform: translateY(6px) scale(.98);
          transition: opacity .58s ease, transform .58s cubic-bezier(.2,.7,.3,1), box-shadow .62s ease;
        }
        .bubble::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(255,255,255,.1) 0%, rgba(255,255,255,.05) 50%, rgba(255,255,255,.02) 100%);
          pointer-events: none;
          z-index: -1;
          /* 确保圆角区域完全透明 */
          overflow: hidden;
        }
        .bubble.on{ opacity:1; transform: translateY(0) scale(1); }
        .bubble.leaving{ opacity:.0; transform: translateY(4px) scale(.985); transition: opacity .50s ease, transform .50s ease; }
        .bubble.light{
          background: rgba(255,255,255,0.55);
          color: #0f172a;
          box-shadow:
            0 20px 40px rgba(2,6,23,.15),
            0 0 0 1px rgba(15,23,42,.08) inset,
            0 8px 32px rgba(2,6,23,.08);
        }
        .bubble.light::before {
          background: linear-gradient(135deg, rgba(255,255,255,.15) 0%, rgba(255,255,255,.08) 50%, rgba(255,255,255,.03) 100%);
        }

        /* ===== 标题栏（可拖动区域）====== */
        .header{
          display:flex; align-items:center; justify-content:space-between; gap:8px;
          margin:-2px -2px 8px; padding:8px 10px;
          border-radius: 12px;
          user-select: none;
          cursor: grab;
          /* 深色：内凹玻璃质感 */
          background: linear-gradient(180deg, rgba(82,98,128,.25), rgba(82,98,128,.12));
          border: 1px solid rgba(255,255,255,.15);
          backdrop-filter: blur(12px) saturate(150%);
          -webkit-backdrop-filter: blur(12px) saturate(150%);
          position: relative;
          /* 修复圆角透明问题 */
          isolation: isolate;
          box-shadow: inset 0 1px 2px rgba(0,0,0,.1), inset 0 -1px 1px rgba(255,255,255,.05);
        }
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(255,255,255,.1) 0%, rgba(255,255,255,.05) 50%, rgba(255,255,255,.02) 100%);
          pointer-events: none;
          z-index: -1;
          /* 确保圆角区域完全透明 */
          overflow: hidden;
          box-shadow: inset 0 1px 3px rgba(0,0,0,.15), inset 0 -1px 1px rgba(255,255,255,.08);
        }
        .bubble.light .header{
          background: linear-gradient(180deg, rgba(100,116,139,.25), rgba(100,116,139,.12));
          border: 1px solid rgba(100,116,139,.2);
          backdrop-filter: blur(12px) saturate(150%);
          -webkit-backdrop-filter: blur(12px) saturate(150%);
          box-shadow: inset 0 1px 2px rgba(100,116,139,.1), inset 0 -1px 1px rgba(255,255,255,.08);
        }
        .bubble.light .header::before {
          background: linear-gradient(135deg, rgba(255,255,255,.15) 0%, rgba(255,255,255,.08) 50%, rgba(255,255,255,.03) 100%);
          box-shadow: inset 0 1px 3px rgba(100,116,139,.12), inset 0 -1px 1px rgba(255,255,255,.1);
        }
        .dragging .header { cursor: grabbing; }

        .title{
          font-weight: 800;
          font-size: 12px;
          letter-spacing: .25px;
          /* “淡淡的颜色”——暗色偏蓝灰、亮色偏清爽蓝 */
          color: #e2e8f0;
          text-shadow: 0 1px 2px rgba(0,0,0,.3);
        }
        .bubble.light .title{ 
          color: #1e293b;
          text-shadow: 0 1px 2px rgba(255,255,255,.5);
        }

        .toolbar{
          display:flex; align-items:center; gap:6px;
        }
        .tbtn{
          all: unset; cursor:pointer;
          min-width: 22px; height: 22px; padding: 0 8px;
          display:inline-flex; align-items:center; justify-content:center;
          border-radius: 8px;
          font-size: 12px;
          color: inherit; opacity: .9;
          border: 1px solid rgba(255,255,255,.2);
          background: rgba(255,255,255,.15);
          backdrop-filter: blur(8px) saturate(120%);
          -webkit-backdrop-filter: blur(8px) saturate(120%);
          transition: all .2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,.2);
        }
        .tbtn.speak{
          min-width: 22px;
          height: 22px;
          padding: 0 3px;
        }
        .tbtn.speak svg{
          width: 14px; height: 14px; display:block;
        }
        .tbtn.speak.playing{
          background: rgba(234,179,8,.25);
          border-color: rgba(234,179,8,.45);
          box-shadow: 0 1px 4px rgba(234,179,8,.35);
        }
        .bubble.light .tbtn.speak.playing{
          background: rgba(234,179,8,.22);
          border-color: rgba(234,179,8,.5);
          box-shadow: 0 1px 4px rgba(234,179,8,.3);
        }
        /* Round, smaller variant for A-/A+ */
        #sx-font-inc, #sx-font-dec{
          min-width: 20px; width: 20px; height: 20px; padding: 0;
          border-radius: 999px; font-weight: 800; line-height: 1; font-size: 12px;
        }
        .tbtn:hover{ 
          opacity: 1; 
          background: rgba(255,255,255,.25);
          border-color: rgba(255,255,255,.3);
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(0,0,0,.3), 0 1px 2px rgba(0,0,0,.2);
        }
        .bubble.light .tbtn{
          border-color: rgba(100,116,139,.3);
          background: rgba(100,116,139,.15);
          backdrop-filter: blur(8px) saturate(120%);
          -webkit-backdrop-filter: blur(8px) saturate(120%);
          box-shadow: 0 1px 3px rgba(100,116,139,.1);
        }
        .bubble.light .tbtn:hover{ 
          background: rgba(100,116,139,.25);
          border-color: rgba(100,116,139,.4);
          box-shadow: 0 2px 6px rgba(100,116,139,.2), 0 1px 2px rgba(0,0,0,.1);
          transform: translateY(-1px);
        }

        .close{
          all: unset;
          cursor: pointer;
          width: 22px; height: 22px;
          border-radius: 8px;
          display:grid; place-items:center;
          color: inherit; opacity: .85;
          transition: all .2s ease;
        }
        .close:hover{
          background: rgba(255,255,255,.2);
          transform: scale(1.1);
          backdrop-filter: blur(6px) saturate(110%);
          -webkit-backdrop-filter: blur(6px) saturate(110%);
          box-shadow: 0 1px 3px rgba(0,0,0,.3);
        }
        .bubble.light .close:hover{
          background: rgba(100,116,139,.25);
          backdrop-filter: blur(6px) saturate(110%);
          -webkit-backdrop-filter: blur(6px) saturate(110%);
          box-shadow: 0 1px 3px rgba(100,116,139,.15);
        }

        .content{
          white-space: normal; word-break: break-word;
          max-height: 56vh; overflow:auto;
          padding: 0 14px;
          line-height: 1.56;
          min-height: 10px; /* slightly larger default height */
        }
        /* petite-vue style enter transitions (staggered) */
        .content .p{ opacity: 0; transform: translateY(4px); transition: opacity .32s ease, transform .32s ease; }
        .content .p.on{ opacity: 1; transform: translateY(0); }
        .content .p{ margin:0; }
        .content .p + .p{ margin-top: 8px; }

        /* ===== Resize handle (bottom-right) ===== */
        .resize-handle{
          position:absolute; right:5px; bottom:5px; width:9px; height:9px; cursor: se-resize;
        }
        /* Small 45° triangle pointing to top-left, with subtle bevel */
        .resize-handle::before{
          content:""; position:absolute; right:0; bottom:0; width:9px; height:9px;
          background:
            /* inner edge highlight */
            linear-gradient(135deg, rgba(255,255,255,.10) 48%, rgba(255,255,255,0) 52%),
            /* main triangle fill */
            linear-gradient(135deg, rgba(255,255,255,.28) 0 49%, rgba(255,255,255,0) 50% 100%);
          filter: drop-shadow(0 0 1px rgba(0,0,0,.10));
        }
        .bubble.light .resize-handle::before{
          background:
            linear-gradient(135deg, rgba(31,41,55,.18) 48%, rgba(31,41,55,0) 52%),
            linear-gradient(135deg, rgba(31,41,55,.40) 0 49%, rgba(31,41,55,0) 50% 100%);
          filter: drop-shadow(0 0 1px rgba(31,41,55,.08));
        }

        /* Simple spinner (legacy) */
        .spinner{ width:16px; height:16px; border:2px solid currentColor; border-right-color: transparent; border-radius:50%; animation: r .8s linear infinite; opacity:.6; display:inline-block; }
        @keyframes r{ to{ transform: rotate(360deg); } }

        /* Equalizer bars loader */
        .loader-eq{ display:flex; align-items:flex-end; gap:4px; height:40px; padding: 6px 0 10px; }
        .loader-eq .bar{ width:4px; height: 24px; border-radius: 3px; opacity:.9; transform-origin: center bottom; will-change: transform, opacity; }
        .loader-eq .bar{ background: rgba(255,255,255,.85); box-shadow: 0 1px 4px rgba(0,0,0,.15); }
        .bubble.light .loader-eq .bar{ background: rgba(15,23,42,.75); box-shadow: 0 1px 3px rgba(15,23,42,.12); }
        .loader-eq .b1{  animation: eq 900ms ease-in-out -120ms infinite; }
        .loader-eq .b2{  animation: eq 840ms ease-in-out  -60ms infinite; }
        .loader-eq .b3{  animation: eq 760ms ease-in-out   -0ms infinite; }
        .loader-eq .b4{  animation: eq 880ms ease-in-out  -180ms infinite; }
        .loader-eq .b5{  animation: eq 820ms ease-in-out   -90ms infinite; }
        .loader-eq .b6{  animation: eq 940ms ease-in-out   -30ms infinite; }
        .loader-eq .b7{  animation: eq 800ms ease-in-out  -150ms infinite; }
        .loader-eq .b8{  animation: eq 860ms ease-in-out   -75ms infinite; }
        .loader-eq .b9{  animation: eq 780ms ease-in-out  -210ms infinite; }
        .loader-eq .b10{ animation: eq 920ms ease-in-out   -45ms infinite; }
        @keyframes eq{
          0%, 100% { transform: scaleY(.35); opacity:.7; }
          25%      { transform: scaleY(1.00); opacity:1; }
          50%      { transform: scaleY(.55); opacity:.9; }
          75%      { transform: scaleY(.85); opacity:.95; }
        }
      </style>

      <div class="bubble" id="sx-bubble" data-theme="dark">
        <div class="header" id="sx-drag-handle">
          <div class="title" id="sx-title">SummarizerX · Translate</div>
          <div class="toolbar">
            <button class="tbtn" id="sx-font-dec" title="A-">−</button>
            <button class="tbtn" id="sx-font-inc" title="A+">＋</button>
            <button class="tbtn" id="sx-copy" title="Copy result">Copy</button>
            <button class="tbtn speak" id="sx-speak" title="Speak original" aria-pressed="false" style="display:none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 9v6h3l4 4V5L7 9z"></path>
                <path d="M16 9a4 4 0 0 1 0 6"></path>
                <path d="M18.5 7a7 7 0 0 1 0 10"></path>
              </svg>
            </button>
            <button class="close" id="sx-close" aria-label="Close">✕</button>
          </div>
        </div>
        <div class="content" id="sx-content"></div>
        <div class="resize-handle" id="sx-resize" title="拖动调整大小" aria-label="调整大小"></div>
      </div>
    `;

    // cache
    wrap = shadow.getElementById('sx-bubble');
    contentEl = shadow.getElementById('sx-content');
    closeBtn = shadow.getElementById('sx-close');
    copyBtn  = shadow.getElementById('sx-copy');
    speakBtn = shadow.getElementById('sx-speak');
    const fontIncBtn = shadow.getElementById('sx-font-inc');
    const fontDecBtn = shadow.getElementById('sx-font-dec');
    resizeHandle = shadow.getElementById('sx-resize');

    // trigger enter animation on next frame
    try {
      requestAnimationFrame(() => { try{ wrap.classList.add('on'); }catch{} });
    } catch { setTimeout(()=>{ try{ wrap.classList.add('on'); }catch{} }, 0); }

    // --- Keep the bubble alive even if other scripts try to remove it (e.g., floatpanel global cleanup)
    function setupKeepAlive(){
      if (keepAliveMO) return;
      keepAliveMO = new MutationObserver(() => {
        try{
          if (window.__sxTranslateKeepAlive !== false && host && !document.body.contains(host)) {
            document.body.appendChild(host);
          }
        }catch{}
      });
      try{ keepAliveMO.observe(document.body, { childList: true }); }catch{}
    }
    setupKeepAlive();

    // 更新UI文本为当前语言
    updateUIText();
    
    // 关闭/复制
    closeBtn.addEventListener('click', removeUI);
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(contentEl.textContent || ''); } catch {}
      // 小提示（不打扰）
      const i18n = await loadI18n();
      if (i18n) {
        copyBtn.textContent = await i18n.t('floatPanel.copied');
        setTimeout(async () => {
          copyBtn.textContent = await i18n.t('floatPanel.copy');
        }, 800);
      } else {
        copyBtn.textContent = 'Copied';
        setTimeout(()=> (copyBtn.textContent = 'Copy'), 800);
      }
    });
    speakBtn?.addEventListener('click', async () => {
      if (!currentOriginalText) return;
      if (!await ensureSpeechSupported()) return;
      if (isSpeaking && activeSpeakButton === speakBtn) {
        stopSpeech();
      } else {
        playSpeech(currentOriginalText, speakBtn);
      }
    });

    // 字号调节（持久化）
    function applyFontPx(px){
      const n = Math.max(12, Math.min(22, Math.round(px||14)));
      try{ contentEl.style.fontSize = n + 'px'; }catch{}
      try{ chrome.storage.sync.set({ sx_translate_font_px: n }); }catch{}
      return n;
    }
    async function initFontPx(){
      try{
        const { sx_translate_font_px } = await chrome.storage.sync.get(['sx_translate_font_px']);
        const v = Number.isFinite(+sx_translate_font_px) ? +sx_translate_font_px : 14;
        applyFontPx(v);
      }catch{ applyFontPx(14); }
    }
    initFontPx();

    function getCurrentFontPx(){
      const cs = getComputedStyle(contentEl);
      const v = parseFloat(cs.fontSize||'14')||14;
      return Math.round(v);
    }
    fontIncBtn?.addEventListener('click', ()=>{ applyFontPx(getCurrentFontPx()+1); });
    fontDecBtn?.addEventListener('click', ()=>{ applyFontPx(getCurrentFontPx()-1); });

    // 延后一帧绑定“外点关闭”，避免打开时被误判
    setTimeout(() => {
      document.addEventListener('keydown', escToClose, { passive: true });
      document.addEventListener('mousedown', clickOutsideToClose, true);
    }, 0);

    // ===== 拖拽：以 header 为手柄 =====
    const handle = shadow.getElementById('sx-drag-handle');
    let dragOffsetX = 0, dragOffsetY = 0, dragging = false;
    // 拖动不设与选区关联的限制，用户可在视窗任意区域放置

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      wrap.classList.add('dragging');
      const rect = host.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      // 不再绑定选区矩形为牵引范围
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const br = host.getBoundingClientRect();
      const bubbleW = br.width  || wrap.getBoundingClientRect().width  || 320;
      const bubbleH = br.height || wrap.getBoundingClientRect().height || 120;
      let newX = e.clientX - dragOffsetX;
      let newY = e.clientY - dragOffsetY;
      // 不设置与选区相关的限制
      newX = Math.min(Math.max(0, newX), vw - bubbleW);
      newY = Math.min(Math.max(0, newY), vh - bubbleH);
      host.style.left = `${Math.round(newX)}px`;
      host.style.top  = `${Math.round(newY)}px`;
      __sxUserMovedBubble = true; // 标记：用户手动移动过
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      wrap.classList.remove('dragging');
      // 无牵引范围需要清理
    });

    // ===== 右下角缩放：拖动改变宽高 =====
    let resizing = false; let startX=0, startY=0; let startW=0, startH=0;
    const headerEl = shadow.getElementById('sx-drag-handle');
    function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
    function onResizeMove(e){
      if (!resizing) return;
      const clientX = e.touches? e.touches[0]?.clientX : e.clientX;
      const clientY = e.touches? e.touches[0]?.clientY : e.clientY;
      if (clientX==null || clientY==null) return;
      const dx = clientX - startX; const dy = clientY - startY;
      const vw = window.innerWidth, vh = window.innerHeight;
      const rawW = clamp(startW + dx, 240, Math.max(320, Math.floor(vw * 0.9)));
      const rawH = clamp(startH + dy, 120, Math.max(160, Math.floor(vh * 0.8)));

      // Apply directly for immediate, predictable resizing (original behavior)
      wrap.style.maxWidth = 'none';
      wrap.style.width = Math.round(rawW) + 'px';

      const padTop = 8, padBottom = 10; // as defined in .bubble padding
      const headerH = headerEl?.getBoundingClientRect()?.height || 28;
      const contentH = Math.max(80, Math.round(rawH - headerH - padTop - padBottom));
      contentEl.style.maxHeight = contentH + 'px';
      contentEl.style.height    = contentH + 'px';

      __sxUserMovedBubble = true;
      e.preventDefault();
    }
    function endResize(){
      if (!resizing) return;
      resizing = false;
      document.removeEventListener('mousemove', onResizeMove, true);
      document.removeEventListener('mouseup', endResize, true);
      document.removeEventListener('touchmove', onResizeMove, {capture:true, passive:false});
      document.removeEventListener('touchend', endResize, {capture:true});
    }
    function startResize(e){
      resizing = true;
      const br = wrap.getBoundingClientRect();
      startW = br.width; 
      startH = br.height;
      const ptX = e.touches? e.touches[0]?.clientX : e.clientX;
      const ptY = e.touches? e.touches[0]?.clientY : e.clientY;
      startX = ptX||0; startY = ptY||0;
      document.addEventListener('mousemove', onResizeMove, true);
      document.addEventListener('mouseup', endResize, true);
      document.addEventListener('touchmove', onResizeMove, {capture:true, passive:false});
      document.addEventListener('touchend', endResize, {capture:true});
      e.preventDefault();
    }
    resizeHandle?.addEventListener('mousedown', startResize);
    resizeHandle?.addEventListener('touchstart', startResize, {passive:false});
  }

  function removeUI() {
    // Disable keep-alive so explicit close actually removes the bubble
    window.__sxTranslateKeepAlive = false;
    stopSpeech();
    if (keepAliveMO) { try{ keepAliveMO.disconnect(); }catch{} keepAliveMO = null; }
    if (!host) return;
    try {
      document.removeEventListener('keydown', escToClose, { passive: true });
      document.removeEventListener('mousedown', clickOutsideToClose, true);
    } catch {}
    // play leave animation, then remove
    try { wrap.classList.remove('on'); wrap.classList.add('leaving'); } catch {}
    const teardown = () => {
      try{ host.remove(); }catch{}
      __sxUserMovedBubble = false;
      host = wrap = contentEl = closeBtn = spinner = shadowRootEl = copyBtn = speakBtn = null;
      currentOriginalText = '';
    };
    try { setTimeout(teardown, 520); } catch { teardown(); }
  }

  // 更新UI文本为当前语言
  async function updateUIText() {
    const i18n = await loadI18n();
    if (!i18n) return;
    
    try {
      const title = shadow.getElementById('sx-title');
      const copyBtn = shadow.getElementById('sx-copy');
      const speakBtn = shadow.getElementById('sx-speak');
      const closeBtn = shadow.getElementById('sx-close');
      const fontIncBtn = shadow.getElementById('sx-font-inc');
      const fontDecBtn = shadow.getElementById('sx-font-dec');
      
      if (title) {
        const currentLang = await i18n.getCurrentLanguage();
        if (currentLang === 'zh') {
          title.textContent = 'SummarizerX · 翻译';
        } else {
          title.textContent = 'SummarizerX · Translate';
        }
      }
      
      if (copyBtn) {
        copyBtn.textContent = await i18n.t('floatPanel.copy');
        copyBtn.title = await i18n.t('floatPanel.copy');
      }
      if (speakBtn) {
        const lang = await i18n.getCurrentLanguage();
        const label = lang === 'zh' ? '朗读原文' : 'Speak original';
        speakBtn.title = label;
        speakBtn.setAttribute('aria-label', label);
      }
      
      if (closeBtn) {
        closeBtn.setAttribute('aria-label', await i18n.t('floatPanel.close'));
      }

      // 字号按钮标题（不改显示字符，仅更新提示）
      try{
        const lang = await i18n.getCurrentLanguage();
        if (fontIncBtn) fontIncBtn.title = lang==='zh' ? '增大字号' : 'Increase font size';
        if (fontDecBtn) fontDecBtn.title = lang==='zh' ? '减小字号' : 'Decrease font size';
      }catch{}
    } catch (e) {
      console.warn('Failed to update UI text:', e);
    }
  }

  function escToClose(e){ if (e.key === 'Escape') removeUI(); }
  function clickOutsideToClose(e) {
    if (!host) return;
    const t = e.target;
    // 点击发生在我们 shadow DOM 内则忽略
    if (shadowRootEl && shadowRootEl.contains(t)) return;
    // 命中宿主也忽略
    if (host.contains(t)) return;
    removeUI();
  }

  /* ===================== 位置计算 ===================== */
  function computePositionFor(rect, desiredW = 320, desiredH = 140) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const hGap = 8;   // horizontal spacing from selection
    const vGap = 12;  // vertical spacing from selection (slightly larger by default)
    // 依次尝试：右上、左上、右下、左下
    const candidates = [
      { x: rect.right + hGap,            y: rect.top    - vGap - desiredH }, // TR
      { x: rect.left  - hGap - desiredW, y: rect.top    - vGap - desiredH }, // TL
      { x: rect.right + hGap,            y: rect.bottom + vGap },           // BR
      { x: rect.left  - hGap - desiredW, y: rect.bottom + vGap }            // BL
    ];
    let pos = candidates.find(p => p.x >= 0 && p.y >= 0 && (p.x + desiredW) <= vw && (p.y + desiredH) <= vh);
    if (!pos) {
      pos = {
        x: Math.min(Math.max(8, rect.right + hGap), vw - desiredW - 8),
        y: Math.min(Math.max(8, rect.top),          vh - desiredH - 8)
      };
    }
    return pos;
  }

  function placeBubbleNearSelection() {
    if (__sxUserMovedBubble) return; // 用户动过就不再自动摆放
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    // 直接按“可能的最大尺寸”预留位置，避免内容加载后再跳动
    const MAX_W = 480;
    const MAX_H = Math.floor(window.innerHeight * 0.56) + 40; // 与 .content max-height 近似，外加内边距
    const pos = computePositionFor(rect, MAX_W, MAX_H);
    host.style.left = `${Math.round(pos.x)}px`;
    host.style.top  = `${Math.round(pos.y)}px`;
  }

  function adjustIfOverflowing() {
    if (__sxUserMovedBubble || !host || !wrap) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const br = wrap.getBoundingClientRect();
    // 若完全在视窗内，就不动
    if (br.left >= 0 && br.top >= 0 && br.right <= vw && br.bottom <= vh) return;

    // 否则，以真实尺寸重新计算一个不会溢出的最优位置
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const pos2 = computePositionFor(rect, br.width, br.height);
    host.style.left = `${Math.round(pos2.x)}px`;
    host.style.top  = `${Math.round(pos2.y)}px`;
  }

  /* ===================== 翻译主流程 ===================== */
  async function startTranslateFlow() {
    try {
      const sel = window.getSelection();
      const text = sel ? String(sel.toString()).trim() : '';
      if (!text) return;
      const originalText = text;
      const targetLang = await getTranslateTargetLang();

      // ✅ 开始翻译前先关闭 floatpanel，避免遮挡
      await closeFloatPanelIfAny();

      ensureUI();
      configureSpeakButton(false);

      // 应用主题（严格跟随设置；仅当两者都无值时才跟随系统）
      applyBubbleTheme(wrap, await resolveBubbleTheme());

      placeBubbleNearSelection();

      // 主题变化实时响应（仅绑定一次）
      if (!startTranslateFlow._bound) {
        chrome.storage.onChanged.addListener(async (changes, area)=>{
          if (area==='sync' && (changes.options_theme_override || changes.float_theme_override)) {
            applyBubbleTheme(wrap, await resolveBubbleTheme());
          }
        });
        try {
          const mq = window.matchMedia('(prefers-color-scheme: dark)');
          const fn = async ()=> applyBubbleTheme(wrap, await resolveBubbleTheme());
          if (mq && mq.addEventListener) mq.addEventListener('change', fn);
          else if (mq && mq.addListener) mq.addListener(fn);
        } catch {}
        startTranslateFlow._bound = true;
      }

      // 加载中：均衡器柱条动画（equalizer bars）
      contentEl.textContent = '';
      spinner = document.createElement('div');
      spinner.className = 'loader-eq';
      spinner.setAttribute('role','progressbar');
      spinner.setAttribute('aria-label','Loading');
      spinner.innerHTML = `
        <span class="bar b1"></span>
        <span class="bar b2"></span>
        <span class="bar b3"></span>
        <span class="bar b4"></span>
        <span class="bar b5"></span>
        <span class="bar b6"></span>
        <span class="bar b7"></span>
        <span class="bar b8"></span>
        <span class="bar b9"></span>
        <span class="bar b10"></span>
      `;
      contentEl.appendChild(spinner);

      const resp = await chrome.runtime.sendMessage({ type: 'SX_TRANSLATE_REQUEST', text });
      if (!resp?.ok) throw new Error(resp?.error || 'Translate failed');

      // 设置结果内容；规范换行并去除空行，避免段落间距过大
      try{
        let txt = String(resp.result || '');
        txt = txt.replace(/\r\n?/g,'\n');           // normalize CRLF
        txt = txt.replace(/^\s*\n+/,'');            // trim leading blank lines
        txt = txt.replace(/\n+\s*$/,'');            // trim trailing blank lines
        // collapse multiple blank lines to a single separator
        txt = txt.replace(/\n[ \t]*\n+/g,'\n');
        const lines = txt.split(/\n/).map(s=>s.trim()).filter(Boolean);
        const esc = (s)=> s.replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m]));
        contentEl.innerHTML = lines.map(l=>`<div class="p">${esc(l)}</div>`).join('');
        // stagger enter reveal
        try{
          const ps = Array.from(contentEl.querySelectorAll('.p'));
          ps.forEach((el, i)=>{
            setTimeout(()=>{ try{ el.classList.add('on'); }catch{} }, Math.min(320, i*36));
          });
        }catch{}
      }catch{
        contentEl.textContent = resp.result;
      }
      spinner?.remove(); spinner = null;

      // 仅当用户未拖动时，做一次微调（防止气泡溢出视窗）
      adjustIfOverflowing();
      configureSpeakButton(shouldEnableSpeakButton(originalText, targetLang), originalText);
    } catch (e) {
      try { if (contentEl) contentEl.textContent = `⚠️ ${e?.message || e}`; } catch {}
      spinner?.remove(); spinner = null;
      configureSpeakButton(false);
    }
  }

  // 背景脚本右键菜单触发
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'SX_TRANSLATE_SELECTION') startTranslateFlow();
    if (msg?.type === 'SX_TRANSLATE_FULL_PAGE') translateFullPageInline();
    if (msg?.type === 'SX_RESTORE_FULL_PAGE') restoreFullPageInline();
    // 忽略 SX_CLOSE_FLOAT_PANEL：那是让内容浮窗收起，不影响翻译气泡
  });

  /* ===================== 全文分块翻译并内联插入 ===================== */
  // 通过“运行代号”方式实现可中断：当 restore 或新一次翻译启动时，递增 runId
  let __sxFullTranslateRunId = 0;
  function ensureInlineTranslateStyles(){
    try{
      if (document.getElementById('sx-inline-translate-style')) return;
      const st = document.createElement('style');
      st.id = 'sx-inline-translate-style';
      st.textContent = `
        @keyframes sx-it-spin { to { transform: rotate(360deg); } }
        .sx-it-spinner{ display:inline-block; width:14px; height:14px; border:2px solid currentColor; border-right-color: transparent; border-radius:50%; animation: sx-it-spin .8s linear infinite; opacity:.6; margin-right:6px; vertical-align:-2px; }
        /* Vue-like enter reveal for inline translation blocks */
        blockquote[data-sx-inline-translation="1"].sx-it{ opacity: 0; transform: translateY(6px); transition: opacity .42s ease, transform .42s cubic-bezier(.2,.7,.3,1); will-change: opacity, transform; }
        blockquote[data-sx-inline-translation="1"].sx-it.on{ opacity: 1; transform: translateY(0); }
        .sx-it-text{ opacity:0; transition: opacity .34s ease; }
        .sx-it-text.on{ opacity:1; }
        /* Local zoom controls (per paragraph) */
        blockquote[data-sx-inline-translation="1"]{ position: relative; }
        .sx-it-zoom{ position:absolute; right:8px; top:8px; transform: none; display:flex; gap:6px; align-items:center; opacity:.9; z-index:1; }
        .sx-it-zoom button{
          width:22px; height:22px; border-radius:6px; border:1px solid rgba(80,110,140,.35);
          background: rgba(255,255,255,.88); color:#1f2937; font-weight:700; font-size:13px; line-height:1;
          cursor:pointer; padding:0; display:grid; place-items:center;
          box-shadow: 0 1px 2px rgba(0,0,0,.06);
          transition: transform .12s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease;
        }
        .sx-it-zoom button:hover{ background: #fff; transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,.12); }
        .sx-it-zoom button:active{ transform: translateY(0); box-shadow: 0 1px 2px rgba(0,0,0,.06); }
        .sx-it-zoom button svg{ width:14px; height:14px; display:block; }
        .sx-it-zoom button.playing{
          background: rgba(234,179,8,.25);
          border-color: rgba(234,179,8,.45);
          box-shadow: 0 1px 4px rgba(234,179,8,.3);
        }
        @media (prefers-color-scheme: dark){
          .sx-it-zoom button{ background: rgba(30,41,59,.78); color:#e5e7eb; border-color: rgba(148,163,184,.35); }
          .sx-it-zoom button:hover{ background: rgba(30,41,59,.86); box-shadow: 0 2px 8px rgba(0,0,0,.25); }
          .sx-it-zoom button.playing{
            background: rgba(234,179,8,.28);
            border-color: rgba(234,179,8,.55);
            box-shadow: 0 1px 4px rgba(234,179,8,.35);
          }
        }
      `;
      document.head.appendChild(st);
    }catch{}
  }
  async function translateFullPageInline(){
    try{
      const myRun = ++__sxFullTranslateRunId;
      ensureInlineTranslateStyles();
      bindInlineThemeWatchersOnce();
      stopSpeech();
      const targetLang = await getTranslateTargetLang();
      // 简单分块策略：收集主要可见段落与显著标题
      const blocks = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
        acceptNode(node){
          const tag = node.tagName?.toLowerCase();
          if (!tag) return NodeFilter.FILTER_SKIP;
          // 跳过不可见/无文本的容器
          const cs = getComputedStyle(node);
          if (cs.display === 'none' || cs.visibility === 'hidden') return NodeFilter.FILTER_SKIP;
          if (['script','style','noscript','iframe','canvas','svg','menu','nav','aside','footer'].includes(tag)) return NodeFilter.FILTER_SKIP;
          if (/^h[1-6]$/.test(tag)) return NodeFilter.FILTER_ACCEPT;
          if (['p','li','blockquote'].includes(tag)) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
      });
      while (walker.nextNode()) {
        const el = walker.currentNode;
        const text = (el.innerText || '').trim();
        if (text) blocks.push(el);
      }
      if (!blocks.length) {
        // 没有可翻译块：回告后台保持“未内联”状态，避免菜单误显示“显示原文”
        try { await chrome.runtime.sendMessage({ type: 'SX_INLINE_TRANSLATED_CHANGED', inline: false }); } catch {}
        return;
      }

      // 翻译辅助：批量请求（逐段串行，避免速率限制；也可按需并行）
      const translatedCache = new Map();
      const translateText = async (t) => {
        const key = t.slice(0,512);
        if (translatedCache.has(key)) return translatedCache.get(key);
        const resp = await chrome.runtime.sendMessage({ type: 'SX_TRANSLATE_REQUEST', text: t });
        if (!resp?.ok) throw new Error(resp?.error || 'Translate failed');
        translatedCache.set(key, resp.result);
        return resp.result;
      };

      let __sxRevealIndex = 0;
      for (const el of blocks){
        // 若在处理中被“恢复原文”或新翻译覆盖，则中断
        if (myRun !== __sxFullTranslateRunId) return;
        const src = (el.innerText || '').trim();
        if (!src) continue;
        // 先插入“加载中”的译文块占位
        const q = document.createElement('blockquote');
        // 上下对等间距（用 !important 抵御站点样式覆盖）
        q.style.setProperty('margin-top','10px','important');
        q.style.setProperty('margin-bottom','14px','important');
        q.style.padding = '6px 10px';
        // 根据主题着色
        try { styleInlineQuoteForTheme(q, await resolveBubbleTheme()); } catch {}
        q.style.whiteSpace = 'pre-wrap';
        q.style.lineHeight = '1.6';
        q.dataset.sxInlineTranslation = '1';
        q.classList.add('sx-it');
        const sp = document.createElement('span'); sp.className = 'sx-it-spinner';
        const txt = document.createElement('span'); txt.textContent = 'Translating…';
        q.appendChild(sp); q.appendChild(txt);
        // 为避免“原段落的 margin-bottom + 引用块的 margin-top”叠加造成上方空隙大，统一消除原段落的底部外边距
        try {
          const prev = el.style.marginBottom || '';
          el.dataset.sxPrevMb = prev;
          el.dataset.sxElAdjusted = '1';
          el.style.setProperty('margin-bottom','0','important');
        } catch {}

        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'li') {
          // 列表项内显示，避免把 blockquote 插到 <ul> 里引起异常布局
          q.style.setProperty('margin-top','10px','important');
          q.style.setProperty('margin-bottom','10px','important');
          el.appendChild(q);
        } else {
          // 默认紧随原节点之后插入
          el.insertAdjacentElement('afterend', q);
          // 若父容器是 grid，复制原节点的网格定位，避免被自动放到边缘列
          try{
            const parentCS = getComputedStyle(el.parentElement);
            if (parentCS && parentCS.display && parentCS.display.includes('grid')){
              const cs = getComputedStyle(el);
              if (cs){
                // 优先复制 grid-area；否则复制 start/end（NYTimes 标题多为 grid-column: 2）
                if (cs.gridArea && cs.gridArea !== 'auto / auto / auto / auto'){
                  q.style.gridArea = cs.gridArea;
                } else {
                  if (cs.gridColumnStart && cs.gridColumnStart !== 'auto') q.style.gridColumnStart = cs.gridColumnStart;
                  if (cs.gridColumnEnd && cs.gridColumnEnd !== 'auto') q.style.gridColumnEnd = cs.gridColumnEnd;
                  if (cs.gridColumn && cs.gridColumn !== 'auto') q.style.gridColumn = cs.gridColumn;
                }
                // 对齐方式尽量与原元素保持一致
                if (cs.justifySelf && cs.justifySelf !== 'auto') q.style.justifySelf = cs.justifySelf;
                if (cs.alignSelf && cs.alignSelf !== 'auto') q.style.alignSelf = cs.alignSelf;
                // 若原元素通过左右 auto 居中，继承之
                if (cs.marginLeft === 'auto' || cs.marginRight === 'auto'){
                  q.style.marginLeft = cs.marginLeft;
                  q.style.marginRight = cs.marginRight;
                  // 避免我们上方设置的 margin 覆盖了居中
                  q.style.setProperty('margin-top','10px','important');
                  q.style.setProperty('margin-bottom','14px','important');
                }

                // Fallback：若 grid 属性均为 auto，强制按原元素的可视宽度居中，避免被放到左缘
                const gridIsAuto = (!cs.gridArea || cs.gridArea === 'auto / auto / auto / auto')
                  && (!cs.gridColumn || cs.gridColumn === 'auto')
                  && (!cs.gridColumnStart || cs.gridColumnStart === 'auto')
                  && (!cs.gridColumnEnd || cs.gridColumnEnd === 'auto');
                if (gridIsAuto){
                  const rect = el.getBoundingClientRect();
                  if (rect && rect.width){
                    // 以原元素可视宽度为上限，块级+水平居中
                    q.style.display = 'block';
                    q.style.maxWidth = Math.round(rect.width) + 'px';
                    q.style.width = 'min(100%, ' + Math.round(rect.width) + 'px)';
                    q.style.marginLeft = 'auto';
                    q.style.marginRight = 'auto';
                    // 维持我们设置的上下间距
                    q.style.setProperty('margin-top','10px','important');
                    q.style.setProperty('margin-bottom','14px','important');
                  }
                }
              }
            }
            // 无论是否命中 grid 分支，最终再镜像一次原段落的几何（宽度与左右留白）
            mirrorBlockGeometryFrom(el, q);
          }catch{}
        }

        // 占位块入场过渡（不影响最终文本的再次淡入）
        try { requestAnimationFrame(()=>{ try{ q.classList.add('on'); }catch{} }); } catch { try{ q.classList.add('on'); }catch{} }

        // 翻译并替换占位内容
        let translated = '';
        try {
          translated = await translateText(src);
        } catch (e) {
          // 单段翻译失败：移除占位并继续下一个；若全部失败，则最终走失败分支
          try{ q.remove(); }catch{}
          continue;
        }
        if (myRun !== __sxFullTranslateRunId) { try{ q.remove(); }catch{} return; }
        // 使用子元素淡入文本，增强可见的“出现”效果
        q.textContent = '';
        const textEl = document.createElement('span');
        textEl.className = 'sx-it-text';
        textEl.textContent = translated;
        q.appendChild(textEl);
        // Add per-paragraph controls (zoom for long blocks, speaker for EN->ZH even if short)
        try{
          const cjkCount = (translated.match(/[\u4E00-\u9FFF]/g) || []).length;
          const latinCount = (translated.match(/[A-Za-z0-9]/g) || []).length;
          const enableZoom = cjkCount >= 20 || latinCount >= 20;
          const enableSpeak = shouldEnableSpeakButton(src, targetLang);
          if (enableZoom || enableSpeak){
            const ctrlBox = document.createElement('div');
            ctrlBox.className = 'sx-it-zoom';
            if (enableSpeak){
              const inlineSpeakBtn = document.createElement('button');
              inlineSpeakBtn.type = 'button';
              inlineSpeakBtn.title = 'Speak original';
              inlineSpeakBtn.setAttribute('aria-label','Speak original');
              inlineSpeakBtn.setAttribute('aria-pressed','false');
              inlineSpeakBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h3l4 4V5L7 9z"></path><path d="M16 9a4 4 0 0 1 0 6"></path><path d="M18.5 7a7 7 0 0 1 0 10"></path></svg>';
              inlineSpeakBtn.addEventListener('click', async (ev)=>{
                ev.preventDefault();
                ev.stopPropagation();
                if (!await ensureSpeechSupported()) return;
                if (isSpeaking && activeSpeakButton === inlineSpeakBtn){
                  stopSpeech();
                } else {
                  playSpeech(src, inlineSpeakBtn);
                }
              });
              ctrlBox.appendChild(inlineSpeakBtn);
            }
            if (enableZoom){
              const minus = document.createElement('button'); minus.type='button'; minus.title='缩小'; minus.textContent='-';
              const plus  = document.createElement('button'); plus.type='button'; plus.title='放大'; plus.textContent='+';
              ctrlBox.appendChild(minus); ctrlBox.appendChild(plus);
              q.dataset.sxZoom = '1';
              const applyZoom = (f)=>{ try{ q.style.fontSize = Math.round(f*100) + '%'; }catch{} };
              minus.addEventListener('click', (ev)=>{ ev.stopPropagation(); ev.preventDefault(); let f=parseFloat(q.dataset.sxZoom||'1')||1; f=Math.max(0.7, Math.round((f-0.1)*10)/10); q.dataset.sxZoom=String(f); applyZoom(f); });
              plus.addEventListener('click',  (ev)=>{ ev.stopPropagation(); ev.preventDefault(); let f=parseFloat(q.dataset.sxZoom||'1')||1; f=Math.min(2.0, Math.round((f+0.1)*10)/10); q.dataset.sxZoom=String(f); applyZoom(f); });
            }
            q.appendChild(ctrlBox);
            // Reserve space on the right to avoid text overlapping buttons
            try {
              // Fallback padding before measurement
              q.style.paddingRight = '60px';
              requestAnimationFrame(()=>{
                try{
                  const w = ctrlBox.getBoundingClientRect().width || 0;
                  const pad = Math.max(44, Math.ceil(w + 12));
                  q.style.paddingRight = pad + 'px';
                }catch{}
              });
            } catch {}
          }
        }catch{}
        // 阶梯延时，增强瀑布式显现（每块 24ms，最多 240ms）
        const delay = Math.min(240, __sxRevealIndex * 24);
        __sxRevealIndex++;
        setTimeout(()=>{ try{ textEl.classList.add('on'); }catch{} }, delay);
      }

      if (myRun === __sxFullTranslateRunId) {
        try { await chrome.runtime.sendMessage({ type: 'SX_INLINE_TRANSLATED_CHANGED', inline: true }); } catch {}
      }
    }catch(e){
      console.warn('Translate full page failed:', e);
      try{ alert('Full-page translate failed: ' + (e?.message || e)); }catch{}
      // 失败时回告后台重置菜单状态
      try { await chrome.runtime.sendMessage({ type: 'SX_INLINE_TRANSLATED_CHANGED', inline: false }); } catch {}
    }
  }

  async function restoreFullPageInline(){
    try{
      stopSpeech();
      // 递增运行代号，中断尚未完成的翻译流程
      __sxFullTranslateRunId++;
      // 移除所有我们插入的译文块
      document.querySelectorAll('blockquote[data-sx-inline-translation="1"]').forEach(n => n.remove());
      // 恢复被我们调整过 margin-bottom 的原段落
      document.querySelectorAll('[data-sx-el-adjusted="1"]').forEach(el => {
        try{
          const prev = el.dataset.sxPrevMb || '';
          if (prev) el.style.marginBottom = prev; else el.style.removeProperty('margin-bottom');
          delete el.dataset.sxPrevMb;
          delete el.dataset.sxElAdjusted;
        }catch{}
      });
      try { await chrome.runtime.sendMessage({ type: 'SX_INLINE_TRANSLATED_CHANGED', inline: false }); } catch {}
    }catch(e){ console.warn('Restore full page failed:', e); }
  }

  /* ===================== 文本框“三连空格”自动翻译（→ 英文） ===================== */
  const TYPING_TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'url', 'email', 'tel', 'number']);
  let typingWatcherBound = false;
  const typingSpaceState = { target: null, count: 0 };
  let typingUILang = 'zh';
  let typingLangResolved = false;

  function isInsideSXUI(el){
    if (!el || typeof el.closest !== 'function') return false;
    return !!(el.closest('#sx-translate-host') || el.closest('#sx-float-panel') || el.closest('[data-sx-sticky]'));
  }

  function resolveTypingField(node){
    if (!node) return null;
    let el = node;
    try {
      if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    } catch {}
    if (!(el instanceof Element)) return null;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el;
    if (el.isContentEditable) return el;
    if (typeof el.closest === 'function') {
      const editable = el.closest('[contenteditable]:not([contenteditable="false"])');
      if (editable) return editable;
    }
    return null;
  }

  function isEligibleTypingField(el){
    if (!el || !(el instanceof Element)) return false;
    if (isInsideSXUI(el)) return false;
    if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
    if (el instanceof HTMLInputElement) {
      const type = String(el.type || '').toLowerCase();
      if (!TYPING_TEXT_INPUT_TYPES.has(type)) return false;
      if (type === 'password') return false;
      return !el.disabled && !el.readOnly;
    }
    if (el.isContentEditable){
      const attr = el.getAttribute('contenteditable');
      if (attr === 'false') return false;
      return true;
    }
    return false;
  }

  function readFieldValue(el){
    if (!el) return '';
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value || '';
    if (el.isContentEditable) return el.innerText || el.textContent || '';
    return '';
  }

  function writeFieldValue(el, text){
    if (!el) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = text;
    } else if (el.isContentEditable) {
      el.textContent = text;
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } catch {}
  }

  function placeCaretAtEnd(el){
    if (!el) return;
    try { el.focus(); } catch {}
    try {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const len = el.value.length;
        if (typeof el.setSelectionRange === 'function') el.setSelectionRange(len, len);
      } else if (el.isContentEditable) {
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch {}
  }

  function ensureTypingSpinnerStyles(){
    if (document.getElementById('sx-type-translate-style')) return;
    const st = document.createElement('style');
    st.id = 'sx-type-translate-style';
    st.textContent = `
      @keyframes sx-type-spin { to { transform: rotate(360deg); } }
      .sx-type-spinner{
        position: fixed;
        z-index: 2147483647;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 500;
        pointer-events: none;
        min-width: 90px;
        background: var(--sx-type-bg, rgba(15,23,42,.9));
        color: var(--sx-type-fg, #f8fafc);
        box-shadow: var(--sx-type-shadow, 0 4px 14px rgba(15,23,42,.35));
      }
      .sx-type-spinner .dot{
        width: 14px;
        height: 14px;
        border-radius: 999px;
        border: 2px solid var(--sx-type-dot, rgba(248,250,252,.35));
        border-top-color: var(--sx-type-dot-active, #38bdf8);
        animation: sx-type-spin .85s linear infinite;
      }
      .sx-type-spinner.dark{
        --sx-type-bg: rgba(15,23,42,.9);
        --sx-type-fg: #f8fafc;
        --sx-type-shadow: 0 4px 14px rgba(15,23,42,.35);
        --sx-type-dot: rgba(248,250,252,.35);
        --sx-type-dot-active: #38bdf8;
      }
      .sx-type-spinner.light{
        --sx-type-bg: rgba(248,250,252,.95);
        --sx-type-fg: #0f172a;
        --sx-type-shadow: 0 6px 18px rgba(15,23,42,.15);
        --sx-type-dot: rgba(15,23,42,.25);
        --sx-type-dot-active: #2563eb;
      }
      .sx-type-spinner.error{
        background: rgba(220,38,38,.92);
        color: #fff;
        box-shadow: 0 4px 14px rgba(220,38,38,.35);
      }
      .sx-type-spinner.error .dot{
        border: 2px solid rgba(255,255,255,.5);
        border-top-color: #fff;
      }
      .sx-type-spinner .label{
        white-space: nowrap;
      }
    `;
    try {
      (document.head || document.documentElement).appendChild(st);
    } catch { document.documentElement.appendChild(st); }
  }

  async function resolveTypingLang(){
    if (typingLangResolved) return typingUILang;
    typingLangResolved = true;
    try {
      const i18n = await loadI18n();
      typingUILang = i18n ? await i18n.getCurrentLanguage() : 'zh';
      typingUILang = (typingUILang === 'en') ? 'en' : 'zh';
    } catch { typingUILang = 'zh'; }
    return typingUILang;
  }

  function createTypingSpinner(target){
    ensureTypingSpinnerStyles();
    const wrap = document.createElement('div');
    wrap.className = 'sx-type-spinner';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    wrap.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="label">Translating…</span>`;
    document.body.appendChild(wrap);
    const labelEl = wrap.querySelector('.label');

    const applyTheme = (theme) => {
      const mode = theme === 'dark' ? 'dark' : 'light';
      wrap.classList.remove('dark','light');
      wrap.classList.add(mode);
    };
    try {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    } catch { applyTheme('dark'); }
    resolveBubbleTheme().then(applyTheme).catch(()=>{});

    const position = () => {
      try{
        const rect = target.getBoundingClientRect();
        const width = wrap.offsetWidth || 90;
        const top = Math.max(8, Math.min(window.innerHeight - 28, rect.top + 6));
        const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width - 6));
        wrap.style.top = `${top}px`;
        wrap.style.left = `${left}px`;
      }catch{}
    };
    position();
    const onRelayout = () => position();
    window.addEventListener('scroll', onRelayout, true);
    window.addEventListener('resize', onRelayout);

    resolveTypingLang().then((lang)=>{
      if (!labelEl) return;
      labelEl.textContent = lang === 'en' ? 'Translating…' : '翻译中…';
    }).catch(()=>{});

    let destroyed = false;
    return {
      setLabel(text, isError){
        if (labelEl) labelEl.textContent = text;
        if (isError) wrap.classList.add('error'); else wrap.classList.remove('error');
      },
      destroy(delay = 0){
        if (destroyed) return;
        destroyed = true;
        const removeSelf = () => {
          window.removeEventListener('scroll', onRelayout, true);
          window.removeEventListener('resize', onRelayout);
          try { wrap.remove(); } catch {}
        };
        if (delay > 0) setTimeout(removeSelf, delay);
        else removeSelf();
      }
    };
  }

  async function triggerTypingTranslate(field){
    if (!field || !(field instanceof Element)) return;
    if (field.dataset?.sxTypingTranslating === '1') return;
    const snapshot = readFieldValue(field);
    const text = snapshot.trim();
    if (!text) return;
    field.dataset.sxTypingTranslating = '1';
    const spinner = createTypingSpinner(field);
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'SX_TRANSLATE_REQUEST', text, targetLang: 'en' });
      if (!resp?.ok) throw new Error(resp?.error || 'Translate failed');
      const result = String(resp.result || '').trim();
      writeFieldValue(field, result);
      placeCaretAtEnd(field);
      spinner?.destroy();
    } catch (e) {
      console.warn('Triple-space translate failed:', e);
      const lang = await resolveTypingLang();
      spinner?.setLabel(lang === 'en' ? 'Failed' : '翻译失败', true);
      spinner?.destroy(1300);
    } finally {
      delete field.dataset.sxTypingTranslating;
    }
  }

  function resetTypingState(target){
    if (!target || typingSpaceState.target === target) {
      typingSpaceState.target = null;
      typingSpaceState.count = 0;
    }
  }

  function handleTypingKeydown(ev){
    if (ev.defaultPrevented) return;
    if (ev.isComposing) return;
    if (ev.__sxTypingHandled) return;
    try { ev.__sxTypingHandled = true; } catch {}
    const field = resolveTypingField(ev.target);
    if (!field || !isEligibleTypingField(field)) {
      resetTypingState(field || null);
      return;
    }
    const el = field;
    if (el.dataset?.sxTypingTranslating === '1') return;
    if (typingSpaceState.target !== el) {
      typingSpaceState.target = el;
      typingSpaceState.count = 0;
    }
    const isSpaceKey = ev.key === ' ' || ev.code === 'Space' || ev.key === 'Spacebar';
    if (isSpaceKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      typingSpaceState.count++;
      if (typingSpaceState.count >= 3) {
        ev.preventDefault();
        typingSpaceState.count = 0;
        const text = readFieldValue(el).trim();
        if (text) triggerTypingTranslate(el);
      }
    } else if (!['Shift', 'CapsLock'].includes(ev.key)) {
      typingSpaceState.count = 0;
    }
  }

  function setupTypingWatcher(){
    if (typingWatcherBound) return;
    typingWatcherBound = true;
    document.addEventListener('keydown', handleTypingKeydown, true);
    window.addEventListener('keydown', handleTypingKeydown, true);
    document.addEventListener('blur', (ev)=>{
      const field = resolveTypingField(ev?.target);
      if (field && field === typingSpaceState.target) resetTypingState(field);
    }, true);
  }

  setupTypingWatcher();
})();
