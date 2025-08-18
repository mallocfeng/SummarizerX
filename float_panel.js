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
    if (typeof md !== "string") md = String(md ?? "");
    let html = escapeHtml(md);
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHtml(code)}</code></pre>`);
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`([^`]+?)`/g, "<code>$1</code>");
    html = html.replace(/^(?:- |\* )(.*)(?:\n(?:- |\* ).*)*/gm, (block) => {
      const items = block.split(/\n/).map((l) => l.replace(/^(?:- |\* )/, "").trim()).filter(Boolean);
      return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    });
    html = html.replace(/^(?:\d+\. )(.*)(?:\n(?:\d+\. ).*)*/gm, (block) => {
      const items = block.split(/\n/).map((l) => l.replace(/^\d+\. /, "").trim()).filter(Boolean);
      return `<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
    });
    html = html.replace(/\n{2,}/g, "</p><p>");
    return `<p>${html}</p>`;
  }

  function renderMarkdown(md = "") {
    if (typeof md !== "string") md = String(md ?? "");
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
    html = html.replace(/\n{2,}/g, "</p><p>");
    html = `<p>${html}</p>`;

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

  // ========== DOM & 样式（Shadow） ==========
  function ensurePanel() {
    let host = document.getElementById(PANEL_ID);
    if (host) return host;

    host = document.createElement("div");
    host.id = PANEL_ID;
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.top = "0";
    host.style.right = "0";
    host.style.width = "420px";
    host.style.height = "100vh";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "auto";

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host{ all:initial; }
      *{ box-sizing: border-box; }
      html, body{ height:100%; }
      body{
        margin:0;
        font-family:"Microsoft YaHei","微软雅黑","PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC",system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
      }
      .wrap{ height:100vh; display:flex; flex-direction:column; background:#f6f8ff; border-left:1px solid #e6e8f0; box-shadow:-6px 0 16px rgba(17,24,39,.06); }
      .appbar{ flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:linear-gradient(180deg,#fff,#f4f7ff); border-bottom:1px solid #e6e8f0; }
      .brand{ display:flex; align-items:center; gap:10px; }
      .logo{ width:10px; height:10px; border-radius:50%; background:#2563eb; box-shadow:0 0 0 4px rgba(37,99,235,.12); }
      .title{ font-size:14px; font-weight:800; }
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
      .card{ background:#fff; border:1px solid #e6e8f0; border-radius:12px; padding:18px 20px; line-height:1.7; font-size:16px; box-shadow:0 2px 8px rgba(17,24,39,0.03); }
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
            <button id="sx-close" class="btn" title="关闭">关闭</button>
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
    $s.innerHTML = summary ? renderMarkdown(summary) : `<div class="empty"><div class="icon">📝</div><div class="title">暂无摘要</div></div>`;
    $c.innerHTML = cleaned ? renderMarkdown(cleaned) : `<div class="empty"><div class="icon">📄</div><div class="title">暂无可读正文</div></div>`;
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
          renderToDom(shadow, st.summary, st.cleaned);
          setLoading(shadow, false);
          return;
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