// options.app.js — petite-vue app shell for non-intrusive toasts
if (window.PetiteVue && typeof window.PetiteVue.createApp === 'function') {
  const root = document.getElementById('sx-toast-root');
  if (root) {
    const App = {
      toasts: [],
      focus: { aiProvider:false, apiKey:false, baseURL:false, model_extract:false, model_summarize:false, output_lang:false, extract_mode:false },
      addToast(msg, type = 'info', ms = 1800) {
        const id = Date.now() + Math.random();
        this.toasts.push({ id, msg, type });
        setTimeout(() => this.removeToast(id), ms);
      },
      removeToast(id){ this.toasts = this.toasts.filter(t => t.id !== id); }
    };
    window.PetiteVue.createApp(App).mount(root);

    // Wire events from options.js
    try{
      window.addEventListener('SX_OPT_SAVE_END', () => App.addToast('已保存设置', 'success'));
      window.addEventListener('SX_OPT_TEST_END', () => App.addToast('测试已完成', 'info'));
    }catch{}
  }
}


