// settings.js —— 统一默认值、平台预设与读取逻辑（Options/Background可共用）

import { FILTER_DEFAULT_STRENGTH } from "./adblock_lists.js";

export const AZURE_DEFAULT_API_VERSION = "2024-02-15-preview";

export const DEFAULTS = {
  // 首次安装默认就是“试用”
  aiProvider: "trial",
  baseURL: "https://api.openai.com/v1",
  model_extract: "gpt-4o-mini",
  model_summarize: "gpt-4o-mini",
  output_lang: "",
  extract_mode: "fast",
  system_prompt_preset: "general_summary",
  system_prompt_custom: ""
};

// 各平台预设（试用模式固定 key 与地址）
export const PROVIDER_PRESETS = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    model_extract: "gpt-4o-mini",
    model_summarize: "gpt-4o-mini",
    apiKeyKey: "apiKey_openai"
  },
  deepseek: {
    baseURL: "https://api.deepseek.com/v1",
    model_extract: "deepseek-chat",
    model_summarize: "deepseek-chat",
    apiKeyKey: "apiKey_deepseek"
  },
  anthropic: {
    baseURL: "https://api.anthropic.com/v1",
    model_extract: "claude-3-haiku-20240307",
    model_summarize: "claude-3-5-sonnet-20240620",
    apiKeyKey: "apiKey_anthropic"
  },
  gemini: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    model_extract: "gemini-1.5-flash-latest",
    model_summarize: "gemini-1.5-pro-latest",
    apiKeyKey: "apiKey_gemini"
  },
  azure: {
    baseURL: "https://YOUR_RESOURCE_NAME.openai.azure.com",
    model_extract: "extract-deployment",
    model_summarize: "summary-deployment",
    apiKeyKey: "apiKey_azure"
  },
  trial: {
    baseURL: "https://mallocfeng1982.win/v1",
    model_extract: "deepseek-chat",
    model_summarize: "deepseek-chat",
    apiKeyKey: "apiKey_trial",
    apiKeyFixed: "trial",   // 固定 key
    lockFields: true        // UI 锁定
  },
  custom: {
    apiKeyKey: "apiKey_custom"
  }
};

/**
 * 统一读取设置（用于 Options 页）：
 * - 若用户从未保存过，返回 Trial 的默认组合；
 * - 若保存过，按保存值 + 对应平台预设合并；
 * - 返回结构简单统一：{ aiProvider, apiKey, baseURL, model_extract, model_summarize, output_lang, extract_mode, system_prompt_* }
 */
export async function getSettings() {
  const d = await chrome.storage.sync.get([
    "aiProvider",
    "apiKey", "apiKey_openai", "apiKey_deepseek", "apiKey_anthropic", "apiKey_gemini", "apiKey_azure", "apiKey_custom", "apiKey_trial",
    "baseURL", "model_extract", "model_summarize",
    "output_lang", "extract_mode",
    "system_prompt_preset", "system_prompt_custom"
  ]);

  const aiProvider = d.aiProvider || DEFAULTS.aiProvider; // 默认 trial
  const preset = PROVIDER_PRESETS[aiProvider] || {};

  // 选择当前平台的专用 key（若无则回退通用 apiKey）
  const providerKeyName = preset.apiKeyKey;
  const providerSavedKey = providerKeyName ? (d[providerKeyName] || "") : "";

  // 试用：固定值；其他：若未填则给平台预设/默认
  const baseURL = (aiProvider === "trial")
    ? preset.baseURL
    : (d.baseURL || preset.baseURL || DEFAULTS.baseURL);

  const model_extract = (aiProvider === "trial")
    ? preset.model_extract
    : (d.model_extract || preset.model_extract || DEFAULTS.model_extract);

  const model_summarize = (aiProvider === "trial")
    ? preset.model_summarize
    : (d.model_summarize || preset.model_summarize || DEFAULTS.model_summarize);

  const apiKey = (aiProvider === "trial")
    ? (preset.apiKeyFixed || "trial")
    : (providerSavedKey || d.apiKey || "");

  const extract_mode = (aiProvider === "trial")
    ? "fast"
    : (d.extract_mode || DEFAULTS.extract_mode);

  return {
    aiProvider,
    apiKey,
    baseURL,
    model_extract,
    model_summarize,
    output_lang: d.output_lang || DEFAULTS.output_lang,
    extract_mode,
    system_prompt_preset: d.system_prompt_preset || DEFAULTS.system_prompt_preset,
    system_prompt_custom: d.system_prompt_custom || DEFAULTS.system_prompt_custom
  };
}

export const SETTINGS_SNAPSHOT_KEYS = [
  "aiProvider",
  "apiKey",
  "apiKey_openai",
  "apiKey_deepseek",
  "apiKey_anthropic",
  "apiKey_gemini",
  "apiKey_azure",
  "apiKey_custom",
  "apiKey_trial",
  "baseURL",
  "model_extract",
  "model_summarize",
  "output_lang",
  "extract_mode",
  "system_prompt_preset",
  "system_prompt_custom",
  "trial_consent",
  "adblock_enabled",
  "adblock_strength",
  "adblock_selected",
  "adblock_block_popups",
  "nyt_block_family_popup",
  "adblock_user_rules_text",
  "adblock_custom_lists",
  "ui_language"
];

const SNAPSHOT_DEFAULTS = {
  aiProvider: DEFAULTS.aiProvider,
  apiKey: "",
  apiKey_openai: "",
  apiKey_deepseek: "",
  apiKey_anthropic: "",
  apiKey_gemini: "",
  apiKey_azure: "",
  apiKey_custom: "",
  apiKey_trial: "trial",
  baseURL: DEFAULTS.baseURL,
  model_extract: DEFAULTS.model_extract,
  model_summarize: DEFAULTS.model_summarize,
  output_lang: DEFAULTS.output_lang,
  extract_mode: DEFAULTS.extract_mode,
  system_prompt_preset: DEFAULTS.system_prompt_preset,
  system_prompt_custom: DEFAULTS.system_prompt_custom,
  trial_consent: false,
  adblock_enabled: false,
  adblock_strength: FILTER_DEFAULT_STRENGTH,
  adblock_selected: [],
  adblock_block_popups: false,
  nyt_block_family_popup: false,
  adblock_user_rules_text: "",
  adblock_custom_lists: [],
  ui_language: "zh"
};

const SAFE_STRING = (value, fallback = "") =>
  (typeof value === "string") ? value : fallback;

export function normalizeSettingsSnapshot(raw = {}) {
  const source = raw || {};
  const out = { ...SNAPSHOT_DEFAULTS };

  out.aiProvider = SAFE_STRING(source.aiProvider, SNAPSHOT_DEFAULTS.aiProvider) || SNAPSHOT_DEFAULTS.aiProvider;
  out.apiKey = SAFE_STRING(source.apiKey, "");
  out.apiKey_openai = SAFE_STRING(source.apiKey_openai, "");
  out.apiKey_deepseek = SAFE_STRING(source.apiKey_deepseek, "");
  out.apiKey_anthropic = SAFE_STRING(source.apiKey_anthropic, "");
  out.apiKey_gemini = SAFE_STRING(source.apiKey_gemini, "");
  out.apiKey_azure = SAFE_STRING(source.apiKey_azure, "");
  out.apiKey_custom = SAFE_STRING(source.apiKey_custom, "");
  out.apiKey_trial = SAFE_STRING(source.apiKey_trial, SNAPSHOT_DEFAULTS.apiKey_trial) || SNAPSHOT_DEFAULTS.apiKey_trial;

  out.baseURL = SAFE_STRING(source.baseURL, SNAPSHOT_DEFAULTS.baseURL) || SNAPSHOT_DEFAULTS.baseURL;
  out.model_extract = SAFE_STRING(source.model_extract, SNAPSHOT_DEFAULTS.model_extract) || SNAPSHOT_DEFAULTS.model_extract;
  out.model_summarize = SAFE_STRING(source.model_summarize, SNAPSHOT_DEFAULTS.model_summarize) || SNAPSHOT_DEFAULTS.model_summarize;
  out.output_lang = SAFE_STRING(source.output_lang, SNAPSHOT_DEFAULTS.output_lang);
  out.extract_mode = SAFE_STRING(source.extract_mode, SNAPSHOT_DEFAULTS.extract_mode) || SNAPSHOT_DEFAULTS.extract_mode;
  out.system_prompt_preset = SAFE_STRING(source.system_prompt_preset, SNAPSHOT_DEFAULTS.system_prompt_preset) || SNAPSHOT_DEFAULTS.system_prompt_preset;
  out.system_prompt_custom = SAFE_STRING(source.system_prompt_custom, SNAPSHOT_DEFAULTS.system_prompt_custom);

  out.trial_consent = !!source.trial_consent;

  out.adblock_enabled = !!source.adblock_enabled;
  out.adblock_strength = SAFE_STRING(source.adblock_strength, SNAPSHOT_DEFAULTS.adblock_strength) || SNAPSHOT_DEFAULTS.adblock_strength;
  out.adblock_selected = Array.isArray(source.adblock_selected)
    ? Array.from(new Set(source.adblock_selected.map((x) => SAFE_STRING(x, "").trim()).filter(Boolean)))
    : [];
  out.adblock_block_popups = !!source.adblock_block_popups;
  out.nyt_block_family_popup = !!source.nyt_block_family_popup;
  out.adblock_user_rules_text = SAFE_STRING(source.adblock_user_rules_text, "");

  if (Array.isArray(source.adblock_custom_lists)) {
    const dedupe = new Set();
    const cleaned = [];
    for (const item of source.adblock_custom_lists) {
      if (!item || typeof item !== "object") continue;
      const id = SAFE_STRING(item.id, "").trim();
      if (!id) continue;
      const name = SAFE_STRING(item.name, id);
      const url = SAFE_STRING(item.url, "");
      const key = `${id}::${url}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      const entry = { id };
      if (name && name !== id) entry.name = name;
      if (url) entry.url = url;
      cleaned.push(entry);
    }
    out.adblock_custom_lists = cleaned;
  } else {
    out.adblock_custom_lists = [];
  }

  out.ui_language = SAFE_STRING(source.ui_language, SNAPSHOT_DEFAULTS.ui_language) || SNAPSHOT_DEFAULTS.ui_language;

  return out;
}

export async function persistSettingsSnapshot(override = {}) {
  try {
    const current = await chrome.storage.sync.get(SETTINGS_SNAPSHOT_KEYS);
    const merged = { ...current, ...override };
    const data = normalizeSettingsSnapshot(merged);
    const snapshot = {
      version: 1,
      savedAt: Date.now(),
      data
    };
    await chrome.storage.sync.set({ sx_settings_snapshot_v1: snapshot });
    try { await chrome.storage.local.set({ sx_settings_snapshot_v1: snapshot }); } catch {}
    return snapshot;
  } catch (e) {
    console.warn("persistSettingsSnapshot failed", e);
    return null;
  }
}

export function buildAzureChatCompletionsURL(baseURL, deployment, version = AZURE_DEFAULT_API_VERSION) {
  const trimmed = String(baseURL || "").trim();
  if (!trimmed) return "";
  const hasChat = /\/chat\/completions/i.test(trimmed);
  if (hasChat) return trimmed;

  const [root, query] = trimmed.split(/\?/);
  const versionInQuery = query && /api-version=/i.test(query);
  const basePath = /\/openai\/deployments\//i.test(root)
    ? root.replace(/\/$/, "")
    : `${root.replace(/\/$/, "")}/openai/deployments/${encodeURIComponent(deployment || "default")}`;
  const params = new URLSearchParams(query || "");
  if (!versionInQuery) {
    params.set("api-version", version || AZURE_DEFAULT_API_VERSION);
  }
  const queryString = params.toString();
  return queryString ? `${basePath}/chat/completions?${queryString}` : `${basePath}/chat/completions`;
}
