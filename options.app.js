// options.app.js — CSP-safe toasts (no Petite-Vue, no eval)
(function(){
  const root = document.getElementById('sx-toast-root');
  if (!root) return;
  // Remove template bindings to avoid showing raw mustache/attributes
  try{ root.innerHTML = ''; }catch{}

  function renderToast(t){
    const el = document.createElement('div');
    el.className = 'sx-toast ' + (t.type||'info');
    el.textContent = t.msg||'';
    el.setAttribute('role','status');
    el.style.cursor = 'pointer';
    el.addEventListener('click', ()=> removeToast(t.id, el));
    root.appendChild(el);
    return el;
  }
  function removeToast(id, el){
    try{ if (el && el.parentNode) el.parentNode.removeChild(el); }catch{}
    queue = queue.filter(x => x.id !== id);
  }
  function addToast(msg, type='info', ms=1800){
    const t = { id: Date.now() + Math.random(), msg, type };
    queue.push(t);
    const el = renderToast(t);
    if (ms>0) setTimeout(()=> removeToast(t.id, el), ms);
  }
  let queue = [];

  // Expose for other modules
  window.SXToast = { add: addToast, remove: removeToast };

  // Wire events from options.js
  try{
    window.addEventListener('SX_OPT_SAVE_END', () => addToast('已保存设置', 'success'));
    window.addEventListener('SX_OPT_TEST_END', () => addToast('测试已完成', 'info'));
  }catch{}
})();

