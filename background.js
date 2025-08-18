// background.js —— 两阶段：先出“摘要”(status: partial)，后出“可读正文”(status: done)
// 同时修复 sidePanel 打开顺序 & 去除重复 onClicked 监听；保留最小权限（activeTab 动态注入）


// 记录用户点击图标后“已授权”的 tab
//const grantedTabs = new Set();

// 记录每个 tab 最近一次已知 URL（用于判断是否导航）
const lastUrlByTab = new Map();

const DEFAULT_CONFIG = {
  baseURL: "https://api.openai.com/v1",
  model_extract: "gpt-4o-mini",
  model_summarize: "gpt-4o-mini",
  output_lang: "",          // "", "zh", "en"；空=自动
  extract_mode: "fast",     // "fast" | "ai"
  task_mode: "summary",     // "summary" | "translation"
  system_prompt_preset: "general_summary",
  system_prompt_custom: ""
};

const SYSTEM_PRESETS = {
  general_summary: "You are a precise assistant for distilling web articles. Be faithful and concise. Avoid speculation.",
  faithful_translation: "You are a professional translator. Preserve meaning, tone and technical terms faithfully. Avoid adding information.",
  tech_article_translation: "You are a technical translator for software articles. Keep code, commands and technical terms unchanged. Clarify ambiguous references."
};

// ---- 读设置
async function getSettings() {
  const d = await chrome.storage.sync.get([
    "apiKey","baseURL","model_extract","model_summarize",
    "output_lang","extract_mode","task_mode",
    "system_prompt_preset","system_prompt_custom"
  ]);
  return {
    apiKey: d.apiKey || "",
    baseURL: d.baseURL || DEFAULT_CONFIG.baseURL,
    model_extract: d.model_extract || DEFAULT_CONFIG.model_extract,
    model_summarize: d.model_summarize || DEFAULT_CONFIG.model_summarize,
    output_lang: (d.output_lang ?? DEFAULT_CONFIG.output_lang),
    extract_mode: d.extract_mode || DEFAULT_CONFIG.extract_mode,
    task_mode: d.task_mode || DEFAULT_CONFIG.task_mode,
    system_prompt_preset: d.system_prompt_preset || DEFAULT_CONFIG.system_prompt_preset,
    system_prompt_custom: d.system_prompt_custom || DEFAULT_CONFIG.system_prompt_custom
  };
}

// ---- 会话状态（按 tabId）
const S = chrome.storage.session;
const STATE_KEY = (tabId) => `panel_state_v3:${tabId}`;
// state: { status: 'idle'|'running'|'partial'|'done'|'error',
//          summary?: string, cleaned?: string, ts: number, error?: string, meta?: {...} }

async function getState(tabId) {
  const d = await S.get([STATE_KEY(tabId)]);
  return d[STATE_KEY(tabId)] || { status: "idle", ts: 0 };
}
async function setState(tabId, state) {
  const prev = await getState(tabId);
  await S.set({ [STATE_KEY(tabId)]: { ...prev, ...state, ts: Date.now() } });
  chrome.runtime.sendMessage({ type: "PANEL_STATE_UPDATED", tabId }).catch(()=>{});
}

/* ------------------------------------------------------------------
   内容抓取（按需注入，依赖 activeTab）
   1) 先 ping 内容脚本是否在；
   2) 不在则用 chrome.scripting.executeScript 注入 utils_extract.js + content.js；
   3) 注入后再 GET_PAGE_RAW；
   4) 对不支持注入的协议给出清晰错误。
------------------------------------------------------------------- */
async function injectIfNeeded(tabId) {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: "PING_EXTRACTOR" });
    if (ping?.ok) return; // 已注入
  } catch {}
  await chrome.scripting.executeScript({ target: { tabId }, files: ["utils_extract.js"] });
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
}

async function getPageRawByTabId(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const url = tab?.url || "";
  if (!/^https?:|^file:|^ftp:/i.test(url)) {
    throw new Error("此页面协议不支持抓取（如 chrome://、edge://、扩展页、Web Store、PDF 查看器等）。");
  }
  await injectIfNeeded(tabId);
  const res = await chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_RAW" }).catch(e => ({ ok:false, error: e?.message || String(e) }));
  if (!res?.ok) {
    if (/Cannot access contents|receiving end/i.test(res?.error || "")) {
      throw new Error("无法访问当前页内容。请先点击工具栏扩展图标打开侧栏后再尝试。");
    }
    throw new Error(res?.error || "抓取失败");
  }
  return res.payload; // { title, text, url, pageLang, markdown }
}

// ---- 语言工具
const isZhChar = (s) => /[\u4e00-\u9fff]/.test(s || "");
const langWord = (l) => (l === "zh" ? "Chinese" : "English");
const langLineEn = (l, isTrans) =>
  (isTrans
    ? `ALWAYS translate and output in ${langWord(l)} only.`
    : `ALWAYS output the final result in ${langWord(l)} only.`);
const langLineNative = (l) => (l === "zh" ? "请仅用中文输出结果。" : "Respond only in English.");

function resolveFinalLang(preferred, pageLang, rawText) {
  const pref = (preferred || "").toLowerCase();
  if (pref && pref !== "auto") return pref;
  const tag = (pageLang || "").toLowerCase();
  if (tag.startsWith("zh")) return "zh";
  if (isZhChar(rawText)) return "zh";
  return "en";
}

// ---- System Prompt 构造
function buildSystemPrompt({ custom, preset, finalLang, task }) {
  const base = (custom && custom.trim()) ? custom.trim() : (SYSTEM_PRESETS[preset] || SYSTEM_PRESETS.general_summary);
  const strict = "Be faithful to the source. Do not add or omit facts.";
  const l1 = langLineEn(finalLang, task === "translation");
  const l2 = langLineNative(finalLang);
  return [base, strict, l1, l2].join("\n");
}

function enforceUserLang(text, finalLang, isTrans) {
  const tail = isTrans
    ? `\n\nIMPORTANT: Output MUST be in ${langWord(finalLang)} only.`
    : `\n\nIMPORTANT: Respond ONLY in ${langWord(finalLang)}.`;
  return text + tail;
}

// ---- OpenAI Chat API
async function chatCompletion({ baseURL, apiKey, model, system, prompt, temperature = 0.1 }) {
  const url = `${baseURL.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model, temperature,
    messages: [system ? { role: "system", content: system } : null, { role: "user", content: prompt }].filter(Boolean)
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content || "";
}

/* ============ 工具：文本→极简 Markdown 段落 ============ */
function textToMarkdown(t = "") {
  const raw = String(t || "");
  const lines = raw.split(/\n/);
  const blocks = [];
  let buf = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (buf.length) { blocks.push(buf.join(" ").trim()); buf = []; }
    } else {
      buf.push(line.trim());
    }
  }
  if (buf.length) blocks.push(buf.join(" ").trim());
  return blocks.map(p => p).join("\n\n");
}

// ---- 主流程：两阶段（先“摘要”→partial；再“可读正文”→done）
async function runForTab(tabId) {
  const cfg = await getSettings();
  if (!cfg.apiKey) throw new Error("请先到设置页填写并保存 API Key");

  await setState(tabId, { status: "running" });

  const { title, text, url, pageLang, markdown } = await getPageRawByTabId(tabId);
  const finalLang = resolveFinalLang(cfg.output_lang || "", pageLang, text);

  // ====== 阶段 A：先生成“摘要”（用本地 md 或极简段落作输入，更快）
  const quickMd = (typeof markdown === "string" && markdown.trim())
    ? markdown
    : textToMarkdown(typeof text === "string" ? text : "");

  const sysForSummary = buildSystemPrompt({
    custom: cfg.system_prompt_custom,
    preset: cfg.system_prompt_preset,
    finalLang,
    task: cfg.task_mode
  });

  let summaryPrompt =
    `Based on the content below, produce:\n` +
    `1) 3–5 key bullet points\n` +
    `2) One-sentence conclusion or recommendation\n` +
    `3) 3–6 keywords\n\n` +
    `Content:\n${quickMd.slice(0, 18000)}`;
  summaryPrompt = enforceUserLang(summaryPrompt, finalLang, false);

  const summaryFast = await chatCompletion({
    baseURL: cfg.baseURL, apiKey: cfg.apiKey, model: cfg.model_summarize,
    system: sysForSummary, prompt: summaryPrompt, temperature: 0.1
  });

  // 先推摘要
  await setState(tabId, {
    status: "partial",
    summary: summaryFast,
    cleaned: "",
    meta: {
      baseURL: cfg.baseURL,
      model_extract: cfg.model_extract,
      model_summarize: cfg.model_summarize,
      output_lang: finalLang,
      extract_mode: cfg.extract_mode,
      task_mode: cfg.task_mode
    }
  });

  // ====== 阶段 B：生成“可读正文”
  let cleanedMarkdown = "";
  if (cfg.extract_mode === "fast") {
    const preferMd = (typeof markdown === "string" && markdown.trim().length > 0)
      ? markdown
      : textToMarkdown(typeof text === "string" ? text : "");

    const NOTICE_ZH = "当前“正文提取方式”为**本地快速模式**，以下正文为**原文**显示。若希望按目标语言显示正文，请在设置中将“正文提取方式”切换为 **AI 清洗模式**。";
    const NOTICE_EN = "Extract mode is **Local Fast**. The readable body below is shown **in the original language**. If you want the body to follow the target language, switch “Extract Mode” to **AI Clean** in Settings.";

    const noticeBlock = `:::notice
${finalLang === "zh" ? NOTICE_ZH : NOTICE_EN}
:::
`;

    const BODY_LIMIT = 50000;
    const body = (preferMd ? String(preferMd) : "").slice(0, BODY_LIMIT);
    cleanedMarkdown = (noticeBlock + "\n" + body).replace(/\n{3,}/g, "\n\n").trim();
  } else {
    const clipped = (text || "").slice(0, 20000);
    const sysClean = [
      "You are an article cleaner.",
      "Your job: remove navigation, ads, cookie banners, boilerplate, and duplicate fragments.",
      "PRESERVE the ORIGINAL sentences and wording. DO NOT paraphrase or summarize.",
      "Keep headings, lists, blockquotes, code fences, links, and tables.",
      "Output clean Markdown of the main body only.",
      langLineEn(finalLang, true),
      langLineNative(finalLang)
    ].join("\n");

    const promptClean =
      `Title: ${title || "(none)"}\nURL: ${url}\n\n` +
      `Raw content (possibly noisy):\n${clipped}\n\n` +
      `Return ONLY the cleaned main body as Markdown.`;

    cleanedMarkdown = await chatCompletion({
      baseURL: cfg.baseURL, apiKey: cfg.apiKey, model: cfg.model_extract,
      system: sysClean, prompt: promptClean, temperature: 0.0
    });
  }

  // 完成：补上正文并设为 done
  await setState(tabId, {
    status: "done",
    summary: summaryFast,
    cleaned: cleanedMarkdown,
    meta: {
      baseURL: cfg.baseURL,
      model_extract: cfg.model_extract,
      model_summarize: cfg.model_summarize,
      output_lang: finalLang,
      extract_mode: cfg.extract_mode,
      task_mode: cfg.task_mode
    }
  });
}

// ---- 与 sidepanel 通信
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "PANEL_GET_STATE" && typeof msg.tabId === "number") {
      const st = await getState(msg.tabId);
      sendResponse({ ok: true, data: st });
      return;
    }
    if (msg?.type === "PANEL_RUN_FOR_TAB" && typeof msg.tabId === "number") {
      try {
        await runForTab(msg.tabId);
        // 立刻回个 ok；实际 UI 通过状态广播刷新（partial→done）
        sendResponse({ ok: true });
      } catch (e) {
        await setState(msg.tabId, { status: "error", error: e?.message || String(e) });
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
      return;
    }
    if (msg?.type === "GET_MODEL_INFO") {
      const cfg = await getSettings();
      sendResponse({ ok: true, data: {
        baseURL: cfg.baseURL,
        model_extract: cfg.model_extract,
        model_summarize: cfg.model_summarize,
        output_lang: cfg.output_lang || "auto",
        extract_mode: cfg.extract_mode,
        task_mode: cfg.task_mode
      }});
      return;
    }
  })();
  return true;
});

// ---- 打开侧栏：封装复用（顺序 + 兜底）
async function openSidePanelForTab(tabId) {
  if (!chrome.sidePanel || !tabId) return;
  try {
    // 顺序 1：先 open 再 setOptions（多数版本稳定）
    await chrome.sidePanel.open({ tabId });
    await chrome.sidePanel.setOptions({ tabId, path: "sidepanel.html", enabled: true });
  } catch (err) {
    // 兜底顺序 2：先 setOptions 再 open
    try {
      await chrome.sidePanel.setOptions({ tabId, path: "sidepanel.html", enabled: true });
      await chrome.sidePanel.open({ tabId });
    } catch (e2) {
      console.error("[openSidePanelForTab] failed:", err, e2);
    }
  }
}

// 扩展图标点击：只保留这一处监听（去重）
// chrome.action.onClicked.addListener(async (tab) => {
//   if (!tab?.id) return;
//   await openSidePanelForTab(tab.id);
// });

// 快捷键（commands）：打开当前活动页的侧栏
// chrome.commands.onCommand.addListener(async (command) => {
//   if (command !== "open_sidepanel") return;
//   const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
//   if (active?.id) await openSidePanelForTab(active.id);
// });


// background.js
const grantedTabs = new Set();

// 当用户点击图标时，标记这个 tab 已授权
// chrome.action.onClicked.addListener((tab) => {
//   if (tab.id) {
//     grantedTabs.add(tab.id);
//     // 原有逻辑：执行 content.js 注入
//     chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["utils_extract.js"] });
//     chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
//   }
// });

chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) {
    grantedTabs.add(tab.id);
    // 可选：此处保持你现有的“尝试注入”，不强制
    // chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["utils_extract.js"] });
    // chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });

    // 打开 sidepanel（如果你已有 openSidePanelForTab，则复用）
    chrome.sidePanel?.setOptions?.({ tabId: tab.id, path: "sidepanel.html", enabled: true }).catch(()=>{});
    chrome.sidePanel?.open?.({ tabId: tab.id }).catch(()=>{});
  }
});



// 小防抖：避免多次事件频繁触发导致闪烁
const closeDebounce = new Map();
function debounceClose(tabId, fn, wait = 200) {
  if (closeDebounce.has(tabId)) clearTimeout(closeDebounce.get(tabId));
  const t = setTimeout(() => { closeDebounce.delete(tabId); fn(); }, wait);
  closeDebounce.set(tabId, t);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 只处理当前窗口的活动标签页
  if (!tab?.active) return;

  const urlChanged = typeof changeInfo.url === "string";
  const startedLoading = changeInfo.status === "loading";

  // 仅当发生导航或开始加载时触发关闭
  if (!urlChanged && !startedLoading) return;

  debounceClose(tabId, async () => {
    // 记录 URL 变化（可用于后续判断）
    if (urlChanged) {
      lastUrlByTab.set(tabId, changeInfo.url);
    }

    // 收起面板 + 清理授权，让用户必须重新点击
    grantedTabs.delete(tabId);
    await closeSidePanelForTab(tabId);
  });
});


chrome.tabs.onRemoved.addListener((tabId) => {
  grantedTabs.delete(tabId);
  lastUrlByTab.delete(tabId);
  if (closeDebounce.has(tabId)) clearTimeout(closeDebounce.get(tabId));
  closeDebounce.delete(tabId);
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  grantedTabs.delete(removedTabId);
  lastUrlByTab.delete(removedTabId);
});



async function closeSidePanelForTab(tabId) {
  try {
    // 设置 enabled:false 会收起 sidepanel
    await chrome.sidePanel.setOptions({ tabId, enabled: false });
  } catch (e) {
    // 少数旧版不支持 enabled:false，可忽略
  }
}

// 侧边栏或其他逻辑需要知道是否已授权
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "CHECK_GRANTED") {
    sendResponse({ ok: grantedTabs.has(msg.tabId) });
    return true;
  }
});

