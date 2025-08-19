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
    md = collapseBlankLines(md);  // 先压缩空行
    if (typeof md !== "string") md = String(md ?? "");
    let html = escapeHtml(md);
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHtml(code)}</code></pre>`);
    html = html
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
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
    html = html.replace(/(?:<\/p>\s*<p>\s*){2,}/gi, "</p><p>"); // 压缩多余空行
    return `<p>${html}</p>`;
  }

  // 把 2 行以上的空白行压到 1 行（\n\n）
  function collapseBlankLines(txt = "") {
    return String(txt)
      .replace(/\r\n?/g, "\n")                              // 统一换行
      .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n");         // 3+ 空行 => 1 个空行
  }

  // 轻量 Markdown 渲染（避免整块 <p> 包裹导致显示不全）
  function renderMarkdown(md = "") {
    if (typeof md !== "string") md = String(md ?? "");
    md = collapseBlankLines(md);  // 压缩空行
    // 先提取 :::notice … :::，占位
    const notices = [];
    md = md.replace(/:::notice\s*([\s\S]*?)\s*:::/g, (_, inner) => {
      notices.push((inner || "").trim());
      return `__ALERT_TOKEN_${notices.length - 1}__`;
    });

    let html = escapeHtml(md);

    // 代码块
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHtml(code)}</code></pre>`);

    // 引用
    html = html.replace(/(^|\n)((?:&gt;\s?.*(?:\n|$))+)/g, (_, pfx, block) => {
      const inner = block.split("\n").filter(Boolean).map((line) => line.replace(/^&gt;\s?/, "").trim()).join("<br>");
      return `${pfx}<blockquote>${inner}</blockquote>`;
    });

    // 标题
    html = html
      .replace(/^######\s?(.*)$/gm, "<h6>$1</h6>")
      .replace(/^#####\s?(.*)$/gm, "<h5>$1</h5>")
      .replace(/^####\s?(.*)$/gm, "<h4>$1</h4>")
      .replace(/^###\s?(.*)$/gm, "<h3>$1</h3>")
      .replace(/^##\s?(.*)$/gm, "<h2>$1</h2>")
      .replace(/^#\s?(.*)$/gm, "<h1>$1</h1>");

    // 列表
    html = html.replace(/^(?:- |\* )(.*)(?:\n(?:- |\* ).*)*/gm, (block) => {
      const items = block.split(/\n/).map((l) => l.replace(/^(?:- |\* )/, "").trim()).filter(Boolean);
      return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    });
    html = html.replace(/^(?:\d+\. )(.*)(?:\n(?:\d+\. ).*)*/gm, (block) => {
      const items = block.split(/\n/).map((l) => l.replace(/^\d+\. /, "").trim()).filter(Boolean);
      return `<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
    });

    // 强调/链接/代码
    html = html
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+?)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // ⚠️ 不用整块 <p> 包裹：仅把“空行”转换成 <br><br>
      // 空行→<br><br>
      html = html.replace(/\n{2,}/g, "<br><br>");
      // 3 个以上 <br> → 2 个
      html = html.replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>");

 

    // // —— 去掉块元素周围多余的 <br>，避免大间隙 ——
    // // 1) 块元素结束后紧跟多个 <br> => 去掉
    // html = html.replace(
    //   /(<\/(?:h[1-6]|p|ul|ol|pre|blockquote)>)\s*(?:<br\s*\/?>\s*)+/gi,
    //   "$1"
    // );
    // // 2) 多个 <br> 紧贴块元素开始前 => 去掉
    // html = html.replace(
    //   /(?:<br\s*\/?>\s*)+(?=\s*<(?:h[1-6]|p|ul|ol|pre|blockquote)\b)/gi,
    //   ''
    // );
    // // 3) 保险：把 3 个以上 <br> 压成 2 个（最多“一个空行”的视觉）
    // html = html.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>');


    html = `<div class="md">${html}</div>`;

    // 还原 notice
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

  // 清理内联颜色/背景/nowrap（避免白字白底/文字挤没）
  function stripInlineColor(html = "") {
    const dropProps = /\b(?:color|background-color|white-space)\s*:[^;"'}]+;?/gi;

    // style="...":
    html = html.replace(/style\s*=\s*"([^"]*)"/gi, (m, css) => {
      const cleaned = css.replace(dropProps, "");
      return cleaned.trim() ? `style="${cleaned.trim()}"` : "";
    });

    // style='...':
    html = html.replace(/style\s*=\s*'([^']*)'/gi, (m, css) => {
      const cleaned = css.replace(dropProps, "");
      return cleaned.trim() ? `style='${cleaned.trim()}'` : "";
    });

    // 老式 <font color="">
    html = html.replace(/<font\b([^>]*?)\scolor=(["']).*?\2([^>]*)>/gi, "<font$1$3>");

    return html;
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
      /* === 字体与隔离：Shadow DOM 内确保与 options 一致 === */
      :host{
        --font-stack: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial,
                      "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
        font-family: var(--font-stack, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial,
                        "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif) !important;

        /* 固定浅色配色，避免外站暗色策略影响 */
        color-scheme: light;
        color:#111827 !important;  /* 钉住根文字色，避免继承白色 */
      }
      :host, :host * {
        font-family: inherit !important;
        box-sizing: border-box;
      }
      button, input, select, textarea { font-family: inherit !important; }

      /* —— 原有样式 —— */
      .wrap{
        height:100vh; display:flex; flex-direction:column;
        /* ⬇︎ 加深背景：由纯色改为更深一点的柔和渐变 */
        background: linear-gradient(180deg,#f1f4ff,#e7ecff);
        border-left:1px solid #e6e8f0; box-shadow:-6px 0 16px rgba(17,24,39,.06);
        color:#111827; /* 钉住默认文字色 */
      }
      .appbar{ flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:linear-gradient(180deg,#fff,#f4f7ff); border-bottom:1px solid #e6e8f0; }
      .brand{ display:flex; align-items:center; gap:10px; }
      .logo{ width:10px; height:10px; border-radius:50%; background:#2563eb; box-shadow:0 0 0 4px rgba(37,99,235,.12); }
      .title{ font-size:14px; font-weight:800; color:#111827; } /* 避免白色标题 */
      .actions{ display:flex; gap:8px; }
      .btn{ padding:8px 12px; border:1px solid #e6e8f0; border-radius:10px; cursor:pointer; background:#fff; color:#111827; font-weight:600; }
      .btn.primary{ background:linear-gradient(180deg,#2563eb,#1f5fe0); color:#fff; border-color:#1d4ed8; box-shadow:0 6px 16px rgba(37,99,235,.18), inset 0 -1px 0 rgba(255,255,255,.15); }
      .btn[disabled]{ opacity:.6; cursor:not-allowed; }
      .progress{ height:2px; background:transparent; position:relative; overflow:hidden; }
      .progress .bar{ position:absolute; left:-18%; width:18%; min-width:110px; max-width:240px; top:0; bottom:0; background:#2563eb; border-radius:999px; animation:slide 1.25s linear infinite; box-shadow:0 0 8px rgba(37,99,235,.55); }
      @keyframes slide { 0%{left:-18%;} 100%{left:100%;} }
      .progress.hidden{ display:none; }
      .container{ flex:1 1 auto; padding:12px; overflow:auto; }
      .section{ margin:10px 0 14px; }
      .section-title{ margin:0 0 10px; font-size:14px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px; }
      .dot{ width:8px; height:8px; border-radius:50%; background:#2563eb; box-shadow:0 0 0 4px rgba(37,99,235,.12); }
      .dot.green{ background:#10b981; box-shadow:0 0 0 4px rgba(16,185,129,.12); }
      .card{ background:#fff; border:1px solid #e6e8f0; border-radius:12px; padding:18px 20px; line-height:1.7; font-size:15px; box-shadow: 0 2px 8px rgba(17,24,39,0.03); }
      .card-summary{ padding-top:54px; border-color:#cfe0ff; background:#fff; box-shadow: 0 2px 10px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.6); position:relative; }
      .card-summary::before{ content:""; position:absolute; left:0; right:0; top:0; height:42px; background:linear-gradient(180deg,#dbe8ff 0%,#cfe0ff 100%); border-radius:12px 12px 0 0; border-bottom:1px solid #bdd1ff; }
      .card-summary::after{ content:"摘要"; position:absolute; left:14px; top:10px; font-weight:700; font-size:14px; color:#123a8f; }
      .skl{ height:12px; background:#eee; border-radius:6px; margin:8px 0; animation:skl 1.2s ease-in-out infinite; }
      @keyframes skl{ 0%{opacity:.6;} 50%{opacity:1;} 100%{opacity:.6;} }
      .empty{ text-align:center; padding:28px 10px; color:#667085; }
      .empty .icon{ font-size:28px; }
      .empty .title{ font-weight:700; margin-top:8px; }
      .empty .hint{ font-size:12px; margin-top:4px; }
      .alert{ border-radius:10px; border:1px solid #f1e2a8; background:#fff8dc; padding:10px 36px 10px 12px; margin:6px 0 10px; position:relative; font-size:13px; line-height:1.75; }
      .alert-close{ position:absolute; top:4px; right:4px; border:none; background:transparent; font-size:16px; cursor:pointer; line-height:1; }
      .footer{ flex:0 0 auto; font-size:12px; color:#6b7280; border-top:1px solid #e6e8f0; padding:8px 12px; }
      .dragbar{ position:absolute; left:-6px; top:0; width:6px; height:100%; cursor:ew-resize; background:transparent; }

      /* 摘要(#sx-summary) 列表缩进调小 */
      #sx-summary ul, #sx-summary ol{ padding-left:14px; margin-left:0; list-style-position:outside; }
      #sx-summary li{ margin:4px 0; }
      #sx-summary.compact ul, #sx-summary.compact ol{ padding-left:0; margin-left:0; list-style-position:inside; }

      /* 图标按钮（右上角关闭） */
      .btn.icon{
        width:36px; height:36px; padding:0; display:grid; place-items:center; line-height:1;
        font-size:18px; border-radius:10px; border:1px solid #d1d5db;
        background: linear-gradient(180deg, #f9f9f9, #e5e7eb); color:#333; cursor:pointer;
        transition: background .2s, box-shadow .2s, transform .05s; box-shadow:0 1px 2px rgba(0,0,0,0.08);
      }
      .btn.icon:hover{
        background: linear-gradient(180deg, #ffffff, #d1d5db);
        box-shadow: 0 2px 6px rgba(0,0,0,0.15); border-color:#cbd5e1;
      }
      .btn.icon:active{
        transform: translateY(1px);
        background: linear-gradient(180deg, #e5e7eb, #cbd5e1);
        box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
      }

      /* === 强制摘要/正文区域可读：只作用于常见“文本元素”，保留 .alert 背景 === */
      #sx-summary, #sx-cleaned { color:#111827 !important; }
      #sx-summary .md :where(h1,h2,h3,h4,h5,h6,p,li,span,a,strong,em,code,pre,blockquote),
      #sx-cleaned .md :where(h1,h2,h3,h4,h5,h6,p,li,span,a,strong,em,code,pre,blockquote){
        color:#111827 !important;
        background-color: transparent !important; /* 不清除 .alert 容器背景 */
        white-space: normal !important;
      }
      #sx-summary a, #sx-cleaned a { color:#1f2937 !important; text-decoration: underline; }
      #sx-summary code, #sx-cleaned code,
      #sx-summary pre,  #sx-cleaned pre { color:#111 !important; }

      /* 图片/表格/代码框适配容器宽度（基线） */
      #sx-summary img, #sx-cleaned img { max-width:100%; height:auto; }
      #sx-summary table, #sx-cleaned table { max-width:100%; display:block; overflow:auto; border-collapse:collapse; }
      #sx-summary pre, #sx-cleaned pre { max-width:100%; overflow:auto; }

      /* ===== Markdown 渲染(.md)——统一显示优化（新增） ===== */
      .md{
        font-size:15px;
        line-height:1.75;
        color:#111827;
        word-break:break-word;
        overflow-wrap:anywhere; /* 长链接/长英文自动断行 */
      }
      /* 标题更紧凑，但层级清晰 */
      .md h1{ margin:16px 0 10px; font-size:20px; line-height:1.4; font-weight:800; }
      .md h2{ margin:14px 0 8px;  font-size:18px; line-height:1.4; font-weight:800; }
      .md h3{ margin:12px 0 8px;  font-size:16px; line-height:1.4; font-weight:700; }
      .md h4{ margin:10px 0 6px;  font-size:15px; line-height:1.4; font-weight:700; }
      .md h5{ margin:8px  0 6px;  font-size:14px; line-height:1.4; font-weight:700; }
      .md h6{ margin:8px  0 6px;  font-size:13px; line-height:1.4; font-weight:700; color:#374151; }

      /* 段落/列表间距（避免大段空白） */
      .md p{  margin:8px 0; }
      .md ul, .md ol{ margin:8px 0; padding-left:18px; }
      .md li{ margin:4px 0; }
      .md li > p{ margin:4px 0; }  /* 列表项内段落更紧凑 */
      .md blockquote{ 
        margin:12px 0; padding:8px 12px;
        border-left:3px solid #cfe0ff; border-radius:8px;
        background:#f8fbff;
        color:#0f172a;
      }

      /* 链接与强调 */
      .md a{ text-decoration: underline; text-underline-offset:2px; }
      .md strong{ font-weight:700; }
      .md em{ font-style:italic; }

      /* 代码：行内与块 */
      .md code{
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        font-size:.92em;
        background:#f3f4f6;
        border:1px solid #e5e7eb;
        border-radius:4px;
        padding:0 .25em;
      }
      .md pre{
        margin:10px 0; padding:12px;
        background:#f7f9ff;
        border:1px solid #e6e8f0; border-radius:10px;
        overflow:auto; line-height:1.6;
      }
      .md pre code{
        background:transparent; border:none; padding:0; display:block; font-size:.92em;
      }

      /* 表格：可读的细边框样式 */
      .md table{
        width:100%; border-collapse:collapse; display:block; overflow:auto;
        margin:10px 0;
      }
      .md thead th{
        background:#f8fafc; color:#0f172a; font-weight:700;
      }
      .md th, .md td{
        border:1px solid #e5e7eb; padding:8px 10px; text-align:left; vertical-align:top;
      }

      /* 图片与分割线 */
      .md img{ display:block; margin:8px 0; }
      .md hr{ border:0; border-top:1px solid #e6e8f0; margin:12px 0; }

      /* 首尾去多余外边距，避免开头/结尾突兀空白 */
      .md > :first-child{ margin-top: 0; }
      .md > :last-child{  margin-bottom: 0; }
      



      /* 列表自身的间距：保留该有的空行，但不过分 */
      .md ul, .md ol { margin: 8px 0; }
      .md li { margin: 4px 0; }
      .md li > p { margin: 4px 0; }      /* 列表项里段落更紧凑，空行仍可见 */

      /* “列表 → 标题/段落/引用/代码块”：收紧相邻间距，避免大块留白 */
      .md ul + h1, .md ol + h1,
      .md ul + h2, .md ol + h2,
      .md ul + h3, .md ol + h3,
      .md ul + p,  .md ol + p,
      .md ul + blockquote, .md ol + blockquote,
      .md ul + pre, .md ol + pre { margin-top: 6px; }

      /* 标题本身保持紧凑（如果你已设置，可忽略或保留这组） */
      .md h1 { margin: 14px 0 6px; }
      .md h2 { margin: 12px 0 6px; }
      .md h3 { margin: 10px 0 6px; }


      /* 收紧列表和下文的间距 */
      .md ul, .md ol {
        margin: 8px 0 4px;   /* 上下 8px，底部只有 4px */
        padding-left: 18px;
      }
      .md li { margin: 4px 0; }

      /* 如果列表后面紧跟 <br>，就去掉它，避免叠加空白 */
      .md ul + br, .md ol + br {
        display: none;
      }


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
                   width="16" height="16" fill="#1e3a8a" aria-hidden="true">
                <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7a1 1 0 0 0-1.41 1.42L10.59 12l-4.89 4.89a1 1 0 0 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"/>
              </svg>
            </button>
          </div>
        </div>
        <div id="sx-progress" class="progress hidden"><div class="bar"></div></div>
        <div class="container">
          <section class="section">
            <div id="sx-summary" class="card card-summary"></div>
          </section>
          <section class="section">
            <h2 class="section-title"><span class="dot green"></span> 可读正文</h2>
            <div id="sx-cleaned" class="card"></div>
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

    // 摘要
    $s.innerHTML = summary
      ? stripInlineColor(renderMarkdown(summary))
      : `<div class="empty"><div class="icon">📝</div><div class="title">暂无摘要</div></div>`;

    // 可读正文
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

  // 内容脚本不能直接用 chrome.tabs.query —— 让 background 告诉我们活动 tabId
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

  // ====== 轮询兜底（partial -> done）======
  let pollTimer = null;
  function stopPolling(){ if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } }

  async function pollUntilDone(tabId, opts = {}) {
    stopPolling();
    const start = Date.now();
    let interval = 600;                 // 初始 600ms
    const maxInterval = 2000;           // 最大 2s
    const hardTimeout = 120000;         // 最长 120s（2 分钟）

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
        // 仍在 running / partial：保持加载态，必要时刷新摘要
        if (st.status === "partial") {
          setLoading(shadow, true);
          renderToDom(shadow, st.summary, null);
        } else if (st.status === "running") {
          setLoading(shadow, true);
          setSkeleton(shadow);
        }
      } catch {
        // 忽略单次读取失败
      }
      // 超时控制
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

  // 按钮：启动任务（先骨架 → 等待 partial → 继续等 done）
  shadow.getElementById("sx-run").addEventListener("click", async () => {
    try {
      setLoading(shadow, true);
      setSkeleton(shadow);
      const tabId = await getActiveTabId();
      if (!tabId) throw new Error("未找到活动标签页");

      const resp = await chrome.runtime.sendMessage({ type: "PANEL_RUN_FOR_TAB", tabId });
      if (!resp || resp.ok !== true) throw new Error(resp?.error || "运行失败");

      // 先拉一次：如果已经 partial，则立即显示摘要
      try {
        const st = await getState(tabId);
        if (st.status === "partial") {
          renderToDom(shadow, st.summary, null);
        } else if (st.status === "done") {
          // 不早退：很可能是上一次的 done，新一轮很快会变成 running/partial
          setLoading(shadow, true);
          setSkeleton(shadow);
        }
      } catch {}
      // 无论如何开始轮询，直到 done
      await pollUntilDone(tabId);
    } catch (e) {
      setLoading(shadow, false);
      shadow.getElementById("sx-summary").innerHTML =
        `<div class="alert"><div class="alert-content"><p>运行失败：${escapeHtml(e?.message||String(e))}</p></div></div>`;
    }
  });

  // 启动时恢复：若已在 running/partial，则开始轮询直到 done
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

  // 仍保留广播（更快）：只处理当前 tab；广播与轮询互不冲突
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