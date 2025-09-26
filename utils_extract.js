// utils_extract.js —— DOM → 高保真 Markdown（优化：抑制无文本 URL 链接 + 过滤导航菜单）
(function () {
  // Attempt to expand collapsed content and trigger lazy loaders prior to extraction
  async function prepareForExtract(){
    try{
      // 1) Click common expand buttons/links
      const MATCH = /(read more|show more|continue reading|expand|see more|load more|阅读全文|展开|显示更多|继续阅读)/i;
      const isSafeAnchor = (el)=>{
        try{
          if (el.tagName?.toLowerCase() !== 'a') return false;
          const role = (el.getAttribute('role')||'').toLowerCase();
          const href = (el.getAttribute('href')||'').trim().toLowerCase();
          const target = (el.getAttribute('target')||'').toLowerCase();
          // Only allow anchors that behave like buttons or don't navigate away
          if (role === 'button') return true;
          if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('void(')) return true;
          // in-page anchors
          if (href.startsWith('#')) return true;
          // anything with target or absolute http(s) likely navigates: disallow
          if (target) return false;
          try{ const u = new URL(href, location.href); if (u.origin !== location.origin) return false; }catch{}
          return false;
        }catch{ return false; }
      };
      const candidates = Array.from(document.querySelectorAll('button, a'))
        .filter(el=>{
          try{ 
            const t=(el.innerText||'').trim(); 
            if (!t || !MATCH.test(t)) return false;
            const tag = el.tagName?.toLowerCase();
            if (tag === 'button') return true;
            if (tag === 'a') return isSafeAnchor(el);
            return false;
          }catch{ return false; }
        })
        .slice(0,3);
      for (const el of candidates){ try{ el.click(); }catch{} }
    }catch{}
    try{
      // 2) Remove CSS clamps/truncation
      const clampSel = [
        '[style*="line-clamp" i]','[style*="-webkit-line-clamp" i]','[style*="max-height" i]',
        '.line-clamp','.clamp','.truncate','.collapsed','.ellipsis','.is-collapsed'
      ].join(',');
      const els = Array.from(document.querySelectorAll(clampSel));
      els.forEach(el=>{
        try{
          const cs=getComputedStyle(el);
          const maxH=parseFloat(cs.maxHeight)||0;
          const hasClamp = /line-clamp/i.test(el.getAttribute('style')||'') || /line-clamp/i.test(cs.display+cs.webkitLineClamp);
          const hidden = (cs.overflow==='hidden');
          if (hasClamp || (hidden && maxH>0 && maxH<400)){
            el.style.setProperty('max-height','none','important');
            el.style.setProperty('-webkit-line-clamp','unset','important');
            el.style.setProperty('overflow','visible','important');
          }
        }catch{}
      });
    }catch{}
    try{
      // 3) Force-load lazy images so Readability keeps figure blocks structured
      const imgs = Array.from(document.querySelectorAll('img'));
      imgs.forEach(img=>{
        try{
          img.loading='eager'; img.decoding='sync';
          const attrs=['data-src','data-original','data-hi-res-src','data-lazy-src'];
          for (const a of attrs){ const v=img.getAttribute(a); if (v){ img.setAttribute('src', v); break; } }
        }catch{}
      });
    }catch{}
    try{
      // 4) Minimal auto-scroll to trigger IntersectionObserver-based loaders
      const doc = document.scrollingElement || document.documentElement;
      const y = (window.scrollY||doc.scrollTop||0);
      const max = Math.max(0, doc.scrollHeight - window.innerHeight);
      const mid = Math.min(max, (y+window.innerHeight*1.2)|0);
      window.scrollTo(0, mid);
      await new Promise(r=>setTimeout(r, 180));
      window.scrollTo(0, y);
    }catch{}
  }
  // Prefer Mozilla Readability when available
  function tryExtractByReadability(){
    try{
      const R = window.Readability;
      if (!R || typeof R !== 'function') return null;
      // Clone to avoid side-effects and strip our own floating panel if present
      const docClone = document.cloneNode(true);
      try{ docClone.getElementById('sx-float-panel')?.remove(); }catch{}
      const article = new R(docClone, { keepClasses:false }).parse();
      if (!article) return null;
      // Convert Readability HTML to Markdown using our Markdown generator.
      // Create a temporary container attached to the live DOM so visibility checks won't drop nodes.
      const tmp = document.createElement('div');
      tmp.setAttribute('data-sx-readable-root','1');
      tmp.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;overflow:hidden;';
      tmp.innerHTML = article.content || '';
      // Prepare within the temp root synchronously: expand clamps, normalize lazy media
      try{
        // 1) Expand <details>
        tmp.querySelectorAll('details').forEach(d=>{ try{ d.setAttribute('open',''); }catch{} });
        // 2) Remove simple CSS clamps/truncation
        const sel = [
          '[style*="line-clamp" i]','[style*="-webkit-line-clamp" i]','[style*="max-height" i]','.line-clamp','.clamp','.truncate','.collapsed','.ellipsis','.is-collapsed'
        ].join(',');
        tmp.querySelectorAll(sel).forEach(el=>{
          try{
            el.style.setProperty('max-height','none','important');
            el.style.setProperty('-webkit-line-clamp','unset','important');
            el.style.setProperty('overflow','visible','important');
          }catch{}
        });
        // 3) Normalize images: prefer currentSrc/srcset/data-src* over tiny placeholders
        const pickFromSet = (set)=>{
          try{
            const parts = String(set||"").split(',').map(s=>s.trim()).filter(Boolean).map(s=>{
              const m=s.match(/\s*(\S+)\s+(\d+)w/); return m? { url:m[1], w:parseInt(m[2]) }: { url:s.split(/\s+/)[0], w:0 };
            });
            parts.sort((a,b)=> b.w-a.w); return parts.length? parts[0].url: '';
          }catch{ return ''; }
        };
        const isTiny=(u)=>/data:image\/(gif|png)/i.test(u||'') && /base64/i.test(u||'');
        tmp.querySelectorAll('img').forEach(img=>{
          try{
            const cands=[];
            if (img.currentSrc) cands.push(img.currentSrc);
            const ss = img.getAttribute('srcset') || img.getAttribute('data-srcset');
            const fromSet = pickFromSet(ss); if (fromSet) cands.push(fromSet);
            ['data-src','data-original','data-hi-res-src','data-lazy-src','src'].forEach(a=>{ const v=img.getAttribute(a); if (v) cands.push(v); });
            if (!fromSet && img.parentElement && img.parentElement.tagName.toLowerCase()==='picture'){
              const s = img.parentElement.querySelector('source[srcset]');
              const u = pickFromSet(s?.getAttribute('srcset')||''); if (u) cands.unshift(u);
            }
            const good = cands.find(u=>u && !isTiny(u));
            if (good){ img.setAttribute('src', good); img.removeAttribute('loading'); img.removeAttribute('decoding'); }
          }catch{}
        });
        // 4) If Readability dropped the lede/hero image (common on news sites),
        //    prepend a best-guess header image from the page (e.g., NYT header figure or og:image)
        try {
          const alreadyHasImg = !!tmp.querySelector('img');
          if (!alreadyHasImg) {
            let src = '';
            let alt = '';
            // Prefer a prominent header image near the headline if available (NYT and similar)
            const ledeImg = document.querySelector('div[data-testid="imageblock-wrapper"] img')
              || document.querySelector('figure.sizeLarge img')
              || document.querySelector('figure img');
            if (ledeImg) {
              src = ledeImg.currentSrc || ledeImg.getAttribute('src') || '';
              // Try a high-res from srcset
              if (!src) {
                const ss = ledeImg.getAttribute('srcset') || '';
                const hi = pickFromSet(ss);
                if (hi) src = hi;
              }
              alt = ledeImg.getAttribute('alt') || (ledeImg.closest('figure')?.querySelector('figcaption')?.innerText || '');
            }
            // Fallback to social meta images
            if (!src) {
              src = document.querySelector('meta[property="og:image"]')?.content
                 || document.querySelector('meta[name="twitter:image"]')?.content
                 || '';
            }
            if (src) {
              try { src = new URL(src, location.href).href; } catch {}
              const holder = document.createElement('p');
              const im = document.createElement('img');
              im.setAttribute('src', src);
              if (alt) im.setAttribute('alt', alt.trim());
              holder.appendChild(im);
              tmp.insertBefore(holder, tmp.firstChild);
            }
          }
        } catch {}
      }catch{}
      document.documentElement.appendChild(tmp);
      try{
        const markdown = extractMarkdown(tmp);
        const title = article.title || (document.title || '');
        const pageLang = document.documentElement.getAttribute('lang') || '';
        const text = (article.textContent || '').trim();
        return { title, pageLang, text, markdown };
      } finally {
        try{ tmp.remove(); }catch{}
      }
    }catch{ return null; }
  }
  const BAD_RE = /nav|aside|footer|header|form|menu|banner|complementary|advert|ads|promo|subscribe|breadcrumb|pagination|comment|related|toc|newsletter|cookie/i;
  const GOOD_RE = /article|main|content|post|entry|markdown|doc|read|story|article-body|post-body|prose|md/i;
  const BLOCK_CONTAINER = new Set(["div", "section", "article", "main", "body", "figure"]);
  const FORCE_SKIP_TAG = new Set(["nav", "aside", "footer", "header", "form"]);

  function hasBadRole(node) {
    const role = node.getAttribute?.("role") || "";
    if (!role) return false;
    return /(navigation|banner|contentinfo|search|complementary)/i.test(role);
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    try{ if (el.closest && el.closest('[data-sx-readable-root]')) return true; }catch{}
    const style = window.getComputedStyle(el);
    if (!style) return false;
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = el.getBoundingClientRect?.();
    if (rect && rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function scoreNode(node) {
    if (!(node instanceof Element)) return -1e6;
    let score = 0;
    const idClass = `${node.id} ${node.className || ""}`;
    if (GOOD_RE.test(idClass)) score += 25;
    if (BAD_RE.test(idClass)) score -= 25;
    const textLen = (node.textContent || "").trim().length;
    score += Math.min(25, textLen / 800);
    return score;
  }

  function pickRoot() {
    const cands = Array.from(document.querySelectorAll("article, main, [role=main]"));
    if (cands.length) return cands.sort((a, b) => scoreNode(b) - scoreNode(a))[0];
    const blocks = Array.from(document.querySelectorAll("article, main, [role=main], .content, .post, .article, .entry, .markdown, .prose, .md, #content, #main"));
    if (blocks.length) return blocks.sort((a, b) => scoreNode(b) - scoreNode(a))[0];
    return document.body;
  }

  function nodeToMarkdown(node, opts) {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) {
      let t = node.nodeValue || "";
      t = t.replace(/\s+/g, " ");
      return t;
    }
    if (!(node instanceof Element)) return "";

    if (!isVisible(node)) return "";
    if (BAD_RE.test(node.className || "") || BAD_RE.test(node.id || "") || hasBadRole(node)) return "";
    const tag = node.tagName.toLowerCase();

    if (FORCE_SKIP_TAG.has(tag)) return "";

    // noscript: some sites (Washington Post) put real <img> inside <noscript>
    if (tag === 'noscript'){
      try{
        const html = node.innerHTML || '';
        if (!html) return '';
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const pic = tmp.querySelector('picture');
        const nsImg = tmp.querySelector('img');
        const pickFromSet = (set)=>{
          try{
            const parts = String(set||"").split(',').map(s=>s.trim()).filter(Boolean).map(s=>{
              const m=s.match(/\s*(\S+)\s+(\d+)w/); return m? { url:m[1], w:parseInt(m[2]) }: { url:s.split(/\s+/)[0], w:0 };
            });
            parts.sort((a,b)=> b.w-a.w); return parts.length? parts[0].url: '';
          }catch{ return ''; }
        };
        let url=''; let alt='';
        if (pic){
          const s=pic.querySelector('source[srcset]');
          url = pickFromSet(s?.getAttribute('srcset')||'') || (nsImg?.getAttribute('src')||'');
          alt = nsImg?.getAttribute('alt')||'';
        } else if (nsImg){
          alt = nsImg.getAttribute('alt')||'';
          url = nsImg.getAttribute('src')||nsImg.getAttribute('data-src')||'';
        }
        if (url){
          try{ url = new URL(url, location.href).href; }catch{}
          return `![${alt}](${url})`;
        }
      }catch{}
      return '';
    }

    if (["script","style","iframe","svg","canvas","menu"].includes(tag)) return "";

    // <pre>/<code>
    if (tag === "pre") {
      const code = node.textContent || "";
      const lang = (node.querySelector("code[class*=\"language-\"]")?.className || "").match(/language-([a-z0-9\-\+]+)/i)?.[1] || "";
      return code.trim() ? `\n\n\`\`\`${lang}\n${code.replace(/\n+$/, "")}\n\`\`\`\n\n` : "";
    }
    if (tag === "code") {
      if (node.parentElement && node.parentElement.tagName.toLowerCase() === "pre") return "";
      const t = node.textContent || "";
      return t ? "`" + t.replace(/`/g, "\\`") + "`" : "";
    }

    // <a> —— 没有可读文字就别输出 URL
    if (tag === "a") {
      const href = node.getAttribute("href") || "";
      const hasBadProto = /^(#|javascript:|mailto:|tel:)/i.test(href || "");
      const text = inlineChildrenToText(node, opts).trim();
      const onlyImg = node.children.length === 1 && node.children[0].tagName && node.children[0].tagName.toLowerCase() === "img";

      if (!href || hasBadProto) return text;
      if ((!text || text.length < 2) && onlyImg) return inlineChildrenToText(node, opts);
      if (!text || text.length < 2) return text;

      let abs = href;
      try { abs = new URL(href, location.href).href; } catch {}
      return `[${text}](${abs})`;
    }

    // <img> — handle lazy-loaded and srcset/currentSrc
    if (tag === "img") {
      const alt = node.getAttribute("alt") || "";
      const isTinyPlaceholder = (u)=>/data:image\/(gif|png)/i.test(u||"") && /base64/i.test(u||"");
      const pickFromSrcset = (set)=>{
        try{
          const parts = String(set||"").split(',').map(s=>s.trim()).filter(Boolean).map(s=>{
            const m=s.match(/\s*(\S+)\s+(\d+)w/); return m? { url:m[1], w:parseInt(m[2]) }: { url:s.split(/\s+/)[0], w:0 };
          });
          parts.sort((a,b)=> b.w-a.w); return parts.length? parts[0].url: '';
        }catch{ return ''; }
      };
      const cands = [];
      try{ if (node.currentSrc) cands.push(node.currentSrc); }catch{}
      [
        'src', 'data-src', 'data-original', 'data-hi-res-src', 'data-lazy-src'
      ].forEach(attr=>{ const v=node.getAttribute(attr); if (v) cands.push(v); });
      const ss = node.getAttribute('srcset') || node.getAttribute('data-srcset');
      const fromSet = pickFromSrcset(ss);
      if (fromSet) cands.unshift(fromSet);
      // Fallback: look for <source srcset> in parent <picture>
      try{
        if (!fromSet && node.parentElement && node.parentElement.tagName.toLowerCase()==='picture'){
          const s = node.parentElement.querySelector('source[srcset]');
          const u = pickFromSrcset(s?.getAttribute('srcset')||''); if (u) cands.unshift(u);
        }
      }catch{}
      const src = (cands.find(u=>u && !isTinyPlaceholder(u)) || '').trim();
      if (!src) return "";
      let abs = src; try { abs = new URL(src, location.href).href; } catch {}
      return `![${alt}](${abs})`;
    }

    // headings
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      const text = (node.textContent || "").trim();
      if (!text) return "";
      return `\n\n${"#".repeat(level)} ${text}\n\n`;
    }

    if (tag === "br") return "\n";

    // lists
    if (tag === "ul" || tag === "ol") {
      const ordered = tag === "ol";
      let idx = 1;
      let out = "\n\n";
      Array.from(node.children || []).forEach(li => {
        if (li.tagName && li.tagName.toLowerCase() === "li") {
          const line = inlineChildrenToText(li, opts).trim();
          if (line) {
            out += ordered ? `${idx}. ${line}\n` : `- ${line}\n`;
            idx++;
          }
          const subLists = Array.from(li.children || []).filter(ch => ["ul","ol"].includes(ch.tagName?.toLowerCase()));
          subLists.forEach(sub => {
            const subMd = nodeToMarkdown(sub, opts).replace(/\n/g, "\n    ");
            out += "    " + subMd.trim() + "\n";
          });
        }
      });
      return out + "\n";
    }

    // table
    if (tag === "table") {
      const rows = Array.from(node.querySelectorAll("tr"));
      if (!rows.length) return "";
      const cells = rows.map(tr => Array.from(tr.children).map(td => (td.textContent || "").trim()));
      let out = "\n\n";
      out += "| " + (cells[0] || []).join(" | ") + " |\n";
      out += "| " + (cells[0] || []).map(() => "---").join(" | ") + " |\n";
      for (let i = 1; i < cells.length; i++) {
        out += "| " + cells[i].join(" | ") + " |\n";
      }
      return out + "\n";
    }

    // blockquote
    if (tag === "blockquote") {
      const inner = blockChildrenToMarkdown(node, opts).trim().replace(/^/gm, "> ");
      return `\n\n${inner}\n\n`;
    }

    // hr
    if (tag === "hr") return "\n\n---\n\n";

    // paragraph / containers
    if (tag === "p") {
      const text = inlineChildrenToText(node, opts).trim();
      return text ? `\n\n${text}\n\n` : "";
    }

    if (BLOCK_CONTAINER.has(tag)) {
      const pieces = [];
      node.childNodes && node.childNodes.forEach(ch => {
        const chunk = nodeToMarkdown(ch, opts);
        if (chunk && chunk.trim()) pieces.push(chunk.trim());
      });
      if (!pieces.length) return "";
      return `\n\n${pieces.join("\n\n")}\n\n`;
    }

    return blockChildrenToMarkdown(node, opts);
  }

  function inlineChildrenToText(el, opts) {
    let out = "";
    el.childNodes && el.childNodes.forEach(ch => { out += nodeToMarkdown(ch, opts); });
    out = out.replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").replace(/\s{2,}/g, " ");
    return out;
  }

  function blockChildrenToMarkdown(el, opts) {
    let out = "";
    el.childNodes && el.childNodes.forEach(ch => { out += nodeToMarkdown(ch, opts); });
    out = out.replace(/\n{3,}/g, "\n\n");
    return out;
  }

  function postCleanLeadingNoise(md) {
    // 去掉文首链接密集/很短的菜单块
    const blocks = md.split(/\n{2,}/);
    const cleaned = [];
    let started = false;
    for (const b of blocks) {
      const t = b.trim();
      // Treat image tokens as content; do not penalize them as "linky" nav
      const imgTokens = (t.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
      const linkTokensAll = (t.match(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g) || []).length;
      const linkOnly = Math.max(0, linkTokensAll - imgTokens);
      const linkRatio = linkOnly / Math.max(1, t.split(/\s+/).length);
      const isVeryShort = t.length < 20;
      const looksLikeNav = linkRatio > 0.5 && t.length < 160;
      const hasImage = imgTokens > 0;
      if (!started && !hasImage && (isVeryShort || looksLikeNav)) continue;
      started = true;
      cleaned.push(t);
    }
    return cleaned.join("\n\n").trim();
  }

  function extractMarkdown(root) {
    const md = nodeToMarkdown(root, {});
    return postCleanLeadingNoise(
      md.replace(/\n{3,}/g, "\n\n").trim()
    );
  }

  window.__AI_READ_EXTRACT__ = function () {
    try{ /* best-effort */ const p=prepareForExtract(); if (p && typeof p.then==='function'){ /* detach */ } }catch{}
    // 1) Prefer Readability (offline, robust) if present
    const byR = tryExtractByReadability();
    if (byR && byR.markdown && byR.markdown.length > 60) return byR;
    // 2) Fallback to heuristic DOM→Markdown
    const root = pickRoot();
    const title = document.title || (document.querySelector("h1")?.innerText || "");
    const pageLang = document.documentElement.getAttribute("lang") || "";
    const markdown = extractMarkdown(root);
    const text = (root.innerText || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return { title, text, pageLang, markdown };
  };
})();
