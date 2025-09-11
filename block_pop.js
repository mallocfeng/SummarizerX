// block_pop.js — runs in page world; patch window.open to block nuisance popups
(function(){
  try {
    if (window.__sx_block_pop_inited) return;
    window.__sx_block_pop_inited = true;

    const nativeOpen = window.open;
    let lastGesture = 0;
    const GESTURE_MS = 1600;
    const gestureEvents = ['pointerdown','mousedown','keydown','touchstart'];
    gestureEvents.forEach(ev => {
      window.addEventListener(ev, () => { lastGesture = Date.now(); }, { capture: true, passive: true });
    });

    function parseUrl(u){
      try {
        if (!u) return '';
        if (typeof u === 'string') return u;
        if (u && typeof u.href === 'string') return String(u.href);
      } catch {}
      return '';
    }

    function shouldBlock(raw){
      const u = String(raw || '');
      const now = Date.now();
      // Always block typical pop endpoints
      if (/\/(pop|popunder|popup)(?:[/?#]|$)/i.test(u)) return true;
      if (/\bpop\?url=/i.test(u)) return true;
      // Block common ad/tracker pop domains quickly
      if (/doubleclick\.net|adnxs\.com|taboola|outbrain|propeller|onclick|push\d*?\./i.test(u)) return true;
      // If there is no recent user gesture, be stricter
      const hasGesture = (now - lastGesture) <= GESTURE_MS;
      if (!hasGesture) {
        // block any target that looks like a redirector
        if (/\b(url|target|dest|redirect|go|r)=https?:/i.test(u)) return true;
        if (/\b(ads?|track|offer|aff|bonus)/i.test(u)) return true;
      }
      return false;
    }

    Object.defineProperty(window, 'open', {
      configurable: true,
      writable: true,
      value: function(url, name, specs){
        try {
          if (window.__sx_allow_popups === true) {
            return nativeOpen.apply(this, arguments);
          }
          const raw = parseUrl(url);
          if (shouldBlock(raw)) {
            try { console.debug('[SX] Blocked popup:', raw); } catch {}
            return null;
          }
        } catch {}
        return nativeOpen.apply(this, arguments);
      }
    });

    // Older APIs
    try { window.showModalDialog = function(){ return null; }; } catch {}
  } catch (e) {
    try { console.warn('block_pop init failed:', e); } catch {}
  }
})();

