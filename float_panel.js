// float_panel.js — 组件化升级：Petite-Vue + 卡片交互 + 动效 + 主题优化
(() => {
  // ===== i18n =====
  let i18nModule = null;
  async function loadI18n() {
    if (i18nModule) return i18nModule;
    try {
      const moduleUrl = chrome.runtime.getURL('i18n.js');
      i18nModule = await import(moduleUrl);
      return i18nModule;
    } catch (e) { console.warn('Failed to load i18n module:', e); return null; }
  }

  // ===== petite-vue（禁用 ESM 远程依赖，确保 MV3 合规）=====
  // 为符合“Blue Argon”要求，不从 vendor/petite-vue.es.js 动态 import（其文件含外链片段）。
  // 面板默认使用 vanilla 渲染路径；若后续需要，也可改为加载本地 IIFE 版本（非必须）。
  let PV = null;
  async function tryLoadPetiteVue() { PV = null; }

  const PANEL_ID = 'sx-float-panel';
  const MARK = '__SX_FLOAT_PANEL_READY__';
  if (window[MARK]) return;
  window[MARK] = true;

  // ===== Utils =====
  const escapeHtml = (str) =>
    String(str || '').replace(/[&<>"']/g,(s)=>({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));

  const collapseBlankLines = (txt='') =>
    String(txt).replace(/\r\n?/g,'\n').replace(/\n[ \t]*\n(?:[ \t]*\n)+/g,'\n\n');

  function stripInlineColor(html = '') {
    const dropProps = /\b(?:color|background-color|white-space)\s*:[^;"'}]+;?/gi;
    html = html.replace(/style\s*=\s*"([^"]*)"/gi,(m,css)=>{ const c=css.replace(dropProps,''); return c.trim()?`style="${c.trim()}"`:''; });
    html = html.replace(/style\s*=\s*'([^']*)'/gi,(m,css)=>{ const c=css.replace(dropProps,''); return c.trim()?`style='${c.trim()}'`:''; });
    html = html.replace(/<font\b([^>]*?)\scolor=(["']).*?\2([^>]*)>/gi,"<font$1$3>");
    return html;
  }

  function renderNoticeMarkdown(md='') {
    md = collapseBlankLines(md);
    let html = escapeHtml(md);
    html = html.replace(/```([\s\S]*?)```/g,(_,code)=>`<pre><code>${escapeHtml(code)}</code></pre>`)
               .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
               .replace(/\*(.+?)\*/g,'<em>$1</em>')
               .replace(/`([^`]+?)`/g,'<code>$1</code>')
               .replace(/^(?:- |\* )(.*)(?:\n(?:- |\* ).*)*/gm,(block)=>{
                  const items = block.split(/\n/).map(l=>l.replace(/^(?:- |\* )/,'').trim()).filter(Boolean);
                  return `<ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
               })
               .replace(/^(?:\d+\. )(.*)(?:\n(?:\d+\. ).*)*/gm,(block)=>{
                  const items = block.split(/\n/).map(l=>l.replace(/^\d+\. /,'').trim()).filter(Boolean);
                  return `<ol>${items.map(i=>`<li>${i}</li>`).join('')}</ol>`;
               })
               .replace(/\n{2,}/g,'</p><p>').replace(/(?:<\/p>\s*<p>\s*){2,}/gi,'</p><p>');
    return `<p>${html}</p>`;
  }

  function renderMarkdown(md='') {
    if (typeof md !== 'string') md = String(md ?? '');
    md = collapseBlankLines(md);
    const notices = [];
    md = md.replace(/:::notice\s*([\s\S]*?)\s*:::/g,(_,inner)=>{
      notices.push((inner||'').trim());
      return `__ALERT_TOKEN_${notices.length-1}__`;
    });
    let html = escapeHtml(md);
    html = html.replace(/```([\s\S]*?)```/g,(_,code)=>`<pre><code>${escapeHtml(code)}</code></pre>`);
    html = html.replace(/(^|\n)((?:&gt;\s?.*(?:\n|$))+)/g,(_,pfx,block)=>{
      const inner = block.split('\n').filter(Boolean).map(l=>l.replace(/^&gt;\s?/,'').trim()).join('<br>');
      return `${pfx}<blockquote>${inner}</blockquote>`;
    });
    html = html
      .replace(/^######\s?(.*)$/gm,'<h6>$1</h6>')
      .replace(/^#####\s?(.*)$/gm,'<h5>$1</h5>')
      .replace(/^####\s?(.*)$/gm,'<h4>$1</h4>')
      .replace(/^###\s?(.*)$/gm,'<h3>$1</h3>')
      .replace(/^##\s?(.*)$/gm,'<h2>$1</h2>')
      .replace(/^#\s?(.*)$/gm,'<h1>$1</h1>');

    html = html.replace(/^(?:- |\* )(.*)(?:\n(?:- |\* ).*)*/gm,(block)=>{
      const items = block.split('\n').map(l=>l.replace(/^(?:- |\* )/,'').trim()).filter(Boolean);
      return `<ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
    });
    html = html.replace(/^(?:\d+\. )(.*)(?:\n(?:\d+\. ).*)*/gm,(block)=>{
      const items = block.split('\n').map(l=>l.replace(/^\d+\. /,'').trim()).filter(Boolean);
      return `<ol>${items.map(i=>`<li>${i}</li>`).join('')}</ol>`;
    });

    html = html
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/`([^`]+?)`/g,'<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    html = html.replace(/\n{2,}/g,'<br><br>');
    html = html.replace(/(?:<br\s*\/?>\s*){3,}/gi,'<br><br>');
    html = html.replace(/(<\/(?:h[1-6]|p|ul|ol|pre|blockquote)>)\s*(?:<br\s*\/?>(?:\s|&nbsp;)*?)+/gi,'$1');
    html = html.replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*?)+(?!<br)(?=\s*<(?:h[1-6]|p|ul|ol|pre|blockquote)\b)/gi,'');
    html = html.replace(/(<div class="alert"[^>]*>.*?<\/div>)\s*(?:<br\s*\/?>(?:\s|&nbsp;)*?)+/gis,'$1')
               .replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*?)+(?=<div class="alert"[^>]*>)/gis,'')
               .replace(/<\/div>\s*<br\s*\/?>/gis,'</div>');
    html = `<div class="md">${html}</div>`;
    notices.forEach((txt,i)=>{
      const n = `<div class="alert" data-alert>
        <button class="alert-close" type="button" aria-label="关闭" title="关闭" data-alert-close>&times;</button>
        <div class="alert-content">${renderNoticeMarkdown(txt)}</div>
      </div>`;
      html = html.replace(`__ALERT_TOKEN_${i}__`, n);
    });
    // 强化一次 alert 前后 <br> 的清理，防止出现过大空隙
    html = html
      .replace(/(?:\s*<br\s*\/?>\s*)+(?=<div class=\"alert\"\b)/gi, '')
      .replace(/(<div class=\"alert\"[^>]*>.*?<\/div>)(?:\s*<br\s*\/?>\s*)+/gis, '$1');
    return html;
  }

  // ===== 主题侦测 =====
  function parseColorToRGB(str){
    if(!str) return null;
    str=String(str).trim().toLowerCase();
    if (str==='transparent') return {r:255,g:255,b:255,a:0};
    let m=str.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\)$/);
    if(m) return {r:+m[1],g:+m[2],b:+m[3],a:m[4]!==undefined?+m[4]:1};
    m=str.match(/^#([0-9a-f]{3})$/i);
    if(m){ const h=m[1]; return {r:parseInt(h[0]+h[0],16),g:parseInt(h[1]+h[1],16),b:parseInt(h[2]+h[2],16),a:1}; }
    m=str.match(/^#([0-9a-f]{6})$/i);
    if(m){ const h=m[1]; return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:1}; }
    return null;
  }
  function relLuminance({r,g,b}) {
    const sr=[r,g,b].map(v=>v/255).map(v=> v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4));
    return 0.2126*sr[0]+0.7152*sr[1]+0.0722*sr[2];
  }
  function isNearlyTransparent(rgb){ const a=rgb?.a??1; return a<=0.01; }
  function getBgFromComputed(el){
    try{
      const cs=getComputedStyle(el);
      const c=parseColorToRGB(cs.backgroundColor);
      if(c && !isNearlyTransparent(c)) return c;
      const tc=parseColorToRGB(cs.color);
      if(tc){ const tl=relLuminance(tc); if(tl>0.72) return {r:20,g:24,b:31,a:1}; if(tl<0.28) return {r:255,g:255,b:255,a:1}; }
    }catch{}
    return null;
  }
  function getAncestorBg(start){
    let el=start;
    while(el && el!==document.documentElement){
      const c=getBgFromComputed(el);
      if(c) return c;
      el=el.parentElement||el.parentNode;
    }
    const b=getBgFromComputed(document.body||document.createElement('body')); if(b) return b;
    const h=getBgFromComputed(document.documentElement); if(h) return h;
    return null;
  }
  function getEffectiveBg(){
    const vw=Math.max(document.documentElement.clientWidth,window.innerWidth||0);
    const vh=Math.max(document.documentElement.clientHeight,window.innerHeight||0);
    const points=[[vw*0.5|0,vh*0.5|0],[vw*0.5|0,vh*0.3|0],[vw*0.5|0,vh*0.7|0]];
    for(const [x,y] of points){
      let node=document.elementFromPoint(x,y);
      if(node && node.nodeType===3) node=node.parentElement;
      if(!node) continue;
      const col=getAncestorBg(node);
      if(col) return col;
    }
    return null;
  }
  function getPageBgColor(){
    const eff=getEffectiveBg();
    if(eff && !isNearlyTransparent(eff)) return eff;
    for(const el of [document.body, document.documentElement].filter(Boolean)){
      const c=getBgFromComputed(el); if(c && !isNearlyTransparent(c)) return c;
    }
    try{
      const isNarrow=Math.max(window.innerWidth||0,document.documentElement.clientWidth||0)<=768;
      if(isNarrow){
        const meta=document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
        const mc=parseColorToRGB(meta||''); if(mc && !isNearlyTransparent(mc)) return mc;
      }
    }catch{}
    return {r:255,g:255,b:255,a:1};
  }
  function isDarkBackground(){
    const rgb=getPageBgColor();
    if(!rgb || isNearlyTransparent(rgb)){
      const base=getComputedStyle(document.body||document.documentElement);
      const tc=parseColorToRGB(base.color||'#111');
      if(tc){ const tl=relLuminance(tc); return tl>0.72; }
      return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return relLuminance(rgb)<0.5;
  }

  function extURL(p){ try{ return chrome?.runtime?.getURL? chrome.runtime.getURL(p): p; }catch{ return p; } }

  // ===== DOM & 样式（Shadow）=====
  function ensurePanel(){
    let host=document.getElementById(PANEL_ID);
    if(host) return host;
    host=document.createElement('div');
    host.id=PANEL_ID;
    host.style.position='fixed';
    host.style.top='0';
    host.style.right='0';
    host.style.width='420px';
    host.style.height='100vh';
    host.style.zIndex='2147483647';
    host.style.pointerEvents='auto';
    host.setAttribute('lang','zh-CN');

    const shadow=host.attachShadow({mode:'open'});
    const style=document.createElement('style');
    style.textContent=`
      :host{
        /* ===== Theme tokens (light) ===== */
        --bg: #f7f9fc;            /* page background */
        --surface: #ffffff;       /* cards / bars */
        --surface-2: #f3f5f9;     /* subtle secondary */
        --border: #e6eaf2;        /* soft border */
        --text: #0f172a;          /* primary text */
        --muted: #5b667a;         /* secondary text */

        /* glass tokens */
        --glass: rgba(255,255,255,.72);        /* slightly less transparent */
        --glass-soft: rgba(255,255,255,.48);
        --glass-edge: rgba(15,23,42,.10);
        --glass-highlight: rgba(255,255,255,.65);
        /* card-specific glass (more opaque for readability) */
        --card-glass: rgba(255,255,255,.82);
        --card-glass-soft: rgba(255,255,255,.68);
        --card-border: rgba(15,23,42,.08);
        --card-radius: 14px;

        --primary: #3b82f6;       /* indigo/azure */
        --primary-600: #2563eb;   /* darker */
        --accent: #22c55e;        /* success */
        --danger: #ef4444;        /* danger */
        --candy-az: rgba(59,130,246,.10);   /* azure */
        --candy-vi: rgba(99,102,241,.10);   /* violet */
        --candy-pk: rgba(236,72,153,.10);   /* pink */

        --ring: 0 0 0 3px rgba(59,130,246,.22);
        --radius: 12px;
        /* approximate Chrome desktop surface corner; may be adjusted per-platform */
        --chrome-radius: 12px;
        --btn-min-h: 36px;
        --arrow-nudge: 8px; /* move empty arrow slightly upward */
        --shadow-1: 0 1px 2px rgba(16,24,40,.06);
        --shadow-2: 0 4px 12px rgba(16,24,40,.10);

        color-scheme: light;
        --font-stack: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "PingFang SC", "Noto Sans SC", sans-serif;
      }
      :host, :host * { box-sizing:border-box; font-family:var(--font-stack)!important; }

      /* ===== Layout ===== */
      .wrap{
        position:relative; height:100vh; display:flex; flex-direction:column;
        border-radius: var(--chrome-radius); overflow:hidden;
        /* frosted glass background */
        background: linear-gradient(135deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(14px) saturate(1.1);
        backdrop-filter: blur(14px) saturate(1.1);
        border-left:1px solid var(--border);
        box-shadow:-6px 0 22px rgba(17,24,39,.08);
        color:var(--text);
        will-change: transform, opacity, filter;
      }
      /* Float panel enter animation */
      @keyframes sxPanelIn {
        0%   { opacity: 0; transform: translateX(22px) scale(.98); filter: blur(6px); }
        60%  { opacity: .96; transform: translateX(0)   scale(1);   filter: blur(1px); }
        100% { opacity: 1; transform: translateX(0)   scale(1);   filter: blur(0); }
      }
      .wrap.fx-enter{ animation: sxPanelIn .58s cubic-bezier(.2,.7,.3,1) both; }

      /* Stagger header/footer for a subtle pop */
      @keyframes sxBarIn { 0%{ opacity:0; transform: translateY(-6px); } 100%{ opacity:1; transform: translateY(0); } }
      .wrap.fx-enter .appbar{ animation: sxBarIn .42s ease .08s both; }
      @keyframes sxFootIn { 0%{ opacity:0; transform: translateY(6px); } 100%{ opacity:1; transform: translateY(0); } }
      .wrap.fx-enter .footer{ animation: sxFootIn .42s ease .12s both; }

      /* Respect user reduced-motion preference */
      @media (prefers-reduced-motion: reduce){
        .wrap.fx-enter, .wrap.fx-enter .appbar, .wrap.fx-enter .footer{ animation: none; }
      }
      .dragbar{ position:absolute; top:0; left:0; height:100%; width:10px; cursor:col-resize; z-index:10; }
      .dragbar::after{ content:""; position:absolute; top:0; bottom:0; right:-1px; width:2px; background:linear-gradient(180deg, rgba(102,112,133,.20), rgba(102,112,133,.02)); opacity:0; transition: opacity .15s ease; }
      .dragbar:hover::after, .wrap.dragging .dragbar::after{ opacity:.9; }
      .wrap.dragging{ cursor:col-resize; }

      /* ===== Top bar ===== */
      .appbar{
        flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; padding:10px 12px;
        /* raised glass bar */
        background:
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 55%, rgba(255,255,255,0) 100%),
          linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(10px) saturate(1.05);
        backdrop-filter: blur(10px) saturate(1.05);
        border-bottom:1px solid var(--border);
        /* raised glass: subtle outer drop shadow */
        box-shadow: 0 1px 6px rgba(16,24,40,.06);
        border-top-left-radius: var(--chrome-radius); border-top-right-radius: var(--chrome-radius);
      }
      .brand{ display:flex; align-items:center; gap:10px; }
      .logo{ width:10px; height:10px; border-radius:50%; background: var(--primary); box-shadow:0 0 0 6px rgba(59,130,246,.12); }
      .title{ font-size:14px; font-weight:800; letter-spacing:.2px; color:var(--text); }

      /* ===== Actions ===== */
      .actions{ display:flex; gap:8px; align-items:stretch; justify-content:flex-end; min-height: var(--btn-min-h); }
      .btn{
        display:inline-flex; align-items:center; justify-content:center; gap:8px;
        padding:8px 12px; min-height:var(--btn-min-h); line-height:1.2; white-space:nowrap; text-align:center;
        border:1px solid var(--border); border-radius:10px; cursor:pointer;
        background: var(--surface); color: var(--text); font-weight:700; letter-spacing:.02em;
        transition: transform .08s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease, color .18s ease;
        box-shadow: var(--shadow-1);
      }
      .btn:hover{ background:#fbfdff; border-color:#d9e6ff; box-shadow: var(--shadow-2); transform: translateY(-1px); }
      .btn:active{ transform: translateY(0); }
      .btn:focus-visible{ outline: none; box-shadow: var(--shadow-1), var(--ring); }
      .btn.primary{ background: var(--primary); border-color: var(--primary); color:#fff; }
      .btn.primary:hover{ background: var(--primary-600); border-color: var(--primary-600); }

      .actions .btn:not(.icon){ flex:1 1 auto; min-width:0; }
      .btn.icon{ flex:0 0 auto; width:36px; min-width:36px; padding:0; line-height:1; border-radius:10px; }
      .btn[disabled]{ opacity:.6; cursor:not-allowed; }

      /* ===== Progress ===== */
      .progress{ height:3px; position:relative; overflow:hidden;
        /* Match appbar surface to avoid transparent flash on show */
        background: linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(8px) saturate(1.05);
        backdrop-filter: blur(8px) saturate(1.05);
      }
      .progress .bar{ position:absolute; left:-20%; width:18%; min-width:140px; max-width:280px; top:0; bottom:0; background: linear-gradient(90deg, rgba(59,130,246,0), rgba(59,130,246,.85), rgba(59,130,246,0)); border-radius:999px; animation: slide 1.15s linear infinite; box-shadow:0 0 10px rgba(59,130,246,.35); }
      @keyframes slide { 0%{left:-20%;} 100%{left:110%;} }
      .progress.hidden{ display:none; }

      /* ===== Body ===== */
      .container{ flex:1 1 auto; padding:7px 12px 8px; overflow:auto; transition: height .6s cubic-bezier(.2,.7,.3,1); }
      .container .section:last-child{ margin-bottom:8px; }
      .container .section:first-child{ margin-top:4px; }
      /* Empty state: hide cards; keep frosted background only between bars and compress middle to 66px */
      .wrap.is-empty #sx-summary,
      .wrap.is-empty #sx-cleaned{ display:none !important; }
      .wrap.is-empty .container{ flex:0 0 auto; height:66px; overflow:hidden; padding-top:0; padding-bottom:0; }
      .wrap.is-empty .section{ margin:0 !important; }
      /* While expanding, allow the middle to grow smoothly */
      .wrap.is-empty.expanding .container{ height: var(--sx-target, 2000px); }
      /* In folded state, keep the panel fully transparent outside the middle container */
      .wrap.fx-intro.is-empty,
      .wrap.is-empty{ background: transparent !important; -webkit-backdrop-filter:none !important; backdrop-filter:none !important; }
      .wrap.is-empty .container{
        background: linear-gradient(135deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(14px) saturate(1.05);
        backdrop-filter: blur(14px) saturate(1.05);
        border-top: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
        position: relative;
      }
      /* Center illus (down arrow) shown only in folded state */
      .empty-illus{ display:none; position:absolute; left:50%; top:50%; transform: translate(-50%, calc(-50% - var(--arrow-nudge)));
        width:28px; height:28px; border-radius:8px; opacity:.96; color: var(--primary);
        background: transparent; border:none; box-shadow:none; pointer-events:none;
        transition: opacity .25s ease, transform .25s ease; animation: bounceY 2.2s ease-in-out infinite; }
      :host([data-theme="dark"]) .empty-illus{ color: var(--primary-600); }
      .empty-illus::before{
        content:""; display:block; width:100%; height:100%;
        background: currentColor;
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23000"><path d="M12 16.5c-.38 0-.74-.14-1.02-.4l-5.5-5.2a1.4 1.4 0 0 1 0-2.02 1.54 1.54 0 0 1 2.1 0L12 12.9l4.42-4.02a1.54 1.54 0 0 1 2.1 0 1.4 1.4 0 0 1 0 2.02l-5.5 5.2c-.28.26-.64.4-1.02.4z"/></svg>') center/contain no-repeat;
        mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23000"><path d="M12 16.5c-.38 0-.74-.14-1.02-.4l-5.5-5.2a1.4 1.4 0 0 1 0-2.02 1.54 1.54 0 0 1 2.1 0L12 12.9l4.42-4.02a1.54 1.54 0 0 1 2.1 0 1.4 1.4 0 0 1 0 2.02l-5.5 5.2c-.28.26-.64.4-1.02.4z"/></svg>') center/contain no-repeat;
        transform: rotate(180deg);
      }
      .empty-illus::after{ content:""; display:none; }
      .wrap.is-empty .empty-illus{ display:grid; place-items:center; }
      .wrap.is-empty.expanding .empty-illus{ opacity:0; transform: translate(-50%, -60%); }
      .wrap.dragging .empty-illus{ animation: none; }
      @keyframes bounceY{ 0%,100%{ transform: translate(-50%, calc(-50% - var(--arrow-nudge))); } 50%{ transform: translate(-50%, calc(-50% - var(--arrow-nudge) + 4px)); } }
      @media (prefers-reduced-motion: reduce){ .empty-illus{ animation: none; } }
      /* Only show the left divider within the middle container; hide global one */
      .wrap.is-empty{ border-left:none !important; box-shadow:none !important; }
      .wrap.is-empty .container::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:1px; background: var(--border); }
      .wrap.is-empty .dragbar::after{ opacity:0 !important; width:0 !important; }
      :host([data-theme="dark"]) .wrap.is-empty .container{
        background: linear-gradient(135deg, var(--glass) 0%, var(--glass-soft) 100%);
      }
      /* Folded: keep same color scheme but reduce transparency via tokens */
      .wrap.is-empty{ --glass: rgba(255,255,255,.88); --glass-soft: rgba(255,255,255,.80); }
      :host([data-theme="dark"]) .wrap.is-empty{ --glass: rgba(16,22,32,.88); --glass-soft: rgba(16,22,32,.80); }
      /* In folded default state, make appbar/footer more solid; keep middle area more transparent */
      .wrap.is-empty .appbar,
      .wrap.is-empty .footer{ --glass: rgba(255,255,255,.97); --glass-soft: rgba(255,255,255,.92); }
      :host([data-theme="dark"]) .wrap.is-empty .appbar,
      :host([data-theme="dark"]) .wrap.is-empty .footer{ --glass: rgba(16,22,32,.92); --glass-soft: rgba(16,22,32,.86); }
      /* Folded: add a subtle bottom shadow to footer to enhance depth */
      .wrap.is-empty .footer{
        box-shadow: 0 -1px 6px rgba(16,24,40,.10), 0 4px 12px rgba(16,24,40,.12) !important;
      }
      :host([data-theme="dark"]) .wrap.is-empty .footer{
        box-shadow: 0 -1px 8px rgba(0,0,0,.28), 0 4px 12px rgba(0,0,0,.22) !important;
      }
      /* Intro state: high-transparency frosted look, no center block */
      .wrap.fx-intro{
        background: linear-gradient(135deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,.10) 100%);
        -webkit-backdrop-filter: blur(16px) saturate(1.05);
        backdrop-filter: blur(16px) saturate(1.05);
      }
      .wrap.fx-intro .container{ position:relative; }
      .wrap.fx-intro .container::after{ content:""; display:none; }
      :host([data-theme="dark"]) .wrap.fx-intro{
        background: linear-gradient(135deg, rgba(16,22,32,.34) 0%, rgba(16,22,32,.20) 100%);
      }
      .section{ margin:10px 0 16px; }

      /* ===== Cards ===== */
      .card{
        position:relative;
        background:
          /* fixed-size soft top highlight to avoid scaling with content height */
          radial-gradient(160px 120px at 24px -24px, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 68%),
          linear-gradient(180deg, var(--card-glass) 0%, var(--card-glass-soft) 100%);
        -webkit-backdrop-filter: blur(8px) saturate(1.05);
        backdrop-filter: blur(8px) saturate(1.05);
        border:1px solid var(--card-border);
        border-radius: var(--card-radius);
        padding:16px; line-height:1.7; font-size:15px; color: var(--text);
        box-shadow:
          0 1px 1px rgba(16,24,40,.05),
          0 8px 22px rgba(16,24,40,.08);
        transition: background-color .2s ease, color .2s ease, border-color .2s ease, box-shadow .22s ease, transform .12s ease;
        transform-origin: top center;
      }
      .card:hover{ transform: translateY(-2px); box-shadow: 0 2px 3px rgba(16,24,40,.06), 0 12px 28px rgba(16,24,40,.12); }

      /* Light theme: add a gentle color tint so cards aren't pure white */
      :host([data-theme="light"]) .card{
        background:
          radial-gradient(160px 120px at 24px -24px, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 68%),
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 60%, rgba(255,255,255,0) 100%),
          linear-gradient(180deg, var(--card-glass) 0%, var(--card-glass-soft) 100%);
      }

      /* Dark theme: soften and enlarge the top-left highlight for a natural look */
      :host([data-theme="dark"]) .card{
        background:
          radial-gradient(220px 160px at 24px -24px, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 80%),
          linear-gradient(180deg, var(--card-glass) 0%, var(--card-glass-soft) 100%);
      }

      .card.card-head{ padding-top:52px; }
      .card.card-head::before{
        content:""; position:absolute; left:0; right:0; top:0; height:44px;
        /* raised glass header with gentle color tint */
        background:
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 60%, rgba(255,255,255,0) 100%),
          linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(8px) saturate(1.05);
        backdrop-filter: blur(8px) saturate(1.05);
        border-radius:10px 10px 0 0; border-bottom:1px solid var(--border);
        /* raised glass: subtle outer drop shadow */
        box-shadow: 0 1px 6px rgba(16,24,40,.06);
      }
      .card.card-head::after{
        content: attr(data-title);
        position:absolute; left:14px; top:12px;
        font-weight:700; font-size:13px; letter-spacing:.2px; color: var(--muted);
      }

      .card-tools{ position:absolute; right:10px; top:8px; display:flex; align-items:center; gap:6px; }
      .tbtn{ border:1px solid var(--border); padding:6px 8px; border-radius:8px; cursor:pointer; background: var(--surface); color:#334155; }
      .tbtn:hover{ background:#fbfdff; border-color:#d9e6ff; }
      .tbtn:active{ transform: translateY(1px); }
      .tbtn[aria-pressed="true"]{ background:#eef5ff; border-color:#cadeff; }

      .read-progress{ position:absolute; left:0; right:0; top:44px; height:3px; background:transparent; }
      .read-progress > span{ display:block; height:3px; width:0%; background: linear-gradient(90deg, rgba(34,197,94,.12), rgba(34,197,94,.85)); transition: width .12s linear; }

      .card.revive{ animation: sxPop .26s cubic-bezier(.2,.7,.3,1) both; }
      @keyframes sxPop { 0%{ opacity:0; transform: translateY(6px) scale(.995);} 100%{ opacity:1; transform: translateY(0) scale(1);} }
      /* Pull-down intro animation for cards */
      .card.pull-in{ animation: sxPull .42s cubic-bezier(.2,.7,.3,1) both; }
      @keyframes sxPull {
        0%{ opacity:0; transform: translateY(-12px); clip-path: inset(0 0 100% 0 round 12px); }
        60%{ opacity:.96; transform: translateY(-2px); clip-path: inset(0 0 8% 0 round 12px); }
        100%{ opacity:1; transform: translateY(0); clip-path: inset(0 0 0 0 round 12px); }
      }
      /* (removed clip-path unroll to avoid flicker); rely on height transition for smoothness */

      /* ===== Markdown ===== */
      .md{ font-size:15px; line-height:1.78; color: var(--text); word-break:break-word; overflow-wrap:anywhere; }
      .md h1{ margin:16px 0 10px; font-size:20px; font-weight:900; }
      .md h2{ margin:14px 0 8px;  font-size:18px; font-weight:800; }
      .md h3{ margin:12px 0 8px;  font-size:16px; font-weight:700; }
      .md p{ margin:6px 0; }
      .md ul, .md ol{ margin:6px 0; padding-left:18px; }
      .md li{ margin:2px 0; }
      .md blockquote{ margin:12px 0; padding:10px 12px; border-left:3px solid #cfe0ff; border-radius:10px; background:#f8fbff; color: var(--text); }
      .md code{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size:.92em; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:6px; padding:0 .35em; }
      .md pre{ margin:10px 0; padding:12px; background:#f7f9ff; border:1px solid #e6e8f0; border-radius:12px; overflow:auto; line-height:1.6; }
      .md table{ width:100%; border-collapse:collapse; display:block; overflow:auto; margin:10px 0; border-radius:10px; }
      .md thead th{ background:#f0f5ff; color:var(--text); font-weight:800; }
      .md th, .md td{ border:1px solid #e5e7eb; padding:8px 10px; text-align:left; vertical-align:top; }
      .md img{ display:block; margin:8px 0; border-radius:8px; }
      .md hr{ border:0; border-top:1px solid #e6e8f0; margin:12px 0; }

      /* content progressive reveal */
      .md [data-fade]{ opacity:0; transform: translateY(4px); transition: opacity .32s ease, transform .32s ease; }
      .md [data-fade].on{ opacity:1; transform: translateY(0); }

      .empty{ text-align:center; padding:34px 12px 30px; color:var(--muted); }
      .empty .illus{ width:72px; height:72px; margin:0 auto 10px; border-radius:16px; border:1px solid var(--border);
        background: linear-gradient(135deg, rgba(255,255,255,.92) 0%, var(--surface-2) 100%);
        box-shadow: var(--shadow-1); display:grid; place-items:center; }
      .empty .icon{ font-size:24px; line-height:1; }
      .empty .title{ font-weight:800; margin:6px 0 4px; color:var(--text); font-size:14px; letter-spacing:.2px; }
      .empty .hint{ margin-top:6px; color:var(--muted); font-size:12px; }
      .empty .hint strong{ background:rgba(59,130,246,.10); padding:0 6px; border-radius:6px; }

      .alert{ border-radius:12px; border:1px solid #f3e9c5; background:#fff9e6; padding:10px 40px 10px 12px; margin:2px 0 10px; font-size:13px; line-height:1.65; position:relative; }
      .alert .alert-close{ position:absolute; top:6px; right:6px; border:none; background:transparent; font-size:16px; cursor:pointer; line-height:1; opacity:.8; }
      .alert .alert-close:hover{ opacity:1; }

      /* tighten spacing after alert */
      .md .alert + *{ margin-top:10px !important; }
      .md .alert + h1,
      .md .alert + h2,
      .md .alert + h3,
      .md .alert + h4,
      .md .alert + h5,
      .md .alert + h6{ margin-top:6px !important; }

      /* ===== Skeleton (loading) ===== */
      .skl{ height:12px; margin:8px 0; border-radius:8px;
        background: linear-gradient(90deg, #eef2ff 0%, #ffffff 40%, #eef2ff 80%);
        background-size: 200% 100%;
        animation: skl 1.2s ease-in-out infinite;
      }
      @keyframes skl{ 0%{ background-position:0% 0; } 100%{ background-position:200% 0; } }

      /* ===== Footer ===== */
      .footer{ flex:0 0 auto; font-size:12px; border-top:1px solid var(--border); padding:8px 12px;
        background:
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 55%, rgba(255,255,255,0) 100%),
          linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(10px) saturate(1.05);
        backdrop-filter: blur(10px) saturate(1.05);
        /* raised glass: subtle outer drop shadow upwards */
        box-shadow: 0 -1px 6px rgba(16,24,40,.06);
        color:#334155; border-bottom-left-radius: var(--chrome-radius); border-bottom-right-radius: var(--chrome-radius); }
      .footer-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:nowrap; }
      .footer-controls{ display:flex; align-items:center; gap:16px; flex-shrink:0; }
      .force-dark-toggle{ display:flex; align-items:center; gap:8px; }
      .force-dark-toggle .label{ color:#334155; white-space:nowrap; font-weight:700; font-size:12px; letter-spacing:.03em; }
      .toggle-btn{ 
        width:28px; 
        height:28px; 
        padding:0; 
        border:1px solid rgba(0,0,0,0.1); 
        border-radius:999px; 
        background:rgba(255,255,255,0.8); 
        cursor:pointer; 
        color:#334155; 
        display:grid; 
        place-items:center; 
        transition: all .18s ease; 
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .toggle-btn:hover{ 
        background:rgba(255,255,255,0.95); 
        border-color:rgba(0,0,0,0.15); 
        box-shadow: 0 2px 6px rgba(0,0,0,0.15); 
        transform: translateY(-1px); 
      }
      .toggle-btn:active{ 
        transform: translateY(0); 
        box-shadow: 0 1px 3px rgba(0,0,0,0.2); 
      }
      .toggle-btn.active{ 
        background:var(--primary); 
        color:#fff; 
        border-color:var(--primary); 
        box-shadow: 0 2px 8px rgba(59,130,246,0.3); 
      }
      .toggle-btn svg{ width:16px; height:16px; display:block; stroke:currentColor; }
      .theme-toggle{ display:flex; align-items:center; gap:8px; flex-shrink:0; }
      .theme-toggle .label{ color:#334155; white-space:nowrap; font-weight:700; font-size:12px; letter-spacing:.03em; }
      .theme-toggle .seg{ display:flex; gap:6px; background: var(--surface-2); border:1px solid var(--border); border-radius:999px; padding:2px; }
      .theme-btn{ width:28px; height:28px; padding:0; border:none; border-radius:999px; background:transparent; cursor:pointer; color:#334155; display:grid; place-items:center; transition: background .18s, color .18s; }
      .theme-btn:hover{ background:rgba(0,0,0,0.06); }
      .theme-btn.active{ background:var(--primary); color:#fff; }
      .theme-btn svg{ width:16px; height:16px; display:block; stroke:currentColor; }

      /* ===== Dark theme overrides ===== */
      :host([data-theme="dark"]) .alert{
        background: rgba(250, 204, 21, 0.08);   /* subtle amber tint on dark */
        border-color: rgba(250, 204, 21, 0.32);
        color: var(--text);                      /* keep readable light text */
      }
      :host([data-theme="dark"]) {
        color-scheme: dark;
        --bg:#0b1220;
        --surface:#111a2e;
        --surface-2:#0d1526;
        --border:#1f2a44;
        --text:#e8eef9;
        --muted:#c2cde3;
        --primary:#8ea2ff;
        --primary-600:#7b8cff;
        --candy-az: rgba(142,162,255,.14);
        --candy-vi: rgba(123,140,255,.12);
        --candy-pk: rgba(255,140,190,.10);
        --ring: 0 0 0 3px rgba(142,162,255,.22);
        --shadow-1: 0 1px 2px rgba(0,0,0,.32);
        --shadow-2: 0 4px 12px rgba(0,0,0,.35);
        /* glass tokens for dark */
        --glass: rgba(17,26,46,.62);
        --glass-soft: rgba(17,26,46,.44);
        --glass-edge: rgba(255,255,255,.06);
        --glass-highlight: rgba(255,255,255,.10);
        --card-glass: rgba(17,26,46,.78);
        --card-glass-soft: rgba(17,26,46,.60);
        --card-border: rgba(255,255,255,.08);
      }
      /* skeleton contrast for dark */
      :host([data-theme="dark"]) .skl{
        background: linear-gradient(90deg, #0f1a30 0%, #1a2540 40%, #0f1a30 80%);
        background-size:200% 100%;
        animation: skl 1.2s ease-in-out infinite;
      }
      :host([data-theme="dark"]) .appbar{
        background:
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 55%, rgba(0,0,0,0) 100%),
          linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(10px) saturate(1.05);
        backdrop-filter: blur(10px) saturate(1.05);
        border-bottom:1px solid var(--border);
        box-shadow: 0 1px 8px rgba(0,0,0,.28);
      }
      :host([data-theme="dark"]) .logo{ background: var(--primary); box-shadow: 0 0 0 6px rgba(142,162,255,.14); }
      :host([data-theme="dark"]) .btn{ background: var(--surface); color:#dbe3ee; border-color:#27344b; box-shadow: var(--shadow-1); }
      :host([data-theme="dark"]) .btn:hover{ background:#16233b; border-color:#344766; box-shadow: var(--shadow-2); }
      :host([data-theme="dark"]) .btn.primary{ background: var(--primary-600); border-color: var(--primary-600); color:#fff; }
      :host([data-theme="dark"]) .progress .bar{ background: linear-gradient(90deg, rgba(255,255,255,0), rgba(142,162,255,.85), rgba(255,255,255,0)); box-shadow: 0 0 10px rgba(142,162,255,.30); }
      :host([data-theme="dark"]) .card.card-head::before{
        background:
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 60%, rgba(0,0,0,0) 100%),
          linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(8px) saturate(1.05);
        backdrop-filter: blur(8px) saturate(1.05);
        border-bottom-color: #1a2540;
        box-shadow: 0 1px 8px rgba(0,0,0,.28);
      }
      :host([data-theme="dark"]) .card.card-head::after{ color: var(--muted); }
      :host([data-theme="dark"]) .footer{
        background:
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 55%, rgba(0,0,0,0) 100%),
          linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(10px) saturate(1.05);
        backdrop-filter: blur(10px) saturate(1.05);
        color:#d8e0ee; border-top-color: var(--border);
        box-shadow: 0 -1px 8px rgba(0,0,0,.28);
      }
      :host([data-theme="dark"]) .empty .illus{ 
        background: linear-gradient(135deg, rgba(142,162,255,.08) 0%, rgba(142,162,255,.04) 100%);
        border-color: rgba(142,162,255,.15);
        box-shadow: 0 2px 8px rgba(0,0,0,.2);
      }
      :host([data-theme="dark"]) .empty .hint strong{ background:rgba(142,162,255,.16); }
      :host([data-theme="dark"]) .force-dark-toggle .label{ color:#d9e2f2; }
      :host([data-theme="dark"]) .toggle-btn{ 
        color:#d9e2f2; 
        border-color: rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.1);
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
      :host([data-theme="dark"]) .toggle-btn:hover{ 
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.25);
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        transform: translateY(-1px);
      }
      :host([data-theme="dark"]) .toggle-btn:active{ 
        transform: translateY(0);
        box-shadow: 0 1px 3px rgba(0,0,0,0.5);
      }
      :host([data-theme="dark"]) .toggle-btn.active{ 
        background:#2a3d5f; 
        color:#e8eef8; 
        border-color: #2a3d5f;
        box-shadow: 0 2px 8px rgba(142,162,255,0.3);
      }
      :host([data-theme="dark"]) .theme-toggle .label{ color:#d9e2f2; }
      :host([data-theme="dark"]) .theme-toggle .seg{ background:#18233a; border-color:#2a3d5f; }
      :host([data-theme="dark"]) .theme-btn{ color:#d9e2f2; }
      :host([data-theme="dark"]) .theme-btn.active{ background:#2a3d5f; color:#e8eef8; }

      /* Dark markdown readability tweaks */
      :host([data-theme="dark"]) .md a{ color: var(--primary); }
      :host([data-theme="dark"]) .md code{
        background:#121a2d;
        border:1px solid #243555;
        color:#eef4ff;
      }
      :host([data-theme="dark"]) .md pre{
        background:#0f1a30;
        border:1px solid #1a2540;
        color:#e8eef9;
      }
      :host([data-theme="dark"]) .md blockquote{
        background: rgba(142,162,255,.08);
        border-left:3px solid #2a3f66;
        color: var(--text);
      }
      :host([data-theme="dark"]) .md thead th{ background:#16233b; color: var(--text); }
      :host([data-theme="dark"]) .md th, :host([data-theme="dark"]) .md td{ border-color:#2a3f66; }
      :host([data-theme="dark"]) .md hr{ border-top:1px solid #1a2540; }

      /* Card tool buttons on dark */
      :host([data-theme="dark"]) .tbtn{ background: var(--surface); color:#e2ebf8; border-color:#27344b; }
      :host([data-theme="dark"]) .tbtn:hover{ background:#16233b; border-color:#344766; }

      /* ===== Accessibility ===== */
      @media (prefers-reduced-motion: reduce){
        .btn, .card{ transition: none; }
      }
    `;
    shadow.appendChild(style);

    const root = document.createElement('div');
    shadow.appendChild(root);
    document.documentElement.appendChild(host);

    // 模板
    root.innerHTML = `
      <div class="wrap" id="sx-wrap">
        <div class="dragbar" id="sx-drag"></div>
        <div class="appbar">
          <div class="brand"><span class="logo"></span><div class="title" id="sx-app-title">麦乐可 AI 摘要阅读器</div></div>
          <div class="actions">
            <button id="sx-settings" class="btn" title="设置">设置</button>
            <button id="sx-run" class="btn primary">提取并摘要</button>
            <button id="sx-close" class="btn icon" title="关闭" aria-label="关闭">✕</button>
          </div>
        </div>
        <div id="sx-progress" class="progress hidden"><div class="bar"></div></div>
        <div class="container" id="sx-container">
          <div class="empty-illus" id="sx-empty-arrow" aria-hidden="true"></div>
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
            <div class="footer-controls">
              <div class="force-dark-toggle" id="sx-force-dark">
                <span class="label" id="sx-force-dark-label">强制深色</span>
                <button class="toggle-btn" id="sx-force-dark-btn" aria-label="强制深色模式" title="强制深色模式">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                </button>
              </div>
              <div class="theme-toggle" id="sx-theme">
                <span class="label" id="sx-theme-label">外观</span>
                <div class="seg" role="tablist" aria-label="外观切换">
                  <button class="theme-btn" data-mode="auto" role="tab" aria-selected="true" aria-label="自动" title="自动">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                  </button>
                  <button class="theme-btn" data-mode="light" role="tab" aria-selected="false" aria-label="浅色" title="浅色">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                  </button>
                  <button class="theme-btn" data-mode="dark" role="tab" aria-selected="false" aria-label="深色" title="深色">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 12.8a9 9 0 1 1-9.8-9 7 7 0 0 0 9.8 9z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    return host;
  }

  // ===== 主题覆盖 =====
  let themeOverride='auto';
  let forceDarkMode = false;
  function computeTheme(){
    try{ const mq=window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)'); if (mq && typeof mq.matches==='boolean') return mq.matches?'dark':'light'; }catch{}
    return isDarkBackground()? 'dark': 'light';
  }
  function applyThemeWithOverride(shadow){
    const mode=themeOverride||'auto';
    const theme=(mode==='light'||mode==='dark')? mode: computeTheme();
    if (shadow.host.getAttribute('data-theme')!==theme) shadow.host.setAttribute('data-theme',theme);
  }
  function markThemeButtonsActive(shadow){
    shadow.getElementById('sx-theme')?.querySelectorAll('.theme-btn').forEach(b=>{
      const active=(b.dataset.mode===themeOverride);
      b.classList.toggle('active',active);
      b.setAttribute('aria-selected', active?'true':'false');
    });
  }

  // ===== Chrome 交互 =====
  async function getActiveTabId(){ try{ const r=await chrome.runtime.sendMessage({type:'GET_ACTIVE_TAB_ID'}); return r?.ok? (r.tabId??null): null; }catch{ return null; } }
  async function getState(tabId){ const r=await chrome.runtime.sendMessage({type:'PANEL_GET_STATE', tabId}); if(!r?.ok) throw new Error(r?.error||'无法获取状态'); return r.data; }

  // ===== 状态渲染（组件化）=====
  let currentLangCache='zh';

  // 组件：卡片（Vue 启用时使用）
  function CardComponent(props){
    return {
      $template: `
        <div class="card card-head" :data-title="title" ref="card">
          <div class="read-progress" aria-hidden="true"><span :style="\`width:\${progress}%\`"></span></div>
          <div class="card-tools" role="toolbar" aria-label="card tools">
            <button class="tbtn" @click="copy" :title="tt.copy">{{ tt.copy }}</button>
            <button class="tbtn" @click="toggle" :aria-pressed="collapsed? 'true':'false'" :title="collapsed? tt.expand: tt.collapse">
              {{ collapsed? tt.expand: tt.collapse }}
            </button>
          </div>
          <div v-show="!collapsed" class="md" v-html="html"></div>
          <div v-show="collapsed" class="empty">
            <div class="icon">➖</div>
            <div class="title">{{ tt.collapsed }}</div>
          </div>
        </div>
      `,
      title: props.title,
      html: props.html,
      collapsed: false,
      progress: 0,
      tt: {
        get copy(){ return currentLangCache==='en' ? 'Copy' : '复制'; },
        get collapse(){ return currentLangCache==='en' ? 'Collapse' : '收起'; },
        get expand(){ return currentLangCache==='en' ? 'Expand' : '展开'; },
        get collapsed(){ return currentLangCache==='en' ? 'Collapsed' : '已收起'; },
      },
      mounted(){
        try{
          const md = this.$refs.card.querySelector('.md');
          if (md){
            const blocks = Array.from(md.children);
            blocks.forEach((el)=>{
              el.setAttribute('data-fade','');
              const io = new IntersectionObserver((es)=>{
                es.forEach(e=>{
                  if(e.isIntersecting){ e.target.classList.add('on'); io.unobserve(e.target); }
                });
              }, { root: md.closest('.container'), threshold: 0.02 });
              io.observe(el);
            });
          }
        }catch{}

        const container = this.$refs.card.closest('.container');
        const update = () => {
          const cardRect = this.$refs.card.getBoundingClientRect();
          const contRect = container.getBoundingClientRect();
          const visible = Math.min(cardRect.bottom, contRect.bottom) - Math.max(cardRect.top, contRect.top);
          const total = cardRect.height;
          const pct = total>0 ? Math.max(0, Math.min(100, Math.round((visible/total)*100))) : 0;
          this.progress = pct;
        };
        this._onScroll = () => update();
        container.addEventListener('scroll', this._onScroll, { passive:true });
        update();
      },
      unmounted(){
        try{
          const container = this.$refs.card.closest('.container');
          container && this._onScroll && container.removeEventListener('scroll', this._onScroll);
        }catch{}
      },
      toggle(){ this.collapsed = !this.collapsed; },
      async copy(){
        try{
          const tmp = document.createElement('div');
          tmp.innerHTML = this.html;
          const text = tmp.innerText;
          await navigator.clipboard.writeText(text);
          this._flashBtn('.tbtn:first-child');
        }catch(e){ console.warn('copy failed', e); }
      },
      _flashBtn(sel){
        const btn = this.$refs.card.querySelector(sel);
        if(!btn) return;
        btn.setAttribute('aria-pressed','true');
        setTimeout(()=>btn.setAttribute('aria-pressed','false'), 900);
      }
    };
  }

  // 原生模式下的占位渲染
  function vanillaSkeleton(shadow){
    shadow.getElementById('sx-summary').innerHTML =
      `<div class="skl" style="width:90%"></div><div class="skl" style="width:72%"></div><div class="skl" style="width:84%"></div>`;
    shadow.getElementById('sx-cleaned').innerHTML =
      `<div class="skl" style="width:96%"></div><div class="skl" style="width:64%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`;
  }
  async function vanillaEmpty(shadow){
    const i18n = await loadI18n(); const lang = i18n? await i18n.getCurrentLanguage(): 'zh';
    const em1 = `<div class="empty is-summary">
      <div class="illus"><div class="icon">📝</div></div>
      <div class="title">${lang==='zh'?'暂无摘要':'No Summary'}</div>
      <div class="hint">${lang==='zh'?'点击上方<strong>提取并摘要</strong>开始处理当前页面':'Click <strong>Extract & Summarize</strong> above to process this page'}</div>
    </div>`;
    const em2 = `<div class="empty is-cleaned">
      <div class="illus"><div class="icon">📄</div></div>
      <div class="title">${lang==='zh'?'暂无可读正文':'No Readable Content'}</div>
      <div class="hint">${lang==='zh'?'点击上方<strong>提取并摘要</strong>生成可读正文':'Use <strong>Extract & Summarize</strong> to generate cleaned content'}</div>
    </div>`;
    shadow.getElementById('sx-summary').innerHTML = em1;
    shadow.getElementById('sx-cleaned').innerHTML = em2;
  }
  async function vanillaRender(shadow, summary, cleaned){
    const $s = shadow.getElementById('sx-summary');
    const $c = shadow.getElementById('sx-cleaned');
    $s.innerHTML = summary ? stripInlineColor(renderMarkdown(summary)) : $s.innerHTML;
    $c.innerHTML = (cleaned===null) ? `<div class="skl" style="width:96%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`
      : (cleaned ? stripInlineColor(renderMarkdown(cleaned)) : $c.innerHTML);
    try{ $s.firstElementChild?.classList?.add('revive'); $c.firstElementChild?.classList?.add('revive'); }catch{}
  }

  function applyTrialLabelToFloatButton(shadow){
    const btn = shadow.getElementById('sx-run'); if(!btn) return;
    chrome.storage.sync.get(['aiProvider']).then(async ({ aiProvider })=>{
      const i18n = await loadI18n(); const lang = i18n? await i18n.getCurrentLanguage(): 'zh';
      if ((aiProvider||'trial')==='trial'){
        btn.textContent = lang==='zh' ? '试用摘要' : 'Trial Summary';
        btn.title = lang==='zh' ? '当前为试用模式（通过代理调用），点击开始试用摘要' : 'Currently in trial mode (via proxy), click to start trial summary';
      }else{
        btn.textContent = lang==='zh' ? '提取并摘要' : 'Extract & Summarize';
        btn.title = lang==='zh' ? '点击提取正文并生成摘要' : 'Click to extract content and generate summary';
      }
      try{ updateEmptyArrowPosition(); }catch{}
    }).catch(()=>{
      btn.textContent = '提取并摘要';
      btn.title = '点击提取正文并生成摘要';
      try{ updateEmptyArrowPosition(); }catch{}
    });
  }

  // ===== 轮询兜底 =====
  let pollTimer=null;
  function stopPolling(){ if(pollTimer){ clearTimeout(pollTimer); pollTimer=null; } }
  async function pollUntilDone(shadow, tabId, render){
    stopPolling();
    const start=Date.now();
    let interval=600, maxInterval=2000, hardTimeout=120000;

    const step = async ()=>{
      try{
        const st = await getState(tabId);
        if (st.status==='done'){ setLoading(shadow,false); await render(st.summary, st.cleaned); stopPolling(); return; }
        if (st.status==='error'){
          setLoading(shadow,false);
          const i18n = await loadI18n(); const lang = i18n? await i18n.getCurrentLanguage():'zh';
          shadow.getElementById('sx-summary').innerHTML =
            `<div class="alert"><button class="alert-close" title="关闭" aria-label="关闭">&times;</button><div class="alert-content"><p>${lang==='zh'?'发生错误，请重试。':'An error occurred, please try again.'}</p></div></div>`;
          stopPolling(); return;
        }
        if (st.status==='partial'){ setLoading(shadow,true); await render(st.summary, null); }
        else if (st.status==='running'){ setLoading(shadow,true); skeleton(shadow); }
      }catch{}
      if (Date.now()-start>hardTimeout){ setLoading(shadow,false); stopPolling(); return; }
      interval = Math.min(maxInterval, Math.round(interval*1.25));
      pollTimer = setTimeout(step, interval);
    };
    pollTimer=setTimeout(step, interval);
  }

  // ===== 主题监听 & 其他绑定 =====
  function startThemeWatchers(shadow){
    try{ applyThemeWithOverride(shadow); }catch{}
    const themeObserver = new MutationObserver(()=>{ try{ if(themeOverride==='auto') applyThemeWithOverride(shadow); }catch{} });
    themeObserver.observe(document.documentElement,{attributes:true, attributeFilter:['class','style']});
    if (document.body) themeObserver.observe(document.body,{attributes:true, attributeFilter:['class','style']});
    const themeTick = setInterval(()=>{ try{ if(themeOverride==='auto') applyThemeWithOverride(shadow); }catch{} },1500);
    try{
      const mq=window.matchMedia('(prefers-color-scheme: dark)');
      const onChange=()=>{ if(themeOverride==='auto') applyThemeWithOverride(shadow); };
      if (mq?.addEventListener) mq.addEventListener('change', onChange);
      else if (mq?.addListener) mq.addListener(onChange);
    }catch{}
    return ()=>{ try{themeObserver.disconnect();}catch{} try{clearInterval(themeTick);}catch{} };
  }

  // ===== 启动 =====
  const host = ensurePanel();
  const shadow = host.shadowRoot;

  // 动态定位折叠箭头到“提取并摘要”按钮正下方
  function updateEmptyArrowPosition(){
    try{
      const wrap = shadow.getElementById('sx-wrap');
      if (!wrap || !wrap.classList.contains('is-empty')) return;
      const btn = shadow.getElementById('sx-run');
      const container = shadow.getElementById('sx-container');
      const arrow = shadow.getElementById('sx-empty-arrow');
      if (!btn || !container || !arrow) return;
      const br = btn.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      if (!br.width || !cr.width) return;
      const centerX = br.left + br.width/2;
      const leftInContainer = Math.max(0, Math.min(cr.width, centerX - cr.left));
      arrow.style.left = Math.round(leftInContainer) + 'px';
      // keep vertical center via top:50% in CSS
    }catch{}
  }

  // 监听容器与按钮尺寸变化，实时校准箭头（避免第一次变化时跳动）
  let __arrowRO = null;
  function bindArrowResizeObservers(){
    try{
      if (!('ResizeObserver' in window)) return;
      if (__arrowRO) { try{ __arrowRO.disconnect(); }catch{} }
      __arrowRO = new ResizeObserver(()=>{ try{ updateEmptyArrowPosition(); }catch{} });
      const c = shadow.getElementById('sx-container');
      const b = shadow.getElementById('sx-run');
      c && __arrowRO.observe(c);
      b && __arrowRO.observe(b);
    }catch{}
  }

  // Align corner radius to platform look
  (function applyPlatformRadius(){
    try{
      const ua = navigator.userAgent || '';
      // Defaults to 12px (Chrome desktop surfaces)
      let px = 12;
      if (/Windows/i.test(ua)) px = 8;               // Windows 11 look leans 8px
      else if (/Macintosh|Mac OS X/i.test(ua)) px = 12; // macOS rounded surfaces ~12px
      else px = 12;
      shadow.host.style.setProperty('--chrome-radius', px + 'px');
    }catch{}
  })();

  // ripple
  shadow.addEventListener('click',(ev)=>{
    const b=ev.target.closest('.btn'); if(!b) return;
    const rect=b.getBoundingClientRect(); const x=ev.clientX-rect.left; const y=ev.clientY-rect.top;
    const r=document.createElement('span'); r.className='ripple'; r.style.left=x+'px'; r.style.top=y+'px';
    b.appendChild(r); setTimeout(()=>{ try{ r.remove(); }catch{} }, 650);
  });

  // 关闭
  const stopThemeWatch = startThemeWatchers(shadow);
  shadow.getElementById('sx-close')?.addEventListener('click', ()=>{ stopThemeWatch(); host.remove(); window[MARK]=false; });

  // 保持折叠箭头在窗口尺寸变化时也对齐
  try{ window.addEventListener('resize', ()=>{ try{ updateEmptyArrowPosition(); }catch{} }, { passive:true }); }catch{}

  // 开启动画：为容器添加入场类，完毕后移除
  try{
    const wrapOnce = shadow.getElementById('sx-wrap');
    if (wrapOnce){
      wrapOnce.classList.add('fx-enter');
      const clear = ()=>{ try{ wrapOnce.classList.remove('fx-enter'); wrapOnce.removeEventListener('animationend', clear); updateEmptyArrowPosition(); }catch{} };
      wrapOnce.addEventListener('animationend', clear);
      // 帧后与兜底时机各执行一次定位，避免入场动画位置差异
      requestAnimationFrame(()=>{ try{ updateEmptyArrowPosition(); }catch{} });
      setTimeout(clear, 900);
    }
  }catch{}

  // 设置
  shadow.getElementById('sx-settings')?.addEventListener('click', async ()=>{ try{ await chrome.runtime.sendMessage({type:'OPEN_OPTIONS'});}catch{} });

  // 主题切换
  const themeWrap=shadow.getElementById('sx-theme');
  themeWrap?.addEventListener('click',(e)=>{
    const btn=e.target.closest('.theme-btn'); if(!btn) return;
    const mode=btn.dataset.mode; if(!['auto','light','dark'].includes(mode)) return;
    themeOverride=mode;
    try{ chrome.storage.sync.set({ float_theme_override: themeOverride, options_theme_override: themeOverride }); }catch{}
    applyThemeWithOverride(shadow);
    markThemeButtonsActive(shadow);
  });

  // 强制深色模式切换
  const forceDarkBtn = shadow.getElementById('sx-force-dark-btn');
  forceDarkBtn?.addEventListener('click', async ()=>{
    forceDarkMode = !forceDarkMode;
    forceDarkBtn.classList.toggle('active', forceDarkMode);
    
    // 保存设置
    try{ 
      await chrome.storage.sync.set({ force_dark_mode: forceDarkMode }); 
    }catch(e){ 
      console.warn('Failed to save force dark mode setting:', e); 
    }
    
    // 应用强制深色模式
    applyForceDarkMode(forceDarkMode);
  });

  // 拖宽 + 记忆
  (function bindDrag(){
    const drag=shadow.getElementById('sx-drag'); const wrapEl=shadow.getElementById('sx-wrap');
    function clamp(px){
      const vw=Math.max(document.documentElement.clientWidth, window.innerWidth||0);
      const minW=Math.min(320, vw-80), maxW=Math.max(320, Math.min(720, vw-80));
      return Math.max(minW, Math.min(maxW, px));
    }
    function setW(clientX){
      const vw=Math.max(document.documentElement.clientWidth, window.innerWidth||0);
      const fromRight=vw-clientX; const w=clamp(fromRight);
      host.style.width = `${w}px`; try{ chrome.storage.sync.set({ float_panel_width: w }); }catch{}
    }
    let dragging=false;
    function start(){ dragging=true; wrapEl?.classList.add('dragging'); document.documentElement.style.userSelect='none'; try{ updateEmptyArrowPosition(); }catch{} }
    function end(){ dragging=false; wrapEl?.classList.remove('dragging'); document.documentElement.style.userSelect=''; window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); window.removeEventListener('touchmove', tm, {capture:true, passive:false}); window.removeEventListener('touchend', te, {capture:true}); }
    const mm=(ev)=>{ if(!dragging) return; ev.preventDefault(); setW(ev.clientX); updateEmptyArrowPosition(); };
    const mu=()=>{ if(!dragging) return; end(); };
    const tm=(ev)=>{ if(!dragging) return; if(ev.touches && ev.touches[0]) setW(ev.touches[0].clientX); updateEmptyArrowPosition(); ev.preventDefault(); };
    const te=()=>{ if(!dragging) return; end(); };
    drag?.addEventListener('mousedown',(e)=>{ start(); e.preventDefault(); window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true); });
    drag?.addEventListener('touchstart',(e)=>{ start(); e.preventDefault(); window.addEventListener('touchmove', tm, {capture:true, passive:false}); window.addEventListener('touchend', te, {capture:true}); }, {passive:false});
    drag?.addEventListener('dblclick', async ()=>{
      const cur=parseInt(getComputedStyle(host).width,10)||420;
      const target=cur<520? 560: 380;
      const w=clamp(target); host.style.width=`${w}px`; try{ chrome.storage.sync.set({ float_panel_width:w }); }catch{}
    });
    try{ chrome.storage.sync.get(['float_panel_width']).then(({float_panel_width})=>{ if(Number.isFinite(+float_panel_width)) host.style.width = `${clamp(+float_panel_width)}px`; updateEmptyArrowPosition(); }); }catch{}
  })();

  // 关闭 notice 清理
  shadow.addEventListener('click',(e)=>{
    const btn=e.target.closest('.alert-close'); if(!btn) return;
    const box=btn.closest('.alert'); if(!box) return;
    const rm=(start,dir='nextSibling')=>{ let n=start[dir]; while(n && n.nodeType===1 && n.tagName==='BR'){ const d=n; n=n[dir]; d.remove(); } };
    rm(box,'previousSibling'); rm(box,'nextSibling');
    const md=box.closest('.md'); box.remove(); if(md){ const first=md.firstElementChild; first && (first.style.marginTop='6px'); }
  });

  // 文案/标题 i18n（更新 host.lang → 驱动中英文按钮换行策略）
  async function updateUIText(){
    const i18n=await loadI18n(); if(!i18n) return;
    try{
      const lang = await i18n.getCurrentLanguage();
      currentLangCache = lang==='en' ? 'en':'zh';
      // 设置 Shadow Host 的语言属性，用于 CSS 定向控制换行
      shadow.host.setAttribute('lang', currentLangCache==='zh' ? 'zh-CN' : 'en');

      const t_app = currentLangCache==='zh'?'麦乐可 AI 摘要阅读器':'SummarizerX AI Reader';
      const t_set = currentLangCache==='zh'?'设置':'Settings';
      const t_run = currentLangCache==='zh'?'提取并摘要':'Extract & Summarize';
      const t_close = currentLangCache==='zh'?'关闭':'Close';
      const t_appear = currentLangCache==='zh'?'外观':'Appearance';
      const t_force_dark = currentLangCache==='zh'?'强制深色':'Force Dark';
      const t_note = currentLangCache==='zh'?'注：部分页面（如 chrome://、扩展页、PDF 查看器）不支持注入。':'Note: Some pages (like chrome://, extension pages, PDF viewers) do not support injection.';
      shadow.getElementById('sx-app-title').textContent = t_app;
      const runBtn=shadow.getElementById('sx-run'); if(runBtn && !runBtn.disabled) runBtn.textContent=t_run;
      const settingsBtn=shadow.getElementById('sx-settings'); if(settingsBtn){ settingsBtn.textContent=t_set; settingsBtn.title=t_set; }
      const closeBtn=shadow.getElementById('sx-close'); if(closeBtn){ closeBtn.title=t_close; closeBtn.setAttribute('aria-label', t_close); }
      shadow.getElementById('sx-theme-label').textContent=t_appear;
      shadow.getElementById('sx-force-dark-label').textContent=t_force_dark;
      shadow.getElementById('sx-footer-note').textContent=t_note;
      shadow.getElementById('sx-summary').setAttribute('data-title', currentLangCache==='zh'?'摘要':'Summary');
      shadow.getElementById('sx-cleaned').setAttribute('data-title', currentLangCache==='zh'?'可读正文':'Readable Content');
    }catch(e){ console.warn('Failed to update UI text:', e); }
    try{ updateEmptyArrowPosition(); }catch{}
  }

  function setLoading(shadow,loading){
    const runBtn=shadow.getElementById('sx-run');
    const bar=shadow.getElementById('sx-progress');
    if (runBtn){
      runBtn.disabled=!!loading;
      if (loading){ const t=currentLangCache==='en'?'Processing…':'处理中…'; runBtn.innerHTML=`<span class="spin"></span><span>${t}</span>`; }
      else{ runBtn.textContent = currentLangCache==='en' ? 'Extract & Summarize':'提取并摘要'; }
    }
    if (bar) bar.classList.toggle('hidden', !loading);
  }

  // ==== Vue 挂载（如果可用）====
  let vueApp=null, vmSummary=null, vmCleaned=null;
  function mountVue(){
    if (!PV) return false;
    const rootSummary = shadow.getElementById('sx-summary');
    const rootCleaned = shadow.getElementById('sx-cleaned');
    rootSummary.innerHTML = '';
    rootCleaned.innerHTML = '';
    vueApp = PV.createApp({});
    vmSummary = vueApp.mount(CardComponent({ title: currentLangCache==='zh'?'摘要':'Summary', html: '' }), rootSummary);
    vmCleaned = vueApp.mount(CardComponent({ title: currentLangCache==='zh'?'可读正文':'Readable Content', html: '' }), rootCleaned);
    return true;
  }
  function skeleton(shadow){
    if (vmSummary && vmCleaned){
      vmSummary.html = `<div class="skl" style="width:90%"></div><div class="skl" style="width:72%"></div><div class="skl" style="width:84%"></div>`;
      vmCleaned.html = `<div class="skl" style="width:96%"></div><div class="skl" style="width:64%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`;
    }else{
      vanillaSkeleton(shadow);
    }
  }
  async function setEmpty(shadow){
    // Do not render empty cards; keep background only
    try{
      if (vmSummary && vmCleaned){ vmSummary.html = ''; vmCleaned.html = ''; }
      else {
        shadow.getElementById('sx-summary').innerHTML = '';
        shadow.getElementById('sx-cleaned').innerHTML = '';
      }
    }catch{}
    // Mark intro + empty for high-transparency frosted backdrop and no resize
    try{ const wrap=shadow.getElementById('sx-wrap'); wrap?.classList?.add('fx-intro'); wrap?.classList?.add('is-empty'); }catch{}
    // Observe changes & update arrow position under the run button center
    try{ bindArrowResizeObservers(); updateEmptyArrowPosition(); }catch{}
  }
  async function renderCards(summaryMarkdown, cleanedMarkdown){
    const sumHTML = summaryMarkdown ? stripInlineColor(renderMarkdown(summaryMarkdown)) : '';
    if (vmSummary) vmSummary.html = sumHTML; else shadow.getElementById('sx-summary').innerHTML = sumHTML;
    if (cleanedMarkdown===null){
      if (vmCleaned) vmCleaned.html = `<div class="skl" style="width:96%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`;
      else shadow.getElementById('sx-cleaned').innerHTML = `<div class="skl" style="width:96%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`;
      return;
    }
    const cleanedHTML = cleanedMarkdown ? stripInlineColor(renderMarkdown(cleanedMarkdown)) : '';
    if (vmCleaned) vmCleaned.html = cleanedHTML; else shadow.getElementById('sx-cleaned').innerHTML = cleanedHTML;
  }

  // ===== Run 按钮 =====
  shadow.getElementById('sx-run').addEventListener('click', async ()=>{
    try{
      // 若为试用模式但尚未同意条款：直接跳转设置页并中止，不进入运行态
      try {
        const { aiProvider = 'trial', trial_consent = false } = await chrome.storage.sync.get({ aiProvider: 'trial', trial_consent: false });
        if ((aiProvider === 'trial') && !trial_consent) {
          // 在面板顶部显示一条提示，说明需要先在设置页勾选同意
          try {
            const hintZh = '试用模式需先同意通过代理传输页面内容。请在设置页勾选“我已阅读并同意”，保存后再试。';
            const hintEn = 'Trial mode requires consent to send page content via proxy. Open Settings, check consent, save, then retry.';
            const msg = (currentLangCache==='en') ? hintEn : hintZh;
            const box = shadow.getElementById('sx-summary');
            if (box) {
              box.innerHTML = `<div class="alert"><button class="alert-close" title="关闭" aria-label="关闭">&times;</button><div class="alert-content"><p>${escapeHtml(msg)}</p></div></div>`;
            }
          } catch {}
          try { await chrome.storage.sync.set({ need_trial_consent_focus: true }); } catch {}
          try { await chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' }); } catch { try { await chrome.runtime.openOptionsPage(); } catch {} }
          return;
        }
      } catch {}
      // Handle folded (empty) state: expand middle first, then reveal cards
      const wrapEl = shadow.getElementById('sx-wrap');
      const wasEmpty = !!wrapEl?.classList?.contains('is-empty');
      try{
        if (wasEmpty){
          wrapEl.classList.remove('fx-intro');
          wrapEl.classList.add('expanding');
        }else{
          wrapEl?.classList?.remove('fx-intro');
        }
      }catch{}

      setLoading(shadow,true);
      if (!wasEmpty) skeleton(shadow);

      const tabId=await getActiveTabId(); if(!tabId) throw new Error('未找到活动标签页');
      const resp=await chrome.runtime.sendMessage({type:'PANEL_RUN_FOR_TAB', tabId});
      if (!resp || resp.ok!==true) throw new Error(resp?.error||'运行失败');

      // After expansion, reveal cards and play pull-in animation
      if (wasEmpty){
        try{
          const container = shadow.getElementById('sx-container');
          // compute target height: wrap height minus appbar + footer heights
          const wrapRect = wrapEl.getBoundingClientRect();
          const appbar = shadow.querySelector('.appbar');
          const footer = shadow.querySelector('.footer');
          const appH = appbar ? appbar.getBoundingClientRect().height : 0;
          const footH = footer ? footer.getBoundingClientRect().height : 0;
          const target = Math.max(120, Math.round(wrapRect.height - appH - footH));
          // prepare container for smooth transition
          container.style.willChange = 'height';
          container.style.contain = 'layout style';
          container?.style.setProperty('--sx-target', target + 'px');

          let done = false; const finish = ()=>{
            if (done) return; done = true;
            try{
              wrapEl.classList.remove('is-empty');
              wrapEl.classList.remove('expanding');
              skeleton(shadow);
              const sCard = shadow.getElementById('sx-summary');
              const cCard = shadow.getElementById('sx-cleaned');
              sCard?.classList?.add('pull-in');
              cCard?.classList?.add('pull-in');
              setTimeout(()=>{ try{ sCard?.classList?.remove('pull-in'); cCard?.classList?.remove('pull-in'); }catch{} }, 700);
            }catch{}
          };
          // Use transitionend for smooth sync with the unroll
          container?.addEventListener('transitionend', (e)=>{ if (e.propertyName==='height') finish(); }, { once:true });
          // Fallback timeout in case transitionend is missed
          setTimeout(finish, 900);
        }catch{}
      } else {
        try{
          const sCard = shadow.getElementById('sx-summary');
          const cCard = shadow.getElementById('sx-cleaned');
          sCard?.classList?.add('pull-in');
          cCard?.classList?.add('pull-in');
          setTimeout(()=>{ try{ sCard?.classList?.remove('pull-in'); cCard?.classList?.remove('pull-in'); }catch{} }, 700);
        }catch{}
      }
      try{ if (wasEmpty) updateEmptyArrowPosition(); }catch{}

      try{
        const st=await getState(tabId);
        if (st.status==='partial'){ await renderCards(st.summary, null); }
        else if (st.status==='done'){ setLoading(shadow,true); skeleton(shadow); }
      }catch{}
      await pollUntilDone(shadow, tabId, (s,c)=>renderCards(s,c));
    }catch(e){
      setLoading(shadow,false);
      const box=shadow.getElementById('sx-summary');
      box.innerHTML = `<div class="alert"><button class="alert-close" title="关闭" aria-label="关闭">&times;</button><div class="alert-content"><p>运行失败：${escapeHtml(e?.message||String(e))}</p></div></div>`;
    }
  });

  // ===== 启动：主题与存储、Vue尝试加载、渲染空态 =====
  (async ()=>{
    try{
      const { options_theme_override, float_theme_override } = await chrome.storage.sync.get(['options_theme_override','float_theme_override']);
      const pick=(v)=> (['auto','light','dark'].includes(v)? v: null);
      themeOverride = pick(options_theme_override)||pick(float_theme_override)||'auto';
    }catch{}
    applyThemeWithOverride(shadow); markThemeButtonsActive(shadow);

    await updateUIText();
    applyTrialLabelToFloatButton(shadow);

    await tryLoadPetiteVue();
    if (PV) mountVue();

    try{
      const tabId=await getActiveTabId();
      if (!tabId){ await setEmpty(shadow); return; }
      const st=await getState(tabId);
      if (st.status==='running'){
        const w=shadow.getElementById('sx-wrap'); w?.classList?.remove('fx-intro');
        if (!w?.classList?.contains('expanding')) w?.classList?.remove('is-empty');
        setLoading(shadow,true); skeleton(shadow); pollUntilDone(shadow, tabId, (s,c)=>renderCards(s,c));
      }
      else if (st.status==='partial'){
        const w=shadow.getElementById('sx-wrap'); w?.classList?.remove('fx-intro');
        if (!w?.classList?.contains('expanding')) w?.classList?.remove('is-empty');
        setLoading(shadow,true); await renderCards(st.summary, null); pollUntilDone(shadow, tabId, (s,c)=>renderCards(s,c));
      }
      else if (st.status==='done'){
        const w=shadow.getElementById('sx-wrap'); w?.classList?.remove('fx-intro');
        if (!w?.classList?.contains('expanding')) w?.classList?.remove('is-empty');
        setLoading(shadow,false); await renderCards(st.summary, st.cleaned); stopPolling();
      }
      else { await setEmpty(shadow); }
    }catch{ await setEmpty(shadow); }
  })();

  // ===== 广播同步 =====
  chrome.runtime.onMessage.addListener(async (msg)=>{
    if(!msg) return;
    if (msg.type==='PANEL_STATE_UPDATED'){
      const curId=await getActiveTabId(); if (msg.tabId!==curId) return;
      try{
        const st=await getState(curId);
        if (st.status==='running'){
          const w=shadow.getElementById('sx-wrap'); w?.classList?.remove('fx-intro');
          if (!w?.classList?.contains('expanding')) w?.classList?.remove('is-empty');
          setLoading(shadow,true); skeleton(shadow);
        }
        else if (st.status==='partial'){
          const w=shadow.getElementById('sx-wrap'); w?.classList?.remove('fx-intro');
          if (!w?.classList?.contains('expanding')) w?.classList?.remove('is-empty');
          setLoading(shadow,true); await renderCards(st.summary, null);
        }
        else if (st.status==='done'){
          const w=shadow.getElementById('sx-wrap'); w?.classList?.remove('fx-intro');
          if (!w?.classList?.contains('expanding')) w?.classList?.remove('is-empty');
          setLoading(shadow,false); await renderCards(st.summary, st.cleaned); stopPolling();
        }
        else if (st.status==='error'){
          setLoading(shadow,false);
          shadow.getElementById('sx-summary').innerHTML =
            `<div class="alert"><button class="alert-close" title="关闭" aria-label="关闭">&times;</button><div class="alert-content"><p>发生错误，请重试。</p></div></div>`;
          stopPolling();
        }
      }catch{}
    }else if (msg.type==='SX_CLOSE_FLOAT_PANEL'){
      const btn=shadow.getElementById('sx-close');
      if (btn) btn.click(); else { const host=document.getElementById(PANEL_ID); if (host){ host.remove(); window[MARK]=false; } stopPolling(); }
    }
  });

  // ===== 强制深色模式 =====
  function applyForceDarkMode(enabled) {
    if (enabled) {
      // 注入强制深色模式CSS
      const style = document.createElement('style');
      style.id = 'sx-force-dark-mode';
      style.textContent = `
        /* 强制深色模式（更温和）：
           - 仅为页面容器提供深色底色
           - 文本颜色统一为浅色
           - 不影响媒体元素（video/img/canvas/svg/iframe 等）的底色，避免遮挡视频 */
        html, body { background-color: #121212 !important; color: #eaeef5 !important; }
        /* 文本与图标（svg 也使用 currentColor 时仍能跟随）*/
        *, *::before, *::after { color: #eaeef5 !important; }
        /* 不为媒体元素强制设置背景色，避免视频/画布被黑色覆盖 */
        img, video, canvas, svg, iframe, embed, object, picture { background-color: transparent !important; }

        /* YouTube 站点常见容器背景（不影响视频区域）*/
        ytd-app,
        ytd-masthead,
        ytd-page-manager,
        ytd-browse,
        ytd-two-column-browse-results-renderer,
        ytd-rich-grid-renderer,
        ytd-watch-flexy,
        ytd-watch-flexy #columns,
        ytd-watch-flexy #primary,
        ytd-watch-flexy #secondary,
        #content,
        #page-manager,
        #container {
          background-color: #121212 !important;
        }

        /* GitHub 常见容器与变量覆盖（仅在 GitHub 选择器命中时生效）*/
        :root[data-color-mode],
        body[data-color-mode] {
          --color-canvas-default: #0f1624 !important;
          --color-canvas-subtle: #0d1422 !important;
          --color-border-default: #2a3a57 !important;
          --color-fg-default: #e6ebf2 !important;
          --color-accent-fg: #d6dbe5 !important;
        }
        .application-main,
        .markdown-body,
        .Layout,
        .Layout-main,
        .container-lg,
        .container-xl,
        .Box,
        .Box-body,
        .gollum-markdown-content,
        .blob-wrapper {
          background-color: #0f1624 !important;
          color: #e6ebf2 !important;
        }
        
        /* 链接：改为带灰度的浅色，避免突兀的蓝色 */
        a, a:visited, a:active { color: #d6dbe5 !important; }
        a:hover { color: #eef2f7 !important; }

        /* 移除一刀切背景覆盖，避免覆盖视频或交互控件；统一文字亮色的规则已在上方保留 */
        
        /* 处理选择文本 */
        ::selection {
          background-color: #4a9eff !important;
          color: #ffffff !important;
        }
      `;
      document.head.appendChild(style);

      // 智能本地加深：仅为明显浅底的容器加暗色基底（避免一刀切破坏）
      try{
        const MEDIA = new Set(['IMG','VIDEO','CANVAS','SVG','IFRAME','EMBED','OBJECT','PICTURE']);
        const hasBgImage = (cs)=>{
          const bi = cs.backgroundImage || '';
          return bi && bi !== 'none' && !/linear-gradient/i.test(bi);
        };
        const markNode = (el)=>{
          if (!el || el.nodeType!==1) return;
          // 距离视频区域很近的容器直接跳过，避免遮挡
          try{
            const nearVideo = el.closest('video, [class*="ytp-" i], [class*="video" i], [class*="player" i], [id*="video" i], [id*="player" i]');
            if (nearVideo) return;
          }catch{}
          if (MEDIA.has(el.tagName)) return;
          // 不处理极小元素，降低抖动（但放宽阈值，避免小徽标未处理）
          const rect = el.getBoundingClientRect?.();
          if (rect && (rect.width*rect.height) < 150) return;
          const cs = getComputedStyle(el);
          if (!cs) return;
          if (hasBgImage(cs)) return;
          const hasGlass = (cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none');
          const hasGradient = /linear-gradient/i.test(cs.backgroundImage || '');
          const bg = parseColorToRGB(cs.backgroundColor);
          if (!bg || bg.a < 0.05) return; // 近透明跳过
          const lum = relLuminance(bg);
          // 若是玻璃毛化容器，且背景为浅色/半透明/或有渐变，替换为暗色半透明玻璃
          if (hasGlass && (hasGradient || !bg || bg.a < 0.95) && (lum > 0.65)){
            el.classList.add('sx-dark-glass');
            return;
          }
          if (lum > 0.78) el.classList.add('sx-dark-bg');
          const bc = parseColorToRGB(cs.borderTopColor);
          if (bc && relLuminance(bc) > 0.7) el.classList.add('sx-dark-border');
        };
        const scanBatch = (root)=>{
          const all = (root||document).querySelectorAll('*');
          const MAX = 2000;
          const vh = window.innerHeight || document.documentElement.clientHeight || 800;
          let seen = 0;
          for (let i=0; i<all.length && seen<MAX; i++){
            const el = all[i];
            const rect = el.getBoundingClientRect?.();
            if (rect && (rect.bottom < -20 || rect.top > vh*1.8)) continue; // 只处理视口附近
            markNode(el);
            seen++;
          }
        };
        // 注入辅助样式（与主样式同 <style> 中）
        style.textContent += `\n`
          + `.sx-dark-bg{ background-color:#121826 !important; color:#e6ebf2 !important; }\n`
          + `.sx-dark-bg a, .sx-dark-bg a:visited, .sx-dark-bg a:active{ color:#d6dbe5 !important; }\n`
          + `.sx-dark-border{ border-color:#2a3a57 !important; }\n`
          + `.sx-dark-glass{ background-color: rgba(18,24,38,.45) !important; color:#e6ebf2 !important; border-color: rgba(42,58,87,.6) !important; backdrop-filter: saturate(1) blur(6px) !important; -webkit-backdrop-filter: saturate(1) blur(6px) !important; }\n`;
        // 初次扫描
        scanBatch(document);
        // 监听增量变化（仅 childList，避免属性循环），并使用 rAF 合批
        window.__sxForceDarkObserver && window.__sxForceDarkObserver.disconnect();
        window.__sxForceDarkObserver = new MutationObserver((muts)=>{
          if (window.__sxFDDebounce) return;
          window.__sxFDDebounce = true;
          requestAnimationFrame(()=>{
            window.__sxFDDebounce = false;
            const batch=[];
            for (const m of muts){
              if (m.type==='childList'){
                m.addedNodes && m.addedNodes.forEach(n=>{
                  if (n && n.nodeType===1){
                    batch.push(n);
                    try{ n.querySelectorAll && n.querySelectorAll('*').forEach(x=>batch.push(x)); }catch{}
                  }
                });
              }
            }
            let processed=0;
            for (const el of batch){ if (processed>600) break; markNode(el); processed++; }
          });
        });
        window.__sxForceDarkObserver.observe(document.documentElement, { childList:true, subtree:true });
      }catch{}
    } else {
      // 移除强制深色模式CSS
      const existingStyle = document.getElementById('sx-force-dark-mode');
      if (existingStyle) {
        existingStyle.remove();
      }
      // 清理智能标记与观察器
      try{ document.querySelectorAll('.sx-dark-bg').forEach(el=>el.classList.remove('sx-dark-bg')); }catch{}
      try{ document.querySelectorAll('.sx-dark-border').forEach(el=>el.classList.remove('sx-dark-border')); }catch{}
      try{ window.__sxForceDarkObserver && window.__sxForceDarkObserver.disconnect(); window.__sxForceDarkObserver=null; }catch{}
    }
  }

  // 初始化强制深色模式状态
  (async () => {
    try {
      const { force_dark_mode } = await chrome.storage.sync.get(['force_dark_mode']);
      forceDarkMode = !!force_dark_mode;
      const forceDarkBtn = shadow.getElementById('sx-force-dark-btn');
      if (forceDarkBtn) {
        forceDarkBtn.classList.toggle('active', forceDarkMode);
      }
      applyForceDarkMode(forceDarkMode);
    } catch (e) {
      console.warn('Failed to load force dark mode setting:', e);
    }
  })();

  // ===== 存储变更 =====
  try{
    chrome.storage.onChanged.addListener((changes, area)=>{
      if (area==='sync' && changes.aiProvider) applyTrialLabelToFloatButton(shadow);
      if (area!=='sync') return;
      if (changes.options_theme_override || changes.float_theme_override){
        const next=(changes.options_theme_override?.newValue) ?? (changes.float_theme_override?.newValue);
        if (['auto','light','dark'].includes(next)){
          themeOverride=next; applyThemeWithOverride(shadow); markThemeButtonsActive(shadow);
        }
      }
      if (changes.force_dark_mode) {
        forceDarkMode = !!changes.force_dark_mode.newValue;
        const forceDarkBtn = shadow.getElementById('sx-force-dark-btn');
        if (forceDarkBtn) {
          forceDarkBtn.classList.toggle('active', forceDarkMode);
        }
        applyForceDarkMode(forceDarkMode);
      }
    });
  }catch{}
})();
