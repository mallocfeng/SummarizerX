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
  let host, wrap, contentEl, closeBtn, spinner, shadowRootEl, copyBtn;

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
          background: rgba(17, 24, 39, 0.94);
          color: #f8fafc;
          border-radius: 12px;
          box-shadow:
            0 12px 28px rgba(0,0,0,.35),
            0 0 0 1px rgba(255,255,255,.08) inset;
          padding: 8px 10px 10px;
          font: 14px/1.6 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
          backdrop-filter: blur(8px) saturate(140%);
          -webkit-backdrop-filter: blur(8px) saturate(140%);
        }
        .bubble.light{
          background: #ffffff;
          color: #0f172a;
          box-shadow:
            0 10px 24px rgba(2,6,23,.12),
            0 0 0 1px rgba(15,23,42,.06) inset;
        }

        /* ===== 标题栏（可拖动区域）====== */
        .header{
          display:flex; align-items:center; justify-content:space-between; gap:8px;
          margin:-2px -2px 8px; padding:6px 8px;
          border-radius: 8px;
          user-select: none;
          cursor: grab;
          /* 深色：低饱和蓝灰玻璃；亮色：柔和浅蓝 */
          background: linear-gradient(180deg, rgba(82,98,128,.16), rgba(82,98,128,.06));
          border: 1px solid rgba(255,255,255,.10);
        }
        .bubble.light .header{
          background: linear-gradient(180deg, rgba(178,196,230,.28), rgba(178,196,230,.12));
          border: 1px solid rgba(74,102,145,.18);
        }
        .dragging .header { cursor: grabbing; }

        .title{
          font-weight: 800;
          font-size: 12px;
          letter-spacing: .25px;
          /* “淡淡的颜色”——暗色偏蓝灰、亮色偏清爽蓝 */
          color: #86a1c7;
        }
        .bubble.light .title{ color:#2a64c9cc; }

        .toolbar{
          display:flex; align-items:center; gap:6px;
        }
        .tbtn{
          all: unset; cursor:pointer;
          min-width: 22px; height: 22px; padding: 0 8px;
          display:inline-flex; align-items:center; justify-content:center;
          border-radius: 6px;
          font-size: 12px;
          color: inherit; opacity: .88;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.08);
        }
        .tbtn:hover{ opacity: 1; background: rgba(255,255,255,.15); }
        .bubble.light .tbtn{
          border-color: rgba(2,6,23,.10);
          background: rgba(2,6,23,.06);
        }
        .bubble.light .tbtn:hover{ background: rgba(2,6,23,.10); }

        .close{
          all: unset;
          cursor: pointer;
          width: 22px; height: 22px;
          border-radius: 6px;
          display:grid; place-items:center;
          color: inherit; opacity: .80;
        }
        .close:hover{
          background: rgba(255,255,255,.12);
        }
        .bubble.light .close:hover{
          background: rgba(15,23,42,.06);
        }

        .content{
          white-space: pre-wrap; word-break: break-word;
          max-height: 56vh; overflow:auto;
        }

        .spinner{
          width:16px; height:16px;
          border:2px solid currentColor; border-right-color: transparent;
          border-radius:50%;
          animation: r .8s linear infinite; opacity:.6;
          display:inline-block;
        }
        @keyframes r{ to{ transform: rotate(360deg); } }
      </style>

      <div class="bubble" id="sx-bubble" data-theme="dark">
        <div class="header" id="sx-drag-handle">
          <div class="title" id="sx-title">SummarizerX · Translate</div>
          <div class="toolbar">
            <button class="tbtn" id="sx-copy" title="Copy result">Copy</button>
            <button class="close" id="sx-close" aria-label="Close">✕</button>
          </div>
        </div>
        <div class="content" id="sx-content"></div>
      </div>
    `;

    // cache
    wrap = shadow.getElementById('sx-bubble');
    contentEl = shadow.getElementById('sx-content');
    closeBtn = shadow.getElementById('sx-close');
    copyBtn  = shadow.getElementById('sx-copy');

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

    // 延后一帧绑定“外点关闭”，避免打开时被误判
    setTimeout(() => {
      document.addEventListener('keydown', escToClose, { passive: true });
      document.addEventListener('mousedown', clickOutsideToClose, true);
    }, 0);

    // ===== 拖拽：以 header 为手柄 =====
    const handle = shadow.getElementById('sx-drag-handle');
    let dragOffsetX = 0, dragOffsetY = 0, dragging = false;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      wrap.classList.add('dragging');
      const rect = host.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const br = host.getBoundingClientRect();
      const bubbleW = br.width  || wrap.getBoundingClientRect().width  || 320;
      const bubbleH = br.height || wrap.getBoundingClientRect().height || 120;
      let newX = e.clientX - dragOffsetX;
      let newY = e.clientY - dragOffsetY;
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
    });
  }

  function removeUI() {
    // Disable keep-alive so explicit close actually removes the bubble
    window.__sxTranslateKeepAlive = false;
    if (keepAliveMO) { try{ keepAliveMO.disconnect(); }catch{} keepAliveMO = null; }
    if (!host) return;
    try {
      document.removeEventListener('keydown', escToClose, { passive: true });
      document.removeEventListener('mousedown', clickOutsideToClose, true);
    } catch {}
    host.remove();
    __sxUserMovedBubble = false;
    host = wrap = contentEl = closeBtn = spinner = shadowRootEl = copyBtn = null;
  }

  // 更新UI文本为当前语言
  async function updateUIText() {
    const i18n = await loadI18n();
    if (!i18n) return;
    
    try {
      const title = shadow.getElementById('sx-title');
      const copyBtn = shadow.getElementById('sx-copy');
      const closeBtn = shadow.getElementById('sx-close');
      
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
      
      if (closeBtn) {
        closeBtn.setAttribute('aria-label', await i18n.t('floatPanel.close'));
      }
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
    const gap = 8;
    // 依次尝试：右上、左上、右下、左下
    const candidates = [
      { x: rect.right + gap,            y: rect.top    - gap - desiredH }, // TR
      { x: rect.left  - gap - desiredW, y: rect.top    - gap - desiredH }, // TL
      { x: rect.right + gap,            y: rect.bottom + gap },            // BR
      { x: rect.left  - gap - desiredW, y: rect.bottom + gap }             // BL
    ];
    let pos = candidates.find(p => p.x >= 0 && p.y >= 0 && (p.x + desiredW) <= vw && (p.y + desiredH) <= vh);
    if (!pos) {
      pos = {
        x: Math.min(Math.max(8, rect.right + gap), vw - desiredW - 8),
        y: Math.min(Math.max(8, rect.top),         vh - desiredH - 8)
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

      // ✅ 开始翻译前先关闭 floatpanel，避免遮挡
      await closeFloatPanelIfAny();

      ensureUI();

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

      // 加载中
      contentEl.textContent = '';
      spinner = document.createElement('div');
      spinner.className = 'spinner';
      contentEl.appendChild(spinner);

      const resp = await chrome.runtime.sendMessage({ type: 'SX_TRANSLATE_REQUEST', text });
      if (!resp?.ok) throw new Error(resp?.error || 'Translate failed');

      // 设置结果内容；不要改动位置
      contentEl.textContent = resp.result;
      spinner?.remove(); spinner = null;

      // 仅当用户未拖动时，做一次微调（防止气泡溢出视窗）
      adjustIfOverflowing();
    } catch (e) {
      try { if (contentEl) contentEl.textContent = `⚠️ ${e?.message || e}`; } catch {}
      spinner?.remove(); spinner = null;
    }
  }

  // 背景脚本右键菜单触发
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'SX_TRANSLATE_SELECTION') startTranslateFlow();
    // 忽略 SX_CLOSE_FLOAT_PANEL：那是让内容浮窗收起，不影响翻译气泡
  });
})();