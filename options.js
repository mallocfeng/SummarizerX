// options.js —— 设置页（System Prompt、眼睛显示 Key、保存在最下）
import { DEFAULTS, PROVIDER_PRESETS, getSettings } from "./settings.js";

const $ = (id) => document.getElementById(id);

const GUIDE_URL = chrome.runtime.getURL('help_buy_api.html');
const GUIDE_OPENAI  = `${GUIDE_URL}#openai`;
const GUIDE_DEEPSEEK = `${GUIDE_URL}#deepseek`;

const PRESETS = {
  general_summary: "You are a precise assistant for distilling web articles. Be faithful and concise. Avoid speculation.",
  faithful_translation: "You are a professional translator. Preserve meaning, tone and technical terms faithfully. Avoid adding information.",
  tech_article_translation: "You are a technical translator for software articles. Keep code, commands and technical terms unchanged. Clarify ambiguous references."
};

// ========== 会话级“平台字段快照” ==========
const providerSnapshots = {}; // { provider: { apiKey, baseURL, model_extract, model_summarize, extract_mode } }
let currentProvider = null;

function snapshotCurrentProvider() {
  if (!currentProvider) return;
  providerSnapshots[currentProvider] = {
    apiKey: $("apiKey").value,
    baseURL: $("baseURL").value,
    model_extract: $("model_extract").value,
    model_summarize: $("model_summarize").value,
    extract_mode: $("extract_mode").value,
  };
}

function applySnapshot(provider) {
  const snap = providerSnapshots[provider];
  if (!snap) return false;
  $("apiKey").value = snap.apiKey ?? $("apiKey").value;
  $("baseURL").value = snap.baseURL ?? $("baseURL").value;
  $("model_extract").value = snap.model_extract ?? $("model_extract").value;
  $("model_summarize").value = snap.model_summarize ?? $("model_summarize").value;
  if (snap.extract_mode) $("extract_mode").value = snap.extract_mode;
  return true;
}

// Trial 锁定/隐藏（含：强制正文提取方式=fast，隐藏 BaseURL）
function setTrialLock(isLocked) {
  const $apiKey = $("apiKey");
  const $base   = $("baseURL");
  const $baseWrap = $("field-baseURL");     // 记得在 HTML 里为 BaseURL 外层包一个 id="field-baseURL"
  const $ext    = $("model_extract");
  const $sum    = $("model_summarize");
  const $eyeBtn = $("toggleKey");
  const $mode   = $("extract_mode");

  [$apiKey, $base, $ext, $sum].forEach(i => { if (i) i.disabled = !!isLocked; });
  if ($eyeBtn) $eyeBtn.disabled = !!isLocked;

  if ($mode) {
    if (isLocked) { $mode.value = "fast"; $mode.disabled = true; }
    else { $mode.disabled = false; }
  }
  if ($baseWrap) $baseWrap.classList.toggle("hidden", !!isLocked);

  const tip = isLocked ? "试用模式下此项已锁定。如需自定义，请切换到 OpenAI/DeepSeek/自定义。" : "";
  [$apiKey, $base, $ext, $sum, $mode].forEach(i => { if (i) i.title = tip; });
  if ($eyeBtn) $eyeBtn.title = tip;
}

function setStatus(text) { $("status").textContent = text; }
function setMeta(meta) {
  $("meta").textContent = `当前配置：provider=${meta.aiProvider}，extract=${meta.model_extract}，summary=${meta.model_summarize}，base=${meta.baseURL}，lang=${meta.output_lang || "auto"}，mode=${meta.extract_mode}`;
}

// 版本号 & 指南链接
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('app-version');
  if (el) {
    const { version, version_name } = chrome.runtime.getManifest();
    el.textContent = `v${version}`;
    el.title = version_name || version;
  }
  const $openaiGuide = document.getElementById('link-buy-openai');
  const $deepseekGuide = document.getElementById('link-buy-deepseek');
  if ($openaiGuide)  $openaiGuide.href  = GUIDE_OPENAI;
  if ($deepseekGuide) $deepseekGuide.href = GUIDE_DEEPSEEK;
});

function reflectGuideLink(){
  const p = $("aiProvider").value;
  const o = document.getElementById('link-buy-openai');
  const d = document.getElementById('link-buy-deepseek');
  if (!o || !d) return;
  if (p === "openai") { o.style.display = "inline"; d.style.display = "none"; }
  else if (p === "deepseek") { o.style.display = "none"; d.style.display = "inline"; }
  else if (p === "trial") { o.style.display = "none"; d.style.display = "none"; }
  else { o.style.display = "inline"; d.style.display = "inline"; }
}

// —— 只用 Markdown 的硬约束尾注（禁止 HTML 和内联样式）
function formatRulesSuffix() {
  return "\n\nFormatting rules (STRICT):\n" +
         "- Output must be **pure Markdown**. Do NOT use any HTML tags or inline CSS.\n" +
         "- Do not output <div>, <span>, <font>, <br>, <p>, style=... etc.\n" +
         "- Use fenced code blocks for code (```lang ... ```), and Markdown lists/headings/links only.\n" +
         "- Do not include color names, CSS, or inline styles in the content.\n";
}

function langSuffix() {
  const lang = ($("output_lang").value || "").toLowerCase();
  if (lang === "zh") return "\n\n请仅用中文输出结果。";
  if (lang === "en") return "\n\nRespond only in English.";
  return "\n\nEnsure the output strictly matches the target language.";
}

const PRESET_TEXT = {
  general_summary: "You are a precise assistant for distilling web articles. Be faithful and concise. Avoid speculation.",
  faithful_translation: "You are a professional translator. Preserve meaning, tone and technical terms faithfully. Avoid adding information.",
  tech_article_translation: "You are a technical translator for software articles. Keep code, commands and technical terms unchanged. Clarify ambiguous references."
};

function applyPresetToTextarea(force = false) {
  const box = $("system_prompt_custom");
  const presetKey = $("system_prompt_preset").value || "general_summary";
  const base = PRESET_TEXT[presetKey] || PRESET_TEXT.general_summary;
  const newText = base + formatRulesSuffix() + langSuffix();
  if (!box.value.trim() || force) box.value = newText;
}

/* =========================
 * 载入/保存
 * ========================= */
async function loadSettings() {
  const d = await getSettings(); // ← 统一读取（含 trial 默认）

  // 平台（默认 trial）
  const aiProvider = d.aiProvider || DEFAULTS.aiProvider;
  $("aiProvider").value = aiProvider;
  currentProvider = aiProvider;

  // 显示字段
  $("apiKey").value = d.apiKey || "";
  $("baseURL").value = d.baseURL || "";
  $("model_extract").value = d.model_extract || "";
  $("model_summarize").value = d.model_summarize || "";

  $("output_lang").value = d.output_lang || DEFAULTS.output_lang;
  $("extract_mode").value = d.extract_mode || DEFAULTS.extract_mode;

  if (aiProvider === "trial") setTrialLock(true); else setTrialLock(false);

  $("system_prompt_preset").value = d.system_prompt_preset || DEFAULTS.system_prompt_preset;
  if (d.system_prompt_custom && d.system_prompt_custom.trim()) {
    $("system_prompt_custom").value = d.system_prompt_custom;
  } else {
    applyPresetToTextarea(true);
  }

  setMeta({
    aiProvider,
    baseURL: $("baseURL").value,
    model_extract: $("model_extract").value,
    model_summarize: $("model_summarize").value,
    output_lang: $("output_lang").value,
    extract_mode: $("extract_mode").value
  });
  reflectGuideLink();
  updateBuyHelp(aiProvider);
  toggleBuyHelpInline(aiProvider);
}

async function saveSettings() {
  const aiProvider = $("aiProvider").value || DEFAULTS.aiProvider;

  // Trial：强制固定值
  if (aiProvider === "trial") {
    const p = PROVIDER_PRESETS.trial;
    $("apiKey").value = p.apiKeyFixed || "trial";
    $("baseURL").value = p.baseURL;
    $("model_extract").value = p.model_extract;
    $("model_summarize").value = p.model_summarize;
    $("extract_mode").value = "fast";
  }

  const payload = {
    aiProvider,
    apiKey: $("apiKey").value.trim(),
    baseURL: ($("baseURL").value.trim() || DEFAULTS.baseURL).replace(/\/+$/,""),
    model_extract: $("model_extract").value.trim(),
    model_summarize: $("model_summarize").value.trim(),
    output_lang: $("output_lang").value,
    extract_mode: $("extract_mode").value,
    system_prompt_preset: $("system_prompt_preset").value,
    system_prompt_custom: $("system_prompt_custom").value.trim()
  };

  // 同步保存平台专用 key（便于切换回填）
  const providerKeyName = PROVIDER_PRESETS[aiProvider]?.apiKeyKey;
  if (providerKeyName) payload[providerKeyName] = payload.apiKey;

  await chrome.storage.sync.set(payload);

  // 更新快照
  providerSnapshots[aiProvider] = {
    apiKey: payload.apiKey,
    baseURL: payload.baseURL,
    model_extract: payload.model_extract,
    model_summarize: payload.model_summarize,
    extract_mode: payload.extract_mode,
  };

  setStatus("已保存设置 ✅");
  setMeta(payload);
}

/* =========================
 * API Key 测试
 * ========================= */
async function testApiKey() {
  const cleanupSlash = (s="") => s.replace(/\/+$/,"");
  try {
    const provider = $("aiProvider").value;
    const key = $("apiKey").value.trim() || (provider === "trial" ? "trial" : "");
    const base = cleanupSlash($("baseURL").value.trim() || DEFAULTS.baseURL);
    const model = $("model_summarize").value.trim() || DEFAULTS.model_summarize;
    if (!key && provider !== "trial") throw new Error("请先输入 API Key");
    setStatus("⏳ 正在测试 API Key 与 Base URL…");

    const resp1 = await fetch(`${base}/models`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${key}` }
    });
    if (resp1.ok) { setStatus("✅ 测试通过：/models 可访问，Key 有效"); return; }

    const payload = { model, messages: [{ role: "user", content: "ping" }], temperature: 0 };
    const resp2 = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify(payload)
    });
    if (resp2.ok) { setStatus("✅ 测试通过：/chat/completions 可访问，Key 有效"); return; }

    const t1 = await safeReadText(resp1);
    const t2 = await safeReadText(resp2);
    throw new Error(`两种探测均失败。\n/models => ${resp1.status} ${t1}\n/chat/completions => ${resp2.status} ${t2}`);
  } catch (e) {
    setStatus("❌ 测试失败：" + (e?.message || String(e)));
  }
}
async function safeReadText(res) { try { return await res.text(); } catch { return "(no body)"; } }
function toggleApiKeyVisibility() { const input = $("apiKey"); input.type = input.type === "password" ? "text" : "password"; }

/* =========================
 * 平台切换 & 自定义检测
 * ========================= */
let isProgrammaticProviderChange = false;

async function onProviderChange() {
  if (isProgrammaticProviderChange) return;
  snapshotCurrentProvider();

  const provider = $("aiProvider").value || DEFAULTS.aiProvider;
  currentProvider = provider;

  // 回填快照或预设
  if (provider === "trial") {
    const p = PROVIDER_PRESETS.trial;
    $("apiKey").value = p.apiKeyFixed || "trial";
    $("baseURL").value = p.baseURL;
    $("model_extract").value = p.model_extract;
    $("model_summarize").value = p.model_summarize;
    $("extract_mode").value = "fast";
    setTrialLock(true);
  } else if (provider === "openai" || provider === "deepseek") {
    const restored = applySnapshot(provider);
    if (!restored) {
      const p = PROVIDER_PRESETS[provider];
      $("baseURL").value = p.baseURL;
      $("model_extract").value = p.model_extract;
      $("model_summarize").value = p.model_summarize;
      $("extract_mode").value = providerSnapshots[provider]?.extract_mode || $("extract_mode").value || DEFAULTS.extract_mode;
    }
    // 回填平台专用 key（若之前保存过）
    const keyName = PROVIDER_PRESETS[provider].apiKeyKey;
    const kv = await chrome.storage.sync.get([keyName]);
    $("apiKey").value = (providerSnapshots[provider]?.apiKey) || kv[keyName] || "";
    setTrialLock(false);
  } else {
    // custom
    const restored = applySnapshot("custom");
    if (!restored) {
      // 不动用户现有输入，若想初始化可按需填默认
      $("baseURL").value = $("baseURL").value || DEFAULTS.baseURL;
      $("model_extract").value = $("model_extract").value || DEFAULTS.model_extract;
      $("model_summarize").value = $("model_summarize").value || DEFAULTS.model_summarize;
      $("extract_mode").value = providerSnapshots.custom?.extract_mode || $("extract_mode").value || DEFAULTS.extract_mode;
    }
    setTrialLock(false);
  }

  setMeta({
    aiProvider: provider,
    baseURL: $("baseURL").value,
    model_extract: $("model_extract").value,
    model_summarize: $("model_summarize").value,
    output_lang: $("output_lang").value,
    extract_mode: $("extract_mode").value
  });
  reflectGuideLink();
  updateBuyHelp(provider);
  toggleBuyHelpInline(provider);
}

// 用户手动改 Base/模型 → 切自定义（Trial 不允许）
function markCustomIfManualChange() {
  const sel = $("aiProvider");
  if (sel.value === "trial") return;
  if (sel.value !== "custom") {
    snapshotCurrentProvider();
    isProgrammaticProviderChange = true;
    sel.value = "custom";
    isProgrammaticProviderChange = false;
    onProviderChange();
  }
}

function onPresetChange() {
  const box = $("system_prompt_custom");
  if (box.value.trim()) {
    if (confirm("自定义提示词已有内容，是否覆盖？")) applyPresetToTextarea(true);
  } else applyPresetToTextarea(true);
}
function onOutputLangChange() {
  const box = $("system_prompt_custom");
  if (box.value.trim()) {
    if (confirm("自定义提示词已有内容，是否根据新语言覆盖？")) applyPresetToTextarea(true);
  } else applyPresetToTextarea(true);
}

// 底栏适配
function fitDockPadding() {
  const dock = document.querySelector('.save-dock');
  const main = document.querySelector('.main-with-dock');
  const spacer = document.getElementById('dock-spacer');
  if (!dock || !main) return;
  const h = dock.getBoundingClientRect().height || 0;
  main.style.paddingBottom = `${h + 16}px`;
  if (spacer) spacer.style.height = `${h}px`;
}

function updateBuyHelp(provider) {
  const open = document.getElementById('link-buy-openai');
  const deep = document.getElementById('link-buy-deepseek');
  const sep  = document.getElementById('buy-help-sep');
  if (!open || !deep || !sep) return;

  open.href = GUIDE_OPENAI;
  deep.href = GUIDE_DEEPSEEK;

  if (provider === 'trial') { open.style.display='none'; deep.style.display='none'; sep.style.display='none'; return; }
  if (provider === 'custom') { open.style.display='inline'; deep.style.display='inline'; sep.style.display='inline'; }
  else if (provider === 'openai') { open.style.display='inline'; deep.style.display='none'; sep.style.display='none'; }
  else if (provider === 'deepseek') { open.style.display='none'; deep.style.display='inline'; sep.style.display='none'; }
  else { open.style.display='inline'; deep.style.display='inline'; sep.style.display='inline'; }
}

function toggleBuyHelpInline(provider){
  const help = document.querySelector('.buy-help-inline');
  if (!help) return;
  // 规则：Trial 隐藏，其它平台显示
  help.style.display = (provider === 'trial') ? 'none' : '';
}

document.addEventListener('DOMContentLoaded', () => {
  fitDockPadding();
  window.addEventListener('resize', fitDockPadding);
  const dock = document.querySelector('.save-dock');
  if (window.ResizeObserver && dock) {
    const ro = new ResizeObserver(() => fitDockPadding());
    ro.observe(dock);
  }
});

// (function(){
//   function toggleBuyHelp(){
//     const sel = document.getElementById('aiProvider');
//     const help = document.querySelector('.buy-help-inline');
//     if (!sel || !help) return;
//     help.style.display = (sel.value === 'trial') ? 'none' : '';
//   }
//   document.addEventListener('DOMContentLoaded', () => {
//     const sel = document.getElementById('aiProvider');
//     if (!sel) return;
//     toggleBuyHelp();              // 初始
//     sel.addEventListener('change', toggleBuyHelp); // 变更
//   });
// })();

/* =========================
 * 事件绑定
 * ========================= */
const $openShortcut = document.getElementById("open-shortcut");
if ($openShortcut) {
  $openShortcut.addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });
}

$("btn-save").addEventListener("click", saveSettings);
$("btn-test").addEventListener("click", testApiKey);
$("toggleKey").addEventListener("click", toggleApiKeyVisibility);
$("system_prompt_preset").addEventListener("change", onPresetChange);
$("output_lang").addEventListener("change", onOutputLangChange);
$("aiProvider").addEventListener("change", onProviderChange);
$("baseURL").addEventListener("input", markCustomIfManualChange);
$("model_extract").addEventListener("input", markCustomIfManualChange);
$("model_summarize").addEventListener("input", markCustomIfManualChange);

// 初始加载
loadSettings();