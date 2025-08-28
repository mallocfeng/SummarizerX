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

  // ===== petite-vue（ESM优先，失败降级）=====
  let PV = null;
  async function tryLoadPetiteVue() {
    try {
      const url = chrome.runtime.getURL('vendor/petite-vue.es.js');
      const mod = await import(url);
      if (mod && typeof mod.createApp === 'function') PV = mod;
    } catch (e) { console.info('petite-vue.es.js not found; fallback to vanilla.', e); }
  }

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
        /* 降饱和品牌色（更柔和） */
        --primary:#5a7fd6;
        --primary-600:#3e63b8;
        --accent:#19b87b;
        --danger:#e25656;

        --bg:#e9eef8;
        --bg-grad: radial-gradient(120% 80% at 100% 0%, #f7f9fe 0%, #ecf1ff 50%, #e9eef8 100%);
        --card:rgba(255,255,255,0.78);
        --card-blur:12px;
        --border:#d7e0fb;
        --muted:#626f86;
        --text:#0f172a;

        --warn-bg:#fff7db;
        --warn-border:#f1e2a8;

        --ring: 0 0 0 3px rgba(90,127,214,0.28);
        --font-stack: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "PingFang SC", "Noto Sans SC", sans-serif;
        color-scheme: light;

        /* 统一按钮最小高度（其余自适应） */
        --btn-min-h: 36px;
      }
      :host, :host * { box-sizing:border-box; font-family:var(--font-stack) !important; }

      .wrap{
        position:relative; height:100vh; display:flex; flex-direction:column;
        background:var(--bg-grad);
        border-left:1px solid var(--border);
        box-shadow:-6px 0 22px rgba(17,24,39,.10);
        color:var(--text);
      }

      .dragbar{ position:absolute; top:0; left:0; height:100%; width:12px; cursor:col-resize; }
      .dragbar::after{ content:""; position:absolute; top:0; bottom:0; right:-1px; width:3px; background:linear-gradient(180deg, rgba(102,112,133,.20), rgba(102,112,133,.03)); opacity:0; transition:.12s; }
      .dragbar:hover::after{ opacity:.9; }
      .wrap.dragging{ cursor:col-resize; }

      .appbar{
        flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; padding:10px 12px;
        background: linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.62));
        backdrop-filter: blur(8px);
        border-bottom:1px solid var(--border);
      }
      .brand{ display:flex; align-items:center; gap:10px; }
      .logo{ width:10px; height:10px; border-radius:50%; background: linear-gradient(135deg, var(--primary), #a8c0ff); box-shadow:0 0 0 6px rgba(90,127,214,.16); }
      .title{ font-size:14px; font-weight:800; letter-spacing:.2px; color:#0f172a; }

      /* 操作区：按钮高度按“最高”同步，前两个按钮弹性宽度 */
      .actions{
        display:flex;
        gap:8px;
        align-items: stretch;          /* 同步高度 */
        justify-content:flex-end;
        min-height: var(--btn-min-h);
      }

      .btn{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 12px;
        height: auto;
        min-height: var(--btn-min-h);
        line-height: 1.2;
        white-space: nowrap;           /* 基线：不换行，后续对英文再放开 */
        text-align: center;
        box-sizing: border-box;

        border:1px solid var(--border); border-radius:12px; cursor:pointer;
        background:rgba(255,255,255,.85); color:var(--text); font-weight:700; letter-spacing:.02em;
        transition: transform .06s, box-shadow .24s, background .24s, border-color .24s, opacity .2s;
        position: relative; overflow: hidden; box-shadow: 0 2px 8px rgba(17,24,39,0.04);
      }
      .btn:hover{ background:#fff; border-color:#cadeff; box-shadow: 0 6px 18px rgba(17,24,39,0.10); transform: translateY(-1px); }
      .btn:active{ transform: translateY(0); }
      .btn:focus-visible{ box-shadow: 0 0 0 4px rgba(90,127,214,.28), inset 0 1px 0 rgba(255,255,255,.20); outline:none; }
      .btn.primary{ background: linear-gradient(180deg, var(--primary), var(--primary-600)); color:#fff; border-color: transparent; }

      /* 前两个按钮（Settings / Extract & Summarize）——弹性宽度 */
      .actions .btn:not(.icon){
        flex: 1 1 auto;       /* 弹性宽度，随面板拖动变化 */
        min-width: 0;         /* 允许在容器内收缩 */
        text-align: center;
      }
      /* 英文：允许换行，避免过长溢出；中文：不换行 */
      :host([lang="en"]) .actions .btn:not(.icon){
        white-space: normal;  /* 英文可换行 */
        word-break: normal;   /* 按词断行 */
      }
      :host([lang^="zh"]) .actions .btn:not(.icon){
        white-space: nowrap;  /* 中文不换行 */
        word-break: keep-all;
      }

      /* 关闭按钮：宽度固定，高度随行同步 */
      .btn.icon{
        flex: 0 0 auto;
        width: 36px;
        min-width: 36px;
        padding: 0;
        line-height: 1;
        height: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size:18px;
        border-radius:12px;
      }

      .btn[disabled]{ opacity:.65; cursor:not-allowed; }
      .btn .ripple{ position:absolute; pointer-events:none; width:12px; height:12px; border-radius:50%; background: currentColor; opacity:.18; transform: translate(-50%,-50%) scale(1); animation: sxRipple .6s ease-out forwards; }
      @keyframes sxRipple { from{ opacity:.22; transform: translate(-50%,-50%) scale(1);} to{ opacity:0; transform: translate(-50%,-50%) scale(18);} }
      .btn .spin{ width:14px; height:14px; border:2px solid currentColor; border-right-color: transparent; border-radius:50%; display:inline-block; animation: sxSpin .8s linear infinite; margin:0; vertical-align: middle; }
      @keyframes sxSpin { to { transform: rotate(360deg); } }

      .progress{ height:3px; background:transparent; position:relative; overflow:hidden; }
      .progress .bar{
        position:absolute; left:-20%; width:18%; min-width:140px; max-width:280px; top:0; bottom:0;
        background: linear-gradient(90deg, rgba(255,255,255,.0), rgba(90,127,214,.85), rgba(255,255,255,.0));
        border-radius:999px; animation: slide 1.15s linear infinite; box-shadow:0 0 10px rgba(90,127,214,.40);
      }
      @keyframes slide { 0%{left:-20%;} 100%{left:110%;} }
      .progress.hidden{ display:none; }

      .container{ flex:1 1 auto; padding:12px; overflow:auto; }
      .section{ margin:10px 0 16px; }

      .card{
        position:relative;
        background: var(--card);
        -webkit-backdrop-filter: blur(var(--card-blur));
        backdrop-filter: blur(var(--card-blur));
        border:1px solid var(--border);
        border-radius:14px;
        padding:56px 20px 18px;
        line-height:1.7; font-size:15px;
        box-shadow: 0 10px 30px rgba(17,24,39,0.08);
        color: var(--text);
        transition: background .28s ease, color .28s ease, border-color .28s ease, box-shadow .28s ease, transform .2s ease, opacity .2s ease;
        transform-origin: top center;
      }
      .card:hover{ transform: translateY(-1px); box-shadow: 0 18px 42px rgba(17,24,39,0.12); }
      .card.revive{ animation: sxPop .26s cubic-bezier(.2,.7,.3,1) both; }
      @keyframes sxPop { 0%{ opacity:0; transform: translateY(6px) scale(.995); } 100%{ opacity:1; transform: translateY(0) scale(1);} }

      .card.card-head::before{
        content:"";
        position:absolute; left:0; right:0; top:0; height:42px;
        background: linear-gradient(180deg, #f5f7fa, #e6ebf3);
        border-radius:12px 12px 0 0;
        border-bottom:1px solid #d2dae6;
        transition: background .28s ease, border-color .28s ease;
      }
      .card.card-head::after{
        content: attr(data-title);
        position:absolute; left:14px; top:10px; font-weight:800; font-size:14px; letter-spacing:.3px; color:#344055;
      }

      .card-tools{
        position:absolute; right:10px; top:8px; display:flex; align-items:center; gap:6px;
      }
      .tbtn{
        border:none; padding:6px 8px; border-radius:8px; cursor:pointer; background:rgba(255,255,255,.85); color:#334155; border:1px solid var(--border);
      }
      .tbtn:hover{ background:#fff; }
      .tbtn:active{ transform: translateY(1px); }
      .tbtn[aria-pressed="true"]{ background:#eef5ff; border-color:#cadeff; }

      .read-progress{ position:absolute; left:0; right:0; top:44px; height:3px; background:transparent; }
      .read-progress > span{ display:block; height:3px; width:0%; background: linear-gradient(90deg, rgba(25,184,123,.1), rgba(25,184,123,.85)); transition: width .12s linear; }

      .md [data-fade]{ opacity:0; transform: translateY(4px); transition: opacity .32s ease, transform .32s ease; }
      .md [data-fade].on{ opacity:1; transform: translateY(0); }

      .md{ font-size:15px; line-height:1.78; color: var(--text); word-break:break-word; overflow-wrap:anywhere; }
      .md h1{ margin:16px 0 10px; font-size:20px; font-weight:900; }
      .md h2{ margin:14px 0 8px;  font-size:18px; font-weight:800; }
      .md h3{ margin:12px 0 8px;  font-size:16px; font-weight:700; }
      .md p{ margin:6px 0; }
      .md ul, .md ol{ margin:6px 0; padding-left:18px; }
      .md li{ margin:2px 0; }
      .md blockquote{ margin:12px 0; padding:10px 12px; border-left:3px solid #cfe0ff; border-radius:10px; background:#f8fbff; color:#0f172a; }
      .md code{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size:.92em; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:6px; padding:0 .35em; }
      .md pre{ margin:10px 0; padding:12px; background:#f7f9ff; border:1px solid #e6e8f0; border-radius:12px; overflow:auto; line-height:1.6; }
      .md table{ width:100%; border-collapse:collapse; display:block; overflow:auto; margin:10px 0; border-radius:10px; }
      .md thead th{ background:#f0f5ff; color:#0f172a; font-weight:800; }
      .md th, .md td{ border:1px solid #e5e7eb; padding:8px 10px; text-align:left; vertical-align:top; }
      .md img{ display:block; margin:8px 0; border-radius:8px; }
      .md hr{ border:0; border-top:1px solid #e6e8f0; margin:12px 0; }

      .empty{ text-align:center; padding:28px 10px; color:var(--muted); }
      .empty .icon{ font-size:28px; }
      .empty .title{ font-weight:800; margin-top:8px; }

      .skl{ height:12px; background:linear-gradient(90deg,#eef2ff,#ffffff,#eef2ff); background-size:200% 100%; border-radius:8px; margin:8px 0; animation: skl 1.2s ease-in-out infinite; }
      @keyframes skl{ 0%{background-position:0% 0;} 100%{background-position:200% 0;} }

      .alert{
        border-radius:12px; border:1px solid var(--warn-border); background:var(--warn-bg);
        padding:10px 40px 10px 12px; margin:8px 0; position:relative; font-size:13px; line-height:1.65;
      }
      .alert .alert-close{ position:absolute; top:6px; right:6px; border:none; background:transparent; font-size:16px; cursor:pointer; line-height:1; opacity:.8; }
      .alert .alert-close:hover{ opacity:1; }

      .footer{
        flex:0 0 auto; font-size:12px; border-top:1px solid var(--border); padding:8px 12px;
        background:linear-gradient(0deg, rgba(255,255,255,.82), rgba(255,255,255,.60));
        color:#334155;
        backdrop-filter: blur(8px);
      }
      .footer-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:nowrap; }
      .theme-toggle{ display:flex; align-items:center; gap:8px; flex-shrink:0; }
      .theme-toggle .label{ color:#334155; white-space:nowrap; font-weight:700; font-size:12px; letter-spacing:.03em; }
      .theme-toggle .seg{ display:flex; gap:6px; background:rgba(255,255,255,.92); border:1px solid var(--border); border-radius:999px; padding:2px; }
      .theme-btn{ width:28px; height:28px; padding:0; border:none; border-radius:999px; background:transparent; cursor:pointer; color:#334155; display:grid; place-items:center; transition: background .18s, color .18s; }
      .theme-btn:hover{ background:rgba(0,0,0,0.06); }
      .theme-btn.active{ background:var(--primary); color:#fff; }
      .theme-btn svg{ width:16px; height:16px; display:block; stroke:currentColor; }

      /* 深色主题 */
      :host([data-theme="dark"]) {
        --bg:#070c17;
        --bg-grad: radial-gradient(120% 80% at 100% 0%, #070c17 0%, #0d1628 55%, #070c17 100%);
        --card:rgba(17,24,39,0.70);
        --card-blur:12px;
        --border:#293a5a;
        --muted:#a6b7cf;
        --text:#e9eef7;

        --warn-bg: rgba(255, 240, 175, 0.08);
        --warn-border: rgba(250, 204, 21, 0.35);
      }
      :host([data-theme="dark"]) .appbar{
        background: linear-gradient(180deg, rgba(13,20,36,0.72), rgba(13,20,36,0.56));
        backdrop-filter: blur(10px);
        border-bottom: 1px solid #24324d;
      }
      :host([data-theme="dark"]) .title{ color: #dfe6f5; }
      :host([data-theme="dark"]) .brand .logo{
        background: linear-gradient(135deg, #22314a, #3a4f72);
        box-shadow: 0 0 0 6px rgba(58,79,114,.18);
      }
      :host([data-theme="dark"]) .btn{
        background: rgba(18,27,46,.78);
        color: #d5deee;
        border-color: #2a3d5f;
        box-shadow: 0 2px 10px rgba(0,0,0,.25);
      }
      :host([data-theme="dark"]) .btn:hover{
        background: rgba(22,32,54,.92);
        border-color: #35527e;
      }
      :host([data-theme="dark"]) .btn.primary{
        background: linear-gradient(180deg, #22314a, #1a263a);
        border-color: #1a263a;
        color: #e8eef8;
      }
      :host([data-theme="dark"]) .progress .bar{
        background: linear-gradient(90deg, rgba(255,255,255,0), rgba(84,124,148,.85), rgba(255,255,255,0));
        box-shadow: 0 0 10px rgba(84,124,148,.35);
      }
      :host([data-theme="dark"]) .card.card-head::before{
        background: linear-gradient(180deg, #1a2436, #121a2a);
        border-bottom-color: #111827;
      }
      :host([data-theme="dark"]) .card.card-head::after{ color:#dfe6f5; }
      :host([data-theme="dark"]) .md blockquote{ background: rgba(255,255,255,0.06); border-left-color: rgba(90,127,214,0.45); color: var(--text); }
      :host([data-theme="dark"]) .md code{ background:#0b1220; border-color:#1f2a44; color:#e5e7eb; }
      :host([data-theme="dark"]) .md pre{ background:#0b1220; border-color:#1f2a44; color:#e5e7eb; }
      :host([data-theme="dark"]) .md thead th{ background:#0f1a30; color:#e5e7eb; }
      :host([data-theme="dark"]) .footer{
        background: linear-gradient(0deg, rgba(13,20,36,.88), rgba(13,20,36,.68));
        color: #e0e7f3;
        border-top-color: #24324d;
      }
      :host([data-theme="dark"]) .theme-toggle .seg{
        background: rgba(18,27,46,.72);
        border-color: #2a3d5f;
      }
      :host([data-theme="dark"]) .theme-btn{ color:#d9e2f2; }
      :host([data-theme="dark"]) .theme-btn.active{ background:#2a3d5f; color:#e8eef8; }
      :host([data-theme="dark"]) .theme-btn:hover{ background:rgba(255,255,255,0.08); }
      :host([data-theme="dark"]) .theme-toggle .label{ color:#e5eaf2; }
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="4"></circle>
                    <line x1="12" y1="2" x2="12" y2="5"></line>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"></line>
                    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"></line>
                    <path d="M21 12.8a9 9 0 1 1-9.8-9 7 7 0 0 0 9.8 9z"></path>
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
      </div>`;
    return host;
  }

  // ===== 主题覆盖 =====
  let themeOverride='auto';
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
    const em1 = `<div class="empty"><div class="icon">📝</div><div class="title">${lang==='zh'?'暂无摘要':'No Summary'}</div><div class="hint">${lang==='zh'?'点击上方"提取并摘要"':'Click "Extract & Summarize" above'}</div></div>`;
    const em2 = `<div class="empty"><div class="icon">📄</div><div class="title">${lang==='zh'?'暂无可读正文':'No Readable Content'}</div><div class="hint">${lang==='zh'?'点击上方"提取并摘要"':'Click "Extract & Summarize" above'}</div></div>`;
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
    }).catch(()=>{
      btn.textContent = '提取并摘要';
      btn.title = '点击提取正文并生成摘要';
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
    function start(){ dragging=true; wrapEl?.classList.add('dragging'); document.documentElement.style.userSelect='none'; }
    function end(){ dragging=false; wrapEl?.classList.remove('dragging'); document.documentElement.style.userSelect=''; window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); window.removeEventListener('touchmove', tm, {capture:true, passive:false}); window.removeEventListener('touchend', te, {capture:true}); }
    const mm=(ev)=>{ if(!dragging) return; ev.preventDefault(); setW(ev.clientX); };
    const mu=()=>{ if(!dragging) return; end(); };
    const tm=(ev)=>{ if(!dragging) return; if(ev.touches && ev.touches[0]) setW(ev.touches[0].clientX); ev.preventDefault(); };
    const te=()=>{ if(!dragging) return; end(); };
    drag?.addEventListener('mousedown',(e)=>{ start(); e.preventDefault(); window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true); });
    drag?.addEventListener('touchstart',(e)=>{ start(); e.preventDefault(); window.addEventListener('touchmove', tm, {capture:true, passive:false}); window.addEventListener('touchend', te, {capture:true}); }, {passive:false});
    drag?.addEventListener('dblclick', async ()=>{
      const cur=parseInt(getComputedStyle(host).width,10)||420;
      const target=cur<520? 560: 380;
      const w=clamp(target); host.style.width=`${w}px`; try{ chrome.storage.sync.set({ float_panel_width:w }); }catch{}
    });
    try{ chrome.storage.sync.get(['float_panel_width']).then(({float_panel_width})=>{ if(Number.isFinite(+float_panel_width)) host.style.width = `${clamp(+float_panel_width)}px`; }); }catch{}
  })();

  // 关闭 notice 清理
  shadow.addEventListener('click',(e)=>{
    const btn=e.target.closest('.alert-close'); if(!btn) return;
    const box=btn.closest('.alert'); if(!box) return;
    const rm=(start,dir='nextSibling')=>{ let n=start[dir]; while(n && n.nodeType===1 && n.tagName==='BR'){ const d=n; n=n[dir]; d.remove(); } };
    rm(box,'previousSibling'); rm(box,'nextSibling');
    const md=box.closest('.md'); box.remove(); if(md){ const first=md.firstElementChild; first && (first.style.marginTop='0px'); }
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
      const t_note = currentLangCache==='zh'?'注：部分页面（如 chrome://、扩展页、PDF 查看器）不支持注入。':'Note: Some pages (like chrome://, extension pages, PDF viewers) do not support injection.';
      shadow.getElementById('sx-app-title').textContent = t_app;
      const runBtn=shadow.getElementById('sx-run'); if(runBtn && !runBtn.disabled) runBtn.textContent=t_run;
      const settingsBtn=shadow.getElementById('sx-settings'); if(settingsBtn){ settingsBtn.textContent=t_set; settingsBtn.title=t_set; }
      const closeBtn=shadow.getElementById('sx-close'); if(closeBtn){ closeBtn.title=t_close; closeBtn.setAttribute('aria-label', t_close); }
      shadow.getElementById('sx-theme-label').textContent=t_appear;
      shadow.getElementById('sx-footer-note').textContent=t_note;
      shadow.getElementById('sx-summary').setAttribute('data-title', currentLangCache==='zh'?'摘要':'Summary');
      shadow.getElementById('sx-cleaned').setAttribute('data-title', currentLangCache==='zh'?'可读正文':'Readable Content');
    }catch(e){ console.warn('Failed to update UI text:', e); }
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
    const i18n = await loadI18n(); const lang = i18n? await i18n.getCurrentLanguage():'zh';
    const em1 = `<div class="empty"><div class="icon">📝</div><div class="title">${lang==='zh'?'暂无摘要':'No Summary'}</div><div class="hint">${lang==='zh'?'点击上方"提取并摘要"':'Click "Extract & Summarize" above'}</div></div>`;
    const em2 = `<div class="empty"><div class="icon">📄</div><div class="title">${lang==='zh'?'暂无可读正文':'No Readable Content'}</div><div class="hint">${lang==='zh'?'点击上方"提取并摘要"':'Click "Extract & Summarize" above'}</div></div>`;
    if (vmSummary && vmCleaned){ vmSummary.html = em1; vmCleaned.html = em2; }
    else { await vanillaEmpty(shadow); }
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
      setLoading(shadow,true);
      skeleton(shadow);
      const tabId=await getActiveTabId(); if(!tabId) throw new Error('未找到活动标签页');
      const resp=await chrome.runtime.sendMessage({type:'PANEL_RUN_FOR_TAB', tabId});
      if (!resp || resp.ok!==true) throw new Error(resp?.error||'运行失败');

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
      if (st.status==='running'){ setLoading(shadow,true); skeleton(shadow); pollUntilDone(shadow, tabId, (s,c)=>renderCards(s,c)); }
      else if (st.status==='partial'){ setLoading(shadow,true); await renderCards(st.summary, null); pollUntilDone(shadow, tabId, (s,c)=>renderCards(s,c)); }
      else if (st.status==='done'){ setLoading(shadow,false); await renderCards(st.summary, st.cleaned); stopPolling(); }
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
        if (st.status==='running'){ setLoading(shadow,true); skeleton(shadow); }
        else if (st.status==='partial'){ setLoading(shadow,true); await renderCards(st.summary, null); }
        else if (st.status==='done'){ setLoading(shadow,false); await renderCards(st.summary, st.cleaned); stopPolling(); }
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
    });
  }catch{}
})();