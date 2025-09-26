(()=>{
  if (window.__SX_DR_BRIDGE__) return; window.__SX_DR_BRIDGE__ = true;
  function setFlag(state){
    try{ document.documentElement.setAttribute('data-sx-dark', state===true? 'on' : (state==='err'? 'err' : 'off')); }catch{}
  }
  function enable(opts){
    try{
      if (!window.DarkReader){ setFlag('err'); return; }
      try{ window.DarkReader.setFetchMethod(window.fetch ? window.fetch.bind(window) : undefined); }catch{}
      try{
        window.DarkReader.enable(Object.assign({
          brightness: 100,
          contrast: 95,
          sepia: 0,
          darkSchemeBackgroundColor: '#121212',
          darkSchemeTextColor: '#eaeef5'
        }, opts||{}));
      }catch(e){ console.warn('SX DarkReader enable failed', e); setFlag('err'); return; }
      setFlag(true);
    }catch(e){ setFlag('err'); }
  }
  function disable(){
    try{ if (window.DarkReader) window.DarkReader.disable(); }catch{}
    setFlag(false);
  }
  window.addEventListener('message', (e)=>{
    try{
      if (e.source !== window) return; const d=e.data||{};
      if (d && d.type==='SX_FORCE_DARK_TOGGLE'){
        if (d.enabled) enable(d.options||null); else disable();
      }
    }catch{}
  }, false);
})();
