import { getSettings } from "./settings.js";

// Live Preview using petite-vue (progressive enhancement)
async function initLivePreview(){
  try{
    const mountEl = document.getElementById('pv-summary');
    if (!mountEl || !window.PetiteVue || typeof window.PetiteVue.createApp !== 'function') return;

    const state = await getSettings();
    let theme = 'auto';

    // 复制配置为简短字符串
    let copying = false;
    async function copyConfig(){
      try{
        copying = true;
        const text = `p=${state.aiProvider}, e=${state.model_extract}, s=${state.model_summarize}, l=${state.output_lang||'auto'}, m=${state.extract_mode}, t=${theme}`;
        await navigator.clipboard.writeText(text);
        setTimeout(()=>{ copying = false; }, 600);
      }catch{ copying = false; }
    }

    let uiLang = (await chrome.storage.sync.get({ ui_language: 'zh' }))?.ui_language || 'zh';
    const app = window.PetiteVue.createApp({ state, theme, copying, copyConfig, uiLang });
    app.mount(mountEl);

    // Keep in sync with settings changes made on the page
    const ids = ['aiProvider','model_extract','model_summarize','output_lang','extract_mode'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        state.aiProvider = document.getElementById('aiProvider')?.value || state.aiProvider;
        state.model_extract = document.getElementById('model_extract')?.value || state.model_extract;
        state.model_summarize = document.getElementById('model_summarize')?.value || state.model_summarize;
        state.output_lang = document.getElementById('output_lang')?.value || state.output_lang;
        state.extract_mode = document.getElementById('extract_mode')?.value || state.extract_mode;
      });
      if (el.tagName === 'INPUT') {
        el.addEventListener('input', () => {
          state.model_extract = document.getElementById('model_extract')?.value || state.model_extract;
          state.model_summarize = document.getElementById('model_summarize')?.value || state.model_summarize;
        });
      }
    });

    // Also react to external storage changes
    try{
      chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area !== 'sync') return;
        if (changes.aiProvider || changes.model_extract || changes.model_summarize || changes.output_lang || changes.extract_mode) {
          const latest = await getSettings();
          Object.assign(state, latest);
        }
        if (changes.options_theme_override || changes.float_theme_override) {
          const v = (changes.options_theme_override?.newValue) ?? (changes.float_theme_override?.newValue) ?? theme;
          if (['auto','light','dark'].includes(v)) theme = v;
        }
        if (changes.ui_language) {
          uiLang = changes.ui_language.newValue || uiLang;
        }
      });
    } catch {}
  }catch{}
}

document.addEventListener('DOMContentLoaded', initLivePreview);

// Global busy indicators wired via custom events from options.js
try{
  window.addEventListener('SX_OPT_TEST_START', () => {
    const host = document.querySelector('.pv-busy');
    if (!host) return;
    const scope = host.__vscope;
    if (scope) scope.testing = true;
  });
  window.addEventListener('SX_OPT_TEST_END', () => {
    const host = document.querySelector('.pv-busy');
    if (!host) return;
    const scope = host.__vscope;
    if (scope) scope.testing = false;
  });
  window.addEventListener('SX_OPT_SAVE_START', () => {
    const host = document.querySelector('.pv-busy');
    if (!host) return;
    const scope = host.__vscope;
    if (scope) scope.saving = true;
  });
  window.addEventListener('SX_OPT_SAVE_END', () => {
    const host = document.querySelector('.pv-busy');
    if (!host) return;
    const scope = host.__vscope;
    if (scope) scope.saving = false;
  });
}catch{}


