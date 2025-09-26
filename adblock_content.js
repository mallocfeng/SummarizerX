// adblock_content.js — Apply cosmetic adblock rules as CSS on each page
(async function(){
  // Early preload: inject last-compiled CSS from sessionStorage to reduce flash
  try { preInjectFromSession(); } catch {}

  // For NYTimes specifically, inject an early in-page shim to tell their ad
  // utilities that ads are disabled. This avoids loading GPT/Betamax ad modules
  // and prevents pre-roll without breaking the video player.
  try { earlyInjectNYTNoAdsShim(); } catch {}

  // Conditionally inject page-world script to patch window.open and block nuisance popups
  try {
    const { adblock_block_popups = false } = await chrome.storage.sync.get({ adblock_block_popups: false });
    if (adblock_block_popups) {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('block_pop.js');
      s.defer = false; s.async = false; s.type = 'text/javascript';
      (document.documentElement || document.head || document.body).appendChild(s);
    }
  } catch {}

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
      if (changes.adblock_enabled || changes.adblock_strength || changes.adblock_selected || changes.adblock_user_rules_text) {
        // If user turned off, clear cache for this host to avoid early hide next reload
        if (changes.adblock_enabled && changes.adblock_enabled.newValue === false) {
          try { clearSessionCacheForHost(); } catch {}
        }
        await reapply();
      }
      if (changes.nyt_block_family_popup) {
        // re-scan overlays on toggle change
        try { schedulePlaceholderSweep(); } catch {}
      }
      if (changes.adblock_block_popups) {
        const on = !!changes.adblock_block_popups.newValue;
        if (on) {
          try {
            const s = document.createElement('script');
            s.src = chrome.runtime.getURL('block_pop.js');
            s.defer = false; s.async = false; s.type = 'text/javascript';
            (document.documentElement || document.head || document.body).appendChild(s);
          } catch {}
        } else {
          // disable patched window.open by setting page flag via extension resource (CSP-safe)
          try {
            const s = document.createElement('script');
            s.src = chrome.runtime.getURL('stubs/allow_popups.js');
            s.defer = false; s.async = false; s.type = 'text/javascript';
            (document.documentElement || document.head || document.body).appendChild(s);
          } catch {}
        }
      }
    } else if (area === 'local') {
      if (changes.adblock_rules) await reapply();
    }
  });

  await reapply();

  async function reapply(){
    try {
      const { adblock_enabled = false, adblock_strength = 'medium', adblock_selected = [], nyt_block_family_popup = false } = await chrome.storage.sync.get({ adblock_enabled:false, adblock_strength:'medium', adblock_selected: [], nyt_block_family_popup: false });
      // snapshot NYT toggle for subsequent sweeps
      try { window.__sx_nyt_block_family_popup = !!nyt_block_family_popup; } catch {}
      const style = document.getElementById('sx-adblock-style');
      // Safeguard: avoid cosmetic filtering on YouTube by default (prevents UI regressions)
      const host = location.hostname || '';
      const isYouTube = /(^|\.)youtube\.com$/i.test(host) || /^youtu\.be$/i.test(host);
      if (isYouTube) { if (style) style.remove(); disconnectRemover(); return; }
      if (!adblock_enabled) { if (style) style.remove(); return; }
      const { adblock_rules = {} } = await chrome.storage.local.get({ adblock_rules: {} });
      const { adblock_user_rules_text = '' } = await chrome.storage.sync.get({ adblock_user_rules_text: '' });
      const collected = [];
      for (const id of adblock_selected || []) {
        const rec = adblock_rules[id];
        if (rec?.content) collected.push(rec.content);
      }
      if (adblock_user_rules_text && adblock_user_rules_text.trim()) collected.push(adblock_user_rules_text);
      if (!collected.length) { if (style) style.remove(); return; }
      const struct = mergeStructs(collected.map(parseCosmetic));
      const selectors = compileForHost(struct, location.hostname || '', adblock_strength);
      const css = buildCSS(selectors);
      if (!css) {
        if (style) style.remove();
        disconnectRemover();
        clearSessionCacheForHost();
        // Still try to collapse obvious floaters for specific troublesome hosts
        try { if (/\bmissav\./i.test(location.hostname || '')) schedulePlaceholderSweep(); } catch {}
        return;
      }
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
let __adblStrength = 'medium';

function disconnectRemover(){ try { __adblMO && __adblMO.disconnect(); } catch {} __adblMO = null; __adblRemovable = []; }

function setupRemover(selectors, strength){
  // Build a safe subset for removal
  __adblStrength = String(strength || 'medium');
  __adblRemovable = (selectors || []).filter(isRemovalSafe);
  if (__adblRemovable.length === 0) { disconnectRemover(); return; }
  // Initial sweep
  try { sweepRemove(); } catch {}
  // Observe DOM for newly added nodes
  if (__adblMO) { try { __adblMO.disconnect(); } catch {} }
  __adblMO = new MutationObserver(() => { try { sweepRemove(true); } catch {} });
  __adblMO.observe(document.documentElement || document, { childList: true, subtree: true });
  // Also collapse leftover placeholders/labels
  try { schedulePlaceholderSweep(); } catch {}
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
  // After removals, try collapsing empty ad placeholders
  try { schedulePlaceholderSweep(); } catch {}
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

// ----- Collapse ad placeholders (labels like "Advertisement") -----
let __adblPHTimeout = null;
function schedulePlaceholderSweep(){
  if (__adblPHTimeout) cancelAnimationFrame(__adblPHTimeout);
  __adblPHTimeout = requestAnimationFrame(() => {
  try {
      const host = location.hostname || '';
      const isYouTube = /(^|\.)youtube\.com$/i.test(host) || /^youtu\.be$/i.test(host);
      if (isYouTube) return; // do not run generic collapsers on YouTube
      // Tightened heuristic: skip placeholder collapsing on low strength
      if (__adblStrength !== 'low') collapseAdPlaceholders();
      collapseNYTPlaceholders();
      collapseNYTFamilyUpsell();
      collapseFloatingOverlays();
      // Site specific inline ad containers
      try { if (/\bmissav\./i.test(host)) collapseMissavInlineAds(); } catch {}
      // Site-specific tweaks
      try { collapseSpankbangAds(); } catch {}
      // Xvideos: hide bottom ad above comments and related blocks
      try { collapseXVideosAds(); } catch {}
    } finally { __adblPHTimeout = null; }
  });
}

function collapseAdPlaceholders(){
  const candidates = document.querySelectorAll([
    // Safer explicit indicators only
    '[data-ad]', '[data-ads]', '[data-ad-slot]',
    '[aria-label*="advert" i]', '[aria-label*="Advertisement" i]', '[aria-label*="广告"]',
    'ins.adsbygoogle',
    // Common vendor hooks
    'div[id^="google_ads"], iframe[id^="google_ads_iframe"]'
  ].join(','));
  const labelRe = /^(advertisement|广告|廣告|реклама|anuncio|pubblicità|werbung)$/i;
  const denyTokens = new Set(['masthead','header','headers','badge','badges','download','padding','loader','loading','head']);
  const adTokens = new Set(['ad','ads','advert','advertisement','adunit','ad-slot','adslot','ad_container','adcontainer','sponsor','sponsored','promo','promoted']);
  candidates.forEach(el => {
    try {
      if (!el || !el.isConnected) return;
      if (hasMedia(el)) return; // still holds an ad resource
      const idCls = ((el.id || '') + ' ' + (el.className || '')).toString().toLowerCase();
      const tokens = tokenizeIdClass(idCls);
      if (tokens.some(t => denyTokens.has(t))) return;
      const hasAdLikeToken = tokens.some(t => adTokens.has(t));
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const ariaAdvert = /advert|广告/.test(aria);
      const txt = (el.textContent || '').trim();
      const short = txt && txt.length <= 24;
      const labelOnly = !txt || labelRe.test(txt);
      // Only collapse when there is explicit ad signal
      if ((ariaAdvert || hasAdLikeToken) && (labelOnly || short)) {
        hardHide(el);
        const p = el.parentElement;
        if (p && !hasMedia(p) && isTriviallyEmpty(p)) hardHide(p);
      }
    } catch {}
  });
}

function tokenizeIdClass(s){
  try {
    if (!s) return [];
    // split on camelCase and non-alnum boundaries
    const parts = String(s)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(Boolean);
    return parts;
  } catch { return []; }
}

function hasMedia(root){
  try { return !!root.querySelector('iframe, img, video, object, embed'); } catch { return false; }
}
function isTriviallyEmpty(el){
  const txt = (el.textContent || '').replace(/\s+/g,'').trim();
  if (txt.length > 0) return false;
  const rect = el.getBoundingClientRect();
  return (rect.height <= 8) || (el.children.length === 0);
}
function hardHide(el){
  try {
    el.style.setProperty('display','none','important');
    el.style.setProperty('height','0','important');
    el.style.setProperty('min-height','0','important');
    el.style.setProperty('margin','0','important');
    el.style.setProperty('padding','0','important');
    // If grid/flex gaps remain, parent layout will close as children disappear
  } catch {}
}

// Site-specific: aggressively collapse NYTimes ad wrappers and labels
function collapseNYTPlaceholders(){
  const host = location.hostname || '';
  if (!/nytimes\.com$/.test(host)) return;

  // Hide common labels and skip links
  const isAdLabel = (el) => {
    try { return /^(advertisement|skip\s+advertisement|skip\s+ad)$/i.test((el.textContent || '').trim()); } catch { return false; }
  };
  document.querySelectorAll('p,div,span,a,header,section').forEach(el => { if (isAdLabel(el)) hardHide(el); });

  // Known wrapper ids and slot containers
  const targets = [
    '#top-wrapper', '#bottom-wrapper', '#sponsor-wrapper',
    '#top-slug', '#bottom-slug', '#sponsor-slug',
    '#top', '#bottom', '#sponsor',
    '.place-ad', '.ad.top-wrapper', '.ad.bottom-wrapper', '.ad'
  ];
  try {
    document.querySelectorAll(targets.join(',')).forEach(el => {
      if (!el) return;
      const txt = (el.textContent || '').trim();
      const slotish = el.matches('.place-ad, [data-size-key], [data-position]') || /advert/i.test(txt);
      const anyMedia = hasMedia(el);
      if (slotish && !anyMedia) {
        hardHide(el);
        const p = el.parentElement;
        if (p && !hasMedia(p) && isTriviallyEmpty(p)) hardHide(p);
      }
    });
  } catch {}

  // Any generic wrapper named *-wrapper that only holds ad elements
  try {
    document.querySelectorAll('div[id$="-wrapper"]').forEach(box => {
      const hasSlot = box.querySelector('.place-ad, .ad, [data-size-key], [data-position]');
      const anyMedia = box.querySelector('iframe, img, video, object, embed');
      if (hasSlot && !anyMedia) hardHide(box);
    });
  } catch {}

  // Ensure the NYT ad shim is in place (idempotent)
  try { neutralizeNYTBetamaxAds(); } catch {}
}

// Hide NYTimes "Family subscriptions / All Access Family" upsell floating dialog/banner
function collapseNYTFamilyUpsell(){
  try {
    const host = location.hostname || '';
    if (!/nytimes\.com$/.test(host)) return;
    // Respect user toggle (default true)
    const on = (function(){ try { return window.__sx_nyt_block_family_popup !== false; } catch { return true; } })();
    if (!on) return;

    // Text patterns observed on NYT upsell
    const txtRe = /(family\s+subscriptions?\s+are\s+here|all\s*access\s*family|家庭(订阅|方案)|家庭版)/i;

    // Collect likely overlays: fixed/sticky or role=dialog banners
    const nodes = [];
    try { nodes.push(...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')); } catch {}
    try { nodes.push(...document.querySelectorAll('[style*="position:fixed" i], [style*="position: sticky" i]')); } catch {}
    try { nodes.push(...document.querySelectorAll('div,section,aside')); } catch {}

    const seen = new WeakSet();
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const EDGE = 140; // banner near edges

    for (const el of nodes) {
      try {
        if (!el || !el.isConnected || seen.has(el)) continue;
        seen.add(el);
        const text = (el.textContent || '').trim();
        if (!text || !txtRe.test(text)) continue; // must match upsell text

        // Only target overlays/banners to avoid accidental content hiding
        const cs = getComputedStyle(el);
        const pos = (cs.position || '').toLowerCase();
        const rect = el.getBoundingClientRect();
        const z = parseInt(cs.zIndex || '0', 10);
        const overlayish = (pos === 'fixed' || pos === 'sticky' || (isNaN(z) ? false : z >= 5));
        const nearEdge = rect && (vh - rect.bottom <= EDGE || rect.top <= EDGE || vw - rect.right <= EDGE || rect.left <= EDGE);

        if (overlayish || nearEdge) {
          hardHide(el);
          const p = el.parentElement;
          if (p && !hasMedia(p) && isTriviallyEmpty(p)) hardHide(p);
        }
      } catch {}
    }
  } catch {}
}

// NYTimes ad neutralization (non-destructive):
// - Page-world shim to force adClientUtils to report ads disabled
// - Avoid removing player components that could break playback
function neutralizeNYTBetamaxAds(){
  earlyInjectNYTNoAdsShim();
}

// Inject as early as possible so NYT ad layers see "no-ads" and skip ad setup
function earlyInjectNYTNoAdsShim(){
  try {
    const host = location.hostname || '';
    if (!/nytimes\.com$/.test(host)) return;
    if (document.getElementById('sx-nyt-noads-shim')) return; // idempotent
    const s = document.createElement('script');
    s.id = 'sx-nyt-noads-shim';
    s.type = 'text/javascript';
    s.src = chrome.runtime.getURL('stubs/nyt-noads-shim.js');
    (document.documentElement || document.head || document.body).appendChild(s);
  } catch {}
}

// ----- Generic floating overlay (bottom-right ads) remover -----
function collapseFloatingOverlays(){
  try {
    // Safety: avoid hiding legitimate sticky UI on ChatGPT/OpenAI properties
    try {
      const h = (location.hostname || '').toLowerCase();
      if (/(^|\.)chatgpt\.com$/.test(h) || /(^|\.)openai\.com$/.test(h)) return;
    } catch {}

    // Site-specific: MISSAV corner floating ads are persistent; apply stronger sweep.
    try { if (/\bmissav\./i.test(location.hostname || '')) collapseMissavCornerAds(); } catch {}

    const candidates = document.querySelectorAll([
      '[style*="position:fixed"], [style*="position: sticky"],',
      '[class*="float" i], [id*="float" i],',
      '[class*="sticky" i], [id*="sticky" i],',
      '[class*="fix" i], [id*="fix" i]'
    ].join(' '));

    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    candidates.forEach(el => {
      try {
        if (!el || !el.isConnected) return;
        // compute style
        const cs = getComputedStyle(el);
        const pos = (cs.position || '').toLowerCase();
        if (pos !== 'fixed' && pos !== 'sticky') return;
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        // close to viewport edges (bottom-right / bottom-left areas)
        const EDGE = 96; // be a bit more tolerant on edge distance
        const nearRight = (vw - rect.right) <= EDGE;
        const nearLeft = rect.left <= EDGE;
        const nearBottom = (vh - rect.bottom) <= EDGE;
        const nearTop = rect.top <= EDGE;
        // size heuristic: still ignore huge overlays but allow a bit larger
        const smallish = rect.width <= 640 && rect.height <= 640;
        // z-index high (overlay-ish)
        const z = parseInt(cs.zIndex || '0', 10);
        const overlayish = isNaN(z) ? true : z >= 9; // many overlays use z-index >= 10

        // Must contain something ad-like: iframe/img or obvious ad text/class
        const containsMedia = hasMedia(el);
        const txt = (el.textContent || '').toLowerCase();
        const looksAd = /ad|广告|廣告|promotion|sponsored|close\s*ad/.test(txt) || /ad|pop|promo|sponsor/i.test((el.className||'')+ ' ' + (el.id||''));
        const hasLink = !!el.querySelector('a[href]');

        const anchored = (nearBottom && (nearRight || nearLeft)) || (nearTop && (nearRight || nearLeft));
        // Heuristic:
        // - anchored corner overlay OR contains explicit 'close ad' text
        // - size reasonable
        // - overlay-ish and content looks ad-like
        if (((anchored && smallish) || /close\s*ad/.test(txt)) && overlayish && (containsMedia || hasLink || looksAd)) {
          hardHide(el);
          // also try hide parent if trivial wrapper
          const p = el.parentElement;
          if (p && !hasMedia(p) && isTriviallyEmpty(p)) hardHide(p);
        }
      } catch {}
    });
  } catch {}
}

// Stronger heuristic just for missav.* to catch dynamic corner floaters
function collapseMissavCornerAds(){
  const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

  // Limit how many nodes we inspect to avoid jank
  const MAX_NODES = 1500;
  let inspected = 0;
  const iter = (root) => {
    if (!root) return;
    const all = root.querySelectorAll('div,section,aside,iframe,a');
    for (const el of all) {
      if (inspected++ > MAX_NODES) break;
      try {
        if (!el.isConnected) continue;
        const cs = getComputedStyle(el);
        const pos = (cs.position || '').toLowerCase();
        if (pos !== 'fixed' && pos !== 'sticky') continue;
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) continue;
        // anchored very close to a corner
        const EDGE = Math.max(12, Math.floor(Math.min(vw, vh) * 0.02));
        const nearRight = (vw - rect.right) <= EDGE;
        const nearLeft = rect.left <= EDGE;
        const nearBottom = (vh - rect.bottom) <= EDGE;
        const nearTop = rect.top <= EDGE;
        const anchored = (nearBottom && (nearRight || nearLeft)) || (nearTop && (nearRight || nearLeft));
        if (!anchored) continue;
        // avoid hiding large layout elements
        const smallish = rect.width <= 560 && rect.height <= 560;
        if (!smallish) continue;
        // z-index overlay-ish or auto
        const z = parseInt(cs.zIndex || '0', 10);
        const overlayish = isNaN(z) ? true : z >= 5;
        if (!overlayish) continue;
        // Must look like an ad container
        const containsMedia = hasMedia(el);
        const txt = (el.textContent || '').toLowerCase();
        const looksAd = /ad|广告|廣告|sponsor|promo|close\s*ad/.test(txt) || /ad|promo|sponsor|float|sticky|fix/i.test(((el.className||'')+' '+(el.id||'')));
        const hasLink = !!el.querySelector('a[href]');
        if (containsMedia || hasLink || looksAd) {
          hardHide(el);
          const p = el.parentElement;
          if (p && !hasMedia(p) && isTriviallyEmpty(p)) hardHide(p);
        }
      } catch {}
    }
  };
  try { iter(document.body || document.documentElement); } catch {}
}

// Site-specific: remove known inline ad containers on missav.* pages
function collapseMissavInlineAds(){
  try {
    const targets = [
      'div[id^="ts_ad_video_"]', // TSOutstreamVideo placeholder
      '#ts_ad_video_aes67',
      '#html-ads',
      '#inpage',
      // Common third-party injected iframes/scripts
      'iframe[src*="myavlive.com"]',
      'iframe[src*="stripchat" i]',
      'iframe[src*="tsyndicate" i]',
      'script#SCSpotScript',
      'script[src*="cdn.tsyndicate.com"]',
      'script[src*="sunnycloudstone.com"]'
    ];
    const hardRemove = (n) => { try { hardHide(n); if (n.parentNode) n.parentNode.removeChild(n); } catch {} };
    document.querySelectorAll(targets.join(',')).forEach(el => {
      try {
        // remove the node
        hardRemove(el);
        // also collapse trivial parents to avoid leftover gaps
        let p = el.parentElement;
        for (let i = 0; i < 3 && p; i++) {
          if (!hasMedia(p) && isTriviallyEmpty(p)) { hardHide(p); }
          p = p.parentElement;
        }
      } catch {}
    });
  } catch {}
}

// ----- Site-specific: xvideos.* bottom/inline ad containers -----
function collapseXVideosAds(){
  const host = (location.hostname || '').toLowerCase();
  // Match common xvideos host variants
  if (!(/xvideos\./i.test(host) || /(^|\.)xv-ru\.com$/.test(host))) return;

  const selectors = [
    // Bottom ad just above comments
    '#ad-footer',
    // Mobile footer ad placeholder
    '#ad-footer2',
    // Header mobile ad placeholder (sometimes inserted)
    '#ad-header-mobile-contener', '#ad-header-mobile-container',
    // Right of player rectangle ad
    '#video-right',
    // Upgrade/Remove-ads promo block
    'div.remove-ads'
  ];

  const hardRemove = (n) => { try { hardHide(n); if (n.parentNode) n.parentNode.removeChild(n); } catch {} };
  try {
    document.querySelectorAll(selectors.join(',')).forEach(el => {
      try {
        // Remove node
        hardRemove(el);
        // Collapse trivial wrappers to avoid leftover gap
        let p = el.parentElement;
        for (let i = 0; i < 3 && p; i++) {
          if (!hasMedia(p) && isTriviallyEmpty(p)) { hardHide(p); }
          p = p.parentElement;
        }
      } catch {}
    });
  } catch {}
}

// ----- Site-specific: spankbang.com top banner/affiliate removal -----
let __sbObs = null;
function collapseSpankbangAds(){
  const host = (location.hostname || '').toLowerCase();
  if (!/(^|\.)spankbang\.(com|party)$/.test(host)) return;

  // Direct removals for known ad containers
  const selectors = [
    // Top/inline banners injected as <ins class="18ad69c2"> ...
    'ins[class="18ad69c2"]',
    // ptgncdn static holders
    'ins.ptgncdn_holder', 'ins.ptgncdn_holder_footer',
    // Header affiliate button (e.g., 🔥 AI JERK OFF)
    'header.main-header a[href*="deliver.ptgncdn.com"]',
    // Any other ptgncdn clickouts in header/nav
    'header a[href*="deliver.ptgncdn.com"], nav a[href*="deliver.ptgncdn.com"]',
    // Some buttons use onclick window.open to ptgncdn
    'a[onclick*="deliver.ptgncdn.com"], a[onclick*="ptgncdn.com"]',
    // Fallback: any script nodes from the ad CDN
    'script[src*="deliver.ptgncdn.com"]'
  ];

  const hardRemove = (n) => { try { hardHide(n); if (n.parentNode) n.parentNode.removeChild(n); } catch {} };

  try {
    document.querySelectorAll(selectors.join(',')).forEach(hardRemove);
  } catch {}

  // Also collapse trivial wrappers around the removed <ins>
  try {
    document.querySelectorAll('ins[class="18ad69c2"]').forEach(ins => {
      try {
        const p = ins.parentElement;
        if (p && !hasMedia(p) && isTriviallyEmpty(p)) hardHide(p);
        const gp = p?.parentElement;
        if (gp && !hasMedia(gp) && isTriviallyEmpty(gp)) hardHide(gp);
      } catch {}
    });
  } catch {}

  // Mutation observer to catch dynamically injected banners
  if (!__sbObs) {
    try {
      __sbObs = new MutationObserver((muts) => {
        let needsSweep = false;
        for (const m of muts) {
          if (!m.addedNodes || m.addedNodes.length === 0) continue;
          for (const node of m.addedNodes) {
            try {
              if (!(node instanceof Element)) continue;
              // Fast-path checks
              if (node.matches && selectors.some(sel => { try { return node.matches(sel); } catch { return false; } })) {
                hardRemove(node);
                needsSweep = true;
                continue;
              }
              // Scan a small subtree for known nodes
              const found = node.querySelectorAll ? node.querySelectorAll(selectors.join(',')) : [];
              if (found && found.length) { found.forEach(hardRemove); needsSweep = true; }
            } catch {}
          }
        }
        if (needsSweep) schedulePlaceholderSweep();
      });
      __sbObs.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch {}
  }
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
