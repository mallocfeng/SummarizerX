// adblock_content.js — Apply cosmetic adblock rules as CSS on each page
(async function(){
  // Early preload: inject last-compiled CSS from sessionStorage to reduce flash
  try { preInjectFromSession(); } catch {}

  // Lazy import engine as module (MV3-compatible)
  let parseCosmetic, compileForHost, buildCSS;
  try {
    const mod = await import(chrome.runtime.getURL('adblock_engine.js'));
    parseCosmetic = mod.parseCosmetic;
    compileForHost = mod.compileForHost;
    buildCSS = mod.buildCSS;
  } catch (e) { console.warn('adblock engine load failed:', e); return; }

  // Observe changes regardless of initial state so toggling on/off works without reload
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'sync') {
      if (changes.adblock_enabled || changes.adblock_strength || changes.adblock_selected) {
        // If user turned off, clear cache for this host to avoid early hide next reload
        if (changes.adblock_enabled && changes.adblock_enabled.newValue === false) {
          try { clearSessionCacheForHost(); } catch {}
        }
        await reapply();
      }
    } else if (area === 'local') {
      if (changes.adblock_rules) await reapply();
    }
  });

  await reapply();

  async function reapply(){
    try {
      const { adblock_enabled = false, adblock_strength = 'medium', adblock_selected = [] } = await chrome.storage.sync.get({ adblock_enabled:false, adblock_strength:'medium', adblock_selected: [] });
      const style = document.getElementById('sx-adblock-style');
      if (!adblock_enabled) { if (style) style.remove(); return; }
      const { adblock_rules = {} } = await chrome.storage.local.get({ adblock_rules: {} });
      const collected = [];
      for (const id of adblock_selected || []) {
        const rec = adblock_rules[id];
        if (rec?.content) collected.push(rec.content);
      }
      if (!collected.length) { if (style) style.remove(); return; }
      const struct = mergeStructs(collected.map(parseCosmetic));
      const selectors = compileForHost(struct, location.hostname || '', adblock_strength);
      const css = buildCSS(selectors);
      if (!css) { if (style) style.remove(); disconnectRemover(); clearSessionCacheForHost(); return; }
      injectStyle(css);
      // Also remove simple matched nodes to "directly remove" instead of only hiding
      setupRemover(selectors, adblock_strength);
      // Cache for next reload to reduce flash
      try { saveToSession(css, adblock_strength); } catch {}
    } catch {}
  }
})();

// ----- Removal of simple matches (performance-safe) -----
let __adblMO = null;
let __adblRemovable = [];

function disconnectRemover(){ try { __adblMO && __adblMO.disconnect(); } catch {} __adblMO = null; __adblRemovable = []; }

function setupRemover(selectors, strength){
  // Build a safe subset for removal
  __adblRemovable = (selectors || []).filter(isRemovalSafe);
  if (__adblRemovable.length === 0) { disconnectRemover(); return; }
  // Initial sweep
  try { sweepRemove(); } catch {}
  // Observe DOM for newly added nodes
  if (__adblMO) { try { __adblMO.disconnect(); } catch {} }
  __adblMO = new MutationObserver(() => { try { sweepRemove(true); } catch {} });
  __adblMO.observe(document.documentElement || document, { childList: true, subtree: true });
}

function sweepRemove(incremental){
  const maxSelectors = 200; // cap to avoid jank
  const list = __adblRemovable.slice(0, maxSelectors);
  if (list.length === 0) return;
  for (const sel of list) {
    let nodes;
    try { nodes = document.querySelectorAll(sel); } catch { nodes = []; }
    if (!nodes || nodes.length === 0) continue;
    nodes.forEach(n => {
      try { if (n && n.parentNode) n.parentNode.removeChild(n); } catch {}
    });
  }
}

function isRemovalSafe(sel){
  const s = String(sel || '').trim();
  if (!s) return false;
  if (s.length > 120) return false;
  // disallow heavy pseudos / attributes / relational selectors
  if (/[\[:>~+]/.test(s)) return false;
  // allow simple class or id or tag.class
  if (/^#[a-zA-Z0-9_-]+$/.test(s)) return true;
  if(/^\.[a-zA-Z0-9_-]+$/.test(s)) return true;
  if(/^[a-zA-Z][a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]+$/.test(s)) return true;
  return false;
}

function mergeStructs(arr){
  const out = { global: [], domains: new Map(), exceptions: new Map() };
  for (const s of arr) {
    if (!s) continue;
    if (Array.isArray(s.global)) out.global.push(...s.global);
    if (s.domains instanceof Map) {
      for (const [d, list] of s.domains) {
        const tgt = out.domains.get(d) || [];
        tgt.push(...list);
        out.domains.set(d, tgt);
      }
    }
    if (s.exceptions instanceof Map) {
      for (const [d, list] of s.exceptions) {
        const tgt = out.exceptions.get(d) || [];
        tgt.push(...list);
        out.exceptions.set(d, tgt);
      }
    }
  }
  return out;
}

function injectStyle(css){
  let el = document.getElementById('sx-adblock-style');
  if (!el) {
    el = document.createElement('style');
    el.id = 'sx-adblock-style';
    el.type = 'text/css';
    (document.head || document.documentElement).appendChild(el);
  }
  // Avoid huge reflows: only reset text if changed
  if (el.textContent !== css) el.textContent = css;
}

// ------- Session cache (per host) to reduce first-paint flash -------
function cacheKey(strength){ return `sx_adbl_cache:${location.hostname || ''}:${strength || 'medium'}`; }
function saveToSession(css, strength){
  const key = cacheKey(strength);
  const payload = { enabled: true, strength, css, ts: Date.now() };
  try { window.sessionStorage.setItem(key, JSON.stringify(payload)); } catch {}
}
function preInjectFromSession(){
  try {
    const strengths = ['low','medium','high'];
    for (const s of strengths) {
      const raw = window.sessionStorage.getItem(cacheKey(s));
      if (!raw) continue;
      const obj = JSON.parse(raw);
      if (obj && obj.enabled && typeof obj.css === 'string' && obj.css) {
        injectStyle(obj.css);
        break; // inject first hit
      }
    }
  } catch {}
}
function clearSessionCacheForHost(){
  try {
    const strengths = ['low','medium','high'];
    for (const s of strengths) { try { window.sessionStorage.removeItem(cacheKey(s)); } catch {} }
  } catch {}
}
