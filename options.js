// options.js —— 设置页（System Prompt、眼睛显示 Key、保存在最下）
import { DEFAULTS, PROVIDER_PRESETS, getSettings } from "./settings.js";
import { getCurrentLanguage, t, tSync, updatePageLanguage } from "./i18n.js";

const $ = (id) => document.getElementById(id);

const GUIDE_URL = chrome.runtime.getURL('help_buy_api.html');
const GUIDE_OPENAI  = `${GUIDE_URL}#openai`;
const GUIDE_DEEPSEEK = `${GUIDE_URL}#deepseek`;

// 说明：PRESETS 已由 PRESET_TEXT 统一管理；移除重复未使用的 PRESETS 常量

// ========= 主题切换（自动 / 浅色 / 深色） =========
const THEME_STORAGE_KEY = 'options_theme_override';
// 与浮窗一致，保持两处选择同步（面板使用 float_theme_override）
const FLOAT_THEME_KEY = 'float_theme_override';

function computeAutoTheme(){
  try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
}
function applyDocumentTheme(mode){
  const m = (mode === 'auto') ? computeAutoTheme() : (mode || 'light');
  // 将主题写到 <html data-theme="..."></html>
  document.documentElement.setAttribute('data-theme', m === 'dark' ? 'dark' : 'light');
}
function markOptionsThemeButtonsActive(mode){
  const wrap = document.getElementById('opt-theme');
  if (!wrap) return;
  // 兼容任意带 data-mode 的按钮/图标，不再强依赖 .theme-btn 类
  wrap.querySelectorAll('[data-mode]')
    .forEach(b => {
      const on = b.getAttribute('data-mode') === mode;
      if (b.classList) b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
}
function initOptionsThemeToggle(){
  // 幂等初始化：当 #opt-theme 尚未渲染时，等待其出现
  const doInit = () => {
    const wrap = document.getElementById('opt-theme');
    if (!wrap || wrap.__sx_inited) return;
    wrap.__sx_inited = true;

    // 初始：读取存储并应用（优先 options，其次浮窗，最后 auto）
    chrome.storage.sync.get([THEME_STORAGE_KEY, FLOAT_THEME_KEY]).then((all) => {
      const optVal = all[THEME_STORAGE_KEY];
      const floatVal = all[FLOAT_THEME_KEY];
      const current = ['auto','light','dark'].includes(optVal)
        ? optVal
        : (['auto','light','dark'].includes(floatVal) ? floatVal : 'auto');
      markOptionsThemeButtonsActive(current);
      applyDocumentTheme(current);
      // 若 options 还未设置，但浮窗有值，则写回 options，保持后续一致
      if (!['auto','light','dark'].includes(optVal) && ['auto','light','dark'].includes(floatVal)) {
        chrome.storage.sync.set({ [THEME_STORAGE_KEY]: current }).catch(()=>{});
      }
    }).catch(() => {
      markOptionsThemeButtonsActive('auto');
      applyDocumentTheme('auto');
    });

    // 点击切换（识别任意 data-mode 元素）
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('#opt-theme [data-mode]');
      if (!btn) return;
      const mode = btn.getAttribute('data-mode');
      if (!['auto','light','dark'].includes(mode)) return;
      // 两处存储同时写，保持浮窗与设置页一致
      chrome.storage.sync.set({ [THEME_STORAGE_KEY]: mode, [FLOAT_THEME_KEY]: mode }).catch(()=>{});
      markOptionsThemeButtonsActive(mode);
      applyDocumentTheme(mode);
    });

    // 自动模式下跟随系统切换
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        chrome.storage.sync.get([THEME_STORAGE_KEY]).then((all) => {
          if (all[THEME_STORAGE_KEY] === 'auto') applyDocumentTheme('auto');
        }).catch(()=>{});
      };
      if (mq && mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq && mq.addListener) mq.addListener(onChange);
    } catch {}
  };

  // 1) 立即尝试一次
  doInit();

  // 2) 若此时尚无 #opt-theme，则监听 DOM，出现后再初始化（只触发一次）
  if (!document.getElementById('opt-theme') && window.MutationObserver) {
    const mo = new MutationObserver(() => {
      if (document.getElementById('opt-theme')) {
        try { doInit(); } finally { mo.disconnect(); }
      }
    });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }

  // 3) 监听存储变化：当浮窗或其他页切换主题时，设置页（若已打开）立即联动
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      const hasOpt = !!changes[THEME_STORAGE_KEY];
      const hasFloat = !!changes[FLOAT_THEME_KEY];
      if (!hasOpt && !hasFloat) return;
      const next = (changes[THEME_STORAGE_KEY]?.newValue)
        ?? (changes[FLOAT_THEME_KEY]?.newValue);
      if (!['auto','light','dark'].includes(next)) return;
      // 应用到文档与按钮高亮
      applyDocumentTheme(next);
      markOptionsThemeButtonsActive(next);
    });
  } catch {}
}

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
async function setTrialLock(isLocked) {
  const $apiKey = $("apiKey");
  const $base   = $("baseURL");
  const $baseWrap = $("field-baseURL");     // 记得在 HTML 里为 BaseURL 外层包一个 id="field-baseURL"
  const $ext    = $("model_extract");
  const $sum    = $("model_summarize");
  const $eyeBtn = $("toggleKey");
  const $mode   = $("extract_mode");

  // 当进入试用模式时，强制将 API Key 的显示重置为“隐藏”（password），避免眼睛保持打开状态导致泄露
  if (isLocked && $apiKey) { try { $apiKey.type = 'password'; } catch {} }

  [$apiKey, $base, $ext, $sum].forEach(i => { if (i) i.disabled = !!isLocked; });
  if ($eyeBtn) $eyeBtn.disabled = !!isLocked;

  if ($mode) {
    if (isLocked) { $mode.value = "fast"; $mode.disabled = true; }
    else { $mode.disabled = false; }
  }
  if ($baseWrap) $baseWrap.classList.toggle("hidden", !!isLocked);

  const tip = isLocked ? await t("settings.trialLocked") : "";
  [$apiKey, $base, $ext, $sum, $mode].forEach(i => { if (i) i.title = tip; });
  if ($eyeBtn) $eyeBtn.title = tip;
}

async function setStatus(key) { 
  const text = await t(key);
  $("status").textContent = text; 
}
async function setMeta(meta) {
  // 生成更简洁的配置信息，使用更短的标签
  const configParts = [
    `p=${meta.aiProvider}`,
    `e=${meta.model_extract}`,
    `s=${meta.model_summarize}`,
    `l=${meta.output_lang || "auto"}`,
    `m=${meta.extract_mode}`
  ];
  
  const currentLang = await getCurrentLanguage();
  const prefix = currentLang === 'zh' ? '配置：' : 'Config: ';
  const separator = currentLang === 'zh' ? '，' : ', ';
  
  $("meta").textContent = `${prefix}${configParts.join(separator)}`;
}

// 版本号 & 指南链接
document.addEventListener('DOMContentLoaded', async () => {
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

  // 初始化主题三态切换（自动/浅色/深色）
  initOptionsThemeToggle();
  // 确保首次渲染就根据存储应用一次（容错）
  chrome.storage.sync.get([THEME_STORAGE_KEY, FLOAT_THEME_KEY]).then((all)=>{
    const v = all[THEME_STORAGE_KEY] || all[FLOAT_THEME_KEY] || 'auto';
    applyDocumentTheme(v);
  }).catch(()=>{});

  // 初始化国际化
  await initI18n();
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
  const { trial_consent = false, need_trial_consent_focus = false } = await chrome.storage.sync.get({ trial_consent: false, need_trial_consent_focus: false });

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

  if (aiProvider === "trial") await setTrialLock(true); else await setTrialLock(false);
  // 显示试用模式同意复选框
  reflectTrialConsentVisibility(aiProvider);
  const consentEl = $("trial_consent");
  if (consentEl) consentEl.checked = !!trial_consent;
  // 若来自前台引导需要强调试用同意，进行闪烁提醒并滚动到视图内
  if (aiProvider === 'trial' && !trial_consent && need_trial_consent_focus) {
    try { await flashTrialConsentAttention(); } catch {}
    // 清一次标记，避免反复闪烁
    try { await chrome.storage.sync.set({ need_trial_consent_focus: false }); } catch {}
  }
  // 初始化同意区视觉状态与事件
  try { initTrialConsentUI(); } catch {}

  $("system_prompt_preset").value = d.system_prompt_preset || DEFAULTS.system_prompt_preset;
  if (d.system_prompt_custom && d.system_prompt_custom.trim()) {
    $("system_prompt_custom").value = d.system_prompt_custom;
  } else {
    applyPresetToTextarea(true);
  }

  await setMeta({
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
  try{ window.dispatchEvent(new CustomEvent('SX_OPT_SAVE_START')); }catch{}
  // 读取当前选择
  let aiProvider = $("aiProvider").value || DEFAULTS.aiProvider;

  // Trial 模式：允许在未同意的情况下保存（面板端拦截试用），不自动切换到 OpenAI

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
    system_prompt_custom: $("system_prompt_custom").value.trim(),
    trial_consent: !!($("trial_consent")?.checked)
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

  await setStatus("settings.saved");
  await setMeta(payload);
  try{ window.dispatchEvent(new CustomEvent('SX_OPT_SAVE_END')); }catch{}
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
    if (!key && provider !== "trial") throw new Error(await t("settings.noApiKey"));
    await setStatus("settings.testing");

    const resp1 = await fetch(`${base}/models`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${key}` }
    });
    if (resp1.ok) { await setStatus("settings.testSuccess"); return; }

    const payload = { model, messages: [{ role: "user", content: "ping" }], temperature: 0 };
    const resp2 = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify(payload)
    });
    if (resp2.ok) { await setStatus("settings.testSuccessChat"); return; }

    const t1 = await safeReadText(resp1);
    const t2 = await safeReadText(resp2);
    throw new Error(`两种探测均失败。\n/models => ${resp1.status} ${t1}\n/chat/completions => ${resp2.status} ${t2}`);
  } catch (e) {
    const errorText = await t("settings.testFailed");
    setStatus(errorText + (e?.message || String(e)));
    try{ window.dispatchEvent(new CustomEvent('SX_OPT_TEST_END', { detail:{ ok:false } })); }catch{}
    return;
  }
  try{ window.dispatchEvent(new CustomEvent('SX_OPT_TEST_END', { detail:{ ok:true } })); }catch{}
}
async function safeReadText(res) { try { return await res.text(); } catch { return "(no body)"; } }
function toggleApiKeyVisibility() { const input = $("apiKey"); input.type = input.type === "password" ? "text" : "password"; }
// 恢复原始点击逻辑（不依赖 SXUI）
// 注意：按钮的事件绑定已在底部：$("toggleKey").addEventListener("click", toggleApiKeyVisibility);

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
    await setTrialLock(true);
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
    await setTrialLock(false);
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
    await setTrialLock(false);
  }
  reflectTrialConsentVisibility(provider);
  // 进入试用模式时，若尚未同意，进行高亮提醒
  if (provider === 'trial') {
    try {
      const { trial_consent = false } = await chrome.storage.sync.get({ trial_consent: false });
      updateTrialConsentVisual(!!trial_consent);
      if (!trial_consent) { try { await flashTrialConsentAttention(); } catch {} }
    } catch {}
  }
  else {
    // 非试用模式清理视觉标记
    try { updateTrialConsentVisual(null); } catch {}
  }

  await setMeta({
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

function reflectTrialConsentVisibility(provider){
  const wrap = document.getElementById('trial-consent-wrap');
  if (!wrap) return;
  wrap.style.display = (provider === 'trial') ? '' : 'none';
}

// 试用同意的闪烁/高亮提醒，并滚动到视图内
async function flashTrialConsentAttention() {
  const wrap = document.getElementById('trial-consent-wrap');
  const cb = document.getElementById('trial_consent');
  if (!wrap) return;
  try {
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {}
  wrap.classList.remove('consent-attn');
  // 触发重绘以便重复添加动画类生效
  void wrap.offsetWidth;
  wrap.classList.add('consent-attn');
  // 聚焦复选框以显示系统焦点样式，提高可达性
  try { cb && cb.focus({ preventScroll: true }); } catch {}
}

// 初始化并绑定“我已阅读并同意”区域的视觉状态与交互
function initTrialConsentUI(){
  const cb = document.getElementById('trial_consent');
  const sel = document.getElementById('aiProvider');
  if (!cb) return;
  // 初始应用一次视觉
  updateTrialConsentVisual(!!cb.checked);
  // 变更时即时反馈视觉（不写入存储，仅 UI）
  cb.addEventListener('change', () => {
    updateTrialConsentVisual(!!cb.checked);
    // 未勾选时重新触发一次闪烁提示
    if (!cb.checked) {
      try { flashTrialConsentAttention(); } catch {}
    } else {
      // 勾选后确保出现绿色焦点环
      try { setTimeout(()=> cb.focus({ preventScroll: true }), 0); } catch {}
    }
  });
}

// 根据勾选状态应用视觉：true => 绿色勾选 + 温和背景；false => 恢复跳动提示
function updateTrialConsentVisual(checked){
  const wrap = document.getElementById('trial-consent-wrap');
  if (!wrap) return;
  if (checked === null) { wrap.classList.remove('consent-ok'); wrap.classList.remove('consent-attn'); return; }
  if (checked) {
    wrap.classList.add('consent-ok');
    wrap.classList.remove('consent-attn');
  } else {
    wrap.classList.remove('consent-ok');
    // 重新触发 attention 脉冲
    wrap.classList.remove('consent-attn'); void wrap.offsetWidth; wrap.classList.add('consent-attn');
  }
}

async function onPresetChange() {
  const box = $("system_prompt_custom");
  if (box.value.trim()) {
    const confirmText = await t("settings.confirmOverride");
    if (confirm(confirmText)) applyPresetToTextarea(true);
  } else applyPresetToTextarea(true);
}
async function onOutputLangChange() {
  const box = $("system_prompt_custom");
  if (box.value.trim()) {
    const confirmText = await t("settings.confirmLangOverride");
    if (confirm(confirmText)) applyPresetToTextarea(true);
  } else applyPresetToTextarea(true);
}

// 底栏适配
function fitDockPadding() {
  const dock = document.querySelector('.save-dock');
  const main = document.querySelector('.main-with-dock');
  const spacer = document.getElementById('dock-spacer');
  if (!dock || !main) return;
  const h = dock.getBoundingClientRect().height || 0;
  const SAFE_GAP = 12; // 页面滚动到底部时，内容与底栏之间保留的可视间隙
  main.style.paddingBottom = `${h + SAFE_GAP}px`;
  if (spacer) spacer.style.height = `${SAFE_GAP}px`;
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

// ========== 国际化功能 ==========
async function initI18n() {
  // 更新页面语言属性
  await updatePageLanguage();
  
  // 加载当前语言设置
  const currentLang = await getCurrentLanguage();
  
  // 更新语言切换器状态
  updateLanguageSwitcher(currentLang);
  
  // 更新界面文本
  await updateUIText();
  
  // 绑定语言切换事件
  bindLanguageEvents();
}

function updateLanguageSwitcher(lang) {
  const zhBtn = document.getElementById('lang-zh');
  const enBtn = document.getElementById('lang-en');
  
  if (zhBtn && enBtn) {
    zhBtn.classList.toggle('active', lang === 'zh');
    enBtn.classList.toggle('active', lang === 'en');
  }
}

async function updateUIText() {
  const lang = await getCurrentLanguage();
  
  // 更新标题和副标题
  updateElementText('settings-title', await t('settings.title'));
  updateElementText('settings-subtitle', await t('settings.subtitle'));
  
  // 更新基础配置
  updateElementText('basic-config', await t('settings.basicConfig'));
  updateElementText('ai-platform', await t('settings.aiPlatform'));
  updateElementText('trial-option', await t('settings.trial'));
  updateElementText('openai-option', await t('settings.openai'));
  updateElementText('deepseek-option', await t('settings.deepseek'));
  updateElementText('custom-option', await t('settings.custom'));
  updateElementText('buy-help-text', await t('settings.buyHelp'));
  updateElementText('link-buy-openai', await t('settings.openaiGuide'));
  updateElementText('link-buy-deepseek', await t('settings.deepseekGuide'));
  updateElementText('platform-hint', await t('settings.hint'));
  updateElementText('trial-consent-text', await t('settings.trialConsentText'));
  
  // 更新表单标签
  updateElementText('api-key-label', await t('settings.apiKey'));
  updateElementText('base-url-label', await t('settings.baseURL'));
  updateElementText('extract-model-label', await t('settings.extractModel'));
  updateElementText('summarize-model-label', await t('settings.summarizeModel'));
  updateElementText('output-lang-label', await t('settings.outputLang'));
  updateElementText('auto-option', await t('settings.auto'));
  updateElementText('chinese-option', await t('settings.chinese'));
  updateElementText('english-option', await t('settings.english'));
  updateElementText('extract-mode-label', await t('settings.extractMode'));
  updateElementText('fast-option', await t('settings.fastLocal'));
  updateElementText('ai-option', await t('settings.aiExtract'));
  
  // 更新System Prompt
  updateElementText('system-prompt-title', await t('settings.systemPrompt'));
  updateElementText('presets-label', await t('settings.presets'));
  updateElementText('general-summary-option', await t('settings.generalSummary'));
  updateElementText('faithful-translation-option', await t('settings.faithfulTranslation'));
  updateElementText('tech-article-translation-option', await t('settings.techArticleTranslation'));
  updateElementText('preset-hint', await t('settings.presetHint'));
  updateElementText('custom-prompt-label', await t('settings.customPrompt'));
  
  // 更新快捷键设置
  updateElementText('shortcuts-title', await t('settings.shortcuts'));
  updateElementText('shortcut-desc', await t('settings.shortcutDesc'));
  updateElementText('open-shortcut', await t('settings.setShortcut'));
  updateElementText('shortcut-hint', await t('settings.shortcutHint'));
  
  // 更新底部按钮
  updateElementText('appearance-label', await t('settings.appearance'));
  updateElementText('btn-test', await t('settings.testApi'));
  updateElementText('btn-save', await t('settings.saveAll'));
  
  // 更新状态文本
  updateElementText('status', await t('settings.ready'));
  
  // 更新主题按钮标题
  const themeBtns = document.querySelectorAll('.theme-btn');
  for (const btn of themeBtns) {
    const mode = btn.getAttribute('data-mode');
    if (mode === 'auto') btn.title = await t('settings.autoTheme');
    else if (mode === 'light') btn.title = await t('settings.lightTheme');
    else if (mode === 'dark') btn.title = await t('settings.darkTheme');
  }
}

function updateElementText(elementId, text) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

function bindLanguageEvents() {
  const zhBtn = document.getElementById('lang-zh');
  const enBtn = document.getElementById('lang-en');
  
  if (zhBtn) {
    zhBtn.addEventListener('click', () => switchLanguage('zh'));
  }
  
  if (enBtn) {
    enBtn.addEventListener('click', () => switchLanguage('en'));
  }
}

let __langSwitching = false;
async function switchLanguage(lang) {
  if (__langSwitching) return; // 避免重复触发
  __langSwitching = true;
  const root = document.documentElement; // 使用 html 作为动画根
  try{
    // 添加动画类并触发淡出
    root.classList.add('lang-anim');
    root.classList.add('lang-out');

    // 等待淡出完成（或超时兜底）
    await new Promise(res=> setTimeout(res, window.matchMedia('(prefers-reduced-motion: reduce)').matches? 0: 180));

    // 保存语言设置 + 更新文案
    await chrome.storage.sync.set({ ui_language: lang });
    await updatePageLanguage();
    updateLanguageSwitcher(lang);
    await updateUIText();

  }catch(e){ console.warn('switchLanguage failed:', e); }
  finally{
    // 触发淡入
    root.classList.remove('lang-out');
    // 稍后移除动画根（保持可重用）
    setTimeout(()=>{ try{ root.classList.remove('lang-anim'); }catch{} __langSwitching=false; }, 260);
  }
}

function toggleBuyHelpInline(provider){
  const help = document.querySelector('.buy-help-inline');
  if (!help) return;
  // 规则：Trial 隐藏，其它平台显示
  help.style.display = (provider === 'trial') ? 'none' : '';
}

document.addEventListener('DOMContentLoaded', () => {
  // Subtle page enter animation
  try{
    const root = document.documentElement;
    root.classList.add('page-enter');
    // Stagger sections slightly for layered feel
    const cards = Array.from(document.querySelectorAll('.section.card'));
    cards.forEach((el, i)=>{
      el.classList.add('fx-in');
      el.style.animationDelay = (80 + i*40) + 'ms';
    });
    // Cleanup after a short duration
    const clear = () => {
      try{ root.classList.remove('page-enter'); }catch{}
      try{ cards.forEach(el=>{ el.classList.remove('fx-in'); el.style.animationDelay=''; }); }catch{}
    };
    setTimeout(clear, window.matchMedia('(prefers-reduced-motion: reduce)').matches? 0: 900);
  }catch{}

  fitDockPadding();
  window.addEventListener('resize', fitDockPadding);
  const dock = document.querySelector('.save-dock');
  if (window.ResizeObserver && dock) {
    const ro = new ResizeObserver(() => fitDockPadding());
    ro.observe(dock);
  }

  // 监听存储变化：当前台触发 need_trial_consent_focus 时，若本页已打开，则重置未保存的“同意”选中状态
  try{
    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area !== 'sync') return;
      if (changes.need_trial_consent_focus && changes.need_trial_consent_focus.newValue) {
        try {
          const sel = document.getElementById('aiProvider');
          const provider = sel ? sel.value : (await chrome.storage.sync.get({ aiProvider: DEFAULTS.aiProvider })).aiProvider;
          const { trial_consent = false } = await chrome.storage.sync.get({ trial_consent: false });
          if (provider === 'trial' && !trial_consent) {
            const cb = document.getElementById('trial_consent');
            if (cb) cb.checked = false; // 强制与存储一致，避免“看起来已同意但未生效”的错觉
            updateTrialConsentVisual(false);
            try { await flashTrialConsentAttention(); } catch {}
          }
        } catch {}
      }
    });
  }catch{}

  // 当页面重新可见时，若存在“需要聚焦同意”的标记且仍未保存同意，则重置复选框并高亮
  try{
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible') return;
      try{
        const { need_trial_consent_focus = false, trial_consent = false, aiProvider = DEFAULTS.aiProvider } = await chrome.storage.sync.get({ need_trial_consent_focus:false, trial_consent:false, aiProvider: DEFAULTS.aiProvider });
        if (need_trial_consent_focus && aiProvider === 'trial' && !trial_consent) {
          const cb = document.getElementById('trial_consent');
          if (cb) cb.checked = false;
          updateTrialConsentVisual(false);
          try { await flashTrialConsentAttention(); } catch {}
        }
      }catch{}
    });
  }catch{}
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
