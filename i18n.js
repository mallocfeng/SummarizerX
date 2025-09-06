// i18n.js - 国际化配置文件
const I18N = {
  zh: {
    // 设置页面
    settings: {
      title: "麦乐可 AI 摘要阅读器 · 设置",
      subtitle: "配置 API / 模型 / 输出语言与 System Prompt 预设；底部有统一的\"保存全部设置\"。",
      basicConfig: "基础配置",
      aiPlatform: "AI 平台",
      trial: "试用（推荐体验）",
      openai: "OpenAI（默认）",
      deepseek: "DeepSeek",
      custom: "自定义",
      buyHelp: "不会买？查看：",
      openaiGuide: "OpenAI 指南",
      deepseekGuide: "DeepSeek 指南",
      hint: "切换平台将自动填写 Base URL 和模型；若手动修改任意字段，将自动切到「自定义」。",
      apiKey: "OpenAI API Key",
      baseURL: "Base URL",
      extractModel: "清洗模型（extract）",
      summarizeModel: "摘要/翻译模型（summarize）",
      outputLang: "输出语言（Output Language）",
      auto: "自动（Auto）",
      chinese: "中文（Chinese）",
      english: "English（英文）",
      extractMode: "正文提取方式（Extract Mode）",
      fastLocal: "本地快速（推荐）",
      aiExtract: "AI 清洗",
      systemPrompt: "System Prompt（系统提示词）",
      presets: "选择预设（Presets）",
      generalSummary: "General summarization",
      faithfulTranslation: "Faithful translation",
      techArticleTranslation: "Tech article translation",
      presetHint: "说明：可选预设为英文描述；你也可以在下面输入自定义提示词。无论选择哪种提示词，系统都会强制追加一句\"请将结果输出为目标语言\"（根据\"输出语言\"或自动识别）。",
      customPrompt: "自定义系统提示词（可留空）",
      customPromptPlaceholder: "例如：Be concise and faithful. Keep structure and factual accuracy.",
      shortcuts: "快捷键设置",
      shortcutDesc: "你可以在 Chrome 的扩展快捷键页面里绑定快捷键，用于快速打开侧边栏。",
      setShortcut: "去设置快捷键",
      shortcutHint: "前往 chrome://extensions/shortcuts，搜索\"麦乐可AI摘要阅读器\"，给命令 打开/切换侧边栏 绑定组合键。",
      ready: "就绪",
      saveAll: "保存全部设置",
      testApi: "测试 API Key",
      appearance: "外观",
      forceDarkMode: "强制深色",
      autoTheme: "自动",
      lightTheme: "浅色",
      darkTheme: "深色",
      saved: "已保存设置 ✅",
      testing: "⏳ 正在测试 API Key 与 Base URL…",
      testSuccess: "✅ 测试通过：/models 可访问，Key 有效",
      testSuccessChat: "✅ 测试通过：/chat/completions 可访问，Key 有效",
      testFailed: "❌ 测试失败：",
      noApiKey: "请先输入 API Key",
      trialLocked: "试用模式下此项已锁定。如需自定义，请切换到 OpenAI/DeepSeek/自定义。",
      trialConsentText: "我已阅读并同意：试用模式会通过代理服务器传输页面内容，用于生成摘要/清洗正文。",
      trialConsentRequired: "试用模式需先同意通过代理传输页面内容，请勾选同意并保存后继续试用。",
      trialAutoSwitch: "未同意试用条款，已自动切换为 OpenAI 模式。",
      trialConsentPrompt: "当前未勾选试用模式同意。是否切换为 OpenAI 模式并继续保存？",
      saveCancelled: "已取消保存。",
      confirmOverride: "自定义提示词已有内容，是否覆盖？",
      confirmLangOverride: "自定义提示词已有内容，是否根据新语言覆盖？",
      localMode: "本地模式（不上传内容）",
      localModeHint: "启用后，摘要和翻译功能将禁用，页面内容不会上传。",
      privacyPolicy: "隐私政策 / Privacy Policy"
    },
    // 浮窗面板
    floatPanel: {
      summary: "摘要",
      translation: "翻译",
      extract: "提取",
      loading: "加载中...",
      error: "错误",
      retry: "重试",
      close: "关闭",
      copy: "复制",
      copied: "已复制",
      expand: "展开",
      collapse: "收起",
      noSelection: "请先选择文本",
      networkError: "网络错误，请检查网络连接",
      apiError: "API 错误，请检查配置",
      unknownError: "未知错误"
    },
    // 右键菜单
    contextMenu: {
      summarize: "摘要选中文本",
      translate: "翻译选中文本",
      extract: "提取正文"
    },
    // 扩展图标
    action: {
      togglePanel: "打开/关闭右侧悬浮面板"
    }
  },
  en: {
    // Settings page
    settings: {
      title: "SummarizerX AI Reader · Settings",
      subtitle: "Configure API / Model / Output Language and System Prompt presets; unified 'Save All Settings' at the bottom.",
      basicConfig: "Basic Configuration",
      aiPlatform: "AI Platform",
      trial: "Trial (Recommended for Experience)",
      openai: "OpenAI (Default)",
      deepseek: "DeepSeek",
      custom: "Custom",
      buyHelp: "Don't know how to buy? Check:",
      openaiGuide: "OpenAI Guide",
      deepseekGuide: "DeepSeek Guide",
      hint: "Switching platforms will automatically fill Base URL and models; manually modifying any field will switch to 'Custom'.",
      apiKey: "OpenAI API Key",
      baseURL: "Base URL",
      extractModel: "Extract Model",
      summarizeModel: "Summarize/Translate Model",
      outputLang: "Output Language",
      auto: "Auto",
      chinese: "Chinese",
      english: "English",
      extractMode: "Extract Mode",
      fastLocal: "Fast Local (Recommended)",
      aiExtract: "AI Extract",
      systemPrompt: "System Prompt",
      presets: "Presets",
      generalSummary: "General summarization",
      faithfulTranslation: "Faithful translation",
      techArticleTranslation: "Tech article translation",
      presetHint: "Note: Presets are in English; you can also enter custom prompts below. Regardless of the prompt chosen, the system will force append \"Please output the result in the target language\" (based on \"Output Language\" or auto-detection).",
      customPrompt: "Custom System Prompt (can be empty)",
      customPromptPlaceholder: "e.g.: Be concise and faithful. Keep structure and factual accuracy.",
      shortcuts: "Keyboard Shortcuts",
      shortcutDesc: "You can bind keyboard shortcuts in Chrome's extension shortcuts page for quick sidebar access.",
      setShortcut: "Shortcuts",
      shortcutHint: "Go to chrome://extensions/shortcuts, search for \"SummarizerX AI Reader\", and bind a key combination to the \"Open/Toggle Sidebar\" command.",
      ready: "Ready",
      saveAll: "Save All",
      testApi: "Test API",
      appearance: "Appearance",
      forceDarkMode: "Force Dark",
      autoTheme: "Auto",
      lightTheme: "Light",
      darkTheme: "Dark",
      saved: "Settings saved ✅",
      testing: "⏳ Testing API Key and Base URL...",
      testSuccess: "✅ Test passed: /models accessible, Key valid",
      testSuccessChat: "✅ Test passed: /chat/completions accessible, Key valid",
      testFailed: "❌ Test failed:",
      noApiKey: "Please enter API Key first",
      trialLocked: "This item is locked in trial mode. To customize, please switch to OpenAI/DeepSeek/Custom.",
      trialConsentText: "I have read and agree: Trial mode sends page content via a proxy server to generate summaries/cleaned body.",
      trialConsentRequired: "Trial mode requires consent to send page content via proxy. Please check the box and save to continue the trial.",
      trialAutoSwitch: "Trial consent not given; switched to OpenAI mode automatically.",
      trialConsentPrompt: "Trial consent is not checked. Switch to OpenAI mode and continue saving?",
      saveCancelled: "Save cancelled.",
      confirmOverride: "Custom prompt has content, override?",
      confirmLangOverride: "Custom prompt has content, override based on new language?",
      localMode: "Local mode (no data upload)",
      localModeHint: "When enabled, summaries and translations are disabled and page content won't be uploaded.",
      privacyPolicy: "Privacy Policy"
    },
    // Float panel
    floatPanel: {
      summary: "Summary",
      translation: "Translation",
      extract: "Extract",
      loading: "Loading...",
      error: "Error",
      retry: "Retry",
      close: "Close",
      copy: "Copy",
      copied: "Copied",
      expand: "Expand",
      collapse: "Collapse",
      noSelection: "Please select text first",
      networkError: "Network error, please check connection",
      apiError: "API error, please check configuration",
      unknownError: "Unknown error"
    },
    // Context menu
    contextMenu: {
      summarize: "Summarize selected text",
      translate: "Translate selected text",
      extract: "Extract content"
    },
    // Extension action
    action: {
      togglePanel: "Open/Close right sidebar"
    }
  }
};

// 获取当前语言设置
async function getCurrentLanguage() {
  try {
    const result = await chrome.storage.sync.get(['ui_language']);
    return result.ui_language || 'zh'; // 默认中文
  } catch {
    return 'zh';
  }
}

// 获取翻译文本
async function t(key) {
  const lang = await getCurrentLanguage();
  const keys = key.split('.');
  let value = I18N[lang];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // 如果当前语言没有找到，尝试英文
      value = I18N.en;
      for (const k2 of keys) {
        if (value && typeof value === 'object' && k2 in value) {
          value = value[k2];
        } else {
          return key; // 返回原始key作为fallback
        }
      }
      break;
    }
  }
  
  return value || key;
}

// 同步获取翻译文本（用于非异步场景）
function tSync(key, lang = 'zh') {
  const keys = key.split('.');
  let value = I18N[lang];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // 如果当前语言没有找到，尝试英文
      value = I18N.en;
      for (const k2 of keys) {
        if (value && typeof value === 'object' && k2 in value) {
          value = value[k2];
        } else {
          return key; // 返回原始key作为fallback
        }
      }
      break;
    }
  }
  
  return value || key;
}

// 更新页面语言
async function updatePageLanguage() {
  const lang = await getCurrentLanguage();
  document.documentElement.lang = lang;
  document.documentElement.setAttribute('data-lang', lang);
}

// 导出
export { I18N, getCurrentLanguage, t, tSync, updatePageLanguage };
