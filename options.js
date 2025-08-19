// options.js —— 设置页（System Prompt、眼睛显示 Key、保存在最下）
const $ = (id) => document.getElementById(id);

const GUIDE_URL = chrome.runtime.getURL('help_buy_api.html');
const GUIDE_OPENAI  = `${GUIDE_URL}#openai`;
const GUIDE_DEEPSEEK = `${GUIDE_URL}#deepseek`;

const DEFAULTS = {
  baseURL: "https://api.openai.com/v1",
  model_extract: "gpt-4o-mini",
  model_summarize: "gpt-4o-mini",
  output_lang: "",
  extract_mode: "fast",
  system_prompt_preset: "general_summary",
  system_prompt_custom: "",
  aiProvider: "openai",
};

const PRESETS = {
  general_summary: "You are a precise assistant for distilling web articles. Be faithful and concise. Avoid speculation.",
  faithful_translation: "You are a professional translator. Preserve meaning, tone and technical terms faithfully. Avoid adding information.",
  tech_article_translation: "You are a technical translator for software articles. Keep code, commands and technical terms unchanged. Clarify ambiguous references."
};

// —— 各平台预设
const PROVIDER_PRESETS = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    model_extract: "gpt-4o-mini",
    model_summarize: "gpt-4o-mini",
    apiKeyKey: "apiKey_openai",
  },
  deepseek: {
    baseURL: "https://api.deepseek.com/v1",
    model_extract: "deepseek-chat",
    model_summarize: "deepseek-chat",
    apiKeyKey: "apiKey_deepseek",
  },
  custom: {
    // 自定义不套默认，保持用户可自由输入
    apiKeyKey: "apiKey_custom",
  }
};

function setStatus(text) { $("status").textContent = text; }
function setMeta(meta) {
  $("meta").textContent = `当前配置：provider=${meta.aiProvider}，extract=${meta.model_extract}，summary=${meta.model_summarize}，base=${meta.baseURL}，lang=${meta.output_lang || "auto"}，mode=${meta.extract_mode}`;
}

// 版本号
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('app-version');
  if (!el) return;
  const { version, version_name } = chrome.runtime.getManifest();
  el.textContent = `v${version}`;
  el.title = version_name || version;
  const $openaiGuide = document.getElementById('link-buy-openai');
  const $deepseekGuide = document.getElementById('link-buy-deepseek');
  if ($openaiGuide)  $openaiGuide.href  = GUIDE_OPENAI;
  if ($deepseekGuide) $deepseekGuide.href = GUIDE_DEEPSEEK;
});

// —— 根据输出语言，生成强制语言尾注
function langSuffix() {
  const lang = ($("output_lang").value || "").toLowerCase();
  if (lang === "zh") return "\n\n请仅用中文输出结果。";
  if (lang === "en") return "\n\nRespond only in English.";
  return "\n\nEnsure the output strictly matches the target language.";
}

function reflectGuideLink(){
  const p = $("aiProvider").value;
  const o = document.getElementById('link-buy-openai');
  const d = document.getElementById('link-buy-deepseek');
  if (!o || !d) return;
  if (p === "openai") { o.style.display = "inline"; d.style.display = "none"; }
  else if (p === "deepseek") { o.style.display = "none"; d.style.display = "inline"; }
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

// —— 预设 + 语言尾注 → 覆盖到自定义文本框
// function applyPresetToTextarea(force = false) {
//   const box = $("system_prompt_custom");
//   const presetKey = $("system_prompt_preset").value || "general_summary";
//   const base = PRESETS[presetKey] || PRESETS.general_summary;
//   const newText = base + langSuffix();
//   if (!box.value.trim() || force) {
//     box.value = newText;
//   }
// }

function applyPresetToTextarea(force = false) {
  const box = $("system_prompt_custom");
  const presetKey = $("system_prompt_preset").value || "general_summary";
  const base = PRESETS[presetKey] || PRESETS.general_summary;

  const newText = base + formatRulesSuffix() + langSuffix(); // ← 加上“只用 Markdown”硬规则
  if (!box.value.trim() || force) {
    box.value = newText;
  }
}

/* =========================
 * 载入/保存
 * ========================= */
async function loadSettings() {
  const d = await chrome.storage.sync.get([
    "aiProvider",
    "apiKey", "apiKey_openai", "apiKey_deepseek", "apiKey_custom",
    "baseURL","model_extract","model_summarize",
    "output_lang","extract_mode","system_prompt_preset","system_prompt_custom"
  ]);

  // 平台（默认 openai）
  const aiProvider = d.aiProvider || DEFAULTS.aiProvider;
  $("aiProvider").value = aiProvider;

  // API Key：展示当前平台专用 Key（若没有，则 fallback 到通用 apiKey 或留空）
  const providerKeyName = PROVIDER_PRESETS[aiProvider]?.apiKeyKey;
  const providerSavedKey = (providerKeyName && d[providerKeyName]) ? d[providerKeyName] : "";
  $("apiKey").value = providerSavedKey || d.apiKey || "";

  // Base / 模型：如果 provider = openai / deepseek，优先用预设；否则用已存或默认
  if (aiProvider === "openai" || aiProvider === "deepseek") {
    const p = PROVIDER_PRESETS[aiProvider];
    $("baseURL").value = p.baseURL;
    $("model_extract").value = p.model_extract;
    $("model_summarize").value = p.model_summarize;
  } else {
    $("baseURL").value = d.baseURL || DEFAULTS.baseURL;
    $("model_extract").value = d.model_extract || DEFAULTS.model_extract;
    $("model_summarize").value = d.model_summarize || DEFAULTS.model_summarize;
  }

  $("output_lang").value = d.output_lang || DEFAULTS.output_lang;
  $("extract_mode").value = d.extract_mode || DEFAULTS.extract_mode;
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
  reflectGuideLink(); // 更新购买指南链接显示
  updateBuyHelp($("aiProvider").value || "openai");
}

async function saveSettings() {
  const aiProvider = $("aiProvider").value || DEFAULTS.aiProvider;
  const payload = {
    aiProvider,
    apiKey: $("apiKey").value.trim(), // 仍然保存一份“当前使用”的通用 Key
    baseURL: ($("baseURL").value.trim() || DEFAULTS.baseURL).replace(/\/+$/,""),
    model_extract: $("model_extract").value.trim(),
    model_summarize: $("model_summarize").value.trim(),
    output_lang: $("output_lang").value,
    extract_mode: $("extract_mode").value,
    system_prompt_preset: $("system_prompt_preset").value,
    system_prompt_custom: $("system_prompt_custom").value.trim()
  };

  // 同时把当前平台的 key 单独保存（方便切换时自动带回）
  const providerKeyName = PROVIDER_PRESETS[aiProvider]?.apiKeyKey;
  if (providerKeyName) {
    payload[providerKeyName] = payload.apiKey;
  }

  await chrome.storage.sync.set(payload);
  setStatus("已保存设置 ✅");
  setMeta(payload);
}

/* =========================
 * API Key 测试
 * ========================= */
async function testApiKey() {
  const cleanupSlash = (s="") => s.replace(/\/+$/,"");
  try {
    const key = $("apiKey").value.trim();
    const base = cleanupSlash($("baseURL").value.trim() || DEFAULTS.baseURL);
    const model = $("model_summarize").value.trim() || DEFAULTS.model_summarize;
    if (!key) throw new Error("请先输入 API Key");
    setStatus("⏳ 正在测试 API Key 与 Base URL…");

    // --- 尝试 1：/v1/models（多数 OpenAI 兼容端可用）
    const resp1 = await fetch(`${base}/models`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${key}` }
    });

    if (resp1.ok) {
      setStatus("✅ 测试通过：/models 可访问，Key 有效");
      return;
    }

    // --- 尝试 2：/v1/chat/completions（有些兼容端不实现 /models）
    const payload = {
      model,
      messages: [{ role: "user", content: "ping" }],
      temperature: 0
    };
    const resp2 = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });

    if (resp2.ok) {
      setStatus("✅ 测试通过：/chat/completions 可访问，Key 有效");
      return;
    }

    const t1 = await safeReadText(resp1);
    const t2 = await safeReadText(resp2);
    throw new Error(`两种探测均失败。\n/models => ${resp1.status} ${t1}\n/chat/completions => ${resp2.status} ${t2}`);
  } catch (e) {
    setStatus("❌ 测试失败：" + (e?.message || String(e)));
  }
}

async function safeReadText(res) {
  try { return await res.text(); } catch { return "(no body)"; }
}

function toggleApiKeyVisibility() {
  const input = $("apiKey");
  input.type = input.type === "password" ? "text" : "password";
}

/* =========================
 * 平台切换 & 自定义检测
 * ========================= */
let isProgrammaticProviderChange = false; // 程序性切换时，忽略 change 回调

async function onProviderChange() {
  if (isProgrammaticProviderChange) return;

  const provider = $("aiProvider").value || "openai";
  const d = await chrome.storage.sync.get([
    "apiKey","apiKey_openai","apiKey_deepseek","apiKey_custom"
  ]);

  if (provider === "openai" || provider === "deepseek") {
    const p = PROVIDER_PRESETS[provider];

    // 1) 切换 Base / 模型为预设
    $("baseURL").value = p.baseURL;
    $("model_extract").value = p.model_extract;
    $("model_summarize").value = p.model_summarize;

    // 2) 尝试填充该平台的已保存 Key（否则留空）
    const keyName = p.apiKeyKey;
    const saved = keyName ? (d[keyName] || "") : "";
    $("apiKey").value = saved || ""; // 没保存过就留空
  } else {
    // custom：不动用户输入（如果需要也可从存储带回）
    const saved = d.apiKey_custom || "";
    if (saved) $("apiKey").value = saved;
  }

  setMeta({
    aiProvider: provider,
    baseURL: $("baseURL").value,
    model_extract: $("model_extract").value,
    model_summarize: $("model_summarize").value,
    output_lang: $("output_lang").value,
    extract_mode: $("extract_mode").value
  });
  reflectGuideLink(); // 更新购买指南链接显示
  updateBuyHelp(provider);
}

// —— 监听“会导致自定义”的输入，但 **不包含 apiKey**
function markCustomIfManualChange() {
  // 用户手动改了 Base/模型 → 切到 custom
  const sel = $("aiProvider");
  if (sel.value !== "custom") {
    isProgrammaticProviderChange = true;
    sel.value = "custom";
    isProgrammaticProviderChange = false;
  }
}

function onPresetChange() {
  const box = $("system_prompt_custom");
  if (box.value.trim()) {
    if (confirm("自定义提示词已有内容，是否覆盖？")) {
      applyPresetToTextarea(true);
    }
  } else {
    applyPresetToTextarea(true);
  }
}

function onOutputLangChange() {
  const box = $("system_prompt_custom");
  if (box.value.trim()) {
    if (confirm("自定义提示词已有内容，是否根据新语言覆盖？")) {
      applyPresetToTextarea(true);
    }
  } else {
    applyPresetToTextarea(true);
  }
}

// === 动态为内容区与占位块设置正确的底部留白 ===
function fitDockPadding() {
  const dock = document.querySelector('.save-dock');
  const main = document.querySelector('.main-with-dock');
  const spacer = document.getElementById('dock-spacer');
  if (!dock || !main) return;

  const h = dock.getBoundingClientRect().height || 0;
  // 主内容底部留白 = 保存栏高度 + 16px 视觉间距
  main.style.paddingBottom = `${h + 16}px`;
  if (spacer) spacer.style.height = `${h}px`;
}


function updateBuyHelp(provider) {
  const open = document.getElementById('link-buy-openai');
  const deep = document.getElementById('link-buy-deepseek');
  const sep  = document.getElementById('buy-help-sep');

  if (!open || !deep || !sep) return;

  // 可选：在这里统一设置 href（更稳，不怕文件名变化）
  try {
    const guideUrl = GUIDE_URL;
    open.href = GUIDE_OPENAI
    deep.href = GUIDE_DEEPSEEK;
  } catch (e) {
    // 如果不是扩展环境或无权限，忽略即可
  }

  // 逻辑：custom 显示两个链接；openai 只显示 OpenAI；deepseek 只显示 DeepSeek
  if (provider === 'custom') {
    open.style.display = 'inline';
    deep.style.display = 'inline';
    sep.style.display  = 'inline';
  } else if (provider === 'openai') {
    open.style.display = 'inline';
    deep.style.display = 'none';
    sep.style.display  = 'none'; // 只剩一个链接 → 不显示分隔点
  } else if (provider === 'deepseek') {
    open.style.display = 'none';
    deep.style.display = 'inline';
    sep.style.display  = 'none'; // 只剩一个链接 → 不显示分隔点
  } else {
    // 兜底：显示两个
    open.style.display = 'inline';
    deep.style.display = 'inline';
    sep.style.display  = 'inline';
  }
}


document.addEventListener('DOMContentLoaded', () => {
  // 你原有的初始化逻辑……
  // （保持不动）

  // 初始化底部留白
  fitDockPadding();

  // 窗口尺寸变化时更新
  window.addEventListener('resize', fitDockPadding);

  // 监听保存栏高度变化（换行/文案变化等）
  const dock = document.querySelector('.save-dock');
  if (window.ResizeObserver && dock) {
    const ro = new ResizeObserver(() => fitDockPadding());
    ro.observe(dock);
  }
});

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

// 平台切换
$("aiProvider").addEventListener("change", onProviderChange);

// 手动改 Base / 模型 → 切自定义（不监听 apiKey）
$("baseURL").addEventListener("input", markCustomIfManualChange);
$("model_extract").addEventListener("input", markCustomIfManualChange);
$("model_summarize").addEventListener("input", markCustomIfManualChange);

// 初始加载
loadSettings();