// utils_extract.js —— DOM → 高保真 Markdown（优化：抑制无文本 URL 链接 + 过滤导航菜单）
(function () {
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

    if (["script","style","noscript","iframe","svg","canvas","menu"].includes(tag)) return "";

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

    // <img>
    if (tag === "img") {
      const alt = node.getAttribute("alt") || "";
      const src = node.getAttribute("src") || "";
      if (!src) return "";
      let abs = src;
      try { abs = new URL(src, location.href).href; } catch {}
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
      const linkRatio = (t.match(/\]\(https?:\/\/[^)]+\)/g) || []).length / Math.max(1, t.split(/\s+/).length);
      const isVeryShort = t.length < 20;
      const looksLikeNav = linkRatio > 0.5 && t.length < 160;
      if (!started && (isVeryShort || looksLikeNav)) continue;
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
