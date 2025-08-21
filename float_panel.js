// float_panel.js —— 页面内右侧悬浮面板（Shadow DOM，零样式污染）
// 两阶段：先显示“摘要”(partial)，随后自动补“可读正文”(done)
// 增强：广播 + 轮询兜底（避免错过后台广播导致停在 partial）

(() => {
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
    chrome.storage.sync.get(["aiProvider"]).then(({ aiProvider }) => {
      if ((aiProvider || "trial") === "trial") {
        btn.textContent = "试用摘要";
        btn.title = "当前为试用模式（通过代理调用），点击开始试用摘要";
      } else {
        btn.textContent = "提取并摘要";
        btn.title = "点击提取正文并生成摘要";
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
    const style = document.createElement("style");

    style.textContent = `
      /* === 字体与隔离：与 options 统一 === */
      :host{
        --font-stack: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial,
                      "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
        font-family: var(--font-stack) !important;

        color-scheme: light;
        color:#111827 !important;

        /* ==== 莫兰迪·玻璃主题变量（更明快） ==== */
        --m-blue: 168,180,192;                 /* #A8B4C0 柔和蓝灰 */
        --glass-card: rgba(var(--m-blue), 0.18);/* 卡片玻璃底：更通透 */
        --glass-bar:  rgba(var(--m-blue), 0.12);/* 顶栏/底栏更浅 */
        --glass-stroke: rgba(255,255,255,0.40);
        --glass-inner: rgba(255,255,255,0.14);
        --glass-blur: 12px;
        /* === 标题栏配色（与按钮玻璃风统一） === */
        --title-glass-bg: rgba(255,255,255,0.55);  /* 与按钮同底色 */
        --title-glass-stroke: rgba(255,255,255,0.60);
        --title-inner: rgba(255,255,255,0.35);
        --title-text: #fff;                        /* 文字颜色，提升对比 */
      }
      :host, :host * { font-family: inherit !important; box-sizing: border-box; }
      button, input, select, textarea { font-family: inherit !important; }

      /* ===== 外壳（更浅、反差更大） ===== */
      .wrap{
        height:100vh; display:flex; flex-direction:column;
        background: linear-gradient(180deg,#f7f9fc,#eef2f7);
        border-left:1px solid #e6e8f0;
        box-shadow:-8px 0 20px rgba(17,24,39,.06);
        color:#111827;
      }

      /* ===== 顶栏玻璃条 ===== */
      .appbar{
        flex:0 0 auto; display:flex; align-items:center; justify-content:space-between;
        padding:10px 12px;
        background: var(--glass-bar);
        backdrop-filter: saturate(180%) blur(var(--glass-blur));
        -webkit-backdrop-filter: saturate(180%) blur(var(--glass-blur));
        border-bottom: 1px solid var(--glass-stroke);
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        border-radius: 0 0 12px 12px;
      }
      .brand{ display:flex; align-items:center; gap:10px; }
      .logo{
        width:10px; height:10px; border-radius:50%;
        background:#5b7da1; box-shadow:0 0 0 4px rgba(91,125,161,.12);
      }
      .title{ font-size:14px; font-weight:800; color:#111827; }
      .actions{ display:flex; gap:8px; }

      /* ===== 玻璃按钮 ===== */
      .btn{
        padding:8px 12px; border:1px solid rgba(255,255,255,0.6); border-radius:10px; cursor:pointer;
        background: rgba(255,255,255,0.55); color:#111827; font-weight:600;
        transition: transform .05s ease, box-shadow .2s ease, background .2s, border-color .2s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.35);
        backdrop-filter: saturate(180%) blur(8px);
        -webkit-backdrop-filter: saturate(180%) blur(8px);
      }
      .btn:hover{ background: rgba(255,255,255,0.70); }
      .btn:active{ transform: translateY(1px); }
      .btn.primary{
        background:
          linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0)),
          linear-gradient(180deg, #6b8fb4, #5f86ac);
        color:#fff; border-color: rgba(255,255,255,0.7);
        box-shadow: 0 6px 16px rgba(95,134,172,.18), inset 0 -1px 0 rgba(255,255,255,.15);
      }
      .btn[disabled]{ opacity:.6; cursor:not-allowed; }

      /* 右上角关闭图标按钮（玻璃） */
      .btn.icon{
        width:36px; height:36px; padding:0; display:grid; place-items:center; line-height:1;
        font-size:18px; border-radius:10px; border:1px solid rgba(255,255,255,0.6);
        background: rgba(255,255,255,0.55); color:#2b5b8a; cursor:pointer;
        transition: background .2s, box-shadow .2s, transform .05s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.35);
        backdrop-filter: saturate(180%) blur(8px);
        -webkit-backdrop-filter: saturate(180%) blur(8px);
      }
      .btn.icon:hover{ background: rgba(255,255,255,0.70); }
      .btn.icon:active{ transform: translateY(1px); }

      /* ===== 进度条（莫兰迪蓝） ===== */
      .progress{ height:2px; background:transparent; position:relative; overflow:hidden; }
      .progress .bar{
        position:absolute; left:-18%; width:18%;
        min-width:110px; max-width:240px; top:0; bottom:0;
        background:#5b7da1; border-radius:999px;
        animation:slide 1.25s linear infinite;
        box-shadow:0 0 8px rgba(91,125,161,.45);
      }
      @keyframes slide { 0%{left:-18%;} 100%{left:100%;} }
      .progress.hidden{ display:none; }

      .container{ flex:1 1 auto; padding:12px; overflow:auto; }
      .section{ margin:10px 0 14px; }

      /* ===== 统一卡片（摘要/正文一致）：玻璃 + 液面高光 ===== */
      .card{
        position: relative; border-radius:12px; padding:18px 20px;
        line-height:1.7; font-size:15px; word-break:break-word;
        background:#fff;
        border:1px solid #e6e8f0;
        box-shadow: 0 2px 8px rgba(17,24,39,0.04);
        overflow: hidden;
      }
      .card::before, .card::after{ content:none; box-shadow:none; background:none; -webkit-mask:none; mask:none; }

      /* ===== 卡片标题条（两块卡片同款，减少割裂） ===== */
      .card-head{ padding-top:48px; }
      .card-head::before{
        content:""; position:absolute; left:0; right:0; top:0; height:44px;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0)),
          linear-gradient(180deg, #7a9bbd, #6f93b5);
        border-radius:12px 12px 0 0;
        border-bottom:1px solid rgba(255,255,255,0.6);
        backdrop-filter: saturate(180%) blur(var(--glass-blur));
        -webkit-backdrop-filter: saturate(180%) blur(var(--glass-blur));
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.35);
        z-index:1;
      }
      .card-head::after{
        content: attr(data-title);
        position:absolute; left:14px; top:0; right:12px; height:44px; line-height:44px;
        font-weight:700; font-size:14px; letter-spacing:.2px; color: var(--title-text);
        z-index:2; pointer-events:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }

      /* 兼容原 .card-summary（同样色系） */
      .card-summary{ padding-top:48px; }
      .card-summary::before{
        content:""; position:absolute; left:0; right:0; top:0; height:44px;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0)),
          linear-gradient(180deg, #7a9bbd, #6f93b5);
        border-radius:12px 12px 0 0;
        border-bottom:1px solid rgba(255,255,255,0.6);
        backdrop-filter: saturate(180%) blur(var(--glass-blur));
        -webkit-backdrop-filter: saturate(180%) blur(var(--glass-blur));
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.35);
        z-index:1;
      }
      .card-summary::after{
        content:"摘要";
        position:absolute; left:14px; top:0; right:12px; height:44px; line-height:44px;
        font-weight:700; font-size:14px; letter-spacing:.2px; color: var(--title-text);
        z-index:2; pointer-events:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }

      /* 骨架/空态/提示 */
      .skl{ height:12px; background:#eee; border-radius:6px; margin:8px 0; animation:skl 1.2s ease-in-out infinite; }
      @keyframes skl{ 0%{opacity:.6;} 50%{opacity:1;} 100%{opacity:.6;} }
      .empty{ text-align:center; padding:28px 10px; color:#667085; }
      .empty .icon{ font-size:28px; }
      .empty .title{ font-weight:700; margin-top:8px; }
      .empty .hint{ font-size:12px; margin-top:4px; }

      .alert{ border-radius:10px; border:1px solid #f1e2a8; background:#fff8dc;
              padding:10px 36px 10px 12px; margin:6px 0 10px; position:relative; font-size:13px; line-height:1.75; }
      .alert-close{ position:absolute; top:4px; right:4px; border:none; background:transparent; font-size:16px; cursor:pointer; line-height:1; }

      /* ===== 底部玻璃 ===== */
      .footer{
        flex:0 0 auto; font-size:12px; color:#6b7280;
        margin-top:10px; padding:10px 12px;
        background: var(--glass-bar);
        backdrop-filter: blur(var(--glass-blur));
        -webkit-backdrop-filter: blur(var(--glass-blur));
        border-top:1px solid var(--glass-stroke);
        border-radius:12px;
        box-shadow: 0 -4px 10px rgba(0,0,0,0.06), inset 0 1px 0 var(--glass-inner);
      }

      .dragbar{ position:absolute; left:-6px; top:0; width:6px; height:100%; cursor:ew-resize; background:transparent; }

      /* ===== Markdown 渲染：统一 ===== */
      #sx-summary, #sx-cleaned { color:#111827 !important; }
      #sx-summary .md :where(h1,h2,h3,h4,h5,h6,p,li,span,a,strong,em,code,pre,blockquote),
      #sx-cleaned .md :where(h1,h2,h3,h4,h5,h6,p,li,span,a,strong,em,code,pre,blockquote){
        color:#111827 !important; background-color: transparent !important; white-space: normal !important;
      }
      #sx-summary a, #sx-cleaned a { color:#1f2937 !important; text-decoration: underline; }
      #sx-summary code, #sx-cleaned code, #sx-summary pre,  #sx-cleaned pre { color:#111 !important; }

      #sx-summary img, #sx-cleaned img { max-width:100%; height:auto; }
      #sx-summary table, #sx-cleaned table { max-width:100%; display:block; overflow:auto; border-collapse:collapse; }
      #sx-summary pre, #sx-cleaned pre { max-width:100%; overflow:auto; }

      .md{ font-size:15px; line-height:1.75; color:#111827; word-break:break-word; overflow-wrap:anywhere; }
      .md h1{ margin:16px 0 10px; font-size:20px; line-height:1.4; font-weight:800; }
      .md h2{ margin:14px 0 8px;  font-size:18px; line-height:1.4; font-weight:800; }
      .md h3{ margin:12px 0 8px;  font-size:16px; line-height:1.4; font-weight:700; }
      .md h4{ margin:10px 0 6px;  font-size:15px; line-height:1.4; font-weight:700; }
      .md h5{ margin:8px  0 6px;  font-size:14px; line-height:1.4; font-weight:700; }
      .md h6{ margin:8px  0 6px;  font-size:13px; line-height:1.4; font-weight:700; color:#374151; }
      .md p{  margin:8px 0; }
      .md ul, .md ol{ margin:8px 0; padding-left:18px; }
      .md li{ margin:4px 0; }
      .md li > p{ margin:4px 0; }
      .md blockquote{ margin:12px 0; padding:8px 12px; border-left:3px solid #cfd8e6; border-radius:8px; background:#f7f9fc; color:#0f172a; }
      .md a{ text-decoration: underline; text-underline-offset:2px; }
      .md strong{ font-weight:700; }
      .md em{ font-style:italic; }
      .md code{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size:.92em; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:4px; padding:0 .25em; }
      .md pre{ margin:10px 0; padding:12px; background:#f7f9ff; border:1px solid #e6e8f0; border-radius:10px; overflow:auto; line-height:1.6; }
      .md pre code{ background:transparent; border:none; padding:0; display:block; font-size:.92em; }
      .md table{ width:100%; border-collapse:collapse; display:block; overflow:auto; margin:10px 0; }
      .md thead th{ background:#f8fafc; color:#0f172a; font-weight:700; }
      .md th, .md td{ border:1px solid #e5e7eb; padding:8px 10px; text-align:left; vertical-align:top; }
      .md img{ display:block; margin:8px 0; }
      .md hr{ border:0; border-top:1px solid #e6e8f0; margin:12px 0; }
      .md > :first-child{ margin-top: 0; }
      .md > :last-child{  margin-bottom: 0; }
      .md ul, .md ol { margin: 8px 0 4px; padding-left: 18px; }
      .md li { margin: 4px 0; }
      .md li > p { margin: 4px 0; }
      .md ul + h1, .md ol + h1,
      .md ul + h2, .md ol + h2,
      .md ul + h3, .md ol + h3,
      .md ul + p,  .md ol + p,
      .md ul + blockquote, .md ol + blockquote,
      .md ul + pre, .md ol + pre { margin-top: 6px; }
      .md ul + br, .md ol + br { display: none; }
    `;

    const root = document.createElement("div");
    root.innerHTML = `
      <div class="wrap">
        <div class="dragbar" id="sx-drag"></div>
        <div class="appbar">
          <div class="brand"><span class="logo"></span><div class="title">麦乐可 AI 摘要阅读器</div></div>
          <div class="actions">
            <button id="sx-settings" class="btn" title="设置">设置</button>
            <button id="sx-run" class="btn primary">提取并摘要</button>
            <button id="sx-close" class="btn icon" title="关闭" aria-label="关闭">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                   width="16" height="16" fill="#2b5b8a" aria-hidden="true">
                <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7a1 1 0 0 0-1.41 1.42L10.59 12l-4.89 4.89a1 1 0 0 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"/>
              </svg>
            </button>
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
        <div class="footer"><small>注：部分页面（如 chrome://、扩展页、PDF 查看器）不支持注入。</small></div>
      </div>
    `;
    shadow.appendChild(style);
    shadow.appendChild(root);
    document.documentElement.appendChild(host);

    // 交互：关闭
    shadow.getElementById("sx-close").addEventListener("click", () => {
      host.remove();
      window[MARK] = false;
    });

    // 交互：设置
    shadow.getElementById("sx-settings").addEventListener("click", async () => {
      try { await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" }); } catch {}
    });

    // 交互：拖宽
    const drag = shadow.getElementById("sx-drag");
    let dragging = false;
    drag.addEventListener("mousedown", (e) => {
      dragging = true; e.preventDefault();
      const onMove = (ev) => {
        if (!dragging) return;
        const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        const fromRight = vw - ev.clientX;
        const w = Math.min(Math.max(fromRight, 320), Math.min(720, vw - 80));
        host.style.width = `${w}px`;
      };
      const onUp = () => {
        dragging = false;
        window.removeEventListener("mousemove", onMove, true);
        window.removeEventListener("mouseup", onUp, true);
      };
      window.addEventListener("mousemove", onMove, true);
      window.addEventListener("mouseup", onUp, true);
    });

    // 关闭 notice
    shadow.addEventListener("click", (e) => {
      const btn = e.target.closest(".alert-close");
      if (!btn) return;
      const box = btn.closest(".alert");
      if (box) box.remove();
    });

    setEmpty(shadow);
    return host;
  }

  function setEmpty(shadow) {
    shadow.getElementById("sx-summary").innerHTML =
      `<div class="empty"><div class="icon">📝</div><div class="title">暂无摘要</div><div class="hint">点击上方“提取并摘要”</div></div>`;
    shadow.getElementById("sx-cleaned").innerHTML =
      `<div class="empty"><div class="icon">📄</div><div class="title">暂无可读正文</div><div class="hint">点击上方“提取并摘要”</div></div>`;
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

  function renderToDom(shadow, summary, cleaned) {
    const $s = shadow.getElementById("sx-summary");
    const $c = shadow.getElementById("sx-cleaned");

    $s.innerHTML = summary
      ? stripInlineColor(renderMarkdown(summary))
      : `<div class="empty"><div class="icon">📝</div><div class="title">暂无摘要</div></div>`;

    if (cleaned === null) {
      $c.innerHTML =
        `<div class="skl" style="width:96%"></div>` +
        `<div class="skl" style="width:88%"></div>` +
        `<div class="skl" style="width:76%"></div>`;
    } else {
      $c.innerHTML = cleaned
        ? stripInlineColor(renderMarkdown(cleaned))
        : `<div class="empty"><div class="icon">📄</div><div class="title">暂无可读正文</div></div>`;
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
          renderToDom(shadow, st.summary, st.cleaned);
          stopPolling();
          return;
        }
        if (st.status === "error") {
          setLoading(shadow, false);
          shadow.getElementById("sx-summary").innerHTML =
            `<div class="alert"><div class="alert-content"><p>发生错误，请重试。</p></div></div>`;
          stopPolling();
          return;
        }
        if (st.status === "partial") {
          setLoading(shadow, true);
          renderToDom(shadow, st.summary, null);
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
      const host = document.getElementById(PANEL_ID);
      if (host) { host.remove(); window[MARK] = false; }
      stopPolling();
    }
  });
})();