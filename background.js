// background.js —— 两阶段：先出“摘要”(status: partial)，后出“可读正文”(status: done)
// 取消 sidepanel，改为页面悬浮面板；保留最小权限（activeTab 动态注入）

// ✅ 改动 1：统一从 settings.js 读取配置（含 Trial 默认值）
import { getSettings } from "./settings.js";


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
  const cfg = await getSettings(); // ← 改动 2：统一从 settings.js 取（含 trial 默认）
  // 允许 trial 无 apiKey；非 trial 仍需 key
  const isTrial = (cfg.aiProvider === "trial");
  if (!cfg.apiKey && !isTrial) throw new Error("请先到设置页填写并保存 API Key");

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
      // 🚀 关键：立刻回复 ok，然后“后台异步”跑两阶段任务
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
  }

  if (!changeInfo.url && changeInfo.status !== "loading") return;
  closeAllFloatPanels();
});

chrome.tabs.onActivated.addListener(() => { closeAllFloatPanels(); });





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
      if (typeof tabId === 'number') inlineStateByTab.set(tabId, !!msg.inline);
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
  (async () => {
    if (msg?.type !== 'SX_FLOATPANEL_CLOSE') return;

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

  return true; // 异步
});