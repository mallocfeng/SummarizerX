// options.app.js — petite-vue app shell for non-intrusive toasts
if (window.PetiteVue && typeof window.PetiteVue.createApp === 'function') {
  const root = document.getElementById('sx-toast-root');
  if (root) {
    const App = {
      toasts: [],
      addToast(msg, type = 'info', ms = 1800) {
        const id = Date.now() + Math.random();
        this.toasts.push({ id, msg, type });
        setTimeout(() => this.removeToast(id), ms);
      },
      removeToast(id){ this.toasts = this.toasts.filter(t => t.id !== id); }
    };
    const app = window.PetiteVue.createApp(App);
    app.mount(root);

    // Render function
    const render = () => {
      root.innerHTML = App.toasts.map(t => `<div class="sx-toast ${t.type}">${t.msg}</div>`).join('');
    };
    const mo = new MutationObserver(()=>{}); // keep a ref
    // Simple reactive effect (minimal): patch add/remove to re-render
    const origAdd = App.addToast.bind(App);
    App.addToast = (m, ty, ms) => { const r = origAdd(m, ty, ms); requestAnimationFrame(render); return r; };
    const origRemove = App.removeToast.bind(App);
    App.removeToast = (id) => { const r = origRemove(id); requestAnimationFrame(render); return r; };

    // Wire events from options.js
    try{
      window.addEventListener('SX_OPT_SAVE_END', () => App.addToast('已保存设置', 'success'));
      window.addEventListener('SX_OPT_TEST_END', () => App.addToast('测试已完成', 'info'));
    }catch{}
  }
}


