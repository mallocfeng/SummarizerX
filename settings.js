// settings.js —— 统一默认值、平台预设与读取逻辑（Options/Background可共用）

export const DEFAULTS = {
  // 首次安装默认就是“试用”
  aiProvider: "trial",
  baseURL: "https://api.openai.com/v1",
  model_extract: "gpt-4o-mini",
  model_summarize: "gpt-4o-mini",
  output_lang: "",
  extract_mode: "fast",
  local_mode: false,
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
    "apiKey", "apiKey_openai", "apiKey_deepseek", "apiKey_custom", "apiKey_trial",
    "baseURL", "model_extract", "model_summarize",
    "output_lang", "extract_mode",
    "system_prompt_preset", "system_prompt_custom",
    "local_mode"
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
    local_mode: d.local_mode || DEFAULTS.local_mode,
    system_prompt_preset: d.system_prompt_preset || DEFAULTS.system_prompt_preset,
    system_prompt_custom: d.system_prompt_custom || DEFAULTS.system_prompt_custom
  };
}