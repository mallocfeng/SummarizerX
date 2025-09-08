// background.js —— 两阶段：先出“摘要”(status: partial)，后出“可读正文”(status: done)
// 取消 sidepanel，改为页面悬浮面板；保留最小权限（activeTab 动态注入）

// ✅ 改动 1：统一从 settings.js 读取配置（含 Trial 默认值）
import { getSettings } from "./settings.js";
import { FILTER_LISTS } from "./adblock_lists.js";


// ⬇️ 保留系统预设（可继续由本文件维护；若你也想统一到 settings.js，也可一起挪过去）
const SYSTEM_PRESETS = {
  general_summary: "You are a precise assistant for distilling web articles. Be faithful and concise. Avoid speculation.",
  faithful_translation: "You are a professional translator. Preserve meaning, tone and technical terms faithfully. Avoid adding information.",
  tech_article_translation: "You are a technical translator for software articles. Keep code, commands and technical terms unchanged. Clarify ambiguous references."
};

// ---- 会话状态（按 tabId）
const S = chrome.storage.session;
const STATE_KEY = (tabId) => `panel_state_v3:${tabId}`;

async function getState(tabId) {
  const d = await S.get([STATE_KEY(tabId)]);
  return d[STATE_KEY(tabId)] || { status: "idle", ts: 0 };
}
async function setState(tabId, state) {
  const prev = await getState(tabId);
  await S.set({ [STATE_KEY(tabId)]: { ...prev, ...state, ts: Date.now() } });
  chrome.runtime.sendMessage({ type: "PANEL_STATE_UPDATED", tabId }).catch(()=>{});
}

/* ------------------------------------------------------------------ */
// 兜底注入：大多数页面已通过 manifest.content_scripts 常驻注入
// 但为防在个别时序/站点下收不到消息，这里保留一次动态注入兜底（仅注入本地文件，合规）。
async function injectIfNeeded(tabId) {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: "PING_EXTRACTOR" });
    if (ping?.ok) return;
  } catch {}
  try { await chrome.scripting.executeScript({ target: { tabId }, files: ["utils_extract.js"] }); } catch {}
  try { await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }); } catch {}
}

async function getPageRawByTabId(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const url = tab?.url || "";
  if (!/^https?:|^file:|^ftp:/i.test(url)) {
    throw new Error("此页面协议不支持抓取（如 chrome://、edge://、扩展页、Web Store、PDF 查看器等）。");
  }
  // 常驻注入为主，这里兜底确保存在监听端
  const res = await chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_RAW" }).catch(e => ({ ok:false, error: e?.message || String(e) }));
  if (!res?.ok) {
    // 再尝试一次兜底注入后重发
    await injectIfNeeded(tabId);
    const res2 = await chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_RAW" }).catch(e => ({ ok:false, error: e?.message || String(e) }));
    if (res2?.ok) return res2.payload;
    if (/Cannot access contents|receiving end/i.test(res?.error || "")) {
      throw new Error("无法访问当前页内容。请先点击扩展图标在本页打开浮动面板后再尝试。");
    }
    throw new Error(res?.error || "抓取失败");
  }
  return res.payload; // { title, text, url, pageLang, markdown }
}

// ---- 语言工具
const isZhChar = (s) => /[\u4e00-\u9fff]/.test(s || "");
const langWord = (l) => (l === "zh" ? "Chinese" : "English");
const langLineEn = (l, isTrans) =>
  (isTrans ? `ALWAYS translate and output in ${langWord(l)} only.` : `ALWAYS output the final result in ${langWord(l)} only.`);
const langLineNative = (l) => (l === "zh" ? "请仅用中文输出结果。" : "Respond only in English.");

function resolveFinalLang(preferred, pageLang, rawText) {
  const pref = (preferred || "").toLowerCase();
  if (pref && pref !== "auto") return pref;
  const tag = (pageLang || "").toLowerCase();
  if (tag.startsWith("zh")) return "zh";
  if (isZhChar(rawText)) return "zh";
  return "en";
}

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

async function chatCompletion({ baseURL, apiKey, model, system, prompt, temperature = 0.1 }) {
  const url = `${baseURL.replace(/\/$/, "")}/chat/completions`;
  const body = { model, temperature, messages: [system ? { role: "system", content: system } : null, { role: "user", content: prompt }].filter(Boolean) };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content || "";
}

/* ============ 文本→极简 Markdown 段落 ============ */
function textToMarkdown(t = "") {
  const raw = String(t || "");
  const lines = raw.split(/\n/);
  const blocks = [];
  let buf = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (buf.length) { blocks.push(buf.join(" ").trim()); buf = []; }
    } else { buf.push(line.trim()); }
  }
  if (buf.length) blocks.push(buf.join(" ").trim());
  return blocks.map(p => p).join("\n\n");
}

// ---- 主流程
async function runForTab(tabId) {
  const cfg = await getSettings(); // ← 改动 2：统一从 settings.js 取（含 trial 默认）
  // 允许 trial 无 apiKey；非 trial 仍需 key
  const isTrial = (cfg.aiProvider === "trial");
  if (!cfg.apiKey && !isTrial) throw new Error("请先到设置页填写并保存 API Key");

  // Trial 模式需要显式同意：否则禁止将页面内容发送至代理
  if (isTrial) {
    try {
      const { trial_consent = false } = await chrome.storage.sync.get({ trial_consent: false });
      if (!trial_consent) {
        // 标记设置页需要高亮试用同意
        try { await chrome.storage.sync.set({ need_trial_consent_focus: true }); } catch {}
        try { await chrome.runtime.openOptionsPage(); } catch {}
        throw new Error("试用模式需先同意通过代理传输页面内容。请在设置页勾选同意，或切换到其他平台。");
      }
    } catch {}
  }

  await setState(tabId, { status: "running" });

  const { title, text, url, pageLang } = await getPageRawByTabId(tabId);
  const finalLang = resolveFinalLang(cfg.output_lang || "", pageLang, text);

  const quickMd = (typeof cfg?.markdown === "string" && cfg.markdown.trim())
    ? cfg.markdown
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
    baseURL: cfg.baseURL,      // trial 情况下，这里已经是你的代理地址（由 settings.js 提供）
    apiKey:  cfg.apiKey || "trial", // trial 没 key 用 “trial” 兜底；正常模式用用户 key
    model:   cfg.model_summarize,
    system:  sysForSummary,
    prompt:  summaryPrompt,
    temperature: 0.1
  });

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

  // 正文
  let cleanedMarkdown = "";
  if (cfg.extract_mode === "fast") {
    const preferMd = (typeof cfg?.markdown === "string" && cfg.markdown.trim().length > 0)
      ? cfg.markdown
      : textToMarkdown(typeof text === "string" ? text : "");
    const NOTICE_ZH = "当前“正文提取方式”为**本地快速模式**，以下正文为**原文**显示。若希望按目标语言显示正文，请在设置中将“正文提取方式”切换为 **AI 清洗模式**。";
    const NOTICE_EN = "Extract mode is **Local Fast**. The readable body below is shown **in the original language**. If you want the body to follow the target language, switch “Extract Mode” to **AI Clean** in Settings.";
    const noticeBlock = `:::notice\n${finalLang === "zh" ? NOTICE_ZH : NOTICE_EN}\n:::\n`;
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
    const promptClean = `Title: ${title || "(none)"}\nURL: ${url}\n\nRaw content (possibly noisy):\n${clipped}\n\nReturn ONLY the cleaned main body as Markdown.`;
    cleanedMarkdown = await chatCompletion({
      baseURL: cfg.baseURL,
      apiKey:  cfg.apiKey || "trial",
      model:   cfg.model_extract,
      system:  sysClean,
      prompt:  promptClean,
      temperature: 0.0
    });
  }

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

/* --------------------------------------------------------------- */
// uBO-style network redirection/blocking for video ads on news/portal sites
// We use MV3 Declarative Net Request to:
// 1) Redirect certain ad SDKs/modules to local no-op stubs (to avoid breaking players)
// 2) Block ad SDKs/ad servers when initiator is a known site (site packages)
async function setupVideoAdDNRRules() {
  const rules = [
    // Redirect Betamax ads module to an empty stub to avoid ad initialization
    {
      id: 2001,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { extensionPath: "/stubs/nyt-betamax-ads-stub.js" }
      },
      condition: {
        regexFilter: "^https://static01\\.nyt\\.com/video-static/betamax/ads-.*\\.js",
        resourceTypes: ["script"],
        initiatorDomains: ["www.nytimes.com","nytimes.com"]
      }
    },
    // Block GPT library when loaded from nytimes pages
    {
      id: 2002,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: "^https://(securepubads\\.g\\.doubleclick\\.net|pagead2\\.googlesyndication\\.com)/",
        resourceTypes: ["script"],
        initiatorDomains: ["www.nytimes.com","nytimes.com"]
      }
    },
    // Block Amazon A9 apstag from nytimes pages
    {
      id: 2003,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: "^https://c\\.amazon-adsystem\\.com/aax2/apstag\\.js",
        resourceTypes: ["script"],
        initiatorDomains: ["www.nytimes.com","nytimes.com"]
      }
    },
    // Block Media.net client script from nytimes pages
    {
      id: 2004,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: "^https://warp\\.media\\.net/js/tags/clientag\\.js",
        resourceTypes: ["script"],
        initiatorDomains: ["www.nytimes.com","nytimes.com"]
      }
    },

    // ---- Generic site packages: CNN, Reuters, Bloomberg, Guardian, Yahoo, CNET ----
    // Redirect IMA3 SDK to no-op stub (safer than outright blocking) for these sites
    {
      id: 2101,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { extensionPath: "/stubs/ima3-empty.js" }
      },
      condition: {
        regexFilter: "^https://imasdk\\.googleapis\\.com/js/sdkloader/ima3\\.js",
        resourceTypes: ["script"],
        initiatorDomains: [
          "www.cnn.com","edition.cnn.com","cnn.com",
          "www.reuters.com","reuters.com",
          "www.bloomberg.com","bloomberg.com",
          "www.theguardian.com","theguardian.com",
          "news.yahoo.com","finance.yahoo.com","www.yahoo.com","yahoo.com",
          "www.cnet.com","cnet.com"
        ]
      }
    },
    // Block FreeWheel SDK/requests for these sites
    {
      id: 2102,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: "^https://[a-z0-9.-]*fwmrm\\.net/",
        resourceTypes: ["script","xmlhttprequest","media"],
        initiatorDomains: [
          "www.cnn.com","edition.cnn.com","cnn.com",
          "www.reuters.com","reuters.com",
          "www.bloomberg.com","bloomberg.com",
          "www.theguardian.com","theguardian.com",
          "news.yahoo.com","finance.yahoo.com","www.yahoo.com","yahoo.com",
          "www.cnet.com","cnet.com"
        ]
      }
    },
    // Block GPT on these sites (optional; can reduce pre-roll triggers)
    {
      id: 2103,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: "^https://(securepubads\\.g\\.doubleclick\\.net|pagead2\\.googlesyndication\\.com)/",
        resourceTypes: ["script"],
        initiatorDomains: [
          "www.cnn.com","edition.cnn.com","cnn.com",
          "www.reuters.com","reuters.com",
          "www.bloomberg.com","bloomberg.com",
          "www.theguardian.com","theguardian.com",
          "news.yahoo.com","finance.yahoo.com","www.yahoo.com","yahoo.com",
          "www.cnet.com","cnet.com"
        ]
      }
    },
    // Block Amazon A9 on these sites
    {
      id: 2104,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: "^https://c\\.amazon-adsystem\\.com/aax2/apstag\\.js",
        resourceTypes: ["script"],
        initiatorDomains: [
          "www.cnn.com","edition.cnn.com","cnn.com",
          "www.reuters.com","reuters.com",
          "www.bloomberg.com","bloomberg.com",
          "www.theguardian.com","theguardian.com",
          "news.yahoo.com","finance.yahoo.com","www.yahoo.com","yahoo.com",
          "www.cnet.com","cnet.com"
        ]
      }
    },
    // Block Media.net on these sites (seen on some portals)
    {
      id: 2105,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: "^https://warp\\.media\\.net/js/tags/clientag\\.js",
        resourceTypes: ["script"],
        initiatorDomains: [
          "news.yahoo.com","finance.yahoo.com","www.yahoo.com","yahoo.com",
          "www.cnet.com","cnet.com"
        ]
      }
    }
  ];

  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const targetIds = rules.map(r => r.id);
    const toRemove = existing.filter(r => targetIds.includes(r.id)).map(r => r.id);
    if (toRemove.length) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove, addRules: [] });
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules, removeRuleIds: [] });
  } catch (e) {
    console.warn('DNR setup failed:', e);
  }
}

chrome.runtime.onInstalled.addListener(() => { setupVideoAdDNRRules(); });
if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(() => { setupVideoAdDNRRules(); });

// ---- 与浮动面板通信
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 仅对本监听器支持的消息返回 true（异步），避免阻塞其他监听器的响应
  let responded = false;
  const safeReply = (payload) => { if (!responded) { sendResponse(payload); responded = true; } };

  if (msg?.type === "PANEL_GET_STATE" && typeof msg.tabId === "number") {
    (async () => {
      const st = await getState(msg.tabId);
      safeReply({ ok: true, data: st });
    })();
    return true;
  }

  if (msg?.type === "PANEL_RUN_FOR_TAB" && typeof msg.tabId === "number") {
    (async () => {
      await setState(msg.tabId, { status: "running" });
      safeReply({ ok: true });
      runForTab(msg.tabId).catch(async (e) => {
        await setState(msg.tabId, { status: "error", error: e?.message || String(e) });
      });
    })();
    return true;
  }

  if (msg?.type === "GET_ACTIVE_TAB_ID") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        safeReply({ ok: true, tabId: tab?.id ?? null });
      } catch (e) {
        safeReply({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "OPEN_OPTIONS") {
    (async () => {
      try { await chrome.runtime.openOptionsPage(); } catch {}
      safeReply({ ok: true });
    })();
    return true;
  }

  // 未处理的消息：让其它监听器接管（返回 false）
  return false;
});

/* ====================== 广告过滤：规则下载与缓存 ====================== */
let adblockUpdateTimer = null;

function listMap() {
  const m = new Map();
  FILTER_LISTS.forEach(x => m.set(x.id, x));
  return m;
}

async function downloadText(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-cache', credentials: 'omit' });
  const text = await safeReadText(res);
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status}`);
    e.status = res.status;
    e.body = text?.slice(0, 300) || '';
    throw e;
  }
  return text;
}

async function downloadAdblockRules(selectedIds = []) {
  const idSet = new Set((selectedIds || []).filter(Boolean));
  if (idSet.size === 0) {
    await chrome.storage.local.set({ adblock_rules: {}, adblock_last_update: Date.now(), adblock_error: null });
    return;
  }
  const map = listMap();
  const results = {};
  const errors = [];
  for (const id of idSet) {
    const item = map.get(id);
    if (!item) continue;
    try {
      const txt = await downloadText(item.url);
      results[id] = { id, url: item.url, name: item.name, size: txt.length, updatedAt: Date.now(), content: txt };
    } catch (e) {
      errors.push(`${id}: ${e?.message || e}`);
    }
  }
  await chrome.storage.local.set({ adblock_rules: results, adblock_last_update: Date.now(), adblock_error: errors.length ? errors.join('\n') : null });
}

function scheduleAdblockUpdate(reason) {
  if (adblockUpdateTimer) { clearTimeout(adblockUpdateTimer); }
  adblockUpdateTimer = setTimeout(async () => {
    try {
      const { adblock_enabled = false, adblock_selected = [] } = await chrome.storage.sync.get({ adblock_enabled: false, adblock_selected: [] });
      if (!adblock_enabled) return;
      await downloadAdblockRules(adblock_selected);
    } catch (e) {
      try { await chrome.storage.local.set({ adblock_error: e?.message || String(e) }); } catch {}
    }
  }, 500); // 简单防抖
}

// 存储变化时触发下载
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.adblock_enabled || changes.adblock_selected) {
      scheduleAdblockUpdate('storage_changed');
    }
  });
} catch {}

// 启动时若启用则刷新一次
(async () => {
  try {
    const { adblock_enabled = false } = await chrome.storage.sync.get({ adblock_enabled: false });
    if (adblock_enabled) scheduleAdblockUpdate('startup');
  } catch {}
})();

// 单条规则下载（供设置页点击“同步”）
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'ADBLOCK_DOWNLOAD_ONE') return; // 其他消息不处理

  (async () => {
    try {
      const id = String(msg.id || '');
      const m = listMap();
      let item = m.get(id);
      // 兼容：若列表未在后台映射（例如新增后未刷新后台），允许使用前端传入的 url/name
      if (!item) {
        const url = typeof msg.url === 'string' ? msg.url : '';
        const name = typeof msg.name === 'string' ? msg.name : id;
        if (!url) throw new Error('Unknown list');
        item = { id, url, name };
      }
      const txt = await downloadText(item.url);
      const now = Date.now();
      // 合并更新 storage.local
      const { adblock_rules = {} } = await chrome.storage.local.get({ adblock_rules: {} });
      adblock_rules[id] = { id, url: item.url, name: item.name, size: txt.length, updatedAt: now, content: txt };
      await chrome.storage.local.set({ adblock_rules, adblock_last_update: now });
      sendResponse?.({ ok: true, id, size: txt.length, updatedAt: now });
    } catch (e) {
      sendResponse?.({ ok: false, error: e?.message || String(e), status: e?.status || null, body: e?.body || '' });
    }
  })();

  return true; // 异步
});

/* ====================== 浮动面板注入与关闭 ====================== */
async function injectFloatPanel(tabId) {
  try { await injectIfNeeded(tabId); } catch {}
  await chrome.scripting.executeScript({ target: { tabId }, files: ["float_panel.js"] });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try { await injectFloatPanel(tab.id); }
  catch (e) { console.warn("injectFloatPanel failed:", e); }
});

async function closeAllFloatPanels() {
  try {
    const wins = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
    for (const w of wins) {
      for (const t of (w.tabs || [])) {
        if (t.id != null) {
          chrome.tabs.sendMessage(t.id, { type: "SX_CLOSE_FLOAT_PANEL" }).catch(()=>{});
        }
      }
    }
  } catch {}
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // 只要开始加载或 URL 变化，就清掉该 tab 的缓存状态
  if (changeInfo.status === "loading" || changeInfo.url) {
    chrome.storage.session.remove(STATE_KEY(tabId));
    // 重置“全文翻译内联”状态，避免新页面沿用旧状态
    try { inlineStateByTab.set(tabId, false); } catch {}
  }

  if (!changeInfo.url && changeInfo.status !== "loading") return;
  closeAllFloatPanels();
});

chrome.tabs.onActivated.addListener(() => { closeAllFloatPanels(); });

// 标签页关闭时清理状态
try {
  chrome.tabs.onRemoved.addListener((tabId) => {
    try { inlineStateByTab.delete(tabId); } catch {}
  });
} catch {}





// ===== SummarizerX — Selection Translate (context menu) =====

// 菜单常量
const MENU_ID_TRANSLATE = 'sx_translate_selection';
const MENU_ID_TRANSLATE_FULL = 'sx_translate_full';
// 记录各 tab 是否已处于“全文对照翻译插入”状态
const inlineStateByTab = new Map(); // tabId -> boolean

// 根据设置返回目标语言 'zh' | 'en'（默认 zh）
async function getTargetLang() {
  const { output_lang = 'zh' } = await chrome.storage.sync.get({ output_lang: 'zh' });
  const v = String(output_lang || '').trim().toLowerCase();
  if (['en','en-us','english','英语','英語'].includes(v)) return 'en';
  return 'zh';
}

// 创建/更新右键菜单（标题随设置语言变化）
async function ensureContextMenu() {
  try { await chrome.contextMenus.remove(MENU_ID_TRANSLATE); } catch {}
  try { await chrome.contextMenus.remove(MENU_ID_TRANSLATE_FULL); } catch {}
  
  // 获取UI语言设置
  const { ui_language = 'zh' } = await chrome.storage.sync.get({ ui_language: 'zh' });
  const targetLang = await getTargetLang();
  
  let title;
  if (ui_language === 'en') {
    title = targetLang === 'en' 
      ? 'SummarizerX: Translate selection → English'
      : 'SummarizerX: Translate selection → Chinese';
  } else {
    title = targetLang === 'en' 
      ? 'SummarizerX：翻译所选文本 → 英文'
      : 'SummarizerX：翻译所选文本 → 中文';
  }
  
  chrome.contextMenus.create({
    id: MENU_ID_TRANSLATE,
    title,
    contexts: ['selection']
  });

  // Full-page inline translation（默认：翻译；若已翻译，则在 onShown 动态改“显示原文”）
  let fullTitle;
  if (ui_language === 'en') {
    fullTitle = targetLang === 'en'
      ? 'SummarizerX: Translate full page (inline → English)'
      : 'SummarizerX: Translate full page (inline → Chinese)';
  } else {
    fullTitle = targetLang === 'en'
      ? 'SummarizerX：全文翻译（段落对照 → 英文）'
      : 'SummarizerX：全文翻译（段落对照 → 中文）';
  }

  chrome.contextMenus.create({
    id: MENU_ID_TRANSLATE_FULL,
    title: fullTitle,
    contexts: ['page']
  });

  // 利用 onShown 动态切换标题
}

// 动态变更“全文翻译/显示原文”的标题
chrome.contextMenus.onShown?.addListener(async (info, tab) => {
  try{
    if (!tab?.id) return;
    const inline = inlineStateByTab.get(tab.id) === true;
    const { ui_language = 'zh' } = await chrome.storage.sync.get({ ui_language: 'zh' });
    let title = '';
    if (inline) {
      title = (ui_language === 'en') ? 'SummarizerX: Restore original (remove inline translations)'
                                    : 'SummarizerX：显示原文（移除对照翻译）';
    } else {
      const targetLang = await getTargetLang();
      title = (ui_language === 'en')
        ? (targetLang === 'en' ? 'SummarizerX: Translate full page (inline → English)' : 'SummarizerX: Translate full page (inline → Chinese)')
        : (targetLang === 'en' ? 'SummarizerX：全文翻译（段落对照 → 英文）' : 'SummarizerX：全文翻译（段落对照 → 中文）');
    }
    chrome.contextMenus.update(MENU_ID_TRANSLATE_FULL, { title });
    chrome.contextMenus.refresh?.();
  }catch{}
});

// 安装/启动时建一次；设置变化时也更新标题
chrome.runtime.onInstalled.addListener(ensureContextMenu);
chrome.runtime.onStartup?.addListener?.(ensureContextMenu);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.output_lang || changes.ui_language)) {
    ensureContextMenu();
  }
});

// 右键点击：让内容脚本执行翻译动作
// chrome.contextMenus.onClicked.addListener(async (info, tab) => {
//   if (info.menuItemId !== MENU_ID_TRANSLATE || !tab?.id) return;
//   chrome.tabs.sendMessage(tab.id, { type: 'SX_TRANSLATE_SELECTION' });
// });

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === MENU_ID_TRANSLATE) {
    try { await chrome.tabs.sendMessage(tab.id, { type: 'SX_CLOSE_FLOAT_PANEL' }); } catch {}
    chrome.tabs.sendMessage(tab.id, { type: 'SX_TRANSLATE_SELECTION' });
    return;
  }
  if (info.menuItemId === MENU_ID_TRANSLATE_FULL) {
    const inline = inlineStateByTab.get(tab.id) === true;
    try { await chrome.tabs.sendMessage(tab.id, { type: 'SX_CLOSE_FLOAT_PANEL' }); } catch {}
    // 立即切换本地状态并更新菜单标题（无需等待前端完成），确保下一次右键立刻看到切换后的文案
    inlineStateByTab.set(tab.id, !inline);
    try {
      const { ui_language = 'zh' } = await chrome.storage.sync.get({ ui_language: 'zh' });
      let title = '';
      if (!inline) {
        // 我们将要“插入翻译”，所以切到“显示原文”
        title = (ui_language === 'en') ? 'SummarizerX: Restore original (remove inline translations)'
                                      : 'SummarizerX：显示原文（移除对照翻译）';
      } else {
        const targetLang = await getTargetLang();
        title = (ui_language === 'en')
          ? (targetLang === 'en' ? 'SummarizerX: Translate full page (inline → English)' : 'SummarizerX: Translate full page (inline → Chinese)')
          : (targetLang === 'en' ? 'SummarizerX：全文翻译（段落对照 → 英文）' : 'SummarizerX：全文翻译（段落对照 → 中文）');
      }
      chrome.contextMenus.update(MENU_ID_TRANSLATE_FULL, { title });
      chrome.contextMenus.refresh?.();
    } catch {}
    chrome.tabs.sendMessage(tab.id, { type: inline ? 'SX_RESTORE_FULL_PAGE' : 'SX_TRANSLATE_FULL_PAGE' });
    return;
  }
});


// —— 统一的后台翻译执行（内容脚本发消息到这里）——
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SX_TRANSLATE_REQUEST') {
    (async () => {
      try {
        const res = await doTranslate(msg.text);
        sendResponse({ ok: true, result: res });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true; // 异步
  }
  if (msg?.type === 'SX_INLINE_TRANSLATED_CHANGED') {
    try {
      const tabId = sender?.tab?.id;
      if (typeof tabId === 'number') {
        const inline = !!msg.inline;
        inlineStateByTab.set(tabId, inline);
        // 即时更新菜单标题（提高可见一致性）
        (async () => {
          try {
            const { ui_language = 'zh' } = await chrome.storage.sync.get({ ui_language: 'zh' });
            const targetLang = await getTargetLang();
            let title = '';
            if (inline) {
              title = (ui_language === 'en') ? 'SummarizerX: Restore original (remove inline translations)'
                                            : 'SummarizerX：显示原文（移除对照翻译）';
            } else {
              title = (ui_language === 'en')
                ? (targetLang === 'en' ? 'SummarizerX: Translate full page (inline → English)' : 'SummarizerX: Translate full page (inline → Chinese)')
                : (targetLang === 'en' ? 'SummarizerX：全文翻译（段落对照 → 英文）' : 'SummarizerX：全文翻译（段落对照 → 中文）');
            }
            chrome.contextMenus.update(MENU_ID_TRANSLATE_FULL, { title });
            chrome.contextMenus.refresh?.();
          } catch {}
        })();
      }
    } catch {}
  }
});

// 实际的翻译实现：读取设置，选模型/基址/Key，然后 Chat Completions
async function doTranslate(text) {
  const all = await chrome.storage.sync.get(null);

  // 平台与凭据
  const provider = all.aiProvider || 'trial';
  const key = provider === 'trial'
    ? 'trial'
    : (all.apiKey || all.openai_api_key || all.deepseek_api_key || '');
  const base = (all.baseURL || 'https://api.openai.com/v1').replace(/\/+$/,'');
  const model = all.model_summarize || 'gpt-4o-mini';

  const target = await getTargetLang(); // 'zh' | 'en'
  const strictRules = [
    'RULES:',
    '- Output PLAIN TEXT only. No Markdown, no quotes, no brackets, no lists.',
    '- Do NOT add explanations, notes, comments, or any extra words.',
    '- No prefixes/suffixes (e.g., "Translation:").',
    '- Preserve original paragraph breaks; do not merge or split.',
    '- Do not use code fences or HTML.',
    '- Translate faithfully; do not omit or add content.'
  ].join('\n');
  const instruction = (target === 'en')
    ? 'Translate the following into English.'
    : '将以下内容翻译为简体中文。';
  const prompt = `${instruction}\n${strictRules}\n\nSOURCE:\n${text}`;

  const body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0 };

  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const tx = await safeReadText(resp);
    throw new Error(`HTTP ${resp.status} ${tx}`);
  }
  const json = await resp.json();
  return json?.choices?.[0]?.message?.content?.trim() || '(Empty)';
}

async function safeReadText(res){ try { return await res.text(); } catch { return ''; } }





// 统一处理：收到“关闭浮窗/侧边栏”消息时：
// 1) 尝试关闭该 tab 的 Side Panel（如果有）
// 2) 通知该 tab 的内容脚本移除“浮动面板”DOM（不动翻译气泡）
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'SX_FLOATPANEL_CLOSE') return false; // 非本消息交给其他监听器

  (async () => {
    try {
      // 优先用消息来源 tabId；否则取当前活动 tab
      let tabId = sender?.tab?.id;
      if (typeof tabId !== 'number') {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (active?.id) tabId = active.id;
      }

      // 1) 关 Side Panel（可用就关）
      if (typeof tabId === 'number' && chrome.sidePanel?.setOptions) {
        try { await chrome.sidePanel.setOptions({ tabId, enabled: false }); } catch {}
      }

      // 2) 通知页面删除浮动面板根节点（id 如 #sx-float-panel）
      if (typeof tabId === 'number') {
        try { await chrome.tabs.sendMessage(tabId, { type: 'SX_CLOSE_FLOAT_PANEL' }); } catch {}
      }

      sendResponse?.({ ok: true });
    } catch (e) {
      sendResponse?.({ ok: false, error: e?.message || String(e) });
    }
  })();

  return true; // 异步，仅处理本类型
});
