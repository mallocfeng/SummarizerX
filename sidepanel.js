// sidepanel.js —— 支持 "partial"：摘要先显示、正文后到再补

const $ = (id) => document.getElementById(id);
const onReady = new Promise((r) =>
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r()
);

// 侧栏“只认一次”的 tabId（加载瞬间的活动页）
async function getMyTabId() {
  try {
    const win = await chrome.windows.getLastFocused({ populate: true, windowTypes: ["normal"] });
    const tab = win?.tabs?.find(t => t.active && !String(t.url||"").startsWith("chrome-extension://"));
    if (tab?.id) return tab.id;
  } catch {}
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id || null;
}
const MY_TAB_ID_PROMISE = getMyTabId();

/* 每次点击都重新取当前活动 tabId，并绑定到 LAST_RUN_TAB_ID */
async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}
let LAST_RUN_TAB_ID = null;

/* =========================
 * Markdown 渲染（含 :::notice）
 * ========================= */
function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, s => (
    {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[s]
  ));
}
// 仅用于 :::notice 的轻量 Markdown 渲染
function renderNoticeMarkdown(md = "") {
  if (typeof md !== "string") md = String(md ?? "");
  let html = escapeHtml(md);
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHtml(code)}</code></pre>`);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
             .replace(/\*(.+?)\*/g, "<em>$1</em>")
             .replace(/`([^`]+?)`/g, "<code>$1</code>")
             .replace(/$begin:math:display$([^$end:math:display$]+)\]$begin:math:text$([^)]+)$end:math:text$/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/^(?:- |\* )(.*)(?:\n(?:- |\* ).*)*/gm, (block) => {
    const items = block.split(/\n/).map(l => l.replace(/^(?:- |\* )/, "").trim()).filter(Boolean);
    return `<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>`;
  });
  html = html.replace(/^(?:\d+\. )(.*)(?:\n(?:\d+\. ).*)*/gm, (block) => {
    const items = block.split(/\n/).map(l => l.replace(/^\d+\. /, "").trim()).filter(Boolean);
    return `<ol>${items.map(i => `<li>${i}</li>`).join("")}</ol>`;
  });
  html = html.replace(/\n{2,}/g, "</p><p>");
  return `<p>${html}</p>`;
}

function renderMarkdown(md = "") {
  if (typeof md !== "string") md = String(md ?? "");

  // 先提取 :::notice … :::，占位
  const notices = [];
  md = md.replace(/:::notice\s*([\s\S]*?)\s*:::/g, (_, inner) => {
    notices.push((inner || "").trim());
    return `__ALERT_TOKEN_${notices.length - 1}__`;
  });

  // 再做通用 Markdown 渲染
  let html = escapeHtml(md);

  // 代码块
  html = html.replace(/```([\\s\S]*?)```/g, (_, code) =>
    `<pre><code>${escapeHtml(code)}</code></pre>`
  );

  // 引用
  html = html.replace(/(^|\n)((?:&gt;\s?.*(?:\n|$))+)/g, (_, pfx, block) => {
    const inner = block.split("\n").filter(Boolean).map(line => line.replace(/^&gt;\s?/, "").trim()).join("<br>");
    return `${pfx}<blockquote>${inner}</blockquote>`;
  });

  // 标题
  html = html.replace(/^######\s?(.*)$/gm, "<h6>$1</h6>")
             .replace(/^#####\s?(.*)$/gm, "<h5>$1</h5>")
             .replace(/^####\s?(.*)$/gm, "<h4>$1</h4>")
             .replace(/^###\s?(.*)$/gm, "<h3>$1</h3>")
             .replace(/^##\s?(.*)$/gm, "<h2>$1</h2>")
             .replace(/^#\s?(.*)$/gm, "<h1>$1</h1>");

  // 列表
  html = html.replace(/^(?:- |\* )(.*)(?:\n(?:- |\* ).*)*/gm, (block) => {
    const items = block.split(/\n/).map(l => l.replace(/^(?:- |\* )/, "").trim()).filter(Boolean);
    return `<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>`;
  });
  html = html.replace(/^(?:\d+\. )(.*)(?:\n(?:\d+\. ).*)*/gm, (block) => {
    const items = block.split(/\n/).map(l => l.replace(/^\d+\. /, "").trim()).filter(Boolean);
    return `<ol>${items.map(i => `<li>${i}</li>`).join("")}</ol>`;
  });

  // 强调/链接
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
             .replace(/\*(.+?)\*/g, "<em>$1</em>")
             .replace(/`([^`]+?)`/g, "<code>$1</code>")
             .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 段落
  html = html.replace(/\n{2,}/g, "</p><p>");
  html = `<p>${html}</p>`;

  // 替换 notice
  notices.forEach((txt, i) => {
    const alertHtml =
      `<div class="alert alert-warning" data-alert>
        <button class="alert-close" type="button" aria-label="关闭" title="关闭" data-alert-close>&times;</button>
        <div class="alert-content">${renderNoticeMarkdown(txt)}</div>
      </div>`;
    html = html.replace(`__ALERT_TOKEN_${i}__`, alertHtml);
  });

  return html;
}

/* =========
 * UI 辅助
 * ========= */
function setButtonLoading(loading=true){
  const btn=$("btn-run"); if(!btn) return;
  btn.classList.toggle("loading",loading);
  btn.disabled=!!loading;
  btn.textContent=loading?"处理中…":"提取并摘要";
}
function showProgress(show=true){ $("progress")?.classList.toggle("hidden", !show); }
function skeleton(){
  // 摘要给骨架，正文给更长骨架
  $("summary").innerHTML=`<div class="skl" style="width:90%"></div><div class="skl" style="width:72%"></div><div class="skl" style="width:84%"></div>`;
  $("cleaned").innerHTML=`<div class="skl" style="width:96%"></div><div class="skl" style="width:64%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`;
}
function empty(kind="summary"){
  const map={
    summary:{icon:"📝",title:"暂无摘要",hint:"点击上方「提取并摘要」"},
    cleaned:{icon:"📄",title:"暂无可读正文",hint:"点击上方「提取并摘要」"}
  };
  const m=map[kind];
  return `<div class="empty"><div class="icon">${m.icon}</div><div class="title">${m.title}</div><div class="hint">${m.hint}</div></div>`;
}
function renderEmptyBoth(){
  $("summary").innerHTML=empty("summary");
  $("cleaned").innerHTML=empty("cleaned");
}
function renderToDom(summary, cleaned){
  $("summary").innerHTML = summary ? renderMarkdown(summary) : empty("summary");
  $("cleaned").innerHTML = cleaned ? renderMarkdown(cleaned) : empty("cleaned");
}

/* ====================
 * 与后台通信（按 tabId）
 * ==================== */
async function getStateFromBG(tabId){
  const resp = await chrome.runtime.sendMessage({ type: "PANEL_GET_STATE", tabId });
  if (!resp?.ok) throw new Error(resp?.error || "无法获取状态");
  return resp.data;
}
async function runForTab(tabId){
  const resp = await chrome.runtime.sendMessage({ type: "PANEL_RUN_FOR_TAB", tabId });
  if (!resp?.ok) throw new Error(resp?.error || "运行失败");
  return true; // 后台改为立即返回 ok，实际数据走广播
}

/* ==========================
 * 初始化：只按 MY_TAB_ID 恢复
 * ========================== */
async function restoreOnce(){
  const tabId = await MY_TAB_ID_PROMISE;
  if (!tabId){
    $("summary").innerHTML = `<p>🚫 未找到可用页面</p>`;
    $("cleaned").innerHTML = `<p>无法抓取</p>`;
    return;
  }
  try{
    const st = await getStateFromBG(tabId);
    if (st.status === "running"){
      setButtonLoading(true); showProgress(true); skeleton();
    } else if (st.status === "partial"){
      setButtonLoading(true); showProgress(true);
      $("summary").innerHTML = st.summary ? renderMarkdown(st.summary) : empty("summary");
      $("cleaned").innerHTML=`<div class="skl" style="width:96%"></div><div class="skl" style="width:64%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`;
    } else if (st.status === "done"){
      setButtonLoading(false); showProgress(false); renderToDom(st.summary, st.cleaned);
    } else if (st.status === "error"){
      setButtonLoading(false); showProgress(false); renderEmptyBoth();
    } else {
      setButtonLoading(false); showProgress(false); renderEmptyBoth();
    }
  } catch(e){
    console.warn(e);
    setButtonLoading(false); showProgress(false); renderEmptyBoth();
  }
}

/* ============================
 * 点击运行：重新获取当前活动 tabId，
 * 绑定到 LAST_RUN_TAB_ID，并兜底重试（摘要先来，正文随后补）
 * ============================ */
async function onRun(){
  let tabId = await getActiveTabId();
  if (!tabId) { alert("没有找到可用的活动标签页"); return; }

  LAST_RUN_TAB_ID = tabId;
  setButtonLoading(true); showProgress(true); skeleton();

  try{
    await runForTab(tabId);
    // 立刻拉一次状态（可能已经 partial）
    const st = await getStateFromBG(tabId);
    if (st.status === "partial"){
      $("summary").innerHTML = st.summary ? renderMarkdown(st.summary) : empty("summary");
      // 正文继续加载，保持骨架
    } else if (st.status === "done"){
      renderToDom(st.summary, st.cleaned);
      setButtonLoading(false); showProgress(false);
    } else if (st.status === "error"){
      renderEmptyBoth(); setButtonLoading(false); showProgress(false);
    }
  } catch(e){
    const msg = e?.message || String(e);
    if (/No tab with id/i.test(msg)) {
      try {
        tabId = await getActiveTabId();
        if (!tabId) throw new Error(msg);
        LAST_RUN_TAB_ID = tabId;
        await runForTab(tabId);
      } catch(e2){
        console.error(e2); renderEmptyBoth(); alert("运行失败：\n" + (e2?.message || String(e2)));
        setButtonLoading(false); showProgress(false);
      }
    } else {
      console.error(e); renderEmptyBoth(); alert("运行失败：\n" + msg);
      setButtonLoading(false); showProgress(false);
    }
  }
}

/* =======================================
 * 只处理与“本次运行 tabId”匹配的状态更新广播；
 * 若尚未点击过（LAST_RUN_TAB_ID 为空），退回到 MY_TAB_ID
 * ======================================= */
chrome.runtime.onMessage.addListener(async (msg) => {
  if (!msg || msg.type !== "PANEL_STATE_UPDATED") return;
  const fallbackMyId = await MY_TAB_ID_PROMISE;
  const targetId = LAST_RUN_TAB_ID ?? fallbackMyId;
  if (msg.tabId !== targetId) return;

  try{
    const st = await getStateFromBG(targetId);
    if (st.status === "running"){
      setButtonLoading(true); showProgress(true); skeleton();
    } else if (st.status === "partial"){
      setButtonLoading(true); showProgress(true);
      $("summary").innerHTML = st.summary ? renderMarkdown(st.summary) : empty("summary");
      $("cleaned").innerHTML=`<div class="skl" style="width:96%"></div><div class="skl" style="width:64%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`;
    } else if (st.status === "done"){
      setButtonLoading(false); showProgress(false); renderToDom(st.summary, st.cleaned);
    } else if (st.status === "error"){
      setButtonLoading(false); showProgress(false); renderEmptyBoth();
    }
  } catch(e){ console.warn(e); }
});

/* =========
 * 事件绑定
 * ========= */
function openOptions(){ chrome.runtime.openOptionsPage(); }

onReady.then(() => {
  $("btn-run")?.addEventListener("click", onRun);
  $("btn-open-settings")?.addEventListener("click", openOptions);
  $("go-settings")?.addEventListener("click", openOptions);
  restoreOnce().catch(console.error);

  // 关闭淡黄提示条
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-alert-close]");
    if (!btn) return;
    const box = btn.closest("[data-alert]");
    if (box) box.remove();
  });
});