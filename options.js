// options.js —— 设置页（System Prompt、眼睛显示 Key、保存在最下）
import { DEFAULTS, PROVIDER_PRESETS, getSettings } from "./settings.js";
import { getCurrentLanguage, t, tSync, updatePageLanguage } from "./i18n.js";
import { FILTER_LISTS, splitLists, FILTER_DEFAULT_STRENGTH } from "./adblock_lists.js";

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

  // 初始化国际化（兜底保护）
  try { await initI18n(); } catch (e) { console.warn('initI18n failed:', e); }

  // 初始化 Tab 切换（AI 摘要 / 广告过滤）
  try { initTopTabs(); } catch(e) { console.warn('initTopTabs failed:', e); }
  // 初始化“卡片上浮时让 active tab 下划线同步上浮”
  try { initTabsFloatHover(); } catch(e) { console.warn('initTabsFloatHover failed:', e); }

  // 初始化广告过滤 UI（渲染列表并回填状态）
  try { initAdblockUI(); } catch (e) { console.warn('initAdblockUI failed:', e); }

  // 渲染完列表与控件后再加载设置回填勾选状态，避免顺序问题
  try { await loadSettings(); } catch (e) { console.warn('loadSettings after UI init failed:', e); }
});

// ---- 顶部 tabs ----
const ACTIVE_TAB_KEY = 'options_active_tab';
function setActiveTab(name){
  const aiBtn = document.getElementById('tab-ai-btn');
  const adBtn = document.getElementById('tab-adblock-btn');
  const aiPane = document.getElementById('tab-ai');
  const adPane = document.getElementById('tab-adblock');
  const isAI = (name === 'ai');
  [aiBtn, adBtn].forEach(b => b && b.classList.remove('active'));
  if (aiBtn) { aiBtn.classList.toggle('active', isAI); aiBtn.setAttribute('aria-selected', isAI ? 'true':'false'); }
  if (adBtn) { adBtn.classList.toggle('active', !isAI); adBtn.setAttribute('aria-selected', !isAI ? 'true':'false'); }
  if (aiPane) aiPane.classList.toggle('is-hidden', !isAI);
  if (adPane) adPane.classList.toggle('is-hidden', isAI);
}
function initTopTabs(){
  const aiBtn = document.getElementById('tab-ai-btn');
  const adBtn = document.getElementById('tab-adblock-btn');
  if (!aiBtn || !adBtn) return;
  // 读取存储，默认 AI
  chrome.storage.sync.get([ACTIVE_TAB_KEY]).then(all => {
    let v = 'ai';
    if (all && typeof all[ACTIVE_TAB_KEY] === 'string') {
      v = (all[ACTIVE_TAB_KEY] === 'adblock') ? 'adblock' : 'ai';
    } else {
      // First run: persist default to ensure consistent initial behavior
      chrome.storage.sync.set({ [ACTIVE_TAB_KEY]: 'ai' }).catch(()=>{});
    }
    setActiveTab(v);
  }).catch(()=> setActiveTab('ai'));
  const onClick = (e) => {
    const b = e.currentTarget;
    const tab = b && b.getAttribute('data-tab');
    if (!tab) return;
    setActiveTab(tab);
    chrome.storage.sync.set({ [ACTIVE_TAB_KEY]: tab }).catch(()=>{});
  };
  aiBtn.addEventListener('click', onClick);
  adBtn.addEventListener('click', onClick);
}

// ---- 让 active tab 下划线跟随第一张卡片上浮 ----
function initTabsFloatHover(){
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const bind = (paneId) => {
    const pane = document.getElementById(paneId);
    if (!pane) return;
    const firstCard = pane.querySelector('.section.card');
    if (!firstCard) return;
    const enter = () => hero.classList.add('tabs-float');
    const leave = () => hero.classList.remove('tabs-float');
    firstCard.addEventListener('mouseenter', enter);
    firstCard.addEventListener('mouseleave', leave);
    firstCard.addEventListener('focusin', enter);
    firstCard.addEventListener('focusout', leave);
  };
  // 绑定两个面板
  bind('tab-ai');
  bind('tab-adblock');
}

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
  const { adblock_enabled = false, adblock_strength = FILTER_DEFAULT_STRENGTH, adblock_selected = [], adblock_block_popups = false, nyt_block_family_popup = false, adblock_user_rules_text = '' } = await chrome.storage.sync.get({ adblock_enabled: false, adblock_strength: FILTER_DEFAULT_STRENGTH, adblock_selected: [], adblock_block_popups: false, nyt_block_family_popup: false, adblock_user_rules_text: '' });

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

  // —— 广告过滤 回填 ——
  try {
    const enabledEl = $("adblock_enabled");
    if (enabledEl) enabledEl.checked = !!adblock_enabled;
    setSelectedStrength(String(adblock_strength || FILTER_DEFAULT_STRENGTH));
    applyAdblockSelections(new Set((adblock_selected || []).filter(Boolean)));
    updateAdblockSectionEnabledState();
    const popCb = document.getElementById('adblock_block_popups');
    if (popCb) popCb.checked = !!adblock_block_popups;
    const nytCb = document.getElementById('nyt_block_family_popup');
    if (nytCb) nytCb.checked = !!nyt_block_family_popup;
    const userTxt = document.getElementById('adblock_user_rules_text');
    if (userTxt) userTxt.value = adblock_user_rules_text || '';
  } catch {}
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

  const $userTxt = document.getElementById('adblock_user_rules_text');
  // 校验自定义隐藏规则（若存在）
  if ($userTxt && $userTxt.value.trim()) {
    const v = validateCustomRules($userTxt.value);
    if (!v.ok) {
      const msg = await t('adblock.userRulesInvalid').catch(()=> '自定义隐藏规则校验失败：');
      await setStatus(`${msg}${v.msg}`);
      throw new Error('user rules invalid');
    }
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
    trial_consent: !!($("trial_consent")?.checked),
    // 广告过滤设置（存 sync 里用于跨设备同步；规则内容会存 local）
    adblock_enabled: !!($("adblock_enabled")?.checked),
    adblock_strength: getSelectedStrength(),
    adblock_selected: (function(){
      return Array.from(getAdblockSelectedSet());
    })(),
    adblock_block_popups: !!(document.getElementById('adblock_block_popups')?.checked),
    nyt_block_family_popup: !!(document.getElementById('nyt_block_family_popup')?.checked)
  };
  if ($userTxt) payload.adblock_user_rules_text = $userTxt.value.trim();

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
  const help = document.getElementById('trial-consent-help');
  if (!wrap) return;
  if (checked === null) { wrap.classList.remove('consent-ok'); wrap.classList.remove('consent-attn'); return; }
  if (checked) {
    wrap.classList.add('consent-ok');
    wrap.classList.remove('consent-attn');
  } else {
    wrap.classList.remove('consent-ok');
    // 重新触发 attention 脉冲
    wrap.classList.remove('consent-attn'); void wrap.offsetWidth; wrap.classList.add('consent-attn');
    // 进一步确保动画在所有浏览器/主题下可靠重启（特别是浅色模式）
    try {
      if (help && help.style) {
        help.style.animation = 'none';
        // 强制重绘后清空，恢复到样式表定义的动画
        void help.offsetWidth;
        help.style.animation = '';
      }
    } catch {}
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
  // 更新顶部 tabs 文案（i18n）
  updateElementText('tab-ai-btn', await t('settings.tabAI'));
  updateElementText('tab-adblock-btn', await t('settings.tabAdblock'));
  
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

  // ====== 广告过滤卡片多语言 ======
  updateElementText('adblock-title', await t('adblock.title'));
  updateElementText('adblock-enable-label', await t('adblock.enable'));
  updateElementText('adblock-enable-hint', await t('adblock.enableHint'));
  updateElementText('adblock-block-popups-label', await t('adblock.blockPopups'));
  updateElementText('adblock-block-popups-hint', await t('adblock.blockPopupsHint'));
  // NYTimes popup switch
  updateElementText('nyt-popup-label', await t('adblock.nytPopupLabel'));
  updateElementText('nyt-popup-hint', await t('adblock.nytPopupHint'));
  updateElementText('adblock-strength-label', await t('adblock.strength'));
  // 强度按钮文字
  try {
    const seg = document.getElementById('adblock-strength-seg');
    if (seg) {
      const low = seg.querySelector('[data-strength="low"]');
      const med = seg.querySelector('[data-strength="medium"]');
      const high = seg.querySelector('[data-strength="high"]');
      if (low) low.textContent = await t('adblock.low');
      if (med) med.textContent = await t('adblock.medium');
      if (high) high.textContent = await t('adblock.high');
      seg.setAttribute('aria-label', await t('adblock.strength'));
    }
  } catch {}
  // 强度提示（自定义规则时建议选择“中”）
  updateElementText('adblock-strength-custom-hint', await t('adblock.strengthCustomHint'));
  updateElementText('adblock-global-lists-text', await t('adblock.globalLists'));
  updateElementText('adblock-regional-lists-text', await t('adblock.regionalLists'));
  updateElementText('adblock-cookie-lists-text', await t('adblock.cookieLists'));
  // 自定义规则标题
  updateElementText('adblock-custom-lists-text', await t('adblock.customTitle'));
  // 用户自定义隐藏（文本）
  updateElementText('adblock-user-rules-label', await t('adblock.userRulesTitle'));
  const uTxt = document.getElementById('adblock_user_rules_text');
  if (uTxt) uTxt.placeholder = await t('adblock.userRulesPlaceholder');
  updateElementText('adblock-user-rules-hint', await t('adblock.userRulesHint'));
  updateElementText('adblock-tip', await t('adblock.tip'));
  // 同步按钮提示
  const syncAllText = await t('adblock.syncAll');
  const syncAllBtns = [
    document.getElementById('sync_all_global'),
    document.getElementById('sync_all_regional'),
    document.getElementById('sync_all_cookie'),
    document.getElementById('sync_all_custom')
  ];
  for (const b of syncAllBtns) {
    if (!b) continue;
    b.title = syncAllText;
    b.setAttribute('aria-label', syncAllText);
    b.dataset.tip = syncAllText;
  }

  // 自定义导入区：占位与按钮文案
  try {
    const elUrl = document.getElementById('custom_url');
    if (elUrl) elUrl.placeholder = await t('adblock.customUrlPlaceholder');
    const bFetch = document.getElementById('btn_custom_url_fetch');
    if (bFetch) bFetch.textContent = await t('adblock.customUrlFetch');
    const elName1 = document.getElementById('custom_url_name');
    if (elName1) elName1.placeholder = await t('adblock.customUrlNamePlaceholder');
    const bAdd1 = document.getElementById('btn_custom_url_add');
    if (bAdd1) bAdd1.textContent = await t('adblock.customUrlConfirm');

    const lblText = document.getElementById('custom-text-label');
    if (lblText) lblText.textContent = await t('adblock.customTextLabel');
    const elText = document.getElementById('custom_text');
    if (elText) elText.placeholder = await t('adblock.customTextPlaceholder');
    const elName2 = document.getElementById('custom_text_name');
    if (elName2) elName2.placeholder = await t('adblock.customTextNamePlaceholder');
    const bAdd2 = document.getElementById('btn_custom_text_add');
    if (bAdd2) bAdd2.textContent = await t('adblock.customTextSave');

    // 语法说明
    updateElementText('custom-syntax-title', await t('adblock.syntaxTitle'));
    updateElementText('custom-syntax-comment', await t('adblock.syntaxComment'));
    updateElementText('custom-syntax-global', await t('adblock.syntaxGlobal'));
    updateElementText('custom-syntax-domain', await t('adblock.syntaxDomain'));
    updateElementText('custom-syntax-id', await t('adblock.syntaxId'));
    updateElementText('custom-syntax-exception', await t('adblock.syntaxException'));
    updateElementText('custom-syntax-unsupported', await t('adblock.syntaxUnsupported'));
  } catch {}

  // 状态行多语言同步（已存在的“同步成功/失败/同步中…”）
  try {
    const okText = await t('adblock.syncOk');
    const failText = await t('adblock.syncFail');
    const syncingText = await t('adblock.syncing');
    document.querySelectorAll('.adbl-status').forEach(el => {
      const e = el;
      const prev = (e.textContent || '').trim();
      // 保留 HTTP 细节（例如 "(HTTP 404)"）
      const m = prev.match(/\(HTTP\s+\d+\)/i);
      const httpDetail = m ? ` ${m[0]}` : '';
      if (e.classList.contains('ok')) {
        e.textContent = okText; // 成功
      } else if (e.classList.contains('err')) {
        e.textContent = `${failText}${httpDetail}`; // 失败 + 细节
      } else {
        // 无状态类时视为进行中
        if (prev) e.textContent = syncingText;
      }
    });
  } catch {}

  // 汇总提示多语言同步（“成功 x · 失败 y”/“没有可更新的规则”）
  try {
    const okLabel = await t('adblock.resultOkLabel');
    const failLabel = await t('adblock.resultFailLabel');
    const noTasks = await t('adblock.noTasks');
    const ids = ['adblock_global_summary_inline','adblock_regional_summary_inline','adblock_cookie_summary_inline','adblock_custom_summary_inline'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const prev = (el.textContent || '').trim();
      if (!prev) continue;
      // 情况1：没有任务
      if (/^没有可更新的规则$|^Nothing to update$/i.test(prev)) { el.textContent = noTasks; continue; }
      // 情况2：解析两个数字，重组本地化文案
      const nums = prev.match(/(\d+)\D+(\d+)/);
      if (nums) {
        const ok = nums[1];
        const fail = nums[2];
        el.textContent = `${okLabel} ${ok} · ${failLabel} ${fail}`;
      }
    }
  } catch {}
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

    // 保存语言设置（同时写 sync 与 local，容错）
    await Promise.allSettled([
      chrome.storage.sync.set({ ui_language: lang }),
      chrome.storage.local.set({ ui_language_cache: lang })
    ]);
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
 * 广告过滤（UI 渲染与状态）
 * ========================= */
function renderAdblockLists() {
  const { global, regional, cookie } = splitLists();
  const mount = (wrapId, items) => {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    wrap.innerHTML = '';
    items.forEach(item => {
      const id = `adbl_${item.id}`;
      const row = document.createElement('label');
      row.className = 'adbl-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.dataset.listId = item.id;
      const span = document.createElement('span');
      span.textContent = item.name;
      span.className = 'adbl-name';
      // sync button (two arrows)
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sync-btn';
      btn.setAttribute('aria-label', '同步此规则');
      btn.dataset.listId = item.id;
      btn.dataset.name = item.name;
      btn.dataset.url = item.url;
      btn.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 22v-6h6"/><path d="M21 8a9 9 0 0 0-15.5-6.36L3 6"/><path d="M3 16a9 9 0 0 0 15.5 6.36L21 18"/></svg>';
      const status = document.createElement('span');
      status.className = 'adbl-status';
      status.id = `adbl_status_${item.id}`;
      row.appendChild(cb);
      row.appendChild(span);
      row.appendChild(btn);
      row.appendChild(status);
      wrap.appendChild(row);
    });
  };
  mount('adblock_global_lists', global);
  mount('adblock_regional_lists', regional);
  mount('adblock_cookie_lists', cookie);
}

function getAdblockSelectedSet() {
  const sel = new Set();
  document.querySelectorAll('#adblock_global_lists input[type="checkbox"], #adblock_regional_lists input[type="checkbox"], #adblock_cookie_lists input[type="checkbox"], #adblock_custom_lists input[type="checkbox"]').forEach(cb => {
    if (cb.checked) sel.add(cb.dataset.listId);
  });
  return sel;
}

function applyAdblockSelections(set) {
  document.querySelectorAll('#adblock_global_lists input[type="checkbox"], #adblock_regional_lists input[type="checkbox"], #adblock_cookie_lists input[type="checkbox"], #adblock_custom_lists input[type="checkbox"]').forEach(cb => {
    const id = cb.dataset.listId;
    cb.checked = set.has(id);
  });
}

function getSelectedStrength(){
  const wrap = document.getElementById('adblock-strength-seg');
  if (!wrap) return 'medium';
  const cur = wrap.querySelector('.seg-btn[aria-selected="true"]');
  const v = cur?.dataset?.strength || 'medium';
  return ['low','medium','high'].includes(v) ? v : 'medium';
}
function setSelectedStrength(v){
  const wrap = document.getElementById('adblock-strength-seg');
  if (!wrap) return;
  const vs = ['low','medium','high'];
  const target = vs.includes(v) ? v : 'medium';
  wrap.querySelectorAll('.seg-btn').forEach(btn => {
    const on = btn.dataset.strength === target;
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    btn.classList.toggle('active', on);
  });
}

function updateAdblockSectionEnabledState(){
  const enabled = !!document.getElementById('adblock_enabled')?.checked;
  const controls = [
    document.getElementById('adblock-strength-seg'),
    document.getElementById('adblock_global_lists'),
    document.getElementById('adblock_regional_lists'),
    document.getElementById('adblock_cookie_lists'),
    document.getElementById('adblock_custom_lists'),
    document.getElementById('adblock_block_popups'),
    document.getElementById('nyt_block_family_popup')
  ];
  controls.forEach(el => { if (el) el.closest('.field')?.classList.toggle('disabled', !enabled); });
  document.querySelectorAll('#adblock_global_lists input, #adblock_regional_lists input, #adblock_cookie_lists input, #adblock_custom_lists input').forEach(el => { el.disabled = !enabled; });
  document.querySelectorAll('#adblock-strength-seg .seg-btn').forEach(el => { el.disabled = !enabled; });
  document.querySelectorAll('.sync-btn').forEach(el => { el.disabled = !enabled; });
  const popCb = document.getElementById('adblock_block_popups');
  if (popCb) popCb.disabled = !enabled;
  const nytCb = document.getElementById('nyt_block_family_popup');
  if (nytCb) nytCb.disabled = !enabled;
}

function initAdblockUI(){
  renderAdblockLists();
  renderCustomAdblockListsFromSync();
  // 回填由 loadSettings() 完成，这里只绑定事件
  const enabledEl = document.getElementById('adblock_enabled');
  if (enabledEl) enabledEl.addEventListener('change', updateAdblockSectionEnabledState);
  const seg = document.getElementById('adblock-strength-seg');
  if (seg) {
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('#adblock-strength-seg .seg-btn');
      if (!btn || btn.disabled) return;
      setSelectedStrength(btn.dataset.strength);
    });
  }
  // 规则的“同步”点击（事件委托）
  const listWraps = [document.getElementById('adblock_global_lists'), document.getElementById('adblock_regional_lists'), document.getElementById('adblock_cookie_lists'), document.getElementById('adblock_custom_lists')];
  listWraps.forEach(wrap => {
    if (!wrap) return;
    wrap.addEventListener('click', async (e) => {
      const btn = e.target.closest('.sync-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.listId;
      const name = btn.dataset.name || id;
      const url = btn.dataset.url || '';
      if (!id) return;
      const ok = await syncOneList(btn, id, name, url);
      // 若是手动点“同步”且之前被禁用，成功后恢复可勾选
      try {
        if (ok) {
          const row = btn.closest('label');
          const cb = row?.querySelector('input[type="checkbox"]');
          if (cb && cb.disabled) { cb.disabled = false; cb.title = ''; }
        }
      } catch {}
    });

    // 勾选后自动同步（仅当开启了广告过滤时）
    wrap.addEventListener('change', async (e) => {
      const cb = e.target && e.target.matches ? (e.target.matches('input[type="checkbox"]') ? e.target : null) : null;
      if (!cb || !cb.checked) return;
      const enabled = !!document.getElementById('adblock_enabled')?.checked;
      if (!enabled) return;
      const row = cb.closest('label');
      const btn = row?.querySelector('.sync-btn');
      if (!btn || btn.disabled) return;
      const id = cb.dataset.listId;
      const name = btn.dataset.name || id;
      const url = btn.dataset.url || '';
      if (!id) return;
      try {
        const ok = await syncOneList(btn, id, name, url);
        if (!ok) {
          // 同步失败：取消勾选并禁用该项，提醒用户
          cb.checked = false;
          cb.disabled = true;
          const st = document.getElementById(`adbl_status_${id}`);
          if (st) {
            st.textContent = `${await t('adblock.syncFail')} · ${await t('adblock.cannotSelect')}`;
            st.classList.add('err'); st.classList.remove('ok');
            st.title = `${await t('adblock.cannotSelect')}`;
          }
        } else {
          // 成功：确保状态为 ok
          const st = document.getElementById(`adbl_status_${id}`);
          if (st) { st.classList.add('ok'); st.classList.remove('err'); st.title=''; }
        }
      } catch {}
    });
  });

  // 全部更新（全球/区域）
  const syncAllGlobal = document.getElementById('sync_all_global');
  const syncAllRegional = document.getElementById('sync_all_regional');
  const syncAllCookie = document.getElementById('sync_all_cookie');
  const syncAllCustom = document.getElementById('sync_all_custom');
  if (syncAllGlobal) syncAllGlobal.addEventListener('click', () => syncAllInSection('global'));
  if (syncAllRegional) syncAllRegional.addEventListener('click', () => syncAllInSection('regional'));
  if (syncAllCookie) syncAllCookie.addEventListener('click', () => syncAllInSection('cookie'));
  if (syncAllCustom) syncAllCustom.addEventListener('click', () => syncAllCustomLists());

  // 绑定自定义导入区
  try { bindCustomImportHandlers(); } catch (e) { console.warn('bindCustomImportHandlers failed:', e); }
}

async function syncOneList(btn, id, name, url){
  try {
    // show loading
    btn.dataset.loading = '1';
    btn.disabled = true;
    const st = document.getElementById(`adbl_status_${id}`);
    if (st) { st.textContent = await t('adblock.syncing'); st.classList.remove('ok','err'); }
    const payload = { type: 'ADBLOCK_DOWNLOAD_ONE', id };
    if (url) payload.url = url;
    if (name) payload.name = name;
    const resp = await chrome.runtime.sendMessage(payload);
    if (resp?.ok) {
      if (st) { st.textContent = await t('adblock.syncOk'); st.classList.add('ok'); st.classList.remove('err'); }
      return true;
    } else {
      if (st) {
        const detail = resp?.status ? ` (HTTP ${resp.status})` : '';
        st.textContent = `${await t('adblock.syncFail')}${detail}`;
        st.classList.add('err'); st.classList.remove('ok');
      }
      return false;
    }
  } catch (e) {
    const st = document.getElementById(`adbl_status_${id}`);
    if (st) { st.textContent = await t('adblock.syncFail'); st.classList.add('err'); st.classList.remove('ok'); }
    return false;
  } finally {
    // small delay to let user see result
    setTimeout(() => {
      try { btn.dataset.loading = '0'; btn.disabled = false; } catch {}
    }, 200);
  }
}

async function syncAllInSection(section){
  const enabled = !!document.getElementById('adblock_enabled')?.checked;
  if (!enabled) return;
  const btnAll = document.getElementById(section === 'global' ? 'sync_all_global' : section === 'regional' ? 'sync_all_regional' : 'sync_all_cookie');
  const wrapId = section === 'global' ? 'adblock_global_lists' : section === 'regional' ? 'adblock_regional_lists' : 'adblock_cookie_lists';
  const wrap = document.getElementById(wrapId);
  if (!wrap || !btnAll) return;
  try {
    btnAll.dataset.loading = '1';
    btnAll.disabled = true;
    // 选择器与按钮集合
    const rows = Array.from(wrap.querySelectorAll('label'));
    const selectedIds = new Set(Array.from(wrap.querySelectorAll('input[type="checkbox"]')).filter(cb => cb.checked).map(cb => cb.dataset.listId));
    // 如果该分区有选择，则仅更新勾选的；否则全部
    const tasks = [];
    rows.forEach(row => {
      const btn = row.querySelector('.sync-btn');
      const id = btn?.dataset.listId;
      if (!btn || !id) return;
      if (selectedIds.size > 0 && !selectedIds.has(id)) return;
      const name = btn.dataset.name || id;
      tasks.push({ btn, id, name });
    });
    let ok = 0, fail = 0;
    for (const t of tasks) {
      const res = await syncOneList(t.btn, t.id, t.name);
      if (res) ok++; else fail++;
      // 微小间隔，避免 UI 抖动
      await new Promise(r => setTimeout(r, 80));
    }
    // 总结提示
    const summary = document.getElementById(section === 'global' ? 'adblock_global_summary_inline' : section === 'regional' ? 'adblock_regional_summary_inline' : 'adblock_cookie_summary_inline');
    if (summary) {
      if (tasks.length === 0) summary.textContent = await t('adblock.noTasks');
      else summary.textContent = `${await t('adblock.resultOkLabel')} ${ok} · ${await t('adblock.resultFailLabel')} ${fail}`;
    }
  } finally {
    try { btnAll.dataset.loading = '0'; btnAll.disabled = false; } catch {}
  }
}

async function syncAllCustomLists(){
  const enabled = !!document.getElementById('adblock_enabled')?.checked;
  if (!enabled) return;
  const btnAll = document.getElementById('sync_all_custom');
  const wrap = document.getElementById('adblock_custom_lists');
  if (!wrap || !btnAll) return;
  try {
    btnAll.dataset.loading = '1';
    btnAll.disabled = true;
    const rows = Array.from(wrap.querySelectorAll('label'));
    const selectedIds = new Set(Array.from(wrap.querySelectorAll('input[type="checkbox"]')).filter(cb => cb.checked).map(cb => cb.dataset.listId));
    const tasks = [];
    rows.forEach(row => {
      const btn = row.querySelector('.sync-btn');
      const id = btn?.dataset.listId;
      const url = btn?.dataset.url || '';
      if (!btn || !id || !url) return; // 仅更新有 URL 的自定义规则
      if (selectedIds.size > 0 && !selectedIds.has(id)) return;
      const name = btn.dataset.name || id;
      tasks.push({ btn, id, name, url });
    });
    let ok = 0, fail = 0;
    for (const t of tasks) {
      const res = await syncOneList(t.btn, t.id, t.name, t.url);
      if (res) ok++; else fail++;
      await new Promise(r => setTimeout(r, 80));
    }
    const summary = document.getElementById('adblock_custom_summary_inline');
    if (summary) {
      if (tasks.length === 0) summary.textContent = await t('adblock.noTasks');
      else summary.textContent = `${await t('adblock.resultOkLabel')} ${ok} · ${await t('adblock.resultFailLabel')} ${fail}`;
    }
  } finally {
    try { btnAll.dataset.loading = '0'; btnAll.disabled = false; } catch {}
  }
}

// ===== 自定义规则：渲染 / 校验 / 导入保存 =====
async function renderCustomAdblockListsFromSync(){
  try {
    const wrap = document.getElementById('adblock_custom_lists');
    if (!wrap) return;
    const { adblock_custom_lists = [] } = await chrome.storage.sync.get({ adblock_custom_lists: [] });
    wrap.innerHTML = '';
    const items = Array.isArray(adblock_custom_lists) ? adblock_custom_lists : [];
    items.forEach(item => {
      const id = String(item.id || '').trim();
      if (!id) return;
      const row = document.createElement('label');
      row.className = 'adbl-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.listId = id;
      const span = document.createElement('span');
      span.textContent = item.name || id;
      span.className = 'adbl-name';
      // sync button: 仅当有 URL 时显示
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sync-btn';
      btn.setAttribute('aria-label', '同步此规则');
      btn.dataset.listId = id;
      btn.dataset.name = item.name || id;
      if (item.url) btn.dataset.url = item.url;
      btn.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 22v-6h6"/><path d="M21 8a9 9 0 0 0-15.5-6.36L3 6"/><path d="M3 16a9 9 0 0 0 15.5 6.36L21 18"/></svg>';
      if (!item.url) btn.style.display = 'none';
      const status = document.createElement('span');
      status.className = 'adbl-status';
      status.id = `adbl_status_${id}`;
      row.appendChild(cb);
      row.appendChild(span);
      row.appendChild(btn);
      row.appendChild(status);
      wrap.appendChild(row);
    });
  } catch (e) { console.warn('renderCustomAdblockListsFromSync failed:', e); }
}

function simpleHash32(s){
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return (h >>> 0).toString(36);
}

function validateCustomRules(text){
  const lines = String(text || '').split(/\r?\n/);
  let n = 0;
  for (const raw of lines) {
    const line = (raw || '').trim();
    if (!line) continue;
    if (/^(\!|\[Adblock|\[uBlock)/i.test(line)) continue; // comment/header
    // reject network/scriptlet rules quickly
    if (/(^\|\||@@|\$|##\+js\(|#\$#|\$\$)/.test(line)) return { ok:false, msg: '包含不支持的网络/脚本规则（如 ||、@@、$、##+js）。' };
    // must be one of: ###id | (domain,~domain)##selector | (domain,~domain)#@#selector | ##selector
    if (line.includes('###')) {
      const idx = line.indexOf('###');
      const id = line.slice(idx + 3).trim();
      if (!id || /[^a-zA-Z0-9_-]/.test(id)) return { ok:false, msg: `无效的ID：${id}` };
      n++; continue;
    }
    if (line.includes('#@#')) {
      const idx = line.indexOf('#@#');
      const left = line.slice(0, idx).trim();
      const sel = line.slice(idx + 3).trim();
      if (!sel) return { ok:false, msg: '缺少选择器（#@# 后为空）。' };
      // domains optional
      if (left) {
        const doms = left.split(',').map(s=>s.trim()).filter(Boolean);
        if (doms.some(d => !/^~?[a-z0-9.-]+$/i.test(d))) return { ok:false, msg: '域名列表格式不正确。' };
      }
      n++; continue;
    }
    if (line.includes('##')) {
      const idx = line.indexOf('##');
      const left = line.slice(0, idx).trim();
      const sel = line.slice(idx + 2).trim();
      if (!sel) return { ok:false, msg: '缺少选择器（## 后为空）。' };
      if (left) {
        const doms = left.split(',').map(s=>s.trim()).filter(Boolean);
        if (doms.some(d => !/^~?[a-z0-9.-]+$/i.test(d))) return { ok:false, msg: '域名列表格式不正确。' };
      }
      n++; continue;
    }
    return { ok:false, msg: `不支持的语法：${line.slice(0,80)}...` };
  }
  if (n === 0) return { ok:false, msg: '未检测到有效规则。' };
  return { ok:true, count:n };
}

function bindCustomImportHandlers(){
  const $url = document.getElementById('custom_url');
  const $fetch = document.getElementById('btn_custom_url_fetch');
  const $step2 = document.getElementById('custom_url_step2');
  const $name = document.getElementById('custom_url_name');
  const $add = document.getElementById('btn_custom_url_add');
  const $status = document.getElementById('custom_url_status');
  const $txt = document.getElementById('custom_text');
  const $txtName = document.getElementById('custom_text_name');
  const $txtAdd = document.getElementById('btn_custom_text_add');
  const setStatus = (el, msg, ok) => { if (!el) return; el.textContent = msg || ''; el.style.color = ok ? '#059669' : '#b91c1c'; };

  if ($fetch) $fetch.addEventListener('click', async () => {
    const url = ($url?.value || '').trim();
    setStatus($status, '', true);
    $step2.style.display = 'none';
    if (!url || !/^https?:\/\//i.test(url)) { setStatus($status, '请输入合法的 http(s) URL。', false); return; }
    try {
      const res = await fetch(url, { redirect:'follow', cache: 'no-cache', credentials:'omit' });
      const txt = await res.text();
      if (!res.ok) { setStatus($status, `下载失败：HTTP ${res.status}`, false); return; }
      const val = validateCustomRules(txt);
      if (!val.ok) { setStatus($status, `校验失败：${val.msg}`, false); return; }
      // 建议规则名
      try {
        const u = new URL(url);
        const base = (u.pathname.split('/').pop() || '').replace(/\.[a-z0-9]+$/i,'') || u.hostname;
        if ($name && !$name.value) $name.value = decodeURIComponent(base);
      } catch {}
      // 暂存到按钮 dataset 以便“确认添加”复用
      $add.dataset.fetchedUrl = url;
      $add.dataset.fetchedText = txt;
      setStatus($status, `校验通过，共 ${val.count} 条规则。请填写名称后确认添加。`, true);
      $step2.style.display = '';
    } catch (e) {
      setStatus($status, `下载异常：${e?.message || String(e)}`, false);
    }
  });

  if ($add) $add.addEventListener('click', async () => {
    const name = ($name?.value || '').trim();
    const url = $add.dataset.fetchedUrl || '';
    const txt = $add.dataset.fetchedText || '';
    if (!url || !txt) { setStatus($status, '请先下载并通过校验。', false); return; }
    if (!name) { setStatus($status, '请填写规则名称。', false); return; }
    const id = `custom_${simpleHash32(url)}`;
    try {
      const now = Date.now();
      // 更新 sync: 自定义条目
      const all = await chrome.storage.sync.get({ adblock_custom_lists: [] });
      const list = Array.isArray(all.adblock_custom_lists) ? all.adblock_custom_lists : [];
      if (list.some(x => x.id === id || (x.url && x.url === url))) { setStatus($status, '此 URL 已添加。', false); return; }
      list.push({ id, name, url });
      await chrome.storage.sync.set({ adblock_custom_lists: list });
      // 写入 local: 规则内容
      const loc = await chrome.storage.local.get({ adblock_rules: {} });
      const rules = loc.adblock_rules || {};
      rules[id] = { id, url, name, size: txt.length, updatedAt: now, content: txt };
      await chrome.storage.local.set({ adblock_rules: rules, adblock_last_update: now });
      // 刷新列表
      await renderCustomAdblockListsFromSync();
      setStatus($status, '已添加，记得勾选以启用。', true);
      $step2.style.display = 'none';
      $add.dataset.fetchedUrl=''; $add.dataset.fetchedText='';
      $name.value=''; $url.value='';
    } catch (e) {
      setStatus($status, `保存失败：${e?.message || String(e)}`, false);
    }
  });

  if ($txtAdd) $txtAdd.addEventListener('click', async () => {
    const name = ($txtName?.value || '').trim();
    const text = ($txt?.value || '').trim();
    const $stat = document.getElementById('custom_text_status');
    const ok = name && text;
    if (!ok) { setStatus($stat, '名称与文本均不能为空。', false); return; }
    const val = validateCustomRules(text);
    if (!val.ok) { setStatus($stat, `校验失败：${val.msg}`, false); return; }
    const id = `custom_text_${simpleHash32(name)}`;
    try {
      const now = Date.now();
      const all = await chrome.storage.sync.get({ adblock_custom_lists: [] });
      const list = Array.isArray(all.adblock_custom_lists) ? all.adblock_custom_lists : [];
      if (list.some(x => x.id === id)) { setStatus($stat, '同名规则已存在，请更换名称。', false); return; }
      list.push({ id, name });
      await chrome.storage.sync.set({ adblock_custom_lists: list });
      const loc = await chrome.storage.local.get({ adblock_rules: {} });
      const rules = loc.adblock_rules || {};
      rules[id] = { id, name, size: text.length, updatedAt: now, content: text };
      await chrome.storage.local.set({ adblock_rules: rules, adblock_last_update: now });
      await renderCustomAdblockListsFromSync();
      setStatus($stat, `已添加（${val.count} 条）。记得勾选以启用。`, true);
      $txt.value=''; $txtName.value='';
    } catch (e) {
      setStatus($stat, `保存失败：${e?.message || String(e)}`, false);
    }
  });
}


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

// 初始加载移至 DOMContentLoaded 里，确保先渲染广告列表再回填
