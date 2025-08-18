// background.js —— 两阶段：先出“摘要”(status: partial)，后出“可读正文”(status: done)
// 取消 sidepanel，改为页面悬浮面板；保留最小权限（activeTab 动态注入）

const lastUrlByTab = new Map();
const grantedTabs = new Set();

const DEFAULT_CONFIG = {
  baseURL: "https://api.openai.com/v1",
  model_extract: "gpt-4o-mini",
  model_summarize: "gpt-4o-mini",
  output_lang: "",
  extract_mode: "fast",
  task_mode: "summary",
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
async function injectIfNeeded(tabId) {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: "PING_EXTRACTOR" });
    if (ping?.ok) return;
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
  const cfg = await getSettings();
  if (!cfg.apiKey) throw new Error("请先到设置页填写并保存 API Key");

  await setState(tabId, { status: "running" });

  const { title, text, url, pageLang, markdown } = await getPageRawByTabId(tabId);
  const finalLang = resolveFinalLang(cfg.output_lang || "", pageLang, text);

  const quickMd = (typeof markdown === "string" && markdown.trim()) ? markdown : textToMarkdown(typeof text === "string" ? text : "");
  const sysForSummary = buildSystemPrompt({ custom: cfg.system_prompt_custom, preset: cfg.system_prompt_preset, finalLang, task: cfg.task_mode });

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

  await setState(tabId, {
    status: "partial",
    summary: summaryFast,
    cleaned: "",
    meta: { baseURL: cfg.baseURL, model_extract: cfg.model_extract, model_summarize: cfg.model_summarize, output_lang: finalLang, extract_mode: cfg.extract_mode, task_mode: cfg.task_mode }
  });

  // 正文
  let cleanedMarkdown = "";
  if (cfg.extract_mode === "fast") {
    const preferMd = (typeof markdown === "string" && markdown.trim().length > 0) ? markdown : textToMarkdown(typeof text === "string" ? text : "");
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
    cleanedMarkdown = await chatCompletion({ baseURL: cfg.baseURL, apiKey: cfg.apiKey, model: cfg.model_extract, system: sysClean, prompt: promptClean, temperature: 0.0 });
  }

  await setState(tabId, {
    status: "done",
    summary: summaryFast,
    cleaned: cleanedMarkdown,
    meta: { baseURL: cfg.baseURL, model_extract: cfg.model_extract, model_summarize: cfg.model_summarize, output_lang: finalLang, extract_mode: cfg.extract_mode, task_mode: cfg.task_mode }
  });
}

// ---- 与浮动面板通信
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 告诉 Chrome：这是异步响应
  let responded = false;
  const safeReply = (payload) => { if (!responded) { sendResponse(payload); responded = true; } };

  (async () => {
    if (msg?.type === "PANEL_GET_STATE" && typeof msg.tabId === "number") {
      const st = await getState(msg.tabId);
      safeReply({ ok: true, data: st });
      return;
    }

    if (msg?.type === "PANEL_RUN_FOR_TAB" && typeof msg.tabId === "number") {
      // 🚀 关键改动：**立刻**回复 ok，然后“后台异步”跑两阶段任务
      await setState(msg.tabId, { status: "running" }); // 抢先置 running
      safeReply({ ok: true });
      runForTab(msg.tabId).catch(async (e) => {
        await setState(msg.tabId, { status: "error", error: e?.message || String(e) });
      });
      return;
    }

    if (msg?.type === "GET_ACTIVE_TAB_ID") {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        safeReply({ ok: true, tabId: tab?.id ?? null });
      } catch (e) {
        safeReply({ ok: false, error: String(e) });
      }
      return;
    }

    if (msg?.type === "OPEN_OPTIONS") {
      try { await chrome.runtime.openOptionsPage(); } catch {}
      safeReply({ ok: true });
      return;
    }

    if (msg?.type === "GET_MODEL_INFO") {
      const cfg = await getSettings();
      safeReply({ ok: true, data: {
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

  return true; // 保持消息通道
});

/* ====================== 浮动面板注入与关闭 ====================== */
async function injectFloatPanel(tabId) {
  try { await injectIfNeeded(tabId); } catch {}
  await chrome.scripting.executeScript({ target: { tabId }, files: ["float_panel.js"] });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try { grantedTabs.add(tab.id); await injectFloatPanel(tab.id); }
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

// chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
//   if (!changeInfo.url && changeInfo.status !== "loading") return;
//   closeAllFloatPanels();
// });


chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // 只要开始加载或 URL 变化，就清掉该 tab 的缓存状态
  if (changeInfo.status === "loading" || changeInfo.url) {
    chrome.storage.session.remove(STATE_KEY(tabId));
  }

  if (!changeInfo.url && changeInfo.status !== "loading") return;
  closeAllFloatPanels();
});

chrome.tabs.onActivated.addListener(() => { closeAllFloatPanels(); });

chrome.tabs.onRemoved.addListener((tabId) => { grantedTabs.delete(tabId); lastUrlByTab.delete(tabId); });
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => { grantedTabs.delete(removedTabId); lastUrlByTab.delete(removedTabId); });