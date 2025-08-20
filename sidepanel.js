// sidepanel.js —— 支持 "partial"：摘要先显示、正文后到再补
// ✅ 修复：无权限/未注入时会尝试本页注入；仅在确实缺权限时提示“点击扩展图标重新授权”
import { getSettings } from "./settings.js";
let RUN_BTN_LABEL = "提取并摘要";

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

/* 工具：获取当前活动页的 host */
async function getActiveHost() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { return tab?.url ? (new URL(tab.url)).host : ""; } catch { return ""; }
}

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
             .replace(/`([^`]+?)`/g, "<code>$1</code>");
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
  html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
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
// function setButtonLoading(loading=true){
//   const btn=$("btn-run"); if(!btn) return;
//   btn.classList.toggle("loading",loading);
//   btn.disabled=!!loading;
//   btn.textContent=loading?"处理中…":"提取并摘要";
// }

function setButtonLoading(loading = true) {
  const btn = $("btn-run");
  if (!btn) return;
  btn.classList.toggle("loading", loading);
  btn.disabled = !!loading;
  // 加载时显示“处理中…”，结束时用动态文案
  btn.textContent = loading ? "处理中…" : RUN_BTN_LABEL;
}

function showProgress(show=true){ $("progress")?.classList.toggle("hidden", !show); }
function skeleton(){
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

/* ========= 友好的“重新授权”提示 ========= */
function showReauthBanner(host){
  const msgZh = `需要访问 <code>${escapeHtml(host)}</code> 的权限。请单击浏览器工具栏中的扩展图标（蓝色按钮）以重新授权本标签页，然后再点击“提取并摘要”。`;
  const html =
    `<div class="alert" data-alert id="reauth-banner" style="margin-top:10px">
      <button class="alert-close" type="button" aria-label="关闭" title="关闭" data-alert-close>&times;</button>
      <div class="alert-content"><p>${msgZh}</p></div>
    </div>`;
  const box = $("summary");
  if (!box) return;
  const old = document.getElementById("reauth-banner");
  if (old) old.remove();
  box.insertAdjacentHTML("afterbegin", html);
}
function removeReauthBanner(){
  const old = document.getElementById("reauth-banner");
  if (old) old.remove();
}

/* =======================================================
 * 权限/注入探测与自我注入（不新增 host 权限）
 * ======================================================= */
async function tryInjectIntoActiveTab(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["utils_extract.js"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return true;
  } catch (e) {
    return { ok:false, error: e?.message || String(e) };
  }
}

async function canAccessAndEnsureInjected() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab?.url) return { ok:false, reason:"no-tab" };

  // 仅支持 http/https/file/ftp
  if (!/^https?:|^file:|^ftp:/i.test(tab.url)) return { ok:false, reason:"scheme" };

  // 1) 先 PING
  try {
    const ping = await chrome.tabs.sendMessage(tab.id, { type: "PING_EXTRACTOR" });
    if (ping?.ok) return { ok:true, injected:true, tabId:tab.id };
  } catch {}

  // 2) 未注入则尝试注入（依赖 activeTab 临时授权）
  const inj = await tryInjectIntoActiveTab(tab.id);
  if (inj === true) {
    // 注入成功再 PING 一次确认
    try {
      const ping2 = await chrome.tabs.sendMessage(tab.id, { type: "PING_EXTRACTOR" });
      if (ping2?.ok) return { ok:true, injected:true, tabId:tab.id };
    } catch {}
    return { ok:false, reason:"inject-unknown", tabId:tab.id };
  }

  // 3) 注入报错，判断是否明确的权限问题
  const msg = (inj && inj.error) ? inj.error : "";
  if (/must request permission to access this host|Cannot access contents|Extensions settings|prohibited/i.test(msg)) {
    return { ok:false, reason:"no-permission", error: msg, tabId:tab.id };
  }
  return { ok:false, reason:"inject-failed", error: msg, tabId:tab.id };
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
  return true; // 后台立即返回 ok，实际数据走广播
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


document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('app-version');
  if (!el) return;

  const { version, version_name } = chrome.runtime.getManifest();
  // 显示短版本，鼠标悬停显示更详细信息（可选）
  el.textContent = `v${version}`;
  el.title = version_name || version;
});

// 初始化按钮文案（Trial => “试用摘要”）
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const cfg = await getSettings();
    RUN_BTN_LABEL = (cfg?.aiProvider === "trial") ? "试用摘要" : "提取并摘要";
    const btn = $("btn-run");
    if (btn && !btn.classList.contains("loading")) {
      btn.textContent = RUN_BTN_LABEL;
    }
  } catch (e) {
    // 读取不到也不致命，保持默认文案
    console.warn("read settings failed:", e);
  }
});

/* ============================
 * 点击运行：先自检注入→不足才提示重新授权
 * ============================ */
async function onRun(){
  let tabId = await getActiveTabId();
  if (!tabId) { alert("没有找到可用的活动标签页"); return; }

  LAST_RUN_TAB_ID = tabId;

  // 运行前：确保可访问 & 已注入
  const access = await canAccessAndEnsureInjected();
  if (!access.ok) {
    const host = await getActiveHost();
    if (access.reason === "scheme") {
      $("summary").innerHTML = `<div class="alert" data-alert><div class="alert-content"><p>🚫 此页面协议不支持抓取（如 chrome://、扩展页、PDF 查看器等）。</p></div></div>`;
    } else if (access.reason === "no-permission") {
      showReauthBanner(host || "当前站点");
    } else {
      // 注入失败等其他未知情况
      showReauthBanner(host || "当前站点");
    }
    setButtonLoading(false); showProgress(false);
    return;
  }

  // 能访问 & 已注入 —— 清掉提示，进入骨架并启动
  removeReauthBanner();
  setButtonLoading(true); showProgress(true); skeleton();

  try{
    await runForTab(tabId);
    // 立刻拉一次状态（可能已经 partial）
    // const st = await getStateFromBG(tabId);
    // if (st.status === "partial"){
    //   $("summary").innerHTML = st.summary ? renderMarkdown(st.summary) : empty("summary");
    // } else if (st.status === "done"){
    //   renderToDom(st.summary, st.cleaned);
    //   setButtonLoading(false); showProgress(false);
    // } else if (st.status === "error"){
    //   renderEmptyBoth(); setButtonLoading(false); showProgress(false);
    // }

    const st = await getStateFromBG(tabId);
    if (st.status === "partial"){
      $("summary").innerHTML = st.summary ? renderMarkdown(st.summary) : empty("summary");
    // 不再把“done”当成终止；这里很可能是旧状态，保持加载并交给轮询
    } else if (st.status === "done"){
      // 不要 setButtonLoading(false) / 不要 return
      // 可以什么都不做，或仅保持骨架屏：
      // skeleton();
    } else if (st.status === "error"){
      renderEmptyBoth(); setButtonLoading(false); showProgress(false);
    }
    // 关键：无论上面拉到什么状态，都开始轮询直到真正的 done
    pollUntilDone(tabId);


  } catch(e){
    const msg = e?.message || String(e);
    // 若后台仍报权限错误，再给提示
    if (/Cannot access contents of url|must request permission to access this host|Receiving end does not exist/i.test(msg)) {
      const host = await getActiveHost();
      showReauthBanner(host || "当前站点");
      setButtonLoading(false); showProgress(false);
      return;
    }
    console.error(e); renderEmptyBoth(); alert("运行失败：\n" + msg);
    setButtonLoading(false); showProgress(false);
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

/* =======================================================
 * 静默检测是否具备访问/注入能力：
 * - 仅在明确“无权限”时才提示
 * - 有权限或只是暂时未就绪则不打扰
 * - 对 onUpdated/onActivated 做去抖处理，避免频繁触发
 * ======================================================= */
const pendingTimers = new Map();

function debouncePerTab(tabId, fn, wait = 250) {
  if (pendingTimers.has(tabId)) clearTimeout(pendingTimers.get(tabId));
  const t = setTimeout(() => { pendingTimers.delete(tabId); fn(); }, wait);
  pendingTimers.set(tabId, t);
}

async function silentCheckAndMaybePrompt(tabId, urlFromChangeInfo) {
  try {
    // 只处理当前活动标签页
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!active || active.id !== tabId) return;

    const url = urlFromChangeInfo || active.url || "";

    // 不支持的协议：直接收起提示，不打扰
    if (!/^https?:|^file:|^ftp:/i.test(url)) { removeReauthBanner(); return; }

    // --- ① 先问后台：这个 tab 是否已经被“点过图标”授权过？（同一 tab 内换站点也视为已授权）
    try {
      const resp = await chrome.runtime.sendMessage({ type: "CHECK_GRANTED", tabId });
      if (resp && resp.ok === true) {
        removeReauthBanner();   // 已授权 → 不提示
        return;
      }
    } catch (_) {
      // 后台没有实现 CHECK_GRANTED 时忽略，继续后面的静默检测
    }

    // --- ② 尝试 ping 已注入的内容脚本（已注入即视为可用）
    try {
      const ping = await chrome.tabs.sendMessage(tabId, { type: "PING_EXTRACTOR" });
      if (ping?.ok) { removeReauthBanner(); return; }
    } catch (_) {
      // ignore，进入下一步
    }

    // --- ③ 静默试探注入：只用来区分“真无权限”与“暂时未就绪”，不在这里抛 UI 错
    let injErr = "";
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["utils_extract.js"] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      // 注入成功后再 ping 一次确认
      try {
        const ping2 = await chrome.tabs.sendMessage(tabId, { type: "PING_EXTRACTOR" });
        if (ping2?.ok) { removeReauthBanner(); return; }
      } catch (_) { /* 继续判定 */ }
    } catch (e) {
      injErr = e?.message || String(e);
    }

    // --- ④ 只有能“明确识别为权限问题”才提示；否则静默
    const isPermError = /must request permission to access this host|Cannot access contents|prohibited|Extensions settings|Extension manifest must request permission/i.test(injErr);

    if (isPermError) {
      // 轻量防抖：1500ms 内不重复弹提示
      if (!window.__SX_LAST_REAUTH_TS) window.__SX_LAST_REAUTH_TS = 0;
      const now = Date.now();
      if (now - window.__SX_LAST_REAUTH_TS < 1500) return;
      window.__SX_LAST_REAUTH_TS = now;

      const host = (() => { try { return new URL(url).host; } catch { return "当前站点"; } })();
      showReauthBanner(host);
    } else {
      removeReauthBanner();
    }
  } catch {
    // 任意异常都不提示，避免打扰
  }
}

/* ============================
 * 标签页 URL 变化/加载完成：静默检测
 * ============================ */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 仅在 active 标签页上处理，且在 URL 变化或加载完成时触发
  if (!tab?.active) return;
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  debouncePerTab(tabId, () => silentCheckAndMaybePrompt(tabId, changeInfo.url));
});

/* ============================
 * 标签页切换：静默检测当前活动页
 * ============================ */
chrome.tabs.onActivated.addListener(({ tabId }) => {
  debouncePerTab(tabId, () => silentCheckAndMaybePrompt(tabId));
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

// 可选：状态更新时顺带刷新按钮文案（如果用户刚改了设置）
(async () => {
  try {
    const cfg = await getSettings();
    const newLabel = (cfg?.aiProvider === "trial") ? "试用摘要" : "提取并摘要";
    if (newLabel !== RUN_BTN_LABEL) {
      RUN_BTN_LABEL = newLabel;
      if (!$("btn-run")?.classList.contains("loading")) {
        $("btn-run").textContent = RUN_BTN_LABEL;
      }
    }
  } catch {}
})();