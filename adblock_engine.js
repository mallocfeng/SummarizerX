// adblock_engine.js — Parse a small, safe subset of EasyList cosmetic rules and compile to CSS

// Public API:
// - parseCosmetic(text): { global: string[], domains: Map<string,string[]>, exceptions: Map<string,string[]> }
// - compileForHost(struct, host, strength): string[] selectors
// - buildCSS(selectors): string css

const COMMENT_RE = /^\s*(!|\[Adblock|\[uBlock)/i;

export function parseCosmetic(text = ''){
  const global = [];
  const domains = new Map(); // domain -> selectors[]
  const exceptions = new Map(); // domain -> selectors[]

  const lines = String(text || '').split(/\r?\n/);
  for (let raw of lines) {
    const line = raw.trim();
    if (!line || COMMENT_RE.test(line)) continue;

    const norm = normalizeSelector(line);

    // Exceptions first: domain#@#selector
    const excIdx = norm.indexOf('#@#');
    if (excIdx !== -1) {
      const domPart = norm.slice(0, excIdx).trim();
      const sel = norm.slice(excIdx + 3).trim();
      if (!sel) continue;
      const doms = (domPart || '').split(',').map(s => s.trim()).filter(Boolean);
      for (const d of doms) {
        if (d.startsWith('~')) continue; // ignore negations in this minimal engine
        const arr = exceptions.get(d) || [];
        arr.push(sel);
        exceptions.set(d, arr);
      }
      continue;
    }

    // Cosmetic hides: domain##selector or ##selector
    const idx2 = norm.indexOf('##');
    if (idx2 !== -1) {
      const left = norm.slice(0, idx2).trim();
      const sel = norm.slice(idx2 + 2).trim();
      if (!sel) continue;
      if (!left) { global.push(sel); continue; }
      const doms = left.split(',').map(s => s.trim()).filter(Boolean);
      const pos = doms.filter(d => !d.startsWith('~'));
      const neg = doms.filter(d => d.startsWith('~')).map(d => d.slice(1)).filter(Boolean);
      if (pos.length === 0) {
        global.push(sel);
        for (const nd of neg) {
          const arr = exceptions.get(nd) || [];
          arr.push(sel);
          exceptions.set(nd, arr);
        }
      } else {
        for (const d of pos) {
          const arr = domains.get(d) || [];
          arr.push(sel);
          domains.set(d, arr);
        }
        for (const nd of neg) {
          const arr = exceptions.get(nd) || [];
          arr.push(sel);
          exceptions.set(nd, arr);
        }
      }
      continue;
    }

    // ID quick form: domain###id or ###id
    const idx3 = norm.indexOf('###');
    if (idx3 !== -1) {
      const left = norm.slice(0, idx3).trim();
      const id = norm.slice(idx3 + 3).trim();
      if (!id) continue;
      const sel = `#${cssEscapeSimple(id)}`;
      if (!left) { global.push(sel); continue; }
      const doms = left.split(',').map(s => s.trim()).filter(Boolean);
      const pos = doms.filter(d => !d.startsWith('~'));
      const neg = doms.filter(d => d.startsWith('~')).map(d => d.slice(1)).filter(Boolean);
      if (pos.length === 0) {
        global.push(sel);
        for (const nd of neg) {
          const arr = exceptions.get(nd) || [];
          arr.push(sel);
          exceptions.set(nd, arr);
        }
      } else {
        for (const d of pos) {
          const arr = domains.get(d) || [];
          arr.push(sel);
          domains.set(d, arr);
        }
        for (const nd of neg) {
          const arr = exceptions.get(nd) || [];
          arr.push(sel);
          exceptions.set(nd, arr);
        }
      }
      continue;
    }
  }
  return { global, domains, exceptions };
}

export function compileForHost(struct, host, strength = 'medium'){
  if (!struct) return [];
  const hostLc = String(host || '').toLowerCase();
  const selSet = new Set();

  // start with global
  for (const s of struct.global || []) if (allowSelector(s, strength)) selSet.add(s);

  // collect domain-matched selectors
  const addDomain = (d) => {
    const list = struct.domains.get(d);
    if (!list) return;
    for (const s of list) if (allowSelector(s, strength)) selSet.add(s);
  };
  // match exact and parent domains
  const parts = hostLc.split('.');
  for (let i = 0; i < parts.length; i++) {
    addDomain(parts.slice(i).join('.'));
  }

  // remove exceptions for matched domains
  const excSet = new Set();
  const addExc = (d) => {
    const list = struct.exceptions.get(d);
    if (!list) return;
    for (const s of list) excSet.add(s);
  };
  for (let i = 0; i < parts.length; i++) {
    addExc(parts.slice(i).join('.'));
  }
  for (const s of excSet) selSet.delete(s);

  return Array.from(selSet);
}

export function buildCSS(selectors = []){
  if (!selectors || !selectors.length) return '';
  const safe = [];
  for (const s of selectors) {
    const trimmed = String(s || '').trim();
    if (!trimmed) continue;
    safe.push(`${trimmed} { display: none !important; }`);
  }
  return safe.join('\n');
}

function allowSelector(sel, strength){
  const s = String(sel || '');
  if (!s) return false;
  if (strength === 'high') return s.length < 1000; // basic sanity cap
  if (strength === 'medium') {
    if (s.length > 600) return false;
    // allow :nth-child etc., but avoid very heavy relational selectors
    if (s.includes(':has(')) return false;
    return true;
  }
  // low: only simple id/class chains without attributes/pseudo
  if (s.length > 160) return false;
  if (/[\[\]:]/.test(s)) return false; // no attributes or pseudo
  const simpleRe = /^([#.][a-zA-Z0-9_-]+)(\s+[#.][a-zA-Z0-9_-]+)*$/;
  return simpleRe.test(s);
}

function cssEscapeSimple(id){
  // Minimal escape for id to be used in #id form
  return String(id).replace(/[^a-zA-Z0-9_-]/g, (m) => `\\${m}`);
}

function normalizeSelector(line){
  // Map some ABP extended pseudo-classes to native equivalents when available
  // ':-abp-has(' => ':has('
  return line.replace(/:-abp-has\(/g, ':has(');
}
