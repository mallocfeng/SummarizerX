// options.js —— 设置页（System Prompt、眼睛显示 Key、保存在最下）
const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  baseURL: "https://api.openai.com/v1",
  model_extract: "gpt-4o-mini",
  model_summarize: "gpt-4o-mini",
  output_lang: "",
  extract_mode: "fast",
  system_prompt_preset: "general_summary",
  system_prompt_custom: ""
};

const PRESETS = {
  general_summary: "You are a precise assistant for distilling web articles. Be faithful and concise. Avoid speculation.",
  faithful_translation: "You are a professional translator. Preserve meaning, tone and technical terms faithfully. Avoid adding information.",
  tech_article_translation: "You are a technical translator for software articles. Keep code, commands and technical terms unchanged. Clarify ambiguous references."
};

function setStatus(text) { $("status").textContent = text; }
function setMeta(meta) {
  $("meta").textContent = `当前配置：extract=${meta.model_extract}，summary=${meta.model_summarize}，base=${meta.baseURL}，lang=${meta.output_lang || "auto"}，mode=${meta.extract_mode}`;
}

// options.js
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('app-version');
  if (!el) return;

  const { version, version_name } = chrome.runtime.getManifest();
  // 显示短版本，鼠标悬停显示更详细信息（可选）
  el.textContent = `v${version}`;
  el.title = version_name || version;
});

// —— 根据输出语言，生成强制语言尾注
function langSuffix() {
  const lang = ($("output_lang").value || "").toLowerCase();
  if (lang === "zh") return "\n\n请仅用中文输出结果。";
  if (lang === "en") return "\n\nRespond only in English.";
  return "\n\nEnsure the output strictly matches the target language.";
}

// —— 预设 + 语言尾注 → 覆盖到自定义文本框
function applyPresetToTextarea(force = false) {
  const box = $("system_prompt_custom");
  const presetKey = $("system_prompt_preset").value || "general_summary";
  const base = PRESETS[presetKey] || PRESETS.general_summary;
  const newText = base + langSuffix();

  if (!box.value.trim() || force) {
    box.value = newText;
  }
}

async function loadSettings() {
  const d = await chrome.storage.sync.get([
    "apiKey","baseURL","model_extract","model_summarize",
    "output_lang","extract_mode","system_prompt_preset","system_prompt_custom"
  ]);
  $("apiKey").value = d.apiKey || "";
  $("baseURL").value = d.baseURL || DEFAULTS.baseURL;
  $("model_extract").value = d.model_extract || DEFAULTS.model_extract;
  $("model_summarize").value = d.model_summarize || DEFAULTS.model_summarize;
  $("output_lang").value = d.output_lang || DEFAULTS.output_lang;
  $("extract_mode").value = d.extract_mode || DEFAULTS.extract_mode;
  $("system_prompt_preset").value = d.system_prompt_preset || DEFAULTS.system_prompt_preset;

  if (d.system_prompt_custom && d.system_prompt_custom.trim()) {
    $("system_prompt_custom").value = d.system_prompt_custom;
  } else {
    applyPresetToTextarea(true);
  }

  setMeta({
    baseURL: $("baseURL").value,
    model_extract: $("model_extract").value,
    model_summarize: $("model_summarize").value,
    output_lang: $("output_lang").value,
    extract_mode: $("extract_mode").value
  });
}

async function saveSettings() {
  const payload = {
    apiKey: $("apiKey").value.trim(),
    baseURL: ($("baseURL").value.trim() || DEFAULTS.baseURL).replace(/\/+$/,""),
    model_extract: $("model_extract").value.trim(),
    model_summarize: $("model_summarize").value.trim(),
    output_lang: $("output_lang").value,
    extract_mode: $("extract_mode").value,
    system_prompt_preset: $("system_prompt_preset").value,
    system_prompt_custom: $("system_prompt_custom").value.trim()
  };
  await chrome.storage.sync.set(payload);
  setStatus("已保存设置 ✅");
  setMeta(payload);
}

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

// 辅助：安全读取响应文本
async function safeReadText(res) {
  try { return await res.text(); } catch { return "(no body)"; }
}

function toggleApiKeyVisibility() {
  const input = $("apiKey");
  input.type = input.type === "password" ? "text" : "password";
}

/* ========== 事件 ========== */

// 预设变化：若已有内容，先确认
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

// 输出语言变化：若已有内容，先确认
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

loadSettings();