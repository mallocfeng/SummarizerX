// float_panel.js — 组件化升级：Petite-Vue + 卡片交互 + 动效 + 主题优化
(() => {
  // ===== i18n =====
  let i18nModule = null;
  async function loadI18n() {
    if (i18nModule) return i18nModule;
    try {
      const moduleUrl = chrome.runtime.getURL('i18n.js');
      i18nModule = await import(moduleUrl);
      return i18nModule;
    } catch (e) { console.warn('Failed to load i18n module:', e); return null; }
  }

  // ===== petite-vue（禁用 ESM 远程依赖，确保 MV3 合规）=====
  // 为符合“Blue Argon”要求，不从 vendor/petite-vue.es.js 动态 import（其文件含外链片段）。
  // 面板默认使用 vanilla 渲染路径；若后续需要，也可改为加载本地 IIFE 版本（非必须）。
  let PV = null;
  async function tryLoadPetiteVue() { PV = null; }

  const PANEL_ID = 'sx-float-panel';
  const MARK = '__SX_FLOAT_PANEL_READY__';
  if (window[MARK]) return;
  window[MARK] = true;

  // ===== Utils =====
  const escapeHtml = (str) =>
    String(str || '').replace(/[&<>"']/g,(s)=>({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));

  const collapseBlankLines = (txt='') =>
    String(txt).replace(/\r\n?/g,'\n').replace(/\n[ \t]*\n(?:[ \t]*\n)+/g,'\n\n');

  function stripInlineColor(html = '') {
    const dropProps = /\b(?:color|background-color|white-space)\s*:[^;"'}]+;?/gi;
    html = html.replace(/style\s*=\s*"([^"]*)"/gi,(m,css)=>{ const c=css.replace(dropProps,''); return c.trim()?`style="${c.trim()}"`:''; });
    html = html.replace(/style\s*=\s*'([^']*)'/gi,(m,css)=>{ const c=css.replace(dropProps,''); return c.trim()?`style='${c.trim()}'`:''; });
    html = html.replace(/<font\b([^>]*?)\scolor=(["']).*?\2([^>]*)>/gi,"<font$1$3>");
    return html;
  }

  function renderNoticeMarkdown(md='') {
    md = collapseBlankLines(md);
    let html = escapeHtml(md);
    html = html.replace(/```([\s\S]*?)```/g,(_,code)=>`<pre><code>${escapeHtml(code)}</code></pre>`)
               .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
               .replace(/\*(.+?)\*/g,'<em>$1</em>')
               .replace(/`([^`]+?)`/g,'<code>$1</code>')
               .replace(/^(?:- |\* )(.*)(?:\n(?:- |\* ).*)*/gm,(block)=>{
                  const items = block.split(/\n/).map(l=>l.replace(/^(?:- |\* )/,'').trim()).filter(Boolean);
                  return `<ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
               })
               .replace(/^(?:\d+\. )(.*)(?:\n(?:\d+\. ).*)*/gm,(block)=>{
                  const items = block.split(/\n/).map(l=>l.replace(/^\d+\. /,'').trim()).filter(Boolean);
                  return `<ol>${items.map(i=>`<li>${i}</li>`).join('')}</ol>`;
               })
               .replace(/\n{2,}/g,'</p><p>').replace(/(?:<\/p>\s*<p>\s*){2,}/gi,'</p><p>');
    return `<p>${html}</p>`;
  }

  function renderMarkdown(md='') {
    if (typeof md !== 'string') md = String(md ?? '');
    md = collapseBlankLines(md);
    const notices = [];
    md = md.replace(/:::notice\s*([\s\S]*?)\s*:::/g,(_,inner)=>{
      notices.push((inner||'').trim());
      return `__ALERT_TOKEN_${notices.length-1}__`;
    });
    let html = escapeHtml(md);
    html = html.replace(/```([\s\S]*?)```/g,(_,code)=>`<pre><code>${escapeHtml(code)}</code></pre>`);
    html = html.replace(/(^|\n)((?:&gt;\s?.*(?:\n|$))+)/g,(_,pfx,block)=>{
      const inner = block.split('\n').filter(Boolean).map(l=>l.replace(/^&gt;\s?/,'').trim()).join('<br>');
      return `${pfx}<blockquote>${inner}</blockquote>`;
    });
    html = html
      .replace(/^######\s?(.*)$/gm,'<h6>$1</h6>')
      .replace(/^#####\s?(.*)$/gm,'<h5>$1</h5>')
      .replace(/^####\s?(.*)$/gm,'<h4>$1</h4>')
      .replace(/^###\s?(.*)$/gm,'<h3>$1</h3>')
      .replace(/^##\s?(.*)$/gm,'<h2>$1</h2>')
      .replace(/^#\s?(.*)$/gm,'<h1>$1</h1>');

    // Images: convert Markdown ![alt](src) to HTML <img>
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, src) => {
      try{
        const s = String(src||'').trim();
        const safe = /^(https?:|data:image\/|blob:|\/|\.|#)/i.test(s) ? s : '';
        const a = (alt||'').trim();
        if (!safe) return '';
        return `<img src="${safe}" alt="${a}" loading="lazy">`;
      }catch{ return ''; }
    });

    html = html.replace(/^(?:- |\* )(.*)(?:\n(?:- |\* ).*)*/gm,(block)=>{
      const items = block.split('\n').map(l=>l.replace(/^(?:- |\* )/,'').trim()).filter(Boolean);
      return `<ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
    });
    html = html.replace(/^(?:\d+\. )(.*)(?:\n(?:\d+\. ).*)*/gm,(block)=>{
      const items = block.split('\n').map(l=>l.replace(/^\d+\. /,'').trim()).filter(Boolean);
      return `<ol>${items.map(i=>`<li>${i}</li>`).join('')}</ol>`;
    });

    html = html
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/`([^`]+?)`/g,'<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    html = html.replace(/\n{2,}/g,'<br><br>');
    html = html.replace(/(?:<br\s*\/?>\s*){3,}/gi,'<br><br>');
    html = html.replace(/(<\/(?:h[1-6]|p|ul|ol|pre|blockquote)>)\s*(?:<br\s*\/?>(?:\s|&nbsp;)*?)+/gi,'$1');
    html = html.replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*?)+(?!<br)(?=\s*<(?:h[1-6]|p|ul|ol|pre|blockquote)\b)/gi,'');
    html = html.replace(/(<div class="alert"[^>]*>.*?<\/div>)\s*(?:<br\s*\/?>(?:\s|&nbsp;)*?)+/gis,'$1')
               .replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*?)+(?=<div class="alert"[^>]*>)/gis,'')
               .replace(/<\/div>\s*<br\s*\/?>/gis,'</div>');
    html = `<div class="md">${html}</div>`;
    notices.forEach((txt,i)=>{
      const n = `<div class="alert" data-alert>
        <button class="alert-close" type="button" aria-label="关闭" title="关闭" data-alert-close>&times;</button>
        <div class="alert-content">${renderNoticeMarkdown(txt)}</div>
      </div>`;
      html = html.replace(`__ALERT_TOKEN_${i}__`, n);
    });
    // 强化一次 alert 前后 <br> 的清理，防止出现过大空隙
    html = html
      .replace(/(?:\s*<br\s*\/?>\s*)+(?=<div class=\"alert\"\b)/gi, '')
      .replace(/(<div class=\"alert\"[^>]*>.*?<\/div>)(?:\s*<br\s*\/?>\s*)+/gis, '$1');
    return html;
  }

  // ===== Share Card (canvas to clipboard) =====
  async function generateShareImageFromSummary(shadow){
    try{
      const host = shadow.host;
      const theme = host.getAttribute('data-theme') || 'light';
      const isDark = theme === 'dark';
      const summaryCard = shadow.getElementById('sx-summary');
      if (!summaryCard) throw new Error('no summary card');
      const md = summaryCard.querySelector('.md');
      if (!md) throw new Error('no summary content');
      const brand = currentLangCache==='en' ? 'SummarizerX AI Reader' : '麦乐可 AI 摘要阅读器';
      const headerTitle = currentLangCache==='en' ? 'Summary' : '摘要';
      const mainDomain = getMainDomain(location.hostname||'');

      // Match current card width but make it slightly narrower/taller
      const cardRect = summaryCard.getBoundingClientRect();
      const baseW = Math.max(360, Math.round(cardRect.width));
      const widthFactor = 0.78; // slightly narrower and taller look
      const scale = 2; // export scale (visual)
      const cardW = Math.round(baseW * widthFactor * scale);
      const outerP = Math.round(16 * scale); // outer padding
      const innerP = Math.round(18 * scale); // base inner padding (left)
      const extraRight = Math.round(24 * scale); // add more breathing room on the right
      const W = cardW + outerP * 2;

      // prepare for measurement pass
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Typography (match .md roughly)
      const baseFont = Math.round(15 * scale); // .md { font-size: 15px }
      const lineH = Math.round(baseFont * 1.7);
      const h1Font = Math.round(baseFont * 1.28);
      const h2Font = Math.round(baseFont * 1.2);
      const h3Font = Math.round(baseFont * 1.12);
      const hdrH = Math.round(baseFont * 2.7); // taller header for better breathing room

      let blocks = parseMdBlocks(md);
      // Targeted fix: if a heading like “结论/结论或建议/关键词(关键字)” exists but其后无内容块，
      // 直接从 DOM 收集该标题之后到下一个标题之间的 runs 作为段落补齐。
      try{
        const labels = [/^(结论或建议)$/i, /^(结论)$/i, /^(建议)$/i, /^(关键词)$/i, /^(关键字)$/i, /^(keywords?)$/i];
        const heads = Array.from(md.querySelectorAll('h1,h2,h3,h4,h5,h6'));
        const fixed=[];
        for (let i=0;i<blocks.length;i++){
          const b = blocks[i];
          fixed.push(b);
          if (b.kind==='h'){
            const txt = (b.runs||[]).map(r=>r.text||'').join('').trim();
            if (labels.some(re=> re.test(txt))){
              const next = blocks[i+1];
              if (!next || next.kind==='h'){
                // find matching heading element by text
                const el = heads.find(h=> (h.innerText||'').trim().startsWith(txt));
                if (el){
                  const runs = collectRunsBetween(el, heads[heads.indexOf(el)+1] || null);
                  const contentTxt = runs.map(r=>r.text||'').join('').trim();
                  if (contentTxt){ fixed.push({ kind:'p', runs }); }
                }
              }
            }
          }
        }
        if (fixed.length) blocks = fixed;
      }catch{}

      // Flatten keywords: after label "关键词/关键字/Keywords" (heading or bold paragraph),
      // merge following items into one paragraph separated by spaces.
      try{
        const textFromRuns = (runs=[])=> runs.map(r=> r?.text||'').join('');
        const isKwTitle = (blk)=>{
          const s = (blk.text!==undefined? blk.text : textFromRuns(blk.runs||[])).trim();
          return /^(关键词|关键字|keywords?)\s*[:：]?\s*$/i.test(s);
        };
        const startsWithKw = (blk)=>{
          const s = (blk.text!==undefined? blk.text : textFromRuns(blk.runs||[])).trim();
          return /^(关键词|关键字|keywords?)\s*[:：]?\s*/i.test(s) ? s.replace(/^(关键词|关键字|keywords?)\s*[:：]?\s*/i,'').trim() : null;
        };
        for (let i=0; i<blocks.length; i++){
          const b = blocks[i];
          if ((b.kind==='h' && isKwTitle(b)) || (b.kind==='p' && startsWithKw(b)!==null)){
            let acc=[];
            // include rest of current paragraph after the label, if any
            if (b.kind==='p'){
              const rest = startsWithKw(b);
              if (rest) acc.push(rest);
            }
            // aggregate until next heading-like label or heading block
            let j=i+1;
            while (j<blocks.length){
              const nb = blocks[j];
              const nbTxt = (nb.text!==undefined? nb.text : textFromRuns(nb.runs||[]));
              if (nb.kind==='h') break;
              // stop if遇到下一个粗体“标签：”段落（防止吞并“结论/建议”）
              const maybeLabel = /^(主要要点|结论或建议|结论|建议|关键词|关键字|keywords?)\s*[:：]?\s*$/i.test(nbTxt.trim());
              if (maybeLabel) break;
              if (nbTxt && nbTxt.trim()) acc.push(nbTxt.trim());
              j++;
            }
            if (acc.length){
              const flat = acc.join(' ').replace(/•/g,' ').replace(/\s+/g,' ').trim();
              const insert = { kind:'p', runs: [{ text: flat, weight: 400, italic: false, code: false }] };
              // if original block是段落且只包含标签，则在其后插入；否则保留原 block（作为标题）再插入合并段
              if (b.kind==='p'){
                // 替换当前段为纯“关键词”标题（可选：也可以直接保留原样）
                blocks.splice(i, 1, { kind:'h', runs: [{ text: '关键词', weight:700, italic:false, code:false }], level:3 }, insert);
                // 删除已经被合并的后续块
                blocks.splice(i+2, j-(i+1));
              } else {
                blocks.splice(i+1, j-(i+1), insert);
              }
              i++; // skip merged paragraph
            }
          }
        }
      }catch{}
      // Robust fallback: if key labels exist in raw text but missing after parse, or parsed text is far shorter, use inline-runs from DOM
      try{
        const raw = (md.innerText||'').trim();
        const textFromRuns = (runs=[])=> runs.map(r=> r?.text||'').join('');
        const joined = blocks.map(b=> (b.text!==undefined? b.text : textFromRuns(b.runs))).join('\n');
        const hasKeyLabels = /(关键词|关键字|结论|建议)/.test(raw);
        const lostKeyLabels = hasKeyLabels && !/(关键词|关键字|结论|建议)/.test(joined);
        const muchShorter = joined.length < Math.floor(raw.length * 0.5);
        if (lostKeyLabels || muchShorter){
          const runs = collectRunsSimple(md);
          blocks = [{ kind:'p', runs }];
        }
      }catch{}

      // measure content height
      const cardX = outerP, cardY = outerP;
      const cw = cardW - innerP - (innerP + extraRight);
      const headerSpacer = Math.round(16 * scale);
      let y = cardY + innerP + hdrH + headerSpacer;
      const blockGap = Math.round(8 * scale);
      const headTopGapDefault = Math.round(14 * scale);
      const headBottomGapDefault = Math.round(6 * scale);
      const headBottomGapTight = Math.round(4 * scale); // tighter gap below specific headings
      const afterTightTitleTopGap = Math.round(2 * scale); // much smaller gap for the first paragraph after tight titles
      const textFromRunsLocal = (runs=[])=> (runs||[]).map(r=>r?.text||'').join('');
      const getHeadMetrics = (blk)=>{
        if (blk?.kind!=='h') return { top: blockGap, bottom: blockGap, isTight:false };
        const s=(blk.text!==undefined? blk.text : textFromRunsLocal(blk.runs||[])).trim();
        const isTight = /^(结论或建议|结论|建议|关键词|关键字|keywords?)$/i.test(s);
        return { top: headTopGapDefault, bottom: isTight? headBottomGapTight: headBottomGapDefault, isTight };
      };
      let prevWasTightTitle = false;
      for (const b of blocks){
        const m = getHeadMetrics(b);
        const topApplied = prevWasTightTitle ? afterTightTitleTopGap : m.top;
        y += topApplied;
        if (b.kind==='blockquote'){
          ctx.font = fontFor({ size: baseFont, weight: 400, italic:false, code:false });
          const used = drawWrappedRich(ctx, b.runs, 0, 0, cw - Math.round(14*scale), lineH, 0, { draw:false, fontSize: baseFont });
          y += used + Math.round(12*scale);
        } else if (b.kind==='h'){
          const size = b.level<=1? h1Font : b.level===2? h2Font : h3Font;
          ctx.font = fontFor({ size, weight: 800, italic:false, code:false });
          y += drawWrappedRich(ctx, b.runs, 0, 0, cw, Math.round(size*1.45), 0, { draw:false, fontSize: size });
        } else if (b.kind==='li'){
          ctx.font = fontFor({ size: baseFont, weight: 400, italic:false, code:false });
          y += drawWrappedRich(ctx, b.runs, 0, 0, cw, lineH, 0, { draw:false, bullet: b.bullet||'•', indent: Math.round(22*scale), fontSize: baseFont });
        } else {
          ctx.font = fontFor({ size: baseFont, weight: 400, italic:false, code:false });
          y += drawWrappedRich(ctx, b.runs, 0, 0, cw, lineH, 0, { draw:false, fontSize: baseFont });
        }
        y += m.bottom;
        prevWasTightTitle = !!m.isTight;
      }
      // brand/footer
      const brandH = Math.round(baseFont * 1.6);
      const cardH = (y - blockGap) + innerP + brandH;
      const H = cardH + outerP * 2;

      // finalize canvas size and scale
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.scale(dpr, dpr);

      // Background
      if (!isDark){
        // Pure white background to match float panel light theme
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0,0,W,H);
      } else {
        // Dark theme keeps subtle gradient
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#0f172a');
        bg.addColorStop(0.5, '#0b1222');
        bg.addColorStop(1, '#0a1b14');
        ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
      }

      // Card container
      const r = Math.max(12, Math.round(24 * scale));
      const path = new Path2D();
      path.moveTo(cardX+r, cardY);
      path.arcTo(cardX+cardW, cardY, cardX+cardW, cardY+cardH, r);
      path.arcTo(cardX+cardW, cardY+cardH, cardX, cardY+cardH, r);
      path.arcTo(cardX, cardY+cardH, cardX, cardY, r);
      path.arcTo(cardX, cardY, cardX+cardW, cardY, r);
      ctx.save();
      ctx.shadowColor = isDark? 'rgba(0,0,0,0.38)' : 'rgba(16,24,40,0.18)';
      ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
      // Morandi-inspired soft card surface (light) instead of pure white
      ctx.fillStyle = isDark? 'rgba(20,30,54,0.90)' : '#F4F3EF';
      ctx.fill(path);
      // crisp border around card
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = Math.max(1, Math.round(1 * scale));
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.10)' : '#e6eaf2';
      ctx.stroke(path);
      ctx.restore();
      // Hero header (Morandi blue): gradient + abstract wave + big title + domain badge
      ctx.save();
      ctx.clip(path);
      const heroGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY+hdrH);
      if (!isDark){ heroGrad.addColorStop(0,'#C9D3E4'); heroGrad.addColorStop(1,'#B6C4DB'); }
      else { heroGrad.addColorStop(0,'#33435F'); heroGrad.addColorStop(1,'#2A3B59'); }
      ctx.fillStyle = heroGrad; ctx.fillRect(cardX, cardY, cardW, hdrH);
      // abstract wave
      ctx.globalAlpha = isDark ? 0.18 : 0.22;
      ctx.fillStyle = isDark ? '#8FB0FF' : '#8FA6C8';
      const waveY = cardY + Math.round(hdrH*0.46);
      ctx.beginPath();
      ctx.moveTo(cardX - 40*scale, waveY);
      ctx.bezierCurveTo(cardX + cardW*0.25, waveY-36*scale, cardX + cardW*0.55, waveY+24*scale, cardX + cardW + 40*scale, waveY-8*scale);
      ctx.lineTo(cardX + cardW + 40*scale, cardY + hdrH);
      ctx.lineTo(cardX - 40*scale, cardY + hdrH);
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      // big title: page title (2 lines)
      const heroPadX = cardX + innerP;
      // Use a concise label in the hero header to avoid overflow
      const title = headerTitle;
      const titleSize = Math.round(baseFont*1.35); // smaller hero title
      ctx.font = `800 ${titleSize}px \\-apple-system, Segoe UI, Roboto, PingFang SC, Noto Sans SC, sans-serif`;
      ctx.fillStyle = isDark? '#ECF2FF' : '#0f172a';
      drawWrappedText(ctx, title, heroPadX, cardY + Math.round(baseFont*1.8), cardW - innerP*2, Math.round(titleSize*1.2), 2);
      // domain badge
      if (mainDomain){
        const pad = Math.round(8*scale); const rx = Math.round(10*scale);
        ctx.font = `700 ${Math.round(baseFont*0.9)}px \\-apple-system, Segoe UI, Roboto, PingFang SC, Noto Sans SC, sans-serif`;
        const tw = ctx.measureText(mainDomain).width;
        const bx = cardX + cardW - tw - pad*2 - Math.round(12*scale);
        const badgeH = Math.round(baseFont*1.4);
        const by = cardY + Math.round(baseFont*0.7); // move badge up
        const badge = new Path2D();
        badge.moveTo(bx+rx, by);
        badge.arcTo(bx+tw+pad*2, by, bx+tw+pad*2, by+rx, rx);
        badge.arcTo(bx+tw+pad*2, by+badgeH, bx+tw+pad*2-rx, by+badgeH, rx);
        badge.arcTo(bx, by+badgeH, bx, by+badgeH-rx, rx);
        badge.arcTo(bx, by, bx+rx, by, rx);
        ctx.fillStyle = isDark? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)';
        ctx.fill(badge);
        ctx.fillStyle = isDark? '#E5EDFF' : '#334155';
        ctx.fillText(mainDomain, bx+pad, by+Math.round(badgeH*0.74));
      }
      // divider under hero
      const lineY = cardY + hdrH;
      const divGrad = ctx.createLinearGradient(0, lineY, 0, lineY + Math.round(8*scale));
      if (!isDark){ divGrad.addColorStop(0,'rgba(15,23,42,0.10)'); divGrad.addColorStop(1,'rgba(15,23,42,0)'); }
      else { divGrad.addColorStop(0,'rgba(0,0,0,0.25)'); divGrad.addColorStop(1,'rgba(0,0,0,0)'); }
      ctx.fillStyle = divGrad; ctx.fillRect(cardX, lineY, cardW, Math.round(8*scale));
      ctx.restore();
      // Summary body (styled by block)
      let drawY = cardY + innerP + hdrH + headerSpacer;
      prevWasTightTitle = false;
      for (const b of blocks){
        const m = getHeadMetrics(b);
        const topApplied = prevWasTightTitle ? afterTightTitleTopGap : m.top;
        drawY += topApplied;
        if (b.kind==='blockquote'){
          const bx = cardX + innerP + Math.round(8*scale);
          const bw = cw - Math.round(14*scale);
          // bar
          ctx.fillStyle = isDark? 'rgba(59,130,246,.35)' : 'rgba(59,130,246,.28)';
          ctx.fillRect(bx, drawY + 4, Math.round(4*scale), Math.round( Math.max(lineH, 10*scale) ));
          ctx.font = fontFor({ size: baseFont, weight: 400, italic:false, code:false });
          ctx.fillStyle = isDark? '#dbe3ee' : '#334155';
          const used = drawWrappedRich(ctx, b.runs, bx + Math.round(12*scale), drawY, bw - Math.round(12*scale), lineH, 0, { draw:true, fontSize: baseFont });
          drawY += used + Math.round(12*scale);
        } else if (b.kind==='h'){
          const size = b.level<=1? h1Font : b.level===2? h2Font : h3Font;
          ctx.font = fontFor({ size, weight: 800, italic:false, code:false });
          ctx.fillStyle = isDark? '#e6eefc' : '#0f172a';
          drawY += drawWrappedRich(ctx, b.runs, cardX+innerP, drawY, cw, Math.round(size*1.45), 0, { draw:true, fontSize: size });
        } else {
          ctx.font = fontFor({ size: baseFont, weight: 400, italic:false, code:false });
          ctx.fillStyle = isDark? '#e5e7eb' : '#111827';
          if (b.kind==='li'){
            drawY += drawWrappedRich(ctx, b.runs, cardX+innerP, drawY, cw, lineH, 0, { draw:true, bullet: b.bullet||'•', indent: Math.round(22*scale), fontSize: baseFont });
          } else {
            drawY += drawWrappedRich(ctx, b.runs, cardX+innerP, drawY, cw, lineH, 0, { draw:true, fontSize: baseFont });
          }
        }
        drawY += m.bottom;
        prevWasTightTitle = !!m.isTight;
      }
      drawY -= (blocks.length? getHeadMetrics(blocks[blocks.length-1]).bottom : 0); // remove last gap

      // Footer brand — refined palette per theme
      const footer = brand;
      ctx.font = `700 ${Math.round(baseFont*0.95)}px \\-apple-system, Segoe UI, Roboto, PingFang SC, Noto Sans SC, sans-serif`;
      const brandText = isDark ? '#BFD1FF' : '#3F5B94';   // soft indigo (dark) / muted indigo (light)
      const brandDot  = isDark ? '#8FB0FF' : '#6C8BD9';   // companion tone
      ctx.fillStyle = brandText;
      const textW = ctx.measureText(footer).width;
      ctx.fillText(footer, cardX + cardW - textW - (innerP + extraRight), cardY + cardH - Math.round(12*scale));
      // brand dot
      ctx.beginPath(); ctx.arc(cardX + cardW - textW - (innerP + extraRight) - Math.round(14*scale), cardY + cardH - Math.round(18*scale), Math.round(5*scale), 0, Math.PI*2); ctx.fillStyle = brandDot; ctx.fill();

      // Export to clipboard
      const blob = await new Promise(res=> canvas.toBlob(res, 'image/png', 0.95));
      if (!blob) throw new Error('toBlob failed');
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return true;
    }catch(e){ console.warn('share image failed', e); return false; }
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines, opts={}){
    const { paragraphSpacing = 12, draw = true } = opts;
    const paragraphs = String(text||'').split(/\n+/).filter(p=>p.length>0);
    let cursorY = y; let linesUsed = 0;
    const ellipsis = '…';
    const drawLine = (lineStr)=>{ if (draw) ctx.fillText(lineStr, x, cursorY); cursorY += lineHeight; linesUsed++; };
    const overLimit = ()=> maxLines && linesUsed >= maxLines;
    for (let pi=0; pi<paragraphs.length; pi++){
      const para = paragraphs[pi];
      // Tokenize: single CJK chars as tokens; keep latin runs and punctuation as chunks; keep spaces separately
      const tokens = para.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]|\s+|[^\s\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]+/g) || [para];
      let line = '';
      for (let i=0; i<tokens.length; i++){
        let tok = tokens[i];
        // normalize whitespace: collapse to single space when joining latin, but skip at line start or around CJK
        if (/^\s+$/.test(tok)){
          // Only add a single space if current line not empty and next token is non-space
          const next = tokens[i+1] || '';
          if (line && next && !/^\s+$/.test(next)) tok = ' ';
          else continue;
        }
        const candidate = line ? (line + tok) : tok.trimStart();
        const w = ctx.measureText(candidate).width;
        if (w > maxWidth && line){
          // line is full; draw it
          drawLine(line.trimEnd());
          if (overLimit()) { if (draw) ctx.fillText(ellipsis, x + maxWidth - ctx.measureText(ellipsis).width, cursorY); return cursorY - y; }
          // start new line with token (trim leading space)
          line = tok.trimStart();
          // if even single token exceeds width (e.g., long unbroken URL), force-break by slicing
          if (ctx.measureText(line).width > maxWidth){
            let acc = '';
            for (const ch of line){
              const t = acc + ch;
              if (ctx.measureText(t).width > maxWidth){
                drawLine(acc);
                if (overLimit()) { if (draw) ctx.fillText(ellipsis, x + maxWidth - ctx.measureText(ellipsis).width, cursorY); return cursorY - y; }
                acc = ch;
              } else acc = t;
            }
            line = acc;
          }
        } else {
          line = candidate;
        }
      }
      if (line){ drawLine(line.trimEnd()); if (overLimit()) return cursorY - y; }
      if (pi < paragraphs.length-1){ cursorY += paragraphSpacing; }
    }
    return cursorY - y;
  }

  function fontFor({ size, weight=400, italic=false, code=false }){
    const fam = code ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
                     : 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "PingFang SC", "Noto Sans SC", sans-serif';
    const wt = (typeof weight==='number') ? weight : (/bold|700|800/.test(weight)? 700: 400);
    return `${italic? 'italic ': ''}${wt} ${size}px ${fam}`;
  }

  // Draw rich runs with inline bold/italic/code and proper wrapping. Returns height used.
  function drawWrappedRich(ctx, runs, x, y, maxWidth, lineHeight, maxLines, opts={}){
    const { draw=true, bullet=null, indent=0, fontSize=null } = opts;
    const startX = x + (bullet ? indent : 0);
    let cx = startX, cy = y, lines = 0, hasAny = false, lineHasContent = false;
    const over = ()=> maxLines && lines >= maxLines;

    // draw bullet on first line
    if (bullet && draw){
      const saveFont = ctx.font, saveFill = ctx.fillStyle;
      const fs = fontSize || Math.max(12, Math.round(lineHeight*0.72));
      ctx.font = fontFor({ size: Math.max(12, Math.round(fs*0.9)), weight:700, italic:false, code:false });
      ctx.fillStyle = '#475569';
      ctx.fillText(String(bullet), x, cy);
      ctx.font = saveFont; ctx.fillStyle = saveFill;
    }

    const pushLine = ()=>{
      if (lineHasContent){ lines++; cy += lineHeight; }
      cx = startX; lineHasContent = false;
    };
    const tokensFrom = (text)=>{
      // split by newline and token regex; preserve newline tokens
      const arr=[]; const parts=String(text||'').split('\n');
      for (let i=0;i<parts.length;i++){
        const p=parts[i];
        if (p.length){
          const toks = p.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]|\s+|[^\s\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]+/g) || [p];
          arr.push(...toks);
        }
        if (i<parts.length-1) arr.push('\n');
      }
      return arr;
    };

    for (const run of runs||[]){
      const { text='', weight=400, italic=false, code=false } = run||{};
      const fs = fontSize || Math.max(12, Math.round(lineHeight*0.72));
      const effSize = code ? Math.max(10, Math.round(fs*0.92)) : fs;
      ctx.font = fontFor({ size: effSize, weight, italic, code });
      const toks = tokensFrom(text);
      for (let i=0;i<toks.length;i++){
        let tok = toks[i];
        if (tok==='\n'){
          // ignore leading or consecutive newlines
          if (!lineHasContent && cx===startX) continue;
          pushLine(); if (over()) return cy - y; continue;
        }
        if (/^\s+$/.test(tok)){
          // collapse spaces
          const next = toks[i+1]||''; if (!next || /^\s+$/.test(next) || cx===startX) continue; tok=' ';
        }
        const w = ctx.measureText(tok).width;
        if (cx - startX + w > maxWidth && cx>startX){ pushLine(); if (over()) return cy - y; }
        if (draw) ctx.fillText(tok, cx, cy);
        hasAny = true; lineHasContent = true;
        cx += w;
      }
    }
    if (lineHasContent){ lines++; cy += lineHeight; }
    return cy - y;
  }

  // Minimal DOM → runs collector for fallback
  function collectRunsSimple(root){
    const out=[];
    const walk=(node, style={weight:400, italic:false, code:false})=>{
      if (!node) return;
      if (node.nodeType===3){ out.push({ text: node.nodeValue||'', weight:style.weight, italic:style.italic, code:style.code }); return; }
      if (node.nodeType!==1) return;
      const tag=(node.tagName||'').toUpperCase();
      if (tag==='BR'){ out.push({ text:'\n', weight:style.weight, italic:style.italic, code:style.code }); return; }
      // Basic list and block handling to preserve bullets in fallback
      if (tag==='UL' || tag==='OL'){
        Array.from(node.children||[]).forEach(li=> walk(li, style));
        out.push({ text:'\n', weight:style.weight, italic:style.italic, code:style.code });
        return;
      }
      if (tag==='LI'){
        out.push({ text:'• ', weight:700, italic:false, code:false });
        Array.from(node.childNodes||[]).forEach(ch=> walk(ch, style));
        out.push({ text:'\n', weight:style.weight, italic:style.italic, code:style.code });
        return;
      }
      const next={ weight:style.weight, italic:style.italic, code:style.code };
      if (tag==='STRONG'||tag==='B') next.weight=700;
      if (tag==='EM'||tag==='I') next.italic=true;
      if (tag==='CODE'||tag==='KBD'||tag==='SAMP') next.code=true;
      Array.from(node.childNodes||[]).forEach(ch=> walk(ch, next));
    };
    Array.from(root.childNodes||[]).forEach(ch=> walk(ch));
    return out;
  }

  // Collect runs from after `startEl` until `endEl` (exclusive). If `endEl` is null, until end of container.
  function collectRunsBetween(startEl, endEl){
    const out=[]; if (!startEl) return out;
    let n = startEl.nextSibling;
    const walk = (node, style={weight:400, italic:false, code:false})=>{
      if (!node) return;
      if (node.nodeType===3){ out.push({ text: node.nodeValue||'', weight:style.weight, italic:style.italic, code:style.code }); return; }
      if (node.nodeType!==1) return;
      const tag=(node.tagName||'').toUpperCase();
      if (tag==='BR'){ out.push({ text:'\n', weight:style.weight, italic:style.italic, code:style.code }); return; }
      if (tag==='UL' || tag==='OL'){
        Array.from(node.children||[]).forEach(li=>{
          out.push({ text:'• ', weight:700, italic:false, code:false });
          Array.from(li.childNodes||[]).forEach(ch=> walk(ch, style));
          out.push({ text:'\n', weight:style.weight, italic:style.italic, code:style.code });
        });
        return;
      }
      const next={ weight:style.weight, italic:style.italic, code:style.code };
      if (tag==='STRONG'||tag==='B') next.weight=700;
      if (tag==='EM'||tag==='I') next.italic=true;
      if (tag==='CODE'||tag==='KBD'||tag==='SAMP') next.code=true;
      Array.from(node.childNodes||[]).forEach(ch=> walk(ch, next));
    };
    while(n && n!==endEl){
      walk(n);
      // separate block siblings by newline
      out.push({ text:'\n', weight:400, italic:false, code:false });
      n = n.nextSibling;
    }
    return out;
  }

  function parseMdBlocks(mdEl){
    const blocks = [];
    const pushRuns = (kind, runs, extra={})=>{
      const txt = (runs||[]).map(r=>r?.text||'').join('').trim();
      if (txt) blocks.push(Object.assign({ kind, runs }, extra));
    };
    const splitLabel = (txt)=>{
      if (!txt) return null;
      const m = txt.match(/^(.*?)[\:：﹕︰]\s*(.+)$/);
      if (m) return { label: m[1].trim(), rest: m[2].trim() };
      return null;
    };
    const blockTags = new Set(['P','UL','OL','DL','BLOCKQUOTE','PRE','H1','H2','H3','H4','H5','H6']);
    const hasBlockChild = (el)=>{
      try{ return Array.from(el.children||[]).some(c=> blockTags.has((c.tagName||'').toUpperCase())); }catch{ return false; }
    };
    const collectRuns = (node, style={weight:400, italic:false, code:false})=>{
      const out=[]; if (!node) return out;
      if (node.nodeType===3){ out.push({ text: node.nodeValue || '', weight: style.weight, italic: style.italic, code: style.code }); return out; }
      if (node.nodeType!==1) return out;
      const tag = (node.tagName||'').toUpperCase();
      if (tag==='BR'){ out.push({ text:'\n', weight:style.weight, italic:style.italic, code:style.code }); return out; }
      const next = { weight: style.weight, italic: style.italic, code: style.code };
      if (tag==='STRONG'||tag==='B') next.weight = 700;
      if (tag==='EM'||tag==='I') next.italic = true;
      if (tag==='CODE'||tag==='KBD'||tag==='SAMP') next.code = true;
      Array.from(node.childNodes||[]).forEach(ch=> out.push(...collectRuns(ch, next)));
      return out;
    };
    const visit = (el)=>{
      const tag = (el.tagName||'').toUpperCase();
      if (tag==='H1') pushRuns('h', collectRuns(el), { level:1 });
      else if (tag==='H2') pushRuns('h', collectRuns(el), { level:2 });
      else if (tag==='H3' || tag==='H4' || tag==='H5' || tag==='H6') pushRuns('h', collectRuns(el), { level:3 });
      else if (tag==='P'){
        pushRuns('p', collectRuns(el));
      }
      else if (tag==='BLOCKQUOTE') pushRuns('blockquote', collectRuns(el));
      else if (tag==='UL'){
        Array.from(el.querySelectorAll(':scope > li')).forEach(li=> pushRuns('li', collectRuns(li), { bullet: '•' }));
      } else if (tag==='OL'){
        Array.from(el.querySelectorAll(':scope > li')).forEach((li, idx)=> pushRuns('li', collectRuns(li), { bullet: `${idx+1}.` }));
      } else if (tag==='DL'){
        const dts = Array.from(el.querySelectorAll(':scope > dt'));
        const dds = Array.from(el.querySelectorAll(':scope > dd'));
        dts.forEach((dt,i)=>{ const tRuns=collectRuns(dt); const t=(dt.innerText||'').trim(); if (t) pushRuns('h', tRuns, { level:3 }); const d=dds[i]; if (d){ const vRuns=collectRuns(d); pushRuns('p', vRuns); } });
      } else if (tag==='PRE'){
        pushRuns('p', collectRuns(el));
      } else if (tag==='DIV' || tag==='SECTION' || tag==='ARTICLE' || tag==='SPAN'){
        if (!hasBlockChild(el)){ const runs=collectRuns(el); pushRuns('p', runs); }
        else { Array.from(el.children||[]).forEach(visit); }
      } else {
        Array.from(el.children||[]).forEach(visit);
      }
    };
    Array.from(mdEl.children||[]).forEach(visit);
    return blocks.length? blocks: [{ kind:'p', text: mdEl.innerText||'' }];
  }

  function getMainDomain(host){
    try{
      host = String(host||'').toLowerCase();
      if (!host) return '';
      const parts = host.split('.').filter(Boolean);
      if (parts.length <= 2) return host;
      // naive eTLD+1 heuristic; handles most cases except complex ccTLDs
      const ccTLDs = new Set(['co','com','net','org','edu','gov']);
      const last = parts[parts.length-1];
      const second = parts[parts.length-2];
      if (second.length<=3 && ccTLDs.has(second)){
        return parts.slice(-3).join('.');
      }
      return parts.slice(-2).join('.');
    }catch{ return host||''; }
  }

  // ===== 主题侦测 =====
  function parseColorToRGB(str){
    if(!str) return null;
    str=String(str).trim().toLowerCase();
    if (str==='transparent') return {r:255,g:255,b:255,a:0};
    let m=str.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\)$/);
    if(m) return {r:+m[1],g:+m[2],b:+m[3],a:m[4]!==undefined?+m[4]:1};
    m=str.match(/^#([0-9a-f]{3})$/i);
    if(m){ const h=m[1]; return {r:parseInt(h[0]+h[0],16),g:parseInt(h[1]+h[1],16),b:parseInt(h[2]+h[2],16),a:1}; }
    m=str.match(/^#([0-9a-f]{6})$/i);
    if(m){ const h=m[1]; return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:1}; }
    return null;
  }
  function relLuminance({r,g,b}) {
    const sr=[r,g,b].map(v=>v/255).map(v=> v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4));
    return 0.2126*sr[0]+0.7152*sr[1]+0.0722*sr[2];
  }
  function isNearlyTransparent(rgb){ const a=rgb?.a??1; return a<=0.01; }
  function getBgFromComputed(el){
    try{
      const cs=getComputedStyle(el);
      const c=parseColorToRGB(cs.backgroundColor);
      if(c && !isNearlyTransparent(c)) return c;
      const tc=parseColorToRGB(cs.color);
      if(tc){ const tl=relLuminance(tc); if(tl>0.72) return {r:20,g:24,b:31,a:1}; if(tl<0.28) return {r:255,g:255,b:255,a:1}; }
    }catch{}
    return null;
  }
  function getAncestorBg(start){
    let el=start;
    while(el && el!==document.documentElement){
      const c=getBgFromComputed(el);
      if(c) return c;
      el=el.parentElement||el.parentNode;
    }
    const b=getBgFromComputed(document.body||document.createElement('body')); if(b) return b;
    const h=getBgFromComputed(document.documentElement); if(h) return h;
    return null;
  }
  function getEffectiveBg(){
    const vw=Math.max(document.documentElement.clientWidth,window.innerWidth||0);
    const vh=Math.max(document.documentElement.clientHeight,window.innerHeight||0);
    const points=[[vw*0.5|0,vh*0.5|0],[vw*0.5|0,vh*0.3|0],[vw*0.5|0,vh*0.7|0]];
    for(const [x,y] of points){
      let node=document.elementFromPoint(x,y);
      if(node && node.nodeType===3) node=node.parentElement;
      if(!node) continue;
      const col=getAncestorBg(node);
      if(col) return col;
    }
    return null;
  }
  function getPageBgColor(){
    const eff=getEffectiveBg();
    if(eff && !isNearlyTransparent(eff)) return eff;
    for(const el of [document.body, document.documentElement].filter(Boolean)){
      const c=getBgFromComputed(el); if(c && !isNearlyTransparent(c)) return c;
    }
    try{
      const isNarrow=Math.max(window.innerWidth||0,document.documentElement.clientWidth||0)<=768;
      if(isNarrow){
        const meta=document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
        const mc=parseColorToRGB(meta||''); if(mc && !isNearlyTransparent(mc)) return mc;
      }
    }catch{}
    return {r:255,g:255,b:255,a:1};
  }
  function isDarkBackground(){
    const rgb=getPageBgColor();
    if(!rgb || isNearlyTransparent(rgb)){
      const base=getComputedStyle(document.body||document.documentElement);
      const tc=parseColorToRGB(base.color||'#111');
      if(tc){ const tl=relLuminance(tc); return tl>0.72; }
      return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return relLuminance(rgb)<0.5;
  }

  function extURL(p){ try{ return chrome?.runtime?.getURL? chrome.runtime.getURL(p): p; }catch{ return p; } }

  // ===== DOM & 样式（Shadow）=====
  function ensurePanel(){
    let host=document.getElementById(PANEL_ID);
    if(host) return host;
    host=document.createElement('div');
    host.id=PANEL_ID;
    // Prevent Dark Reader from instrumenting our Shadow DOM.
    // Dark Reader skips shadow hosts with class "surfingkeys_hints_host".
    // See iterateShadowHosts() in darkreader.js.
    try{ host.classList.add('surfingkeys_hints_host'); }catch{}
    // Also set a hint attribute (harmless if unsupported by DR).
    try{ host.setAttribute('data-darkreader-ignore',''); }catch{}
    host.style.position='fixed';
    host.style.top='0';
    host.style.right='0';
    host.style.width='420px';
    host.style.height='100vh';
    host.style.zIndex='2147483647';
    host.style.pointerEvents='auto';
    host.setAttribute('lang','zh-CN');

    const shadow=host.attachShadow({mode:'open'});
    const style=document.createElement('style');
    style.textContent=`
      :host{
        /* ===== Theme tokens (light) ===== */
        --bg: #f7f9fc;            /* page background */
        --surface: #ffffff;       /* cards / bars */
        --surface-2: #f3f5f9;     /* subtle secondary */
        --border: #e6eaf2;        /* soft border */
        --text: #0f172a;          /* primary text */
        --muted: #5b667a;         /* secondary text */

        /* glass tokens */
        --glass: rgba(255,255,255,.72);        /* slightly less transparent */
        --glass-soft: rgba(255,255,255,.48);
        --glass-edge: rgba(15,23,42,.10);
        --glass-highlight: rgba(255,255,255,.65);
        /* card-specific glass (more opaque for readability) */
        --card-glass: rgba(255,255,255,.82);
        --card-glass-soft: rgba(255,255,255,.68);
        --card-border: rgba(15,23,42,.08);
        --card-radius: 14px;

        --primary: #3b82f6;       /* indigo/azure */
        --reader-accent: #f59e0b; /* reader icon accent (amber) */
        --primary-600: #2563eb;   /* darker */
        --accent: #22c55e;        /* success */
        --danger: #ef4444;        /* danger */
        --candy-az: rgba(59,130,246,.10);   /* azure */
        --candy-vi: rgba(99,102,241,.10);   /* violet */
        --candy-pk: rgba(236,72,153,.10);   /* pink */

        --ring: 0 0 0 3px rgba(59,130,246,.22);
        --radius: 12px;
        /* approximate Chrome desktop surface corner; may be adjusted per-platform */
        --chrome-radius: 12px;
        --btn-min-h: 36px;
        --arrow-nudge: 8px; /* move empty arrow slightly upward */
        --shadow-1: 0 1px 2px rgba(16,24,40,.06);
        --shadow-2: 0 4px 12px rgba(16,24,40,.10);

        color-scheme: light;
        --font-stack: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "PingFang SC", "Noto Sans SC", sans-serif;
      }
      :host, :host * { box-sizing:border-box; font-family:var(--font-stack)!important; }

      /* ===== Layout ===== */
      .wrap{
        position:relative; height:100vh; display:flex; flex-direction:column;
        border-radius: var(--chrome-radius); overflow:hidden;
        /* frosted glass background */
        background: linear-gradient(135deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(14px) saturate(1.1);
        backdrop-filter: blur(14px) saturate(1.1);
        border-left:1px solid var(--border);
        box-shadow:-6px 0 22px rgba(17,24,39,.08);
        color:var(--text);
        will-change: transform, opacity, filter;
      }
      /* Float panel enter animation */
      @keyframes sxPanelIn {
        0%   { opacity: 0; transform: translateX(22px) scale(.98); filter: blur(6px); }
        60%  { opacity: .96; transform: translateX(0)   scale(1);   filter: blur(1px); }
        100% { opacity: 1; transform: translateX(0)   scale(1);   filter: blur(0); }
      }
      .wrap.fx-enter{ animation: sxPanelIn .58s cubic-bezier(.2,.7,.3,1) both; }

      /* Stagger header/footer for a subtle pop */
      @keyframes sxBarIn { 0%{ opacity:0; transform: translateY(-6px); } 100%{ opacity:1; transform: translateY(0); } }
      .wrap.fx-enter .appbar{ animation: sxBarIn .42s ease .08s both; }
      @keyframes sxFootIn { 0%{ opacity:0; transform: translateY(6px); } 100%{ opacity:1; transform: translateY(0); } }
      .wrap.fx-enter .footer{ animation: sxFootIn .42s ease .12s both; }

      /* Respect user reduced-motion preference */
      @media (prefers-reduced-motion: reduce){
        .wrap.fx-enter, .wrap.fx-enter .appbar, .wrap.fx-enter .footer{ animation: none; }
      }
      .dragbar{ position:absolute; top:0; left:0; height:100%; width:10px; cursor:col-resize; z-index:10; }
      .dragbar::after{ content:""; position:absolute; top:0; bottom:0; right:-1px; width:2px; background:linear-gradient(180deg, rgba(102,112,133,.20), rgba(102,112,133,.02)); opacity:0; transition: opacity .15s ease; }
      .dragbar:hover::after, .wrap.dragging .dragbar::after{ opacity:.9; }
      .wrap.dragging{ cursor:col-resize; }

      /* ===== Top bar ===== */
      .appbar{
        flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; padding:10px 12px;
        /* raised glass bar */
        background:
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 55%, rgba(255,255,255,0) 100%),
          linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(10px) saturate(1.05);
        backdrop-filter: blur(10px) saturate(1.05);
        border-bottom:1px solid var(--border);
        /* raised glass: subtle outer drop shadow */
        box-shadow: 0 1px 6px rgba(16,24,40,.06);
        position: relative; z-index: 20; /* keep tooltips above the body container */
        border-top-left-radius: var(--chrome-radius); border-top-right-radius: var(--chrome-radius);
      }
      .brand{ display:flex; align-items:center; gap:10px; }
      /* Reader mode icon (book, clearer silhouette) */
      .reader-ind{ position:relative; width:18px; height:18px; flex:0 0 auto; color: var(--reader-accent); opacity:1; cursor:pointer; border-radius:4px; outline:none; display:inline-block; }
      .reader-ind::before{ content:""; position:absolute; inset:0; background: currentColor;
        /* heroicons 24/solid book-open path (silhouette) */
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z"/></svg>') center/contain no-repeat;
        mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z"/></svg>') center/contain no-repeat;
      }
      .reader-ind:hover{ transform: translateY(-1px); opacity:1; }
      .reader-ind:active{ transform: translateY(0); }
      .reader-ind:focus-visible{ box-shadow: 0 0 0 3px rgba(59,130,246,.25); }
      :host([data-theme="dark"]) .reader-ind{ color: var(--reader-accent); }
      /* Ad filtering status indicator (shield + check/slash); clickable toggle */
      .adf-ind{ position:relative; width:18px; height:18px; flex:0 0 auto; color:#94a3b8; opacity:.95; cursor:pointer; border-radius:4px; outline:none; display:inline-block; }
      .adf-ind::before{ content:""; position:absolute; inset:0; background: currentColor; 
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>') center/contain no-repeat;
        mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>') center/contain no-repeat;
      }
      /* On: add a check mark overlay */
      .adf-ind.on{ color:#22c55e; }
      .adf-ind.on::after{ content:""; position:absolute; inset:0; background: currentColor; opacity:.95;
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4" stroke-width="3" stroke="%23000" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>') center/70% no-repeat;
        mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4" stroke-width="3" stroke="%23000" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>') center/70% no-repeat;
      }
      /* Off: add a slash overlay */
      .adf-ind:not(.on)::after{ content:""; position:absolute; inset:0; background: currentColor; opacity:.9;
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 19L19 5" stroke-width="3" stroke="%23000" fill="none" stroke-linecap="round"/></svg>') center/70% no-repeat;
        mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 19L19 5" stroke-width="3" stroke="%23000" fill="none" stroke-linecap="round"/></svg>') center/70% no-repeat;
      }
      .adf-ind:hover{ transform: translateY(-1px); opacity:1; }
      .adf-ind:active{ transform: translateY(0); }
      .adf-ind:focus-visible{ box-shadow: 0 0 0 3px rgba(59,130,246,.25); }
      :host([data-theme="dark"]) .adf-ind{ color:#7d8fb0; }
      :host([data-theme="dark"]) .adf-ind.on{ color:#22c55e; }

      /* Ad filtering tooltip (fast, prominent) */
      .adf-ind .adf-tip{ position:absolute; top: calc(100% + 8px); left: 50%; transform: translate(-50%, 4px) scale(.98); opacity:0; pointer-events:none;
        padding:8px 10px; border-radius:10px; border:1px solid var(--border); background: var(--surface); color: var(--text);
        font-size:13px; font-weight:800; letter-spacing:.02em; white-space:nowrap; box-shadow: 0 8px 24px rgba(16,24,40,.12);
        transition: opacity .12s ease, transform .12s ease; z-index: 1000;
      }
      .adf-ind .adf-tip::after{ content:""; position:absolute; top:-6px; left:50%; width:10px; height:10px; transform: translateX(-50%) rotate(45deg); background: var(--surface);
        border-left:1px solid var(--border); border-top:1px solid var(--border);
      }
      :host([data-theme="dark"]) .adf-ind .adf-tip{ background:#0f172a; color:#e2ebf8; border-color:#27344b; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
      :host([data-theme="dark"]) .adf-ind .adf-tip::after{ background:#0f172a; border-left-color:#27344b; border-top-color:#27344b; }
      .adf-ind .adf-tip.on{ opacity:1; transform: translate(-50%, 0) scale(1); }

      /* Reader tooltip */
      .reader-ind .reader-tip{ position:absolute; top: calc(100% + 8px); left: 50%; transform: translate(-50%, 4px) scale(.98); opacity:0; pointer-events:none;
        padding:8px 10px; border-radius:10px; border:1px solid var(--border); background: var(--surface); color: var(--text);
        font-size:13px; font-weight:800; letter-spacing:.02em; white-space:nowrap; box-shadow: 0 8px 24px rgba(16,24,40,.12);
        transition: opacity .12s ease, transform .12s ease; z-index: 1000;
      }
      .reader-ind .reader-tip::after{ content:""; position:absolute; top:-6px; left:50%; width:10px; height:10px; transform: translateX(-50%) rotate(45deg); background: var(--surface);
        border-left:1px solid var(--border); border-top:1px solid var(--border);
      }
      .reader-ind .reader-tip.on{ opacity:1; transform: translate(-50%, 0) scale(1); }
      :host([data-theme="dark"]) .reader-ind .reader-tip{ background:#0f172a; color:#e2ebf8; border-color:#27344b; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
      :host([data-theme="dark"]) .reader-ind .reader-tip::after{ background:#0f172a; border-left-color:#27344b; border-top-color:#27344b; }
      .logo{ width:10px; height:10px; border-radius:50%; background: var(--primary); box-shadow:0 0 0 6px rgba(59,130,246,.12); }
      .title{ font-size:14px; font-weight:800; letter-spacing:.2px; color:var(--text); }

      /* ===== Actions ===== */
      .actions{ display:flex; gap:8px; align-items:stretch; justify-content:flex-end; min-height: var(--btn-min-h); }
      .btn{
        display:inline-flex; align-items:center; justify-content:center; gap:8px;
        padding:8px 12px; min-height:var(--btn-min-h); line-height:1.2; white-space:nowrap; text-align:center;
        border:1px solid var(--border); border-radius:10px; cursor:pointer;
        background: var(--surface); color: var(--text); font-weight:700; letter-spacing:.02em;
        transition: transform .08s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease, color .18s ease;
        box-shadow: var(--shadow-1);
      }
      .btn:hover{ background:#fbfdff; border-color:#d9e6ff; box-shadow: var(--shadow-2); transform: translateY(-1px); }
      .btn:active{ transform: translateY(0); }
      .btn:focus-visible{ outline: none; box-shadow: var(--shadow-1), var(--ring); }
      .btn.primary{ background: var(--primary); border-color: var(--primary); color:#fff; }
      .btn.primary:hover{ background: var(--primary-600); border-color: var(--primary-600); }

      .actions .btn:not(.icon){ flex:1 1 auto; min-width:0; }
      .btn.icon{ flex:0 0 auto; width:36px; min-width:36px; padding:0; line-height:1; border-radius:10px; }
      .btn[disabled]{ opacity:.6; cursor:not-allowed; }

      /* ===== Progress ===== */
      .progress{ height:3px; position:relative; overflow:hidden;
        /* Match appbar surface to avoid transparent flash on show */
        background: linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(8px) saturate(1.05);
        backdrop-filter: blur(8px) saturate(1.05);
      }
      .progress .bar{ position:absolute; left:-20%; width:18%; min-width:140px; max-width:280px; top:0; bottom:0; background: linear-gradient(90deg, rgba(59,130,246,0), rgba(59,130,246,.85), rgba(59,130,246,0)); border-radius:999px; animation: slide 1.15s linear infinite; box-shadow:0 0 10px rgba(59,130,246,.35); }
      @keyframes slide { 0%{left:-20%;} 100%{left:110%;} }
      .progress.hidden{ display:none; }

      /* ===== Body ===== */
      .container{ flex:1 1 auto; padding:7px 12px 8px; overflow:auto; overflow-x:hidden; transition: height .6s cubic-bezier(.2,.7,.3,1); position:relative; overscroll-behavior: contain; }
      .container .section:last-child{ margin-bottom:8px; }
      .container .section:first-child{ margin-top:4px; }
      /* Empty state: hide cards; keep frosted background only between bars and compress middle to 66px */
      .wrap.is-empty #sx-summary,
      .wrap.is-empty #sx-cleaned{ display:none !important; }
      .wrap.is-empty .container{ flex:0 0 auto; height:66px; overflow:hidden; padding-top:0; padding-bottom:0; }
      .wrap.is-empty .section{ margin:0 !important; }
      /* While expanding, allow the middle to grow smoothly */
      .wrap.is-empty.expanding .container{ height: var(--sx-target, 2000px); }
      /* In folded state, keep the panel fully transparent outside the middle container */
      .wrap.fx-intro.is-empty,
      .wrap.is-empty{ background: transparent !important; -webkit-backdrop-filter:none !important; backdrop-filter:none !important; }
      .wrap.is-empty .container{
        background: linear-gradient(135deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(14px) saturate(1.05);
        backdrop-filter: blur(14px) saturate(1.05);
        border-top: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
        position: relative;
      }
      /* Center illus (down arrow) shown only in folded state */
      .empty-illus{ display:none; position:absolute; left:50%; top:50%; transform: translate(-50%, calc(-50% - var(--arrow-nudge)));
        width:28px; height:28px; border-radius:8px; opacity:.96; color: var(--primary);
        background: transparent; border:none; box-shadow:none; pointer-events:none;
        transition: opacity .25s ease, transform .25s ease; animation: bounceY 2.2s ease-in-out infinite; }
      :host([data-theme="dark"]) .empty-illus{ color: var(--primary-600); }
      .empty-illus::before{
        content:""; display:block; width:100%; height:100%;
        background: currentColor;
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23000"><path d="M12 16.5c-.38 0-.74-.14-1.02-.4l-5.5-5.2a1.4 1.4 0 0 1 0-2.02 1.54 1.54 0 0 1 2.1 0L12 12.9l4.42-4.02a1.54 1.54 0 0 1 2.1 0 1.4 1.4 0 0 1 0 2.02l-5.5 5.2c-.28.26-.64.4-1.02.4z"/></svg>') center/contain no-repeat;
        mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23000"><path d="M12 16.5c-.38 0-.74-.14-1.02-.4l-5.5-5.2a1.4 1.4 0 0 1 0-2.02 1.54 1.54 0 0 1 2.1 0L12 12.9l4.42-4.02a1.54 1.54 0 0 1 2.1 0 1.4 1.4 0 0 1 0 2.02l-5.5 5.2c-.28.26-.64.4-1.02.4z"/></svg>') center/contain no-repeat;
        transform: rotate(180deg);
      }
      .empty-illus::after{ content:""; display:none; }
      .wrap.is-empty .empty-illus{ display:grid; place-items:center; }
      .wrap.is-empty.expanding .empty-illus{ opacity:0; transform: translate(-50%, -60%); }
      .wrap.dragging .empty-illus{ animation: none; }
      @keyframes bounceY{ 0%,100%{ transform: translate(-50%, calc(-50% - var(--arrow-nudge))); } 50%{ transform: translate(-50%, calc(-50% - var(--arrow-nudge) + 4px)); } }
      @media (prefers-reduced-motion: reduce){ .empty-illus{ animation: none; } }
      /* Only show the left divider within the middle container; hide global one */
      .wrap.is-empty{ border-left:none !important; box-shadow:none !important; }
      .wrap.is-empty .container::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:1px; background: var(--border); }
      .wrap.is-empty .dragbar::after{ opacity:0 !important; width:0 !important; }
      :host([data-theme="dark"]) .wrap.is-empty .container{
        background: linear-gradient(135deg, var(--glass) 0%, var(--glass-soft) 100%);
      }
      /* Folded: keep same color scheme but reduce transparency via tokens */
      .wrap.is-empty{ --glass: rgba(255,255,255,.88); --glass-soft: rgba(255,255,255,.80); }
      :host([data-theme="dark"]) .wrap.is-empty{ --glass: rgba(16,22,32,.88); --glass-soft: rgba(16,22,32,.80); }
      /* In folded default state, make appbar/footer more solid; keep middle area more transparent */
      .wrap.is-empty .appbar,
      .wrap.is-empty .footer{ --glass: rgba(255,255,255,.97); --glass-soft: rgba(255,255,255,.92); }
      :host([data-theme="dark"]) .wrap.is-empty .appbar,
      :host([data-theme="dark"]) .wrap.is-empty .footer{ --glass: rgba(16,22,32,.92); --glass-soft: rgba(16,22,32,.86); }
      /* Folded: add a subtle bottom shadow to footer to enhance depth */
      .wrap.is-empty .footer{
        box-shadow: 0 -1px 6px rgba(16,24,40,.10), 0 4px 12px rgba(16,24,40,.12) !important;
      }
      :host([data-theme="dark"]) .wrap.is-empty .footer{
        box-shadow: 0 -1px 8px rgba(0,0,0,.28), 0 4px 12px rgba(0,0,0,.22) !important;
      }
      /* Intro state: high-transparency frosted look, no center block */
      .wrap.fx-intro{
        background: linear-gradient(135deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,.10) 100%);
        -webkit-backdrop-filter: blur(16px) saturate(1.05);
        backdrop-filter: blur(16px) saturate(1.05);
      }
      .wrap.fx-intro .container{ position:relative; }
      .wrap.fx-intro .container::after{ content:""; display:none; }
      :host([data-theme="dark"]) .wrap.fx-intro{
        background: linear-gradient(135deg, rgba(16,22,32,.34) 0%, rgba(16,22,32,.20) 100%);
      }
      .section{ margin:10px 0 16px; }

      /* ===== Cards ===== */
      .card{
        position:relative;
        background:
          /* fixed-size soft top highlight to avoid scaling with content height */
          radial-gradient(160px 120px at 24px -24px, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 68%),
          linear-gradient(180deg, var(--card-glass) 0%, var(--card-glass-soft) 100%);
        -webkit-backdrop-filter: blur(8px) saturate(1.05);
        backdrop-filter: blur(8px) saturate(1.05);
        border:1px solid var(--card-border);
        border-radius: var(--card-radius);
        padding:16px; line-height:1.7; font-size:15px; color: var(--text);
        box-shadow:
          0 1px 1px rgba(16,24,40,.05),
          0 8px 22px rgba(16,24,40,.08);
        transition: background-color .2s ease, color .2s ease, border-color .2s ease, box-shadow .22s ease, transform .12s ease;
        transform-origin: top center;
      }
      .card:hover{ transform: translateY(-2px); box-shadow: 0 2px 3px rgba(16,24,40,.06), 0 12px 28px rgba(16,24,40,.12); }
      /* When floating Q&A is in front, suppress hover pop on background summary/cleaned cards */
      .wrap.qa-hover-off #sx-summary:hover,
      .wrap.qa-hover-off #sx-cleaned:hover{ transform: translateY(0) !important; box-shadow: 0 1px 1px rgba(16,24,40,.05), 0 8px 22px rgba(16,24,40,.08) !important; }

      /* Light theme: add a gentle color tint so cards aren't pure white */
      :host([data-theme="light"]) .card{
        background:
          radial-gradient(160px 120px at 24px -24px, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 68%),
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 60%, rgba(255,255,255,0) 100%),
          linear-gradient(180deg, var(--card-glass) 0%, var(--card-glass-soft) 100%);
      }

      /* Dark theme: soften and enlarge the top-left highlight for a natural look */
      :host([data-theme="dark"]) .card{
        background:
          radial-gradient(220px 160px at 24px -24px, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 80%),
          linear-gradient(180deg, var(--card-glass) 0%, var(--card-glass-soft) 100%);
      }

      .card.card-head{ padding-top:52px; }
      .card.card-head::before{
        content:""; position:absolute; left:0; right:0; top:0; height:44px;
        /* raised glass header with gentle color tint */
        background:
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 60%, rgba(255,255,255,0) 100%),
          linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(8px) saturate(1.05);
        backdrop-filter: blur(8px) saturate(1.05);
        border-radius:10px 10px 0 0; border-bottom:1px solid var(--border);
        /* raised glass: subtle outer drop shadow */
        box-shadow: 0 1px 6px rgba(16,24,40,.06);
      }
      .card.card-head::after{
        content: attr(data-title);
        position:absolute; left:14px; top:12px;
        font-weight:700; font-size:13px; letter-spacing:.2px; color: var(--muted);
      }

      .card-tools{ position:absolute; right:10px; top:8px; display:flex; align-items:center; gap:6px; }
      .tbtn{ border:1px solid var(--border); padding:6px 8px; border-radius:8px; cursor:pointer; background: var(--surface); color:#334155; }
      /* Emphasized share button */
      .tbtn-share{ 
        background: #eef5ff; 
        border-color: #c7dbff; 
        color: #1e3a8a; 
        font-weight: 800;
      }
      .tbtn .icon{ width:16px; height:16px; display:inline-block; }
      .tbtn .icon-share{ stroke: currentColor; fill: none; stroke-width: 2; }
      .tbtn-share:hover{ background:#dbeafe; border-color:#b7d0ff; color:#1e40af; box-shadow: 0 2px 10px rgba(37,99,235,.18); }
      .tbtn-share:focus-visible{ outline:none; box-shadow: 0 0 0 3px rgba(37,99,235,.32); }
      .tbtn:hover{ background:#fbfdff; border-color:#d9e6ff; }
      .tbtn:active{ transform: translateY(1px); }
      .tbtn[aria-pressed="true"]{ background:#eef5ff; border-color:#cadeff; }

      .read-progress{ position:absolute; left:0; right:0; top:44px; height:3px; background:transparent; }
      .read-progress > span{ display:block; height:3px; width:0%; background: linear-gradient(90deg, rgba(34,197,94,.12), rgba(34,197,94,.85)); transition: width .12s linear; }

      .card.revive{ animation: sxPop .26s cubic-bezier(.2,.7,.3,1) both; }
      @keyframes sxPop { 0%{ opacity:0; transform: translateY(6px) scale(.995);} 100%{ opacity:1; transform: translateY(0) scale(1);} }
      /* Pull-down intro animation for cards */
      .card.pull-in{ animation: sxPull .42s cubic-bezier(.2,.7,.3,1) both; }
      @keyframes sxPull {
        0%{ opacity:0; transform: translateY(-12px); clip-path: inset(0 0 100% 0 round 12px); }
        60%{ opacity:.96; transform: translateY(-2px); clip-path: inset(0 0 8% 0 round 12px); }
        100%{ opacity:1; transform: translateY(0); clip-path: inset(0 0 0 0 round 12px); }
      }
      /* (removed clip-path unroll to avoid flicker); rely on height transition for smoothness */

      /* ===== Markdown ===== */
      .md{ font-size:15px; line-height:1.78; color: var(--text); word-break:break-word; overflow-wrap:anywhere; }
      .md h1{ margin:16px 0 10px; font-size:20px; font-weight:900; }
      .md h2{ margin:14px 0 8px;  font-size:18px; font-weight:800; }
      .md h3{ margin:12px 0 8px;  font-size:16px; font-weight:700; }
      .md p{ margin:6px 0; }
      .md ul, .md ol{ margin:6px 0; padding-left:18px; }
      .md li{ margin:2px 0; }
      .md blockquote{ margin:12px 0; padding:10px 12px; border-left:3px solid #cfe0ff; border-radius:10px; background:#f8fbff; color: var(--text); }
      .md code{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size:.92em; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:6px; padding:0 .35em; }
      .md pre{ margin:10px 0; padding:12px; background:#f7f9ff; border:1px solid #e6e8f0; border-radius:12px; overflow:auto; line-height:1.6; }
      .md table{ width:100%; border-collapse:collapse; display:block; overflow:auto; margin:10px 0; border-radius:10px; }
      .md thead th{ background:#f0f5ff; color:var(--text); font-weight:800; }
      .md th, .md td{ border:1px solid #e5e7eb; padding:8px 10px; text-align:left; vertical-align:top; }
      .md img{ display:block; margin:8px 0; border-radius:8px; max-width:100%; height:auto; }
      .md hr{ border:0; border-top:1px solid #e6e8f0; margin:12px 0; }

      /* content progressive reveal */
      .md [data-fade]{ opacity:0; transform: translateY(4px); transition: opacity .32s ease, transform .32s ease; }
      .md [data-fade].on{ opacity:1; transform: translateY(0); }

      .empty{ text-align:center; padding:34px 12px 30px; color:var(--muted); }
      .empty .illus{ width:72px; height:72px; margin:0 auto 10px; border-radius:16px; border:1px solid var(--border);
        background: linear-gradient(135deg, rgba(255,255,255,.92) 0%, var(--surface-2) 100%);
        box-shadow: var(--shadow-1); display:grid; place-items:center; }
      .empty .icon{ font-size:24px; line-height:1; }
      .empty .title{ font-weight:800; margin:6px 0 4px; color:var(--text); font-size:14px; letter-spacing:.2px; }
      .empty .hint{ margin-top:6px; color:var(--muted); font-size:12px; }
      .empty .hint strong{ background:rgba(59,130,246,.10); padding:0 6px; border-radius:6px; }

      .alert{ border-radius:12px; border:1px solid #f3e9c5; background:#fff9e6; padding:10px 40px 10px 12px; margin:2px 0 10px; font-size:13px; line-height:1.65; position:relative; }
      .alert .alert-close{ position:absolute; top:6px; right:6px; border:none; background:transparent; font-size:16px; cursor:pointer; line-height:1; opacity:.8; }
      .alert .alert-close:hover{ opacity:1; }

      /* tighten spacing after alert */
      .md .alert + *{ margin-top:10px !important; }
      .md .alert + h1,
      .md .alert + h2,
      .md .alert + h3,
      .md .alert + h4,
      .md .alert + h5,
      .md .alert + h6{ margin-top:6px !important; }

      /* ===== Skeleton (loading) ===== */
      .skl{ height:12px; margin:8px 0; border-radius:8px;
        background: linear-gradient(90deg, #eef2ff 0%, #ffffff 40%, #eef2ff 80%);
        background-size: 200% 100%;
        animation: skl 1.2s ease-in-out infinite;
      }
      @keyframes skl{ 0%{ background-position:0% 0; } 100%{ background-position:200% 0; } }

      /* ===== Footer ===== */
      .footer{ flex:0 0 auto; font-size:12px; border-top:1px solid var(--border); padding:8px 12px;
        background:
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 55%, rgba(255,255,255,0) 100%),
          linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(10px) saturate(1.05);
        backdrop-filter: blur(10px) saturate(1.05);
        /* raised glass: subtle outer drop shadow upwards */
        box-shadow: 0 -1px 6px rgba(16,24,40,.06);
        color:#334155; border-bottom-left-radius: var(--chrome-radius); border-bottom-right-radius: var(--chrome-radius); }
      .footer-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:nowrap; }
      .footer-controls{ display:flex; align-items:center; gap:16px; flex-shrink:0; }
      /* Note tip (compact icon-only) */
      .note-tip{ position:relative; display:inline-flex; align-items:center; gap:6px; padding:0 8px; height:28px; border-radius:8px; background: rgba(250,204,21,.18); border:1px solid rgba(217,119,6,.35); color:#92400e; font-weight:700; cursor:default; user-select:none; }
      .note-tip .dot{ width:10px; height:10px; border-radius:999px; background:#f59e0b; box-shadow:0 0 0 4px rgba(245,158,11,.18); }
      .note-tip .chev{ width:0; height:0; border-top:4px solid transparent; border-bottom:4px solid transparent; border-left:6px solid currentColor; opacity:.7; }
      .note-tip .note-tooltip{ position:absolute; left:0; bottom: calc(100% + 8px); min-width:260px; max-width:520px; padding:10px 12px; border-radius:10px; border:1px solid #f3e9c5; background:#fff9e6; color:#92400e; font-weight:600; line-height:1.6; box-shadow: 0 8px 24px rgba(0,0,0,.12); opacity:0; transform: translateY(6px); pointer-events:none; transition: opacity .16s ease, transform .16s ease; z-index: 20; }
      .note-tip:hover .note-tooltip, .note-tip:focus .note-tooltip, .note-tip:focus-within .note-tooltip{ opacity:1; transform: translateY(0); pointer-events:auto; }
      .note-tip .note-tooltip::after{ content:""; position:absolute; top:100%; left:14px; width:10px; height:10px; background:#fff9e6; border-left:1px solid #f3e9c5; border-bottom:1px solid #f3e9c5; transform: rotate(45deg); }
      .force-dark-toggle{ display:flex; align-items:center; gap:8px; }
      .force-dark-toggle .label{ color:#334155; white-space:nowrap; font-weight:700; font-size:12px; letter-spacing:.03em; }
      .toggle-btn{ 
        width:28px; 
        height:28px; 
        padding:0; 
        border:1px solid rgba(0,0,0,0.1); 
        border-radius:999px; 
        background:rgba(255,255,255,0.8); 
        cursor:pointer; 
        color:#334155; 
        display:grid; 
        place-items:center; 
        transition: all .18s ease; 
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .toggle-btn:hover{ 
        background:rgba(255,255,255,0.95); 
        border-color:rgba(0,0,0,0.15); 
        box-shadow: 0 2px 6px rgba(0,0,0,0.15); 
        transform: translateY(-1px); 
      }
      .toggle-btn:active{ 
        transform: translateY(0); 
        box-shadow: 0 1px 3px rgba(0,0,0,0.2); 
      }
      .toggle-btn.active{ 
        background:var(--primary); 
        color:#fff; 
        border-color:var(--primary); 
        box-shadow: 0 2px 8px rgba(59,130,246,0.3); 
      }
      .toggle-btn svg{ width:16px; height:16px; display:block; stroke:currentColor; }
      .theme-toggle{ display:flex; align-items:center; gap:8px; flex-shrink:0; }
      .theme-toggle .label{ color:#334155; white-space:nowrap; font-weight:700; font-size:12px; letter-spacing:.03em; }
      .theme-toggle .seg{ display:flex; gap:6px; background: var(--surface-2); border:1px solid var(--border); border-radius:999px; padding:2px; }
      .theme-btn{ width:28px; height:28px; padding:0; border:none; border-radius:999px; background:transparent; cursor:pointer; color:#334155; display:grid; place-items:center; transition: background .18s, color .18s; }
      .theme-btn:hover{ background:rgba(0,0,0,0.06); }
      .theme-btn.active{ background:var(--primary); color:#fff; }
      .theme-btn svg{ width:16px; height:16px; display:block; stroke:currentColor; }

      /* ===== Dark theme overrides ===== */
      :host([data-theme="dark"]) .alert{
        background: rgba(250, 204, 21, 0.08);   /* subtle amber tint on dark */
        border-color: rgba(250, 204, 21, 0.32);
        color: var(--text);                      /* keep readable light text */
      }
      :host([data-theme="dark"]) {
        color-scheme: dark;
        --bg:#0b1220;
        --surface:#111a2e;
        --surface-2:#0d1526;
        --border:#1f2a44;
        --text:#e8eef9;
        --muted:#c2cde3;
        --primary:#8ea2ff;
        --reader-accent:#fbbf24; /* brighter amber for dark */
        --primary-600:#7b8cff;
        --candy-az: rgba(142,162,255,.14);
        --candy-vi: rgba(123,140,255,.12);
        --candy-pk: rgba(255,140,190,.10);
        --ring: 0 0 0 3px rgba(142,162,255,.22);
        --shadow-1: 0 1px 2px rgba(0,0,0,.32);
        --shadow-2: 0 4px 12px rgba(0,0,0,.35);
        /* glass tokens for dark */
        --glass: rgba(17,26,46,.62);
        --glass-soft: rgba(17,26,46,.44);
        --glass-edge: rgba(255,255,255,.06);
        --glass-highlight: rgba(255,255,255,.10);
        --card-glass: rgba(17,26,46,.78);
        --card-glass-soft: rgba(17,26,46,.60);
        --card-border: rgba(255,255,255,.08);
      }
      /* skeleton contrast for dark */
      :host([data-theme="dark"]) .skl{
        background: linear-gradient(90deg, #0f1a30 0%, #1a2540 40%, #0f1a30 80%);
        background-size:200% 100%;
        animation: skl 1.2s ease-in-out infinite;
      }
      :host([data-theme="dark"]) .appbar{
        background:
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 55%, rgba(0,0,0,0) 100%),
          linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(10px) saturate(1.05);
        backdrop-filter: blur(10px) saturate(1.05);
        border-bottom:1px solid var(--border);
        box-shadow: 0 1px 8px rgba(0,0,0,.28);
      }
      :host([data-theme="dark"]) .logo{ background: var(--primary); box-shadow: 0 0 0 6px rgba(142,162,255,.14); }
      :host([data-theme="dark"]) .btn{ background: var(--surface); color:#dbe3ee; border-color:#27344b; box-shadow: var(--shadow-1); }
      :host([data-theme="dark"]) .btn:hover{ background:#16233b; border-color:#344766; box-shadow: var(--shadow-2); }
      :host([data-theme="dark"]) .btn.primary{ background: var(--primary-600); border-color: var(--primary-600); color:#fff; }
      :host([data-theme="dark"]) .progress .bar{ background: linear-gradient(90deg, rgba(255,255,255,0), rgba(142,162,255,.85), rgba(255,255,255,0)); box-shadow: 0 0 10px rgba(142,162,255,.30); }
      :host([data-theme="dark"]) .card.card-head::before{
        background:
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 60%, rgba(0,0,0,0) 100%),
          linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(8px) saturate(1.05);
        backdrop-filter: blur(8px) saturate(1.05);
        border-bottom-color: #1a2540;
        box-shadow: 0 1px 8px rgba(0,0,0,.28);
      }
      :host([data-theme="dark"]) .card.card-head::after{ color: var(--muted); }
      :host([data-theme="dark"]) .footer{
        background:
          linear-gradient(90deg, var(--candy-vi) 0%, var(--candy-az) 55%, rgba(0,0,0,0) 100%),
          linear-gradient(180deg, var(--glass) 0%, var(--glass-soft) 100%);
        -webkit-backdrop-filter: blur(10px) saturate(1.05);
        backdrop-filter: blur(10px) saturate(1.05);
        color:#d8e0ee; border-top-color: var(--border);
        box-shadow: 0 -1px 8px rgba(0,0,0,.28);
      }
      /* Dark theme for note tip */
      :host([data-theme="dark"]) .note-tip{ background: rgba(250,204,21,.10); border-color: rgba(250,204,21,.35); color:#f2e9c0; }
      :host([data-theme="dark"]) .note-tip .dot{ background:#fbbf24; box-shadow:0 0 0 4px rgba(250,204,21,.15); }
      :host([data-theme="dark"]) .note-tip .note-tooltip{ background: rgba(45,33,10,.95); border-color: rgba(250,204,21,.30); color:#f7f0ca; box-shadow: 0 8px 24px rgba(0,0,0,.45); }
      :host([data-theme="dark"]) .note-tip .note-tooltip::after{ background: rgba(45,33,10,.95); border-left-color: rgba(250,204,21,.30); border-bottom-color: rgba(250,204,21,.30); }
      :host([data-theme="dark"]) .empty .illus{ 
        background: linear-gradient(135deg, rgba(142,162,255,.08) 0%, rgba(142,162,255,.04) 100%);
        border-color: rgba(142,162,255,.15);
        box-shadow: 0 2px 8px rgba(0,0,0,.2);
      }
      :host([data-theme="dark"]) .empty .hint strong{ background:rgba(142,162,255,.16); }
      :host([data-theme="dark"]) .force-dark-toggle .label{ color:#d9e2f2; }
      :host([data-theme="dark"]) .toggle-btn{ 
        color:#d9e2f2; 
        border-color: rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.1);
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
      :host([data-theme="dark"]) .toggle-btn:hover{ 
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.25);
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        transform: translateY(-1px);
      }
      :host([data-theme="dark"]) .toggle-btn:active{ 
        transform: translateY(0);
        box-shadow: 0 1px 3px rgba(0,0,0,0.5);
      }
      :host([data-theme="dark"]) .toggle-btn.active{ 
        background:#2a3d5f; 
        color:#e8eef8; 
        border-color: #2a3d5f;
        box-shadow: 0 2px 8px rgba(142,162,255,0.3);
      }
      /* Stronger contrast for Force-Dark active state in dark theme */
      :host([data-theme="dark"]) #sx-force-dark-btn.active{
        background: var(--primary-600);
        border-color: var(--primary-600);
        color: #ffffff;
        box-shadow: 0 0 0 3px rgba(142,162,255,0.28), 0 4px 12px rgba(0,0,0,0.55);
      }
      :host([data-theme="dark"]) #sx-force-dark-btn.active:hover{
        background: var(--primary);
        border-color: var(--primary);
      }
      :host([data-theme="dark"]) .theme-toggle .label{ color:#d9e2f2; }
      :host([data-theme="dark"]) .theme-toggle .seg{ background:#18233a; border-color:#2a3d5f; }
      :host([data-theme="dark"]) .theme-btn{ color:#d9e2f2; }
      :host([data-theme="dark"]) .theme-btn.active{ background:#2a3d5f; color:#e8eef8; }

      /* Dark markdown readability tweaks */
      :host([data-theme="dark"]) .md a{ color: var(--primary); }
      :host([data-theme="dark"]) .md code{
        background:#121a2d;
        border:1px solid #243555;
        color:#eef4ff;
      }
      :host([data-theme="dark"]) .md pre{
        background:#0f1a30;
        border:1px solid #1a2540;
        color:#e8eef9;
      }
      :host([data-theme="dark"]) .md blockquote{
        background: rgba(142,162,255,.08);
        border-left:3px solid #2a3f66;
        color: var(--text);
      }
      :host([data-theme="dark"]) .md thead th{ background:#16233b; color: var(--text); }
      :host([data-theme="dark"]) .md th, :host([data-theme="dark"]) .md td{ border-color:#2a3f66; }
      :host([data-theme="dark"]) .md hr{ border-top:1px solid #1a2540; }

      /* Card tool buttons on dark */
      :host([data-theme="dark"]) .tbtn{ background: var(--surface); color:#e2ebf8; border-color:#27344b; }
      :host([data-theme="dark"]) .tbtn:hover{ background:#16233b; border-color:#344766; }
      :host([data-theme="dark"]) .tbtn-share{ background:#1b2a4b; border-color:#2a3f66; color:#cfe0ff; font-weight:800; }
      :host([data-theme="dark"]) .tbtn-share:hover{ background:#23365e; border-color:#3a5588; box-shadow: 0 2px 12px rgba(142,162,255,.22); }
      :host([data-theme="dark"]) .tbtn-share:focus-visible{ outline:none; box-shadow: 0 0 0 3px rgba(142,162,255,.35); }

      /* ===== Chat Bubbles ===== */
      .chat-list{ display:flex; flex-direction:column; gap:16px; padding:0 2px 0; }
      /* Provide a small visual breathing space at the very top when at scrollTop=0,
         but no persistent top padding while scrolling (the spacer scrolls away). */
      /* No extra spacer; keep tight to header and control via card padding */
      .chat-list::before{ content:""; display:block; height:0; flex:0 0 0; }
      .chat-bubble{ max-width:92%; padding:12px 16px; border-radius:14px; box-shadow: var(--shadow-1); white-space:pre-wrap; word-break:break-word; line-height:1.55; }
      /* Warm sticky-note palette for chat bubbles */
      .chat-bubble.user{ align-self:flex-end; background:#FFE9A6; color:#3b2a05; border:1px solid #FDE68A; }
      .chat-bubble.ai{ align-self:flex-start; background:#FFF9E6; color:#3b2f0b; border:1px solid #FDE68A; }
      :host([data-theme="dark"]) .chat-bubble.user{ background: rgba(250,204,21,.12); color:#f8f5e3; border:1px solid rgba(250,204,21,.34); }
      :host([data-theme="dark"]) .chat-bubble.ai{ background: rgba(250,204,21,.08); color:#efe9d2; border:1px solid rgba(250,204,21,.26); }
      .chat-bubble .skl{ height:12px; margin:8px 0; border-radius:8px; background: linear-gradient(90deg, rgba(148,163,184,.18), rgba(148,163,184,.28), rgba(148,163,184,.18)); background-size: 200% 100%; animation: shine 1.2s linear infinite; }
      @keyframes shine { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      /* typing indicator: three bouncing dots */
      .typing{ display:inline-flex; gap:6px; align-items:center; padding:2px 0; }
      .typing .dot{ width:6px; height:6px; border-radius:50%; background: currentColor; opacity:.55; animation: bounce 1.1s ease-in-out infinite; }
      .typing .dot:nth-child(1){ animation-delay: 0s; }
      .typing .dot:nth-child(2){ animation-delay: .15s; }
      .typing .dot:nth-child(3){ animation-delay: .3s; }
      @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity:.45 } 40% { transform: translateY(-4px); opacity:.9 } }
      /* Tighter paragraph spacing inside chat bubbles only */
      .chat-bubble .md p{ margin:6px 0; }
      .chat-bubble .md ul, .chat-bubble .md ol{ margin:6px 0 6px 18px; }
      .chat-bubble .md blockquote{ margin:8px 0; }
      .chat-bubble .md pre{ margin:8px 0; }
      .chat-hide{ animation: fadeUp .28s ease forwards; }
      @keyframes fadeUp { from{ opacity:1; transform: translateY(0);} to{ opacity:0; transform: translateY(-10px);} }

      /* ===== Floating QA Overlay ===== */
      /* Chat card: header 44px + persistent 2px breathing; bottom 10px */
      #sx-chat.card.card-head{ padding-top:46px; padding-bottom:10px; }
      #sx-chat.qa-float{ position:absolute; right:16px; z-index:60;
        /* leave room for QA bar at bottom; JS sets --qa-bottom */
        bottom: calc(var(--qa-bottom, 72px));
        /* default larger size */
        --qa-w: min(640px, 70%);
        --qa-h: min(123vh, 1140px);
        width: var(--qa-w);
        height: var(--qa-h);
        /* Fix width by default; do not elastically depend on container width */
        min-width: 200px;
        min-height: 280px;
        max-width: none;
        box-sizing: border-box;
        overflow:hidden;
        box-shadow: 0 8px 26px rgba(16,24,40,.16), 0 2px 10px rgba(16,24,40,.10);
        border:1px solid var(--border);
      }
      /* Match chat-list height to card height minus top/bottom paddings (46 + 10) */
      #sx-chat.qa-float .chat-list{ height: calc(var(--qa-h) - 56px); overflow:auto; overscroll-behavior: contain; }
      /* when repositioned by user */
      #sx-chat.qa-float.qa-custom-pos{ right:auto; bottom:auto; }
      /* show move cursor on header */
      #sx-chat.qa-float.card.card-head::before{ cursor: move; }
      /* resize handle */
      #sx-chat.qa-float .qa-resize-handle{ position:absolute; right:8px; bottom:8px; width:12px; height:12px; cursor: nwse-resize; opacity:.65; z-index:3; }
      #sx-chat.qa-float .qa-resize-handle::before{
        content:""; position:absolute; inset:0; background:
          linear-gradient(135deg, transparent 50%, rgba(234,179,8,.55) 50%),
          linear-gradient(135deg, transparent calc(50% - 3px), rgba(234,179,8,.70) calc(50% - 3px));
        background-size: 100% 100%, 8px 8px; background-repeat:no-repeat; background-position: center center;
        border-radius:2px;
      }
      :host([data-theme="light"]) #sx-chat.qa-float .qa-resize-handle::before{
        background:
          linear-gradient(135deg, transparent 50%, rgba(234,179,8,.65) 50%),
          linear-gradient(135deg, transparent calc(50% - 3px), rgba(234,179,8,.80) calc(50% - 3px));
      }
      :host([data-theme="dark"]) #sx-chat.qa-float .qa-resize-handle::before{
        background:
          linear-gradient(135deg, transparent 50%, rgba(250,204,21,.60) 50%),
          linear-gradient(135deg, transparent calc(50% - 3px), rgba(250,204,21,.75) calc(50% - 3px));
      }
      /* Make floating chat stand out more than background cards */
      :host([data-theme="light"]) #sx-chat.qa-float{
        /* Sticky-note like warm paper in light theme (slightly translucent) */
        background:
          radial-gradient(220px 160px at 28px -28px, rgba(255,255,255,.45) 0%, rgba(255,255,255,0) 78%),
          linear-gradient(180deg, rgba(255,247,214,.94) 0%, rgba(255,240,184,.90) 100%);
        border-color: rgba(234,179,8,.35); /* amber-500 */
        box-shadow: 0 10px 28px rgba(125,90,8,.16), 0 8px 18px rgba(234,179,8,.18);
      }
      :host([data-theme="light"]) #sx-chat.qa-float.card.card-head::before{
        background:
          linear-gradient(90deg, rgba(234,179,8,.20) 0%, rgba(253,224,71,.18) 60%, rgba(255,255,255,0) 100%),
          linear-gradient(180deg, rgba(255,250,230,.92) 0%, rgba(255,243,191,.90) 100%);
        border-bottom-color: rgba(234,179,8,.28);
      }
      :host([data-theme="dark"]) #sx-chat.qa-float{
        /* Warm-tinted dark paper (slightly translucent) */
        background:
          radial-gradient(260px 180px at 28px -28px, rgba(255,220,120,.10) 0%, rgba(255,220,120,0) 82%),
          linear-gradient(180deg, rgba(32,40,60,.84) 0%, rgba(26,34,52,.80) 100%);
        border-color: rgba(250,204,21,.30); /* amber-400 */
        /* warm glow so shadow is visible on dark surfaces */
        box-shadow: 0 12px 34px rgba(250,204,21,.16), 0 6px 18px rgba(12,18,28,.30);
      }
      :host([data-theme="dark"]) #sx-chat.qa-float.card.card-head::before{
        background:
          linear-gradient(90deg, rgba(250,204,21,.20) 0%, rgba(251,191,36,.18) 60%, rgba(255,255,255,0) 100%),
          linear-gradient(180deg, rgba(42,50,72,.70) 0%, rgba(34,42,64,.60) 100%);
        border-bottom-color: rgba(250,204,21,.26);
      }
      .chat-list{ position: relative; }
      #sx-chat.qa-float .card-tools{ display:flex; }
      #sx-chat .card-tools .tbtn-close{ font-weight:700; min-width:auto; padding:4px 8px; border-radius:8px; }
      /* Close button color matches sticky-note palette */
      :host([data-theme="light"]) #sx-chat.qa-float .tbtn-close{
        background:#FDE68A; /* amber-300 */
        border-color: rgba(234,179,8,.50);
        color:#3b2a05;
        box-shadow: 0 1px 2px rgba(125,90,8,.18);
      }
      :host([data-theme="light"]) #sx-chat.qa-float .tbtn-close:hover{
        background:#FCD34D; /* amber-300 -> amber-400 */
        border-color: rgba(234,179,8,.65);
      }
      :host([data-theme="light"]) #sx-chat.qa-float .tbtn-close:focus-visible{
        outline:none; box-shadow: 0 0 0 3px rgba(234,179,8,.35);
      }
      :host([data-theme="dark"]) #sx-chat.qa-float .tbtn-close{
        background: rgba(250,204,21,.18);
        border-color: rgba(250,204,21,.35);
        color:#f6f3e6;
        box-shadow: 0 1px 2px rgba(250,204,21,.12);
      }
      :host([data-theme="dark"]) #sx-chat.qa-float .tbtn-close:hover{
        background: rgba(250,204,21,.26);
        border-color: rgba(250,204,21,.45);
      }
      :host([data-theme="dark"]) #sx-chat.qa-float .tbtn-close:focus-visible{
        outline:none; box-shadow: 0 0 0 3px rgba(250,204,21,.28);
      }
      #sx-chat.qa-float.qa-rise{ animation: qaRise .22s cubic-bezier(.2,.7,.3,1) both; }
      @keyframes qaRise{ from{ opacity:0; transform: translateY(18px) scale(.98);} to{ opacity:1; transform: translateY(0) scale(1);} }

      /* ===== QA Bar ===== */
      .qa-bar{ padding: 8px 12px 10px; border-top:1px solid var(--border); background: var(--surface); position: relative; transition: background-color .18s ease, border-color .18s ease; }
      /* Make ask area visually associated with the chat card (light) */
      :host([data-theme="light"]) .qa-bar{
        background:
          linear-gradient(180deg, rgba(255,247,214,.52) 0%, rgba(255,243,191,.36) 100%),
          var(--surface);
        border-top-color: rgba(234,179,8,.28);
      }
      .qa-url{ font-size:12px; color: #546079; opacity:.9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:6px; }
      :host([data-theme="dark"]) .qa-url{ color:#9fb0d0; opacity:.95; }
      .qa-row{ display:flex; gap:8px; align-items:flex-start; }
      .qa-row textarea{ flex:1 1 auto; min-height:34px; max-height:120px; resize:vertical; padding:8px 10px; border:1px solid var(--border); border-radius:10px; background: #fff; color: var(--text); font-size:14px; line-height:1.4; transition: border-color .16s ease, box-shadow .16s ease, background-color .16s ease; }
      .qa-row textarea::placeholder{ color:#7c6b2a; opacity:.6; }
      /* Light theme: use white input background for clarity; keep warm focus ring */
      :host([data-theme="light"]) .qa-row textarea{ background: #ffffff; border-color: rgba(234,179,8,.42); }
      :host([data-theme="light"]) .qa-row textarea:focus{ outline:none; border-color: rgba(234,179,8,.66); box-shadow: 0 0 0 3px rgba(234,179,8,.22); background: #ffffff; }
      :host([data-theme="light"]) .qa-row textarea::placeholder{ color:#9a7b0e; opacity:.65; }
      /* Dark theme: subtle warm tint matching floating chat */
      :host([data-theme="dark"]) .qa-bar{
        background:
          linear-gradient(180deg, rgba(255,220,120,.10) 0%, rgba(255,220,120,.06) 100%),
          var(--surface);
        border-top-color: rgba(250,204,21,.22);
      }
      :host([data-theme="dark"]) .qa-row textarea{ background: rgba(26,34,52,.75); color: #e2ebf8; border-color: rgba(250,204,21,.28); }
      :host([data-theme="dark"]) .qa-row textarea:focus{ outline:none; border-color: rgba(250,204,21,.45); box-shadow: 0 0 0 3px rgba(250,204,21,.20); background: rgba(32,40,60,.82); }
      :host([data-theme="dark"]) .qa-row textarea::placeholder{ color:#d8c48a; opacity:.7; }
      .qa-row .btn{ flex:0 0 auto; height:34px; padding:8px 12px; transition: background-color .16s ease, border-color .16s ease, color .16s ease, box-shadow .16s ease; }
      /* Send button styled to match the chat card (light) */
      #sx-qa-send{ background: #fef3c7; border-color:#fcd34d; color:#7c4a02; font-weight:800; }
      #sx-qa-send:hover{ background:#fde68a; border-color:#f59e0b; color:#6b3e02; }
      #sx-qa-send:active{ background:#fcd34d; border-color:#f59e0b; color:#5b3302; }
      #sx-qa-send:focus-visible{ outline:none; box-shadow: 0 0 0 3px rgba(234,179,8,.28); }
      :host([data-theme="dark"]) #sx-qa-send{ background: rgba(250,204,21,.16); border-color: rgba(250,204,21,.38); color:#f8f5e3; font-weight:800; }
      :host([data-theme="dark"]) #sx-qa-send:hover{ background: rgba(250,204,21,.22); border-color: rgba(250,204,21,.50); }
      :host([data-theme="dark"]) #sx-qa-send:active{ background: rgba(250,204,21,.32); border-color: rgba(250,204,21,.55); }
      :host([data-theme="dark"]) #sx-qa-send:focus-visible{ outline:none; box-shadow: 0 0 0 3px rgba(250,204,21,.20); }
      /* Minimized QA restore icon */
      .qa-restore{ flex:0 0 auto; width:30px; height:30px; border-radius:999px; border:1px solid var(--border); background: var(--surface-2); display:none; place-items:center; cursor:pointer; color:#334155; margin-top:0; align-self:center; transition: box-shadow .18s ease, transform .18s ease, background-color .18s ease; }
      .qa-restore svg{ width:16px; height:16px; display:block; stroke:currentColor; }
      .qa-restore:hover{ filter: brightness(1.05); box-shadow: 0 0 0 6px rgba(59,130,246,.10); }
      .qa-restore[aria-hidden="false"]{ display:grid; }
      :host([data-theme="dark"]) .qa-restore{ border-color:#27344b; background:#0f172a; color:#e2ebf8; }
      .qa-restore.flash{ animation: qaRestorePulse 1.05s ease-in-out 3; }
      @keyframes qaRestorePulse{ 0%,100%{ transform: scale(1); box-shadow: 0 0 0 0 rgba(59,130,246,0); } 50%{ transform: scale(1.12); box-shadow: 0 0 0 10px rgba(59,130,246,.18); } }
      .qa-restore.flash-done{ animation: qaRestorePulseDone 1.05s ease-in-out 3; }
      @keyframes qaRestorePulseDone{ 0%,100%{ transform: scale(1); box-shadow: 0 0 0 0 rgba(34,197,94,0); } 50%{ transform: scale(1.12); box-shadow: 0 0 0 10px rgba(34,197,94,.22); } }

      /* ===== Accessibility ===== */
      @media (prefers-reduced-motion: reduce){
        .btn, .card{ transition: none; }
      }
    `;
    shadow.appendChild(style);

    const root = document.createElement('div');
    shadow.appendChild(root);
    document.documentElement.appendChild(host);

    // 模板
    root.innerHTML = `
      <div class="wrap" id="sx-wrap">
        <div class="dragbar" id="sx-drag"></div>
        <div class="appbar">
          <div class="brand"><span class="logo"></span><div class="title" id="sx-app-title">麦乐可 AI 摘要阅读器</div><div id="sx-adf-ind" class="adf-ind" role="switch" aria-checked="false" aria-label="" title="" tabindex="0"></div><div id="sx-reader-ind" class="reader-ind" role="button" aria-label="阅读模式" title="阅读模式" tabindex="0"></div></div>
          <div class="actions">
            <button id="sx-settings" class="btn" title="设置">设置</button>
            <button id="sx-run" class="btn primary">提取并摘要</button>
            <button id="sx-close" class="btn icon" title="关闭" aria-label="关闭">✕</button>
          </div>
        </div>
        <div id="sx-progress" class="progress hidden"><div class="bar"></div></div>
        <div class="container" id="sx-container">
          <div class="empty-illus" id="sx-empty-arrow" aria-hidden="true"></div>
          <section class="section">
            <div id="sx-chat" class="card card-head" data-title="你问我答" style="display:none">
              <div class="chat-list" id="sx-chat-list"></div>
            </div>
          </section>
          <section class="section">
            <div id="sx-summary" class="card card-head" data-title="摘要"></div>
          </section>
          <section class="section">
            <div id="sx-cleaned" class="card card-head" data-title="可读正文"></div>
          </section>
        </div>
        <div class="qa-bar" id="sx-qa-area" role="form" aria-label="页面问答">
          <div class="qa-url" id="sx-qa-url" title=""></div>
          <div class="qa-row">
            <textarea id="sx-qa-input" rows="1" placeholder="基于当前网页提问…"></textarea>
            <button id="sx-qa-send" class="btn" type="button">发送</button>
          </div>
        </div>
        <div class="footer">
          <div class="footer-row">
            <div class="note-tip" id="sx-footer-note" tabindex="0" aria-label="注意事项" title="注意事项">
              <span class="dot" aria-hidden="true"></span>
              <span class="chev" aria-hidden="true"></span>
              <div class="note-tooltip" id="sx-footer-note-tooltip">注：部分页面（如 chrome://、扩展页、PDF 查看器）不支持注入。</div>
            </div>
            <div class="footer-controls">
              <div class="force-dark-toggle" id="sx-pick">
                <span class="label" id="sx-pick-label">隐藏元素</span>
                <button class="toggle-btn" id="sx-pick-btn" aria-label="隐藏元素" title="选择页面元素并生成隐藏规则">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <line x1="12" y1="1" x2="12" y2="5"></line>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="1" y1="12" x2="5" y2="12"></line>
                    <line x1="19" y1="12" x2="23" y2="12"></line>
                  </svg>
                </button>
              </div>
              <div class="force-dark-toggle" id="sx-force-dark">
                <span class="label" id="sx-force-dark-label">强制深色</span>
                <button class="toggle-btn" id="sx-force-dark-btn" aria-label="强制深色模式" title="强制深色模式">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                </button>
              </div>
              <div class="theme-toggle" id="sx-theme">
                <span class="label" id="sx-theme-label">外观</span>
                <div class="seg" role="tablist" aria-label="外观切换">
                  <button class="theme-btn" data-mode="auto" role="tab" aria-selected="true" aria-label="自动" title="自动">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                  </button>
                  <button class="theme-btn" data-mode="light" role="tab" aria-selected="false" aria-label="浅色" title="浅色">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="4"></circle>
                      <line x1="12" y1="2" x2="12" y2="5"></line>
                      <line x1="12" y1="19" x2="12" y2="22"></line>
                      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"></line>
                      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"></line>
                      <line x1="2" y1="12" x2="5" y2="12"></line>
                      <line x1="19" y1="12" x2="22" y2="12"></line>
                      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"></line>
                      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22"></line>
                    </svg>
                  </button>
                  <button class="theme-btn" data-mode="dark" role="tab" aria-selected="false" aria-label="深色" title="深色">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 12.8a9 9 0 1 1-9.8-9 7 7 0 0 0 9.8 9z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    // Bind QA bar interactions
    try { setupQABar(shadow); } catch {}
    return host;
  }

  // ===== 主题覆盖 =====
  let themeOverride='auto';
  let forceDarkMode = false;
  function computeTheme(){
    try{ const mq=window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)'); if (mq && typeof mq.matches==='boolean') return mq.matches?'dark':'light'; }catch{}
    return isDarkBackground()? 'dark': 'light';
  }
  function applyThemeWithOverride(shadow){
    const mode=themeOverride||'auto';
    const theme=(mode==='light'||mode==='dark')? mode: computeTheme();
    if (shadow.host.getAttribute('data-theme')!==theme) shadow.host.setAttribute('data-theme',theme);
    // Also sync theme to reader overlay if it's open
    try{
      const ov = document.getElementById('sx-reader-overlay');
      if (ov && ov.getAttribute('data-theme') !== theme) ov.setAttribute('data-theme', theme);
    }catch{}
  }
  function markThemeButtonsActive(shadow){
    shadow.getElementById('sx-theme')?.querySelectorAll('.theme-btn').forEach(b=>{
      const active=(b.dataset.mode===themeOverride);
      b.classList.toggle('active',active);
      b.setAttribute('aria-selected', active?'true':'false');
    });
  }

  // ===== Chrome 交互 =====
  async function getActiveTabId(){ try{ const r=await chrome.runtime.sendMessage({type:'GET_ACTIVE_TAB_ID'}); return r?.ok? (r.tabId??null): null; }catch{ return null; } }
  async function getState(tabId){ const r=await chrome.runtime.sendMessage({type:'PANEL_GET_STATE', tabId}); if(!r?.ok) throw new Error(r?.error||'无法获取状态'); return r.data; }

  // ===== 状态渲染（组件化）=====
  let currentLangCache='zh';

  // 组件：卡片（Vue 启用时使用）
  function CardComponent(props){
    return {
      $template: `
        <div class="card card-head" :data-title="title" ref="card">
          <div class="read-progress" aria-hidden="true"><span :style="\`width:\${progress}%\`"></span></div>
          <div class="card-tools" role="toolbar" aria-label="card tools">
            <button class="tbtn tbtn-share" @click="share" :title="tt.share" aria-label="{{ tt.share }}">
              <svg class="icon icon-share" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/>
                <path d="M12 16V4"/>
                <path d="M8 8l4-4 4 4"/>
              </svg>
            </button>
            <button class="tbtn" @click="copy" :title="tt.copy">{{ tt.copy }}</button>
            <button class="tbtn" @click="toggle" :aria-pressed="collapsed? 'true':'false'" :title="collapsed? tt.expand: tt.collapse">
              {{ collapsed? tt.expand: tt.collapse }}
            </button>
          </div>
          <div v-show="!collapsed" class="md" v-html="html"></div>
          <div v-show="collapsed" class="empty">
            <div class="icon">➖</div>
            <div class="title">{{ tt.collapsed }}</div>
          </div>
        </div>
      `,
      title: props.title,
      html: props.html,
      collapsed: false,
      progress: 0,
      tt: {
        get copy(){ return currentLangCache==='en' ? 'Copy' : '复制'; },
        get share(){ return currentLangCache==='en' ? 'Share' : '分享'; },
        get collapse(){ return currentLangCache==='en' ? 'Collapse' : '收起'; },
        get expand(){ return currentLangCache==='en' ? 'Expand' : '展开'; },
        get collapsed(){ return currentLangCache==='en' ? 'Collapsed' : '已收起'; },
      },
      mounted(){
        try{
          const md = this.$refs.card.querySelector('.md');
          if (md){
            const blocks = Array.from(md.children);
            blocks.forEach((el)=>{
              el.setAttribute('data-fade','');
              const io = new IntersectionObserver((es)=>{
                es.forEach(e=>{
                  if(e.isIntersecting){ e.target.classList.add('on'); io.unobserve(e.target); }
                });
              }, { root: md.closest('.container'), threshold: 0.02 });
              io.observe(el);
            });
          }
        }catch{}

        const container = this.$refs.card.closest('.container');
        const update = () => {
          const cardRect = this.$refs.card.getBoundingClientRect();
          const contRect = container.getBoundingClientRect();
          const visible = Math.min(cardRect.bottom, contRect.bottom) - Math.max(cardRect.top, contRect.top);
          const total = cardRect.height;
          const pct = total>0 ? Math.max(0, Math.min(100, Math.round((visible/total)*100))) : 0;
          this.progress = pct;
        };
        this._onScroll = () => update();
        container.addEventListener('scroll', this._onScroll, { passive:true });
        update();
      },
      unmounted(){
        try{
          const container = this.$refs.card.closest('.container');
          container && this._onScroll && container.removeEventListener('scroll', this._onScroll);
        }catch{}
      },
      toggle(){ this.collapsed = !this.collapsed; },
      async share(){
        const ok = await generateShareImageFromSummary(shadow);
        this._flashBtn('.tbtn:first-child');
        if (!ok){
          try{
            const box=this.$refs.card; const alert=document.createElement('div');
            alert.className='alert'; alert.innerHTML=`<button class="alert-close" title="关闭" aria-label="关闭">&times;</button><div class="alert-content"><p>${currentLangCache==='en'?'Failed to copy image to clipboard':'复制图片到剪贴板失败'}</p></div>`;
            box.insertBefore(alert, box.querySelector('.md'));
          }catch{}
        } else {
          try{
            const card=this.$refs.card;
            const hint=document.createElement('div');
            hint.style.position='absolute'; hint.style.right='14px'; hint.style.top='42px'; hint.style.fontSize='12px'; hint.style.padding='4px 8px'; hint.style.borderRadius='6px';
            const isDark = shadow?.host?.getAttribute('data-theme')==='dark';
            if (isDark){
              hint.style.background='rgba(59,130,246,.22)';
              hint.style.border='1px solid rgba(142,162,255,.55)';
              hint.style.color='#e6efff';
            } else {
              hint.style.background='rgba(34,197,94,.12)';
              hint.style.border='1px solid rgba(34,197,94,.35)';
              hint.style.color='#166534';
            }
            hint.textContent = currentLangCache==='en' ? 'Summary card copied. Paste anywhere.' : '已生成摘要卡片到剪贴板，可在任意处粘贴';
            card.appendChild(hint); setTimeout(()=>{ try{ hint.remove(); }catch{} }, 1400);
          }catch{}
        }
      },
      async copy(){
        try{
          const tmp = document.createElement('div');
          tmp.innerHTML = this.html;
          const text = tmp.innerText;
          await navigator.clipboard.writeText(text);
          this._flashBtn('.tbtn:nth-child(2)');
        }catch(e){ console.warn('copy failed', e); }
      },
      _flashBtn(sel){
        const btn = this.$refs.card.querySelector(sel);
        if(!btn) return;
        btn.setAttribute('aria-pressed','true');
        setTimeout(()=>btn.setAttribute('aria-pressed','false'), 900);
      }
    };
  }

  // 原生模式下的占位渲染
  function vanillaSkeleton(shadow){
    shadow.getElementById('sx-summary').innerHTML =
      `<div class="skl" style="width:90%"></div><div class="skl" style="width:72%"></div><div class="skl" style="width:84%"></div>`;
    shadow.getElementById('sx-cleaned').innerHTML =
      `<div class="skl" style="width:96%"></div><div class="skl" style="width:64%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`;
  }
  async function vanillaEmpty(shadow){
    const i18n = await loadI18n(); const lang = i18n? await i18n.getCurrentLanguage(): 'zh';
    const em1 = `<div class="empty is-summary">
      <div class="illus"><div class="icon">📝</div></div>
      <div class="title">${lang==='zh'?'暂无摘要':'No Summary'}</div>
      <div class="hint">${lang==='zh'?'点击上方<strong>提取并摘要</strong>开始处理当前页面':'Click <strong>Extract & Summarize</strong> above to process this page'}</div>
    </div>`;
    const em2 = `<div class="empty is-cleaned">
      <div class="illus"><div class="icon">📄</div></div>
      <div class="title">${lang==='zh'?'暂无可读正文':'No Readable Content'}</div>
      <div class="hint">${lang==='zh'?'点击上方<strong>提取并摘要</strong>生成可读正文':'Use <strong>Extract & Summarize</strong> to generate cleaned content'}</div>
    </div>`;
    shadow.getElementById('sx-summary').innerHTML = em1;
    shadow.getElementById('sx-cleaned').innerHTML = em2;
  }
  async function vanillaRender(shadow, summary, cleaned){
    const $s = shadow.getElementById('sx-summary');
    const $c = shadow.getElementById('sx-cleaned');
    $s.innerHTML = summary ? stripInlineColor(renderMarkdown(summary)) : $s.innerHTML;
    try{ ensureShareButton(shadow); }catch{}
    $c.innerHTML = (cleaned===null) ? `<div class="skl" style="width:96%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`
      : (cleaned ? stripInlineColor(renderMarkdown(cleaned)) : $c.innerHTML);
    try{ $s.firstElementChild?.classList?.add('revive'); $c.firstElementChild?.classList?.add('revive'); }catch{}
  }

  function applyTrialLabelToFloatButton(shadow){
    const btn = shadow.getElementById('sx-run'); if(!btn) return;
    chrome.storage.sync.get(['aiProvider']).then(async ({ aiProvider })=>{
      const i18n = await loadI18n(); const lang = i18n? await i18n.getCurrentLanguage(): 'zh';
      if ((aiProvider||'trial')==='trial'){
        btn.textContent = lang==='zh' ? '试用摘要' : 'Trial Summary';
        btn.title = lang==='zh' ? '当前为试用模式（通过代理调用），点击开始试用摘要' : 'Currently in trial mode (via proxy), click to start trial summary';
      }else{
        btn.textContent = lang==='zh' ? '提取并摘要' : 'Extract & Summarize';
        btn.title = lang==='zh' ? '点击提取正文并生成摘要' : 'Click to extract content and generate summary';
      }
      try{ updateEmptyArrowPosition(); }catch{}
    }).catch(()=>{
      btn.textContent = '提取并摘要';
      btn.title = '点击提取正文并生成摘要';
      try{ updateEmptyArrowPosition(); }catch{}
    });
  }

  // ===== 轮询兜底 =====
  let pollTimer=null;
  function stopPolling(){ if(pollTimer){ clearTimeout(pollTimer); pollTimer=null; } }
  async function pollUntilDone(shadow, tabId, render){
    stopPolling();
    const start=Date.now();
    let interval=600, maxInterval=2000, hardTimeout=120000;

    const step = async ()=>{
      try{
        const st = await getState(tabId);
        if (st.status==='done'){ setSummarizing(shadow,false); setLoading(shadow,false); await render(st.summary, st.cleaned); stopPolling(); return; }
        if (st.status==='error'){
          setSummarizing(shadow,false); setLoading(shadow,false);
          const i18n = await loadI18n(); const lang = i18n? await i18n.getCurrentLanguage():'zh';
          shadow.getElementById('sx-summary').innerHTML =
            `<div class="alert"><button class="alert-close" title="关闭" aria-label="关闭">&times;</button><div class="alert-content"><p>${lang==='zh'?'发生错误，请重试。':'An error occurred, please try again.'}</p></div></div>`;
          stopPolling(); return;
        }
        if (st.status==='partial'){ setSummarizing(shadow,true); setLoading(shadow,true); await render(st.summary, null); }
        else if (st.status==='running'){ setSummarizing(shadow,true); setLoading(shadow,true); skeleton(shadow); }
      }catch{}
      if (Date.now()-start>hardTimeout){ setSummarizing(shadow,false); setLoading(shadow,false); stopPolling(); return; }
      interval = Math.min(maxInterval, Math.round(interval*1.25));
      pollTimer = setTimeout(step, interval);
    };
    pollTimer=setTimeout(step, interval);
  }

  // ===== 主题监听 & 其他绑定 =====
  function startThemeWatchers(shadow){
    try{ applyThemeWithOverride(shadow); }catch{}
    const themeObserver = new MutationObserver(()=>{ try{ if(themeOverride==='auto') applyThemeWithOverride(shadow); }catch{} });
    themeObserver.observe(document.documentElement,{attributes:true, attributeFilter:['class','style']});
    if (document.body) themeObserver.observe(document.body,{attributes:true, attributeFilter:['class','style']});
    const themeTick = setInterval(()=>{ try{ if(themeOverride==='auto') applyThemeWithOverride(shadow); }catch{} },1500);
    try{
      const mq=window.matchMedia('(prefers-color-scheme: dark)');
      const onChange=()=>{ if(themeOverride==='auto') applyThemeWithOverride(shadow); };
      if (mq?.addEventListener) mq.addEventListener('change', onChange);
      else if (mq?.addListener) mq.addListener(onChange);
    }catch{}
    return ()=>{ try{themeObserver.disconnect();}catch{} try{clearInterval(themeTick);}catch{} };
  }

  // ===== 启动 =====
  const host = ensurePanel();
  const shadow = host.shadowRoot;

  // 动态定位折叠箭头到“提取并摘要”按钮正下方
  function updateEmptyArrowPosition(){
    try{
      const wrap = shadow.getElementById('sx-wrap');
      if (!wrap || !wrap.classList.contains('is-empty')) return;
      const btn = shadow.getElementById('sx-run');
      const container = shadow.getElementById('sx-container');
      const arrow = shadow.getElementById('sx-empty-arrow');
      if (!btn || !container || !arrow) return;
      const br = btn.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      if (!br.width || !cr.width) return;
      const centerX = br.left + br.width/2;
      const leftInContainer = Math.max(0, Math.min(cr.width, centerX - cr.left));
      arrow.style.left = Math.round(leftInContainer) + 'px';
      // keep vertical center via top:50% in CSS
    }catch{}
  }

  // 监听容器与按钮尺寸变化，实时校准箭头（避免第一次变化时跳动）
  let __arrowRO = null;
  function bindArrowResizeObservers(){
    try{
      if (!('ResizeObserver' in window)) return;
      if (__arrowRO) { try{ __arrowRO.disconnect(); }catch{} }
      __arrowRO = new ResizeObserver(()=>{ try{ updateEmptyArrowPosition(); }catch{} });
      const c = shadow.getElementById('sx-container');
      const b = shadow.getElementById('sx-run');
      c && __arrowRO.observe(c);
      b && __arrowRO.observe(b);
    }catch{}
  }

  // Align corner radius to platform look
  (function applyPlatformRadius(){
    try{
      const ua = navigator.userAgent || '';
      // Defaults to 12px (Chrome desktop surfaces)
      let px = 12;
      if (/Windows/i.test(ua)) px = 8;               // Windows 11 look leans 8px
      else if (/Macintosh|Mac OS X/i.test(ua)) px = 12; // macOS rounded surfaces ~12px
      else px = 12;
      shadow.host.style.setProperty('--chrome-radius', px + 'px');
    }catch{}
  })();

  // ripple
  shadow.addEventListener('click',(ev)=>{
    const b=ev.target.closest('.btn'); if(!b) return;
    const rect=b.getBoundingClientRect(); const x=ev.clientX-rect.left; const y=ev.clientY-rect.top;
    const r=document.createElement('span'); r.className='ripple'; r.style.left=x+'px'; r.style.top=y+'px';
    b.appendChild(r); setTimeout(()=>{ try{ r.remove(); }catch{} }, 650);
  });

  // 关闭
  const stopThemeWatch = startThemeWatchers(shadow);
  shadow.getElementById('sx-close')?.addEventListener('click', ()=>{ stopThemeWatch(); host.remove(); window[MARK]=false; });
  // Prevent scroll from chaining to page when hovering panel body
  (function bindPanelScrollContainment(){
    try{
      const container = shadow.getElementById('sx-container');
      if (!container) return;
      const onWheel = (e)=>{
        try{
          const dy = e.deltaY || 0;
          const atTop = container.scrollTop <= 0;
          const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
          if ((dy < 0 && atTop) || (dy > 0 && atBottom)) { e.preventDefault(); e.stopPropagation(); }
          else { e.stopPropagation(); }
        }catch{}
      };
      container.addEventListener('wheel', onWheel, { passive:false });
      let lastY = 0;
      container.addEventListener('touchstart', (e)=>{ try{ lastY = e.touches && e.touches[0] ? e.touches[0].clientY : 0; }catch{} }, { passive:true });
      container.addEventListener('touchmove', (e)=>{
        try{
          if (!e.touches || !e.touches[0]) return;
          const y = e.touches[0].clientY; const dy = lastY ? (lastY - y) : 0; // positive -> scroll down
          const atTop = container.scrollTop <= 0;
          const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
          if ((dy < 0 && atTop) || (dy > 0 && atBottom)) { e.preventDefault(); e.stopPropagation(); }
          else { e.stopPropagation(); }
          lastY = y;
        }catch{}
      }, { passive:false });
    }catch{}
  })();
  // 阅读模式
  shadow.getElementById('sx-reader-ind')?.addEventListener('click', async ()=>{
    try{ await openReaderOverlay(); }catch(e){ console.warn('reader overlay failed', e); }
  });
  // Ensure reader tooltip
  try{ ensureReaderIndicatorTooltip(shadow); }catch{}
  // 元素选择器按钮
  shadow.getElementById('sx-pick-btn')?.addEventListener('click', () => {
    try { startElementPicker(); } catch (e) { console.warn('startElementPicker failed:', e); }
  });

  // 保持折叠箭头在窗口尺寸变化时也对齐
  try{ window.addEventListener('resize', ()=>{ try{ updateEmptyArrowPosition(); }catch{} }, { passive:true }); }catch{}

  // 开启动画：为容器添加入场类，完毕后移除
  try{
    const wrapOnce = shadow.getElementById('sx-wrap');
    if (wrapOnce){
      wrapOnce.classList.add('fx-enter');
      const clear = ()=>{ try{ wrapOnce.classList.remove('fx-enter'); wrapOnce.removeEventListener('animationend', clear); updateEmptyArrowPosition(); }catch{} };
      wrapOnce.addEventListener('animationend', clear);
      // 帧后与兜底时机各执行一次定位，避免入场动画位置差异
      requestAnimationFrame(()=>{ try{ updateEmptyArrowPosition(); }catch{} });
      setTimeout(clear, 900);
    }
  }catch{}

  // 设置
  shadow.getElementById('sx-settings')?.addEventListener('click', async ()=>{ try{ await chrome.runtime.sendMessage({type:'OPEN_OPTIONS'});}catch{} });

  // 主题切换
  const themeWrap=shadow.getElementById('sx-theme');
  themeWrap?.addEventListener('click',(e)=>{
    const btn=e.target.closest('.theme-btn'); if(!btn) return;
    const mode=btn.dataset.mode; if(!['auto','light','dark'].includes(mode)) return;
    themeOverride=mode;
    try{ chrome.storage.sync.set({ float_theme_override: themeOverride, options_theme_override: themeOverride }); }catch{}
    applyThemeWithOverride(shadow);
    markThemeButtonsActive(shadow);
  });

  // 强制深色模式切换
  const forceDarkBtn = shadow.getElementById('sx-force-dark-btn');
  forceDarkBtn?.addEventListener('click', async ()=>{
    forceDarkMode = !forceDarkMode;
    forceDarkBtn.classList.toggle('active', forceDarkMode);
    
    // 保存设置
    try{ 
      await chrome.storage.sync.set({ force_dark_mode: forceDarkMode }); 
    }catch(e){ 
      console.warn('Failed to save force dark mode setting:', e); 
    }
    
    // 应用强制深色模式
    applyForceDarkModeSmart(forceDarkMode);
  });

  // 拖宽 + 记忆
  (function bindDrag(){
    const drag=shadow.getElementById('sx-drag'); const wrapEl=shadow.getElementById('sx-wrap');
    // 当你问我答浮窗距离面板右缘小于安全距离时（含预测），阻止进一步缩小面板
    const SAFE_MARGIN = 10; // px
    function isQATouchingRightEdge(deltaShrinkPx = 0){
      try{
        const chatCard = shadow.getElementById('sx-chat');
        if (!chatCard || chatCard.style.display==='none' || !chatCard.classList.contains('qa-float')) return false;
        const container = shadow.getElementById('sx-container');
        if (!container) return false;
        const cr = chatCard.getBoundingClientRect();
        const pr = container.getBoundingClientRect();
        // 当前实际距离（不含容器 padding）
        let dist = pr.right - cr.right;
        // 若用户自定义了位置（left 定位），面板缩小时容器右缘向左移动，距离会随之减少
        if (chatCard.classList.contains('qa-custom-pos') && deltaShrinkPx > 0) dist -= deltaShrinkPx;
        return dist < SAFE_MARGIN;
      }catch{ return false; }
    }
    function isQATouchingLeftEdge(deltaShrinkPx = 0){
      try{
        const chatCard = shadow.getElementById('sx-chat');
        if (!chatCard || chatCard.style.display==='none' || !chatCard.classList.contains('qa-float')) return false;
        const container = shadow.getElementById('sx-container');
        if (!container) return false;
        const cr = chatCard.getBoundingClientRect();
        const pr = container.getBoundingClientRect();
        // 当前左侧距离（不含容器 padding）
        let dist = cr.left - pr.left;
        // 若卡片靠右锚定（默认非自定义位置），缩小面板（从右侧收缩）会让 left 同步向右移动，左距将减少 deltaShrinkPx
        if (!chatCard.classList.contains('qa-custom-pos') && deltaShrinkPx > 0) dist -= deltaShrinkPx;
        return dist < SAFE_MARGIN;
      }catch{ return false; }
    }
    function clamp(px){
      const vw=Math.max(document.documentElement.clientWidth, window.innerWidth||0);
      const minW=Math.min(320, vw-80), maxW=Math.max(320, Math.min(720, vw-80));
      return Math.max(minW, Math.min(maxW, px));
    }
    function setW(clientX){
      const vw=Math.max(document.documentElement.clientWidth, window.innerWidth||0);
      const fromRight=vw-clientX; let w=clamp(fromRight);
      const curW = parseInt(getComputedStyle(host).width,10) || host.clientWidth || 0;
      // 预测收缩量（>0 表示正在缩小）
      const delta = Math.max(0, curW - w);
      // 若与右/左缘的预测距离将小于安全值，则不再缩小
      if (delta > 0 && (isQATouchingRightEdge(delta) || isQATouchingLeftEdge(delta))) {
        w = curW; // 锁住当前宽度，直到不再贴边
      }
      host.style.width = `${w}px`; try{ chrome.storage.sync.set({ float_panel_width: w }); }catch{}
    }
    let dragging=false;
    function start(){ dragging=true; wrapEl?.classList.add('dragging'); document.documentElement.style.userSelect='none'; try{ updateEmptyArrowPosition(); }catch{} }
    function end(){ dragging=false; wrapEl?.classList.remove('dragging'); document.documentElement.style.userSelect=''; window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); window.removeEventListener('touchmove', tm, {capture:true, passive:false}); window.removeEventListener('touchend', te, {capture:true}); }
    const mm=(ev)=>{ if(!dragging) return; ev.preventDefault(); setW(ev.clientX); updateEmptyArrowPosition(); };
    const mu=()=>{ if(!dragging) return; end(); };
    const tm=(ev)=>{ if(!dragging) return; if(ev.touches && ev.touches[0]) setW(ev.touches[0].clientX); updateEmptyArrowPosition(); ev.preventDefault(); };
    const te=()=>{ if(!dragging) return; end(); };
    drag?.addEventListener('mousedown',(e)=>{ start(); e.preventDefault(); window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true); });
    drag?.addEventListener('touchstart',(e)=>{ start(); e.preventDefault(); window.addEventListener('touchmove', tm, {capture:true, passive:false}); window.addEventListener('touchend', te, {capture:true}); }, {passive:false});
    drag?.addEventListener('dblclick', async ()=>{
      const cur=parseInt(getComputedStyle(host).width,10)||420;
      const target=cur<520? 560: 380;
      let w=clamp(target);
      // 若双击目标会导致“缩小”，且预测距离将小于安全值（左右任一），则保持当前宽度不变
      if (w < cur && (isQATouchingRightEdge(cur - w) || isQATouchingLeftEdge(cur - w))) w = cur;
      host.style.width=`${w}px`; try{ chrome.storage.sync.set({ float_panel_width:w }); }catch{}
    });
    try{ chrome.storage.sync.get(['float_panel_width']).then(({float_panel_width})=>{ if(Number.isFinite(+float_panel_width)) host.style.width = `${clamp(+float_panel_width)}px`; updateEmptyArrowPosition(); }); }catch{}
  })();

  async function ensureReadable(){
    try{
      if (typeof window.__AI_READ_EXTRACT__ === 'function') return true;
    }catch{}
    // Ask background to inject content bridge and return payload
    try{ await chrome.runtime.sendMessage({ type: 'REQUEST_READABLE', ping:true }); }catch{}
    return typeof window.__AI_READ_EXTRACT__ === 'function';
  }

  async function fetchReadable(){
    try{
      if (await ensureReadable()){
        try{ return window.__AI_READ_EXTRACT__(); }catch{}
      }
      const resp = await chrome.runtime.sendMessage({ type: 'REQUEST_READABLE' });
      if (resp?.ok) return resp.data;
    }catch(e){ console.warn('fetchReadable failed', e); }
    return { title: document.title||'', pageLang: document.documentElement.getAttribute('lang')||'', text:'', markdown:'' };
  }

  function createReaderOverlay(markdown, title){
    const existing = document.getElementById('sx-reader-overlay'); if (existing) existing.remove();
    const ov = document.createElement('div'); ov.id='sx-reader-overlay'; ov.style.position='fixed'; ov.style.inset='0'; ov.style.zIndex='2147483646';
    const sh = ov.attachShadow({mode:'open'});
    const theme = shadow.host.getAttribute('data-theme') || 'light';
    const style = document.createElement('style');
    style.textContent = `
      :host{ --bg: #f5f7fb; --scrim: rgba(15,23,42,.55); --surface:#ffffff; --border:#e6eaf2; --text:#0f172a; --primary:#3b82f6; --bar-h:44px; color-scheme: light; }
      :host, :host *{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Micro Hei", sans-serif !important; }
      :host([data-theme="dark"]) { --bg:#0b1220; --scrim: rgba(0,0,0,.55); --surface:#111a2e; --border:#1f2a44; --text:#e8eef9; --primary:#8ea2ff; color-scheme: dark; }
      .scrim{ position:fixed; inset:0; background: var(--scrim); backdrop-filter: blur(2px); }
      .wrap{ position:fixed; left:50%; top:6vh; transform: translateX(-50%); width:min(980px, 92vw); max-height:88vh; overflow:hidden; background: var(--surface); color: var(--text); border:1px solid var(--border); border-radius:16px; box-shadow: 0 20px 60px rgba(0,0,0,.25); display:flex; flex-direction:column; }
      .bar{ position:absolute; top:0; left:0; right:0; height: var(--bar-h); display:flex; justify-content:flex-end; align-items:center; gap:8px; padding:8px; box-sizing:border-box; background: linear-gradient(180deg, rgba(255,255,255,.65), rgba(255,255,255,0)); backdrop-filter: blur(6px); border-bottom:1px solid var(--border); z-index:2; }
      .body{ flex:1 1 auto; overflow:auto; padding-top: var(--bar-h); scrollbar-gutter: stable both-edges; overscroll-behavior: contain; }
      :host([data-theme="dark"]) .bar{ background: linear-gradient(180deg, rgba(17,26,46,.65), rgba(17,26,46,0)); }
      .close{ width:28px; height:28px; border:1px solid var(--border); border-radius:999px; background:transparent; color:var(--text); cursor:pointer; display:grid; place-items:center; }
      .close:hover{ background: rgba(0,0,0,.06); }
      :host([data-theme="dark"]) .close:hover{ background: rgba(255,255,255,.08); }
      /* Double current horizontal padding for wider side spacing */
      .inner{ padding:20px 60px 30px; }
      .md{ font-size:17px; line-height:1.8; }
      .md h1{ margin:12px 0 10px; font-size:26px; font-weight:900; }
      .md h2{ margin:14px 0 8px; font-size:22px; font-weight:800; }
      .md h3{ margin:12px 0 6px; font-size:18px; font-weight:700; }
      .md p{ margin:10px 0; }
      .md a{ color: var(--primary); }
      .md ul,.md ol{ margin:8px 0 8px 18px; }
      .md li{ margin:4px 0; }
      .md blockquote{ margin:14px 0; padding:10px 12px; border-left:3px solid #cfe0ff; border-radius:10px; background: rgba(207,224,255,.22); }
      :host([data-theme="dark"]) .md blockquote{ border-left-color:#2a3f66; background: rgba(26,34,52,.55); }
      .md code{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size:.92em; background:rgba(148,163,184,.18); border:1px solid rgba(148,163,184,.28); border-radius:6px; padding:0 .35em; }
      .md pre{ margin:10px 0; padding:12px; background:rgba(148,163,184,.18); border:1px solid rgba(148,163,184,.28); border-radius:12px; overflow:auto; line-height:1.6; }
      .md img{ display:block; margin:10px 0; border-radius:12px; max-width:100%; height:auto; }
    `;
    sh.appendChild(style);
    const root = document.createElement('div'); sh.appendChild(root);
    sh.host.setAttribute('data-theme', theme);
    root.innerHTML = `
      <div class="scrim"></div>
      <div class="wrap" role="dialog" aria-modal="true" aria-label="阅读模式">
        <div class="bar"><button class="close" aria-label="关闭">✕</button></div>
        <div class="body">
          <div class="inner"><div class="md">${renderMarkdown((title?`# ${escapeHtml(title)}\n\n`:'') + (markdown||''))}</div></div>
        </div>
      </div>`;
    const close = () => { try{ ov.remove(); host.style.display=''; }catch{} };
    root.querySelector('.close')?.addEventListener('click', close);
    sh.querySelector('.scrim')?.addEventListener('click', close);
    document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', esc); } });
    document.documentElement.appendChild(ov);
    // auto-focus close for accessibility
    try{ sh.querySelector('.close')?.focus(); }catch{}

    // Prevent scroll chaining: when user continues to scroll at edges, don't scroll page
    try{
      const scroller = sh.querySelector('.body');
      const scrim = sh.querySelector('.scrim');
      const stopIfEdge = (e)=>{
        if (!scroller) return;
        const dy = e.deltaY || 0;
        const atTop = scroller.scrollTop <= 0;
        const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        // Always stop propagation so it never reaches the page
        if ((dy < 0 && atTop) || (dy > 0 && atBottom)) { e.preventDefault(); e.stopPropagation(); }
        else { e.stopPropagation(); }
      };
      // Wheel (mouse/trackpad/autoscroll)
      sh.addEventListener('wheel', stopIfEdge, { passive:false, capture:true });
      // Touch: block when at edges
      let lastY = 0;
      sh.addEventListener('touchstart', (e)=>{ try{ lastY = e.touches && e.touches[0] ? e.touches[0].clientY : 0; }catch{} }, { passive:true, capture:true });
      sh.addEventListener('touchmove', (e)=>{
        try{
          if (!scroller || !e.touches || !e.touches[0]) return;
          const y = e.touches[0].clientY; const dy = lastY ? (lastY - y) : 0; // positive dy means scroll down
          const atTop = scroller.scrollTop <= 0;
          const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
          if ((dy < 0 && atTop) || (dy > 0 && atBottom)) { e.preventDefault(); e.stopPropagation(); }
          else { e.stopPropagation(); }
          lastY = y;
        }catch{}
      }, { passive:false, capture:true });
      // Also absorb wheel on scrim area so background never scrolls while overlay is open
      scrim?.addEventListener('wheel', (e)=>{ e.preventDefault(); e.stopPropagation(); }, { passive:false });
      scrim?.addEventListener('touchmove', (e)=>{ e.preventDefault(); e.stopPropagation(); }, { passive:false });
    }catch{}
  }

  async function openReaderOverlay(){
    const data = await fetchReadable();
    const md = data?.markdown || '';
    const title = data?.title || '';
    createReaderOverlay(md, title);
    // hide sidepanel while reading
    try{ host.style.display='none'; }catch{}
  }

  // 关闭 notice 清理
  shadow.addEventListener('click',(e)=>{
    const btn=e.target.closest('.alert-close'); if(!btn) return;
    const box=btn.closest('.alert'); if(!box) return;
    const rm=(start,dir='nextSibling')=>{ let n=start[dir]; while(n && n.nodeType===1 && n.tagName==='BR'){ const d=n; n=n[dir]; d.remove(); } };
    rm(box,'previousSibling'); rm(box,'nextSibling');
    const md=box.closest('.md'); box.remove(); if(md){ const first=md.firstElementChild; first && (first.style.marginTop='6px'); }
  });

  // 文案/标题 i18n（更新 host.lang → 驱动中英文按钮换行策略）
  async function updateUIText(){
    const i18n=await loadI18n(); if(!i18n) return;
    try{
      const lang = await i18n.getCurrentLanguage();
      currentLangCache = lang==='en' ? 'en':'zh';
      // 设置 Shadow Host 的语言属性，用于 CSS 定向控制换行
      shadow.host.setAttribute('lang', currentLangCache==='zh' ? 'zh-CN' : 'en');

      const t_app = currentLangCache==='zh'?'麦乐可 AI 摘要阅读器':'SummarizerX AI Reader';
      const t_set = currentLangCache==='zh'?'设置':'Settings';
      const t_run = currentLangCache==='zh'?'提取并摘要':'Extract & Summarize';
      const t_qa_title = currentLangCache==='zh'?'你问我答':'Q&A';
      const t_qa_ph = currentLangCache==='zh'?'基于当前网页提问…':'Ask about this page…';
      const t_qa_send = currentLangCache==='zh'?'发送':'Send';
      const t_close = currentLangCache==='zh'?'关闭':'Close';
      const t_appear = currentLangCache==='zh'?'外观':'Appearance';
      const t_force_dark = currentLangCache==='zh'?'强制深色':'Force Dark';
      const t_note_label = currentLangCache==='zh'?'注意事项':'Notes';
      const t_note = currentLangCache==='zh'?'注：部分页面（如 chrome://、扩展页、PDF 查看器）不支持注入。':'Note: Some pages (like chrome://, extension pages, PDF viewers) do not support injection.';
      const t_pick = currentLangCache==='zh'?'隐藏元素':'Hide element';
      const t_pick_tt = currentLangCache==='zh'?'选择页面元素并生成隐藏规则':'Pick a page element and create a hide rule';
      shadow.getElementById('sx-app-title').textContent = t_app;
      const runBtn=shadow.getElementById('sx-run'); if(runBtn && !runBtn.disabled) runBtn.textContent=t_run;
      const settingsBtn=shadow.getElementById('sx-settings'); if(settingsBtn){ settingsBtn.textContent=t_set; settingsBtn.title=t_set; }
      const closeBtn=shadow.getElementById('sx-close'); if(closeBtn){ closeBtn.title=t_close; closeBtn.setAttribute('aria-label', t_close); }
      shadow.getElementById('sx-theme-label').textContent=t_appear;
      shadow.getElementById('sx-force-dark-label').textContent=t_force_dark;
      const pickLbl=shadow.getElementById('sx-pick-label'); if (pickLbl) { pickLbl.textContent=t_pick; }
      const pickBtn=shadow.getElementById('sx-pick-btn'); if (pickBtn) { pickBtn.title=t_pick_tt; pickBtn.setAttribute('aria-label', t_pick); }
      try{ await updateAdblockIndicator(shadow); }catch{}
      // Reader icon tooltip text
      try{
        ensureReaderIndicatorTooltip(shadow);
        const rid = shadow.getElementById('sx-reader-ind');
        const tip = rid?.querySelector('.reader-tip');
        const txt = currentLangCache==='en' ? 'Click to open Reader mode' : '点击切换到阅读模式';
        if (tip) tip.textContent = txt;
        try{ rid?.removeAttribute('title'); }catch{}
        rid?.setAttribute('aria-label', currentLangCache==='en' ? 'Reader mode' : '阅读模式');
      }catch{}
      const qaRestore=shadow.getElementById('sx-qa-restore'); if (qaRestore) qaRestore.title = (currentLangCache==='en' ? 'Show Q&A' : '显示你问我答');
      const noteLbl=shadow.getElementById('sx-footer-note-label'); if (noteLbl) noteLbl.textContent = t_note_label;
      const noteTip=shadow.getElementById('sx-footer-note-tooltip'); if (noteTip) noteTip.textContent = t_note;
      const noteWrap=shadow.getElementById('sx-footer-note'); if (noteWrap) noteWrap.setAttribute('aria-label', t_note_label);
      shadow.getElementById('sx-summary').setAttribute('data-title', currentLangCache==='zh'?'摘要':'Summary');
      shadow.getElementById('sx-cleaned').setAttribute('data-title', currentLangCache==='zh'?'可读正文':'Readable Content');
      try { shadow.getElementById('sx-chat').setAttribute('data-title', t_qa_title); } catch {}
      try { const i=shadow.getElementById('sx-qa-input'); if(i) i.placeholder=t_qa_ph; } catch {}
      try { const b=shadow.getElementById('sx-qa-send'); if(b) b.textContent=t_qa_send; } catch {}
      try { const u=shadow.getElementById('sx-qa-url'); if(u){ u.textContent=location.href; u.title=location.href; } } catch {}
    }catch(e){ console.warn('Failed to update UI text:', e); }
    try{ updateEmptyArrowPosition(); }catch{}
    try{ ensureShareButton(shadow); }catch{}
  }

  async function updateAdblockIndicator(shadow){
    try{
      const el = shadow.getElementById('sx-adf-ind'); if (!el) return;
      // ensure tooltip exists before updating text
      ensureAdblockIndicatorTooltip(shadow);
      const { adblock_enabled = false } = await chrome.storage.sync.get({ adblock_enabled: false });
      const enabled = !!adblock_enabled;
      el.classList.toggle('on', enabled);
      const txt = currentLangCache==='en' ? (enabled ? 'Ad filtering: On' : 'Ad filtering: Off') : (enabled ? '广告过滤：已开启' : '广告过滤：未开启');
      // Use custom tooltip instead of native title (faster, larger)
      try{ const tip = el.querySelector('.adf-tip'); if (tip) tip.textContent = txt; }catch{}
      try{ el.removeAttribute('title'); }catch{}
      el.setAttribute('aria-label', txt);
      el.setAttribute('aria-checked', enabled ? 'true':'false');
    }catch{}
  }

  function bindAdblockIndicatorToggle(shadow){
    try{
      const el = shadow.getElementById('sx-adf-ind'); if (!el) return;
      const toggle = async ()=>{
        try{
          const { adblock_enabled = false } = await chrome.storage.sync.get({ adblock_enabled: false });
          const next = !adblock_enabled;
          await chrome.storage.sync.set({ adblock_enabled: next });
          // Optimistic UI: update immediately
          await updateAdblockIndicator(shadow);
        }catch(e){ console.warn('toggle adblock failed', e); }
      };
      el.addEventListener('click', toggle);
      el.addEventListener('keydown', (ev)=>{ if (ev.key==='Enter' || ev.key===' '){ ev.preventDefault(); toggle(); } });
    }catch{}
  }

  function ensureAdblockIndicatorTooltip(shadow){
    try{
      const el = shadow.getElementById('sx-adf-ind'); if (!el) return;
      let tip = el.querySelector('.adf-tip');
      if (!tip){
        tip = document.createElement('div'); tip.className = 'adf-tip'; tip.setAttribute('role','tooltip');
        el.appendChild(tip);
        // Hover/focus show quickly; hide quickly on leave/blur
        let showTid = null, hideTid = null;
        const show = ()=>{
          try{ clearTimeout(hideTid); }catch{}
          showTid = setTimeout(()=>{ try{ tip.classList.add('on'); }catch{} }, 120);
        };
        const hide = ()=>{
          try{ clearTimeout(showTid); }catch{}
          hideTid = setTimeout(()=>{ try{ tip.classList.remove('on'); }catch{} }, 60);
        };
        el.addEventListener('mouseenter', show);
        el.addEventListener('mouseleave', hide);
        el.addEventListener('focus', show);
        el.addEventListener('blur', hide);
      }
    }catch{}
  }

  function ensureReaderIndicatorTooltip(shadow){
    try{
      const el = shadow.getElementById('sx-reader-ind'); if (!el) return;
      let tip = el.querySelector('.reader-tip');
      if (!tip){
        tip = document.createElement('div'); tip.className = 'reader-tip'; tip.setAttribute('role','tooltip');
        el.appendChild(tip);
        let showTid = null, hideTid = null;
        const show = ()=>{ try{ clearTimeout(hideTid); }catch{} showTid = setTimeout(()=>{ try{ tip.classList.add('on'); }catch{} }, 120); };
        const hide = ()=>{ try{ clearTimeout(showTid); }catch{} hideTid = setTimeout(()=>{ try{ tip.classList.remove('on'); }catch{} }, 60); };
        el.addEventListener('mouseenter', show);
        el.addEventListener('mouseleave', hide);
        el.addEventListener('focus', show);
        el.addEventListener('blur', hide);
      }
    }catch{}
  }

  function setLoading(shadow,loading){
    const runBtn=shadow.getElementById('sx-run');
    const bar=shadow.getElementById('sx-progress');
    if (runBtn){
      runBtn.disabled=!!loading;
      if (loading){ const t=currentLangCache==='en'?'Processing…':'处理中…'; runBtn.innerHTML=`<span class="spin"></span><span>${t}</span>`; }
      else{ runBtn.textContent = currentLangCache==='en' ? 'Extract & Summarize':'提取并摘要'; }
    }
    if (bar) bar.classList.toggle('hidden', !loading);
  }

  // ==== Vue 挂载（如果可用）====
  let vueApp=null, vmSummary=null, vmCleaned=null;
  function mountVue(){
    if (!PV) return false;
    const rootSummary = shadow.getElementById('sx-summary');
    const rootCleaned = shadow.getElementById('sx-cleaned');
    rootSummary.innerHTML = '';
    rootCleaned.innerHTML = '';
    vueApp = PV.createApp({});
    vmSummary = vueApp.mount(CardComponent({ title: currentLangCache==='zh'?'摘要':'Summary', html: '' }), rootSummary);
    vmCleaned = vueApp.mount(CardComponent({ title: currentLangCache==='zh'?'可读正文':'Readable Content', html: '' }), rootCleaned);
    return true;
  }
  function skeleton(shadow){
    if (vmSummary && vmCleaned){
      vmSummary.html = `<div class="skl" style="width:90%"></div><div class="skl" style="width:72%"></div><div class="skl" style="width:84%"></div>`;
      vmCleaned.html = `<div class="skl" style="width:96%"></div><div class="skl" style="width:64%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`;
    }else{
      vanillaSkeleton(shadow);
    }
  }
  async function setEmpty(shadow){
    // Do not render empty cards; keep background only
    try{
      if (vmSummary && vmCleaned){ vmSummary.html = ''; vmCleaned.html = ''; }
      else {
        shadow.getElementById('sx-summary').innerHTML = '';
        shadow.getElementById('sx-cleaned').innerHTML = '';
      }
    }catch{}
    // Mark intro + empty for high-transparency frosted backdrop and no resize
    try{ const wrap=shadow.getElementById('sx-wrap'); wrap?.classList?.add('fx-intro'); wrap?.classList?.add('is-empty'); }catch{}
    // Observe changes & update arrow position under the run button center
    try{ bindArrowResizeObservers(); updateEmptyArrowPosition(); }catch{}
  }
  async function renderCards(summaryMarkdown, cleanedMarkdown){
    const sumHTML = summaryMarkdown ? stripInlineColor(renderMarkdown(summaryMarkdown)) : '';
    if (vmSummary) vmSummary.html = sumHTML; else { const root=shadow.getElementById('sx-summary'); root.innerHTML = sumHTML; try{ ensureShareButton(shadow); }catch{} }
    if (cleanedMarkdown===null){
      if (vmCleaned) vmCleaned.html = `<div class="skl" style="width:96%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`;
      else shadow.getElementById('sx-cleaned').innerHTML = `<div class="skl" style="width:96%"></div><div class="skl" style="width:88%"></div><div class="skl" style="width:76%"></div>`;
      return;
    }
    const cleanedHTML = cleanedMarkdown ? stripInlineColor(renderMarkdown(cleanedMarkdown)) : '';
    if (vmCleaned) vmCleaned.html = cleanedHTML; else shadow.getElementById('sx-cleaned').innerHTML = cleanedHTML;
  }

  // ===== QA logic =====
  let chatMode = false;
  let chatVisible = false; // whether chat card is currently shown
  let hasSummarizeTriggered = false; // becomes true once user clicks Extract & Summarize (or state indicates run)
  let summarizing = false; // when true, block Q&A input and send
  let qaSending = false; // track if a QA request is in-flight
  const chatHistory = [];

  function updateQAControls(shadow){
    try{
      const qaInput = shadow.getElementById('sx-qa-input');
      const qaSend = shadow.getElementById('sx-qa-send');
      const blocked = !!(summarizing || qaSending);
      if (qaInput) qaInput.disabled = blocked;
      if (qaSend) qaSend.disabled = blocked;
    }catch{}
  }
  function setSummarizing(shadow, on){ summarizing = !!on; updateQAControls(shadow); }
  function setupQABar(shadow){
    const qaInput = shadow.getElementById('sx-qa-input');
    const qaSend = shadow.getElementById('sx-qa-send');
    // Ensure a restore icon exists in the QA bar (right side)
    let qaRestore = shadow.getElementById('sx-qa-restore');
    try{
      if (!qaRestore){
        qaRestore = document.createElement('button');
        qaRestore.id = 'sx-qa-restore';
        qaRestore.className = 'qa-restore';
        qaRestore.type = 'button';
        qaRestore.setAttribute('aria-hidden','true');
        qaRestore.title = currentLangCache==='en' ? 'Show Q&A' : '显示你问我答';
        qaRestore.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>';
        const qaRow = shadow.querySelector('.qa-row');
        if (qaRow){ qaRow.appendChild(qaRestore); }
      }
    }catch{}
    const chatCard = shadow.getElementById('sx-chat');
    const chatList = shadow.getElementById('sx-chat-list');
    if (!qaInput || !qaSend || !chatCard || !chatList) return;

    // Ensure a close button exists (for floating mode)
    const ensureChatTools = ()=>{
      try{
        let tools = chatCard.querySelector('.card-tools');
        if (!tools){ tools = document.createElement('div'); tools.className='card-tools'; chatCard.appendChild(tools); }
        let closeBtn = tools.querySelector('.tbtn-close');
        const label = currentLangCache==='en' ? 'Close' : '关闭';
        if (!closeBtn){
          closeBtn = document.createElement('button');
          closeBtn.className = 'tbtn tbtn-close'; closeBtn.type='button';
          closeBtn.textContent = '×'; closeBtn.title = label; closeBtn.setAttribute('aria-label', label);
          tools.insertBefore(closeBtn, tools.firstChild || null);
          closeBtn.addEventListener('click', ()=>{
            minimizeChat();
          });
        }
        // ensure resize handle exists for visual hint and easy grabbing
        let rh = chatCard.querySelector('.qa-resize-handle');
        if (!rh){ rh = document.createElement('div'); rh.className='qa-resize-handle'; rh.setAttribute('aria-hidden','true'); chatCard.appendChild(rh); }
      }catch{}
    };

    // Minimize/Restore state
    let chatMinimized = false;
    let savedGeom = null; // { custom, left, top, width, height, rightGap }
    const setBgCardHoverDisabled = (disabled)=>{ try{ shadow.getElementById('sx-wrap')?.classList?.toggle('qa-hover-off', !!disabled); }catch{} };

    function getContainerBounds(){
      const contRect = containerEl.getBoundingClientRect();
      const cs = getComputedStyle(containerEl);
      const padL = parseInt(cs.paddingLeft)||0;
      const padR = parseInt(cs.paddingRight)||0;
      const viewLeft = containerEl.scrollLeft;
      const viewRight = viewLeft + contRect.width;
      const SAFE = 10;
      const innerLeftAbs = viewLeft + padL + SAFE;
      const innerRightAbs = viewRight - padR - SAFE;
      const availW = Math.max(0, innerRightAbs - innerLeftAbs);
      return { contRect, innerLeftAbs, innerRightAbs, availW };
    }

    function minimizeChat(){
      try{
        if (!chatCard.classList.contains('qa-float')){ chatCard.style.display='none'; chatVisible=false; return; }
        // Save current geometry relative to container
        const rect = chatCard.getBoundingClientRect();
        const { contRect } = getContainerBounds();
        const left = rect.left - contRect.left + containerEl.scrollLeft;
        const top  = rect.top  - contRect.top  + containerEl.scrollTop;
        const width = rect.width; const height = rect.height;
        const custom = chatCard.classList.contains('qa-custom-pos');
        const rightGap = contRect.right - rect.right; // for right-anchored restore
        savedGeom = { custom, left, top, width, height, rightGap: Math.max(10, Math.round(rightGap)) };

        // Animate towards QA restore icon and then hide
        try{
          const qaBar = shadow.getElementById('sx-qa-area');
          const ccRect = rect;
          let iconRect = qaRestore?.getBoundingClientRect?.();
          if (!iconRect || iconRect.width===0 || iconRect.height===0){
            // Fallback to QA row right side
            const row = shadow.querySelector('.qa-row');
            const r = row? row.getBoundingClientRect() : qaBar.getBoundingClientRect();
            iconRect = { left: r.right-18, top: r.top, width: 18, height: r.height };
          }
          const ccX = ccRect.left + ccRect.width/2;
          const ccY = ccRect.top  + ccRect.height/2;
          const icX = iconRect.left + iconRect.width/2;
          const icY = iconRect.top  + iconRect.height/2;
          const dx = Math.round(icX - ccX);
          const dy = Math.round(icY - ccY);
          chatCard.style.transition = 'transform .28s cubic-bezier(.2,.7,.3,1), opacity .28s ease';
          chatCard.style.willChange = 'transform, opacity';
          chatCard.style.transform = `translate(${dx}px, ${dy}px) scale(.6)`;
          chatCard.style.opacity = '0';
          setTimeout(()=>{
            chatCard.style.display='none';
            chatCard.style.transition=''; chatCard.style.transform=''; chatCard.style.opacity=''; chatCard.style.willChange='';
          }, 240);
        }catch{ chatCard.style.display='none'; }

        // Show restore icon
        if (qaRestore){ qaRestore.setAttribute('aria-hidden','false'); qaRestore.classList.add('flash'); setTimeout(()=>{ try{ qaRestore.classList.remove('flash'); }catch{} }, 3300); }
        chatMinimized = true; chatVisible = false; setBgCardHoverDisabled(false);
      }catch{}
    }

    function restoreChat(){
      try{
        // Get icon position BEFORE hiding it, to animate from its center
        let iconRect = qaRestore?.getBoundingClientRect?.();
        if (!iconRect || iconRect.width===0 || iconRect.height===0){
          const qaBar = shadow.getElementById('sx-qa-area');
          const row = shadow.querySelector('.qa-row');
          const r = row? row.getBoundingClientRect() : qaBar.getBoundingClientRect();
          iconRect = { left: r.right-18, top: r.top, width: 18, height: r.height };
        }

        updateQABottomVar();
        chatCard.style.display='';
        chatCard.classList.add('qa-float');
        // size + pos restore with current bounds
        const { innerLeftAbs, innerRightAbs, availW, contRect } = getContainerBounds();
        const hardMaxW = 1400;
        const baseW = Math.min(hardMaxW, Math.round(savedGeom?.width || 420));
        const width = Math.max(4, Math.min(baseW, Math.floor(availW)));
        chatCard.style.minWidth = '0px';
        chatCard.style.width = width + 'px'; chatCard.style.setProperty('--qa-w', width + 'px');
        chatCard.style.height = (savedGeom?.height? Math.max(260, Math.min(1100, Math.round(savedGeom.height))) : chatCard.style.height);
        if (savedGeom && savedGeom.custom){
          // Clamp left within current bounds
          const maxLeft = innerRightAbs - width;
          const left = Math.max(innerLeftAbs, Math.min(maxLeft, Math.round(savedGeom.left)));
          chatCard.classList.add('qa-custom-pos');
          chatCard.style.right=''; chatCard.style.bottom='';
          chatCard.style.left = left + 'px';
          // keep previous top if possible
          try{
            const topMax = (containerEl.scrollTop + contRect.height) - 10 - (savedGeom.height||chatCard.getBoundingClientRect().height);
            const topMin = containerEl.scrollTop;
            const top = Math.max(topMin, Math.min(topMax, Math.round(savedGeom.top)));
            chatCard.style.top = top + 'px';
          }catch{}
        } else {
          // Right-anchored restore; respect at least 10px and saved right gap if any
          chatCard.classList.remove('qa-custom-pos');
          const gap = Math.max(10, savedGeom?.rightGap || 16);
          chatCard.style.right = gap + 'px';
          chatCard.style.left = '';
          chatCard.style.top = '';
          chatCard.style.bottom = '';
        }
        // Animate from restore icon to final spot
        try{
          const finalRect = chatCard.getBoundingClientRect();
          const fx = finalRect.left + finalRect.width/2;
          const fy = finalRect.top  + finalRect.height/2;
          const ix = iconRect.left + iconRect.width/2;
          const iy = iconRect.top  + iconRect.height/2;
          const dx = Math.round(ix - fx);
          const dy = Math.round(iy - fy);
          chatCard.style.willChange = 'transform, opacity';
          chatCard.style.transform = `translate(${dx}px, ${dy}px) scale(.6)`;
          chatCard.style.opacity = '0';
          requestAnimationFrame(()=>{
            chatCard.style.transition = 'transform .28s cubic-bezier(.2,.7,.3,1), opacity .28s ease';
            chatCard.style.transform = 'translate(0,0) scale(1)';
            chatCard.style.opacity = '1';
            const done=()=>{ try{ chatCard.style.transition=''; chatCard.style.transform=''; chatCard.style.opacity=''; chatCard.style.willChange=''; }catch{} };
            chatCard.addEventListener('transitionend', done, { once:true });
            // Hide the restore icon only after animation kicks in
            try{ qaRestore?.setAttribute('aria-hidden','true'); }catch{}
          });
        }catch{}
        chatMinimized = false; chatVisible = true; setBgCardHoverDisabled(true);
      }catch{}
    }

    try{ qaRestore?.addEventListener('click', ()=>{ if (chatMinimized) restoreChat(); }); }catch{}

    // No-op clamp to keep calls safe (we don't auto-move/auto-resize on container changes)
    const clampFloatWithinContainer = ()=>{};

    const updateQABottomVar = ()=>{
      try{
        const qaBar  = shadow.getElementById('sx-qa-area');
        const qaH = qaBar ? qaBar.getBoundingClientRect().height : 60;
        // keep a smaller gap so initial card位置更靠下
        chatCard.style.setProperty('--qa-bottom', (qaH + 8) + 'px');
      }catch{}
    };
    try{ window.addEventListener('resize', ()=>{ requestAnimationFrame(()=>{ updateQABottomVar(); clampFloatWithinContainer(); }); }, { passive:true }); }catch{}

    // Drag & resize for floating chat
    const containerEl = shadow.getElementById('sx-container');
    let dragState = null; // {startX,startY, startLeft, startTop}
    let resizeState = null; // {startX,startY, startW, startH}

    const startDrag = (ev)=>{
      if (!chatCard.classList.contains('qa-float')) return;
      // ignore drags starting on buttons or resize handle
      const path = ev.composedPath ? ev.composedPath() : (ev.path || []);
      if (path.some(n=> n?.classList?.contains?.('tbtn') || n?.classList?.contains?.('qa-resize-handle'))) return;
      // limit drag start within header area
      const rect = chatCard.getBoundingClientRect();
      if ((ev.clientY - rect.top) > 52) return; // only header
      // switch to absolute left/top positioning
      const contRect = containerEl.getBoundingClientRect();
      const left = rect.left - contRect.left + containerEl.scrollLeft;
      const top  = rect.top  - contRect.top  + containerEl.scrollTop;
      chatCard.classList.add('qa-custom-pos');
      chatCard.style.left = left + 'px';
      chatCard.style.top  = top + 'px';
      chatCard.style.right = '';
      chatCard.style.bottom = '';
      dragState = { startX: ev.clientX, startY: ev.clientY, startLeft: left, startTop: top };
      try{ chatCard.setPointerCapture(ev.pointerId); }catch{}
      ev.preventDefault();
    };
    const onDrag = (ev)=>{
      if (!dragState) return;
      const dx = ev.clientX - dragState.startX; const dy = ev.clientY - dragState.startY;
      const contRect = containerEl.getBoundingClientRect();
      const cardRect = chatCard.getBoundingClientRect();
      const cs = getComputedStyle(containerEl);
      const padL = parseInt(cs.paddingLeft)||0;
      const padR = parseInt(cs.paddingRight)||0;
      const viewLeft = containerEl.scrollLeft;
      const viewTop  = containerEl.scrollTop;
      const viewRight = viewLeft + contRect.width;
      const viewBottom = viewTop + contRect.height;
        const marginL = 10, marginR = 10, marginT = 0, marginB = 0;
      const minLeft = viewLeft + padL + marginL;
      const minTop  = viewTop + marginT; // no vertical padding considered for now
      const maxLeft = viewRight - padR - marginR - cardRect.width;
      const maxTop  = viewBottom - marginB - cardRect.height;
      const left = Math.max(minLeft, Math.min(maxLeft, dragState.startLeft + dx));
      const top  = Math.max(minTop,  Math.min(maxTop,  dragState.startTop + dy));
      chatCard.style.left = left + 'px';
      chatCard.style.top  = top + 'px';
    };
    const endDrag = (ev)=>{
      if (!dragState) return;
      dragState = null;
      try{ chatCard.releasePointerCapture(ev.pointerId); }catch{}
    };

    const rh = ()=> chatCard.querySelector('.qa-resize-handle');
    const inResizeZone = (ev)=>{
      try{
        const rect = chatCard.getBoundingClientRect();
        const zone = 24; // px from bottom-right corner
        return (ev.clientX >= rect.right - zone) && (ev.clientY >= rect.bottom - zone);
      }catch{ return false; }
    };
    const startResize = (ev)=>{
      if (!chatCard.classList.contains('qa-float')) return;
      const handle = rh();
      const hitHandle = !!(handle && ev.target === handle);
      const hitZone = inResizeZone(ev);
      if (!hitHandle && !hitZone) return;
      // ensure custom pos so we don't fight bottom/right
      const rect = chatCard.getBoundingClientRect();
      const contRect = containerEl.getBoundingClientRect();
      const left = rect.left - contRect.left + containerEl.scrollLeft;
      const top  = rect.top  - contRect.top  + containerEl.scrollTop;
      chatCard.classList.add('qa-custom-pos');
      chatCard.style.left = left + 'px';
      chatCard.style.top  = top + 'px';
      chatCard.style.right = '';
      chatCard.style.bottom = '';
      resizeState = { startX: ev.clientX, startY: ev.clientY, startW: rect.width, startH: rect.height, pointerId: ev.pointerId };
      try{ chatCard.setPointerCapture(ev.pointerId); }catch{}
      // Ensure we always end resizing on release, even if pointer capture is lost
      try{
        window.addEventListener('pointermove', onResize, true);
        window.addEventListener('pointerup', endResize, true);
        window.addEventListener('pointercancel', endResize, true);
        window.addEventListener('blur', endResize, true);
        // Fallbacks for environments/events that might miss pointerup
        window.addEventListener('mouseup', endResize, true);
        window.addEventListener('mouseleave', endResize, true);
      }catch{}
      ev.preventDefault();
      ev.stopPropagation();
    };
    const onResize = (ev)=>{
      if (!resizeState) return;
      // If this move is from a different pointer, ignore. If mouse buttons released, stop resizing.
      if (resizeState.pointerId !== undefined && ev.pointerId !== undefined && ev.pointerId !== resizeState.pointerId) return;
      if (ev.buttons === 0) { endResize(ev); return; }
      const dx = ev.clientX - resizeState.startX; const dy = ev.clientY - resizeState.startY;
      const contRect = containerEl.getBoundingClientRect();
      // available viewport (visible) bounds in content coordinates
      const viewLeft = containerEl.scrollLeft;
      const viewTop  = containerEl.scrollTop;
      const viewRight = viewLeft + contRect.width;
      const viewBottom = viewTop + contRect.height;
      const minW = 200; const minH = 260; const margin = 10;
      // current left/top in content coordinates
      const rect = chatCard.getBoundingClientRect();
      const left = (parseFloat(chatCard.style.left) || 0);
      const top  = (parseFloat(chatCard.style.top) || 0);
      const maxWByEdge = Math.max(minW, Math.round(viewRight - left - margin));
      const maxHByEdge = Math.max(minH, Math.round(viewBottom - top - margin));
      const hardMaxW = 1400; const hardMaxH = 1100;
      const maxW = Math.min(maxWByEdge, hardMaxW);
      const maxH = Math.min(maxHByEdge, hardMaxH);
      let w = Math.max(minW, Math.min(maxW, Math.round(resizeState.startW + dx)));
      let h = Math.max(minH, Math.min(maxH, Math.round(resizeState.startH + dy)));
      chatCard.style.setProperty('--qa-w', w + 'px');
      chatCard.style.setProperty('--qa-h', h + 'px');
      chatCard.style.width = w + 'px';
      chatCard.style.height = h + 'px';
      // If we reached boundaries, rebase the starting point so user can continue resizing smoothly
      try{
        if ((w<=minW && dx<0) || (w>=maxW && dx>0)){
          resizeState.startX = ev.clientX; resizeState.startW = w;
        }
        if ((h<=minH && dy<0) || (h>=maxH && dy>0)){
          resizeState.startY = ev.clientY; resizeState.startH = h;
        }
      }catch{}
    };
    const endResize = (ev)=>{
      if (!resizeState) return;
      resizeState = null;
      try{ chatCard.releasePointerCapture(ev.pointerId); }catch{}
      try{ clampFloatWithinContainer(); }catch{}
      try{
        window.removeEventListener('pointermove', onResize, true);
        window.removeEventListener('pointerup', endResize, true);
        window.removeEventListener('pointercancel', endResize, true);
        window.removeEventListener('blur', endResize, true);
        window.removeEventListener('mouseup', endResize, true);
        window.removeEventListener('mouseleave', endResize, true);
      }catch{}
    };
    try{ chatCard.addEventListener('lostpointercapture', endResize, true); }catch{}

    // Update cursor when hovering near the bottom-right corner
    const updateCursor = (ev)=>{
      try{
        if (!chatCard.classList.contains('qa-float')) return;
        if (resizeState) { chatCard.style.cursor = 'nwse-resize'; return; }
        chatCard.style.cursor = inResizeZone(ev) ? 'nwse-resize' : '';
      }catch{}
    };

    // bind drag on card header; resize on handle
    try{
      chatCard.addEventListener('pointerdown', startDrag);
      chatCard.addEventListener('pointermove', onDrag);
      chatCard.addEventListener('pointerup', endDrag);
      chatCard.addEventListener('pointercancel', endDrag);
      chatCard.addEventListener('pointerdown', startResize, true);
      chatCard.addEventListener('pointermove', onResize);
      chatCard.addEventListener('pointerup', endResize);
      chatCard.addEventListener('pointercancel', endResize);
      chatCard.addEventListener('pointermove', updateCursor, { passive:true });
      if (!chatCard._qaContRO && window.ResizeObserver){
        chatCard._qaContRO = new ResizeObserver(()=>{ requestAnimationFrame(()=>clampFloatWithinContainer()); });
        try{ chatCard._qaContRO.observe(containerEl); }catch{}
        try{ chatCard._qaContRO.observe(shadow.host); }catch{}
        try{ chatCard._qaContRO.observe(shadow.getElementById('sx-wrap')); }catch{}
      }
    }catch{}

    const showChat = (withRise)=>{
      chatCard.style.display='';
      if (hasSummarizeTriggered){
        ensureChatTools();
        updateQABottomVar();
        // First-open sizing: fit to visible container height (avoid being clipped)
        try{
          if (!chatCard._qaInitSized){
            const container = shadow.getElementById('sx-container');
            const contH = container?.clientHeight || 0;
            const qaBottomStr = chatCard.style.getPropertyValue('--qa-bottom') || getComputedStyle(chatCard).getPropertyValue('--qa-bottom');
            const qaBottom = parseInt(String(qaBottomStr||'').replace(/[^\d.-]/g,'')) || 72;
            const margin = 12; // bottom safe gap
            const avail = Math.max(0, contH - qaBottom - margin);
            let initH = Math.max(280, Math.round(avail * 0.5)); // use half of available height
            const hardMax = 1100;
            initH = Math.min(initH, hardMax);
            chatCard.style.height = initH + 'px';
            chatCard.style.setProperty('--qa-h', initH + 'px');
            chatCard._qaInitSized = true;
          }
        }catch{}
        // keep size vars in sync when user resizes (native or custom)
        try{
          if (!chatCard._qaResizeObs){
            const syncSizeVars = ()=>{
              const r = chatCard.getBoundingClientRect();
              chatCard.style.setProperty('--qa-w', Math.round(r.width) + 'px');
              chatCard.style.setProperty('--qa-h', Math.round(r.height) + 'px');
            };
            chatCard._qaResizeObs = new ResizeObserver(()=>syncSizeVars());
            chatCard._qaResizeObs.observe(chatCard);
            syncSizeVars();
          }
        }catch{}
        // After entering float mode, ensure bounds are respected
        try{ clampFloatWithinContainer(); }catch{}
        chatCard.classList.add('qa-float');
        if (withRise){ try{ chatCard.classList.add('qa-rise'); setTimeout(()=>chatCard.classList.remove('qa-rise'), 260); }catch{} }
      } else {
        // Non-summary phase: behave like original (full-width card)
        chatCard.classList.remove('qa-float');
      }
      chatVisible = true; setBgCardHoverDisabled(chatCard.classList.contains('qa-float'));
    };
    // auto-resize textarea to show all input lines (up to max-height)
    const autoResize = () => {
      try{
        qaInput.style.height = 'auto';
        const max = 120;
        const h = Math.min(max, qaInput.scrollHeight);
        qaInput.style.height = h + 'px';
      }catch{}
    };
    qaInput.addEventListener('input', autoResize);
    // Calculate offset of an element relative to a root container
    const offsetWithin = (el, root)=>{
      try{
        let y = 0; let n = el;
        while (n && n !== root){ y += n.offsetTop || 0; n = n.offsetParent; }
        return y;
      }catch{ return 0; }
    };
    // In floating mode: keep the user bubble in view near top, while showing as much of AI answer as possible
    const adjustChatViewport = (userBubble, aiBubble)=>{
      try{
        if (!chatCard.classList.contains('qa-float')) return;
        if (!userBubble || !aiBubble) return;
        const H = chatList.clientHeight || 0; if (H<=0) return;
        const margin = 8;
        const uTop = offsetWithin(userBubble, chatList);
        const aBottom = offsetWithin(aiBubble, chatList) + (aiBubble.getBoundingClientRect().height || 0);
        let desired = Math.min(uTop - margin, aBottom - H + margin);
        if (!Number.isFinite(desired)) desired = uTop - margin;
        chatList.scrollTo({ top: Math.max(0, desired), behavior: 'auto' });
      }catch{}
    };
    const appendBubble = (role, html, pending=false)=>{
      const b = document.createElement('div');
      b.className = `chat-bubble ${role}`;
      b.innerHTML = pending ? `<span class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>` : html;
      chatList.appendChild(b);
      try{ b.classList.add('pull-in'); setTimeout(()=>b.classList.remove('pull-in'), 500); }catch{}
      try{
        const scroller = shadow.getElementById('sx-container');
        // In floating mode, avoid jumping container scroll; the window is already visible
        if (!chatCard.classList.contains('qa-float')){
          scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
        }
      }catch{}
      return b;
    };
    const doSend = async ()=>{
      if (summarizing || qaSending) return; // blocked during summarize or when already sending
      const q = qaInput.value.trim();
      if (!q) return;
      const prev = qaSend.textContent;
      qaSending = true; updateQAControls(shadow);
      qaSend.textContent = (currentLangCache==='zh'?'发送中…':'Sending…');
      // Switch to chat mode on first send
      if (!chatMode){
        chatMode = true;
      }
      // Show chat; if summary ever triggered, float above summary/cleaned
      showChat(!chatVisible);
      // During first/early phase (no summarize yet), hide other cards so only Q&A is visible
      if (!hasSummarizeTriggered){
        try{ shadow.getElementById('sx-summary').style.display='none'; }catch{}
        try{ shadow.getElementById('sx-cleaned').style.display='none'; }catch{}
      } else {
        // Keep summary/cleaned visible; overlay floats above them
        try{ shadow.getElementById('sx-summary').style.display=''; }catch{}
        try{ shadow.getElementById('sx-cleaned').style.display=''; }catch{}
      }
      const userHtml = escapeHtml(q);
      const userBubble = appendBubble('user', userHtml, false);
      // Append AI pending bubble
      const aiBubble = appendBubble('ai', '', true);
      // After both bubbles are in, adjust viewport to show user bubble and as much of AI as possible
      try{ adjustChatViewport(userBubble, aiBubble); requestAnimationFrame(()=>adjustChatViewport(userBubble, aiBubble)); }catch{}
      // Clear the input so user text doesn't linger
      try{ qaInput.value=''; qaInput.style.height=''; }catch{}
      // During loading, hide other cards only if summarize hasn't been triggered
      if (!hasSummarizeTriggered){
        try{ shadow.getElementById('sx-summary').style.display='none'; }catch{}
        try{ shadow.getElementById('sx-cleaned').style.display='none'; }catch{}
      }

      // If panel is folded, expand like the summarize flow so the card is visible
      let expanded = false;
      try{
        const wrapEl = shadow.getElementById('sx-wrap');
        const wasEmpty = !!wrapEl?.classList?.contains('is-empty');
        if (wasEmpty){
          wrapEl.classList.remove('fx-intro');
          wrapEl.classList.add('expanding');
          const container = shadow.getElementById('sx-container');
          const wrapRect = wrapEl.getBoundingClientRect();
          const appbar = shadow.querySelector('.appbar');
          const footer = shadow.querySelector('.footer');
          const qaBar  = shadow.getElementById('sx-qa-area');
          const appH = appbar ? appbar.getBoundingClientRect().height : 0;
          const footH = footer ? footer.getBoundingClientRect().height : 0;
          const qaH  = qaBar ? qaBar.getBoundingClientRect().height : 0;
          const target = Math.max(120, Math.round(wrapRect.height - appH - footH - qaH));
          container.style.willChange = 'height';
          container.style.contain = 'layout style';
          container?.style.setProperty('--sx-target', target + 'px');
          expanded = true;
          let done=false; const finish=()=>{
            if (done) return; done=true;
            try{ wrapEl.classList.remove('is-empty'); wrapEl.classList.remove('expanding'); }catch{}
          };
          container?.addEventListener('transitionend', (e)=>{ if (e.propertyName==='height') finish(); }, { once:true });
          setTimeout(finish, 900);
        } else {
          // Already expanded; do nothing special on the card to avoid flicker
        }
      }catch{}

      // Global progress bar like summarize
      try{ setLoading(shadow, true); }catch{}
      try{
        const resp = await chrome.runtime.sendMessage({ type: 'SX_QA_ASK', question: q, history: chatHistory.slice(-8) });
        if (!resp?.ok) throw new Error(resp?.error || 'QA failed');
        // If user minimized during processing, do not auto-pop the chat back
        if (!chatMinimized) {
          showChat(false);
        }
        const ans = String(resp.answer||'').replace(/^__NO_HIT__\s*/i,'').trim();
        let html = stripInlineColor(renderMarkdown(ans));
        // Collapse excessive breaks only within chat bubble rendering
        html = html
          .replace(/^(?:<br\s*\/?>(?:\s|&nbsp;)*?)+/i,'')
          .replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*?)+$/i,'')
          .replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*?){2,}/gi,'<br>');
        aiBubble.innerHTML = html;
        // After answer renders, adjust again to show as much as possible while keeping question visible
        try{ adjustChatViewport(userBubble, aiBubble); setTimeout(()=>adjustChatViewport(userBubble, aiBubble), 50); }catch{}
        // Keep viewport anchored near the user question; do not auto-jump in floating mode
        try{
          if (!chatCard.classList.contains('qa-float')){
            const scroller = shadow.getElementById('sx-container');
            const vh = scroller?.clientHeight || 0;
            const bh = aiBubble?.getBoundingClientRect().height || 0;
            if (scroller && aiBubble){
              if (bh >= vh - 12){
                let offset = 0; let n = aiBubble;
                while (n && n !== scroller){ offset += n.offsetTop || 0; n = n.offsetParent; }
                scroller.scrollTo({ top: Math.max(0, offset - 6), behavior: 'smooth' });
              } else {
                scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
              }
            }
          }
        }catch{}
        // track history
        chatHistory.push({ role:'user', content: q });
        chatHistory.push({ role:'assistant', content: ans });
      }catch(e){
        try{ alert((currentLangCache==='zh'?'提问失败：':'Ask failed: ') + (e?.message || e)); }catch{}
      } finally {
        try{ setLoading(shadow, false); }catch{}
        qaSending = false; updateQAControls(shadow);
        // Restore label unless still blocked by summarizing
        if (qaSend && !qaSend.disabled) qaSend.textContent = prev || (currentLangCache==='zh'?'发送':'Send');
        // If minimized while processing, signal completion on the restore icon (green pulse)
        try{
          if (chatMinimized && qaRestore){
            qaRestore.setAttribute('aria-hidden','false');
            qaRestore.classList.remove('flash');
            qaRestore.classList.add('flash-done');
            setTimeout(()=>{ try{ qaRestore.classList.remove('flash-done'); }catch{} }, 3200);
          }
        }catch{}
      }
    };
    qaSend.addEventListener('click', doSend);
    qaInput.addEventListener('keydown', (ev)=>{
      if (summarizing || qaSending) return; // ignore input when blocked
      if (ev.key==='Enter' && ev.shiftKey){
        // allow newline; resize after the key inserts the line break
        setTimeout(autoResize, 0);
        return;
      }
      if (ev.key==='Enter' && !ev.shiftKey){ ev.preventDefault(); doSend(); }
    });
  }

  function ensureShareButton(shadow){
    try{
      const card = shadow.getElementById('sx-summary');
      if (!card) return;
      let tools = card.querySelector('.card-tools');
      if (!tools){ tools = document.createElement('div'); tools.className='card-tools'; card.appendChild(tools); }
      let btn = tools.querySelector('.tbtn-share');
      const label = currentLangCache==='en' ? 'Share' : '分享';
      const svg = `<svg class="icon icon-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M12 16V4"/><path d="M8 8l4-4 4 4"/></svg>`;
      if (!btn){ btn = document.createElement('button'); btn.className='tbtn tbtn-share'; btn.type='button'; btn.innerHTML = svg; btn.title = label; btn.setAttribute('aria-label', label); tools.insertBefore(btn, tools.firstChild || null);
        btn.addEventListener('click', async ()=>{
          const ok = await generateShareImageFromSummary(shadow);
          try{ btn.setAttribute('aria-pressed','true'); setTimeout(()=>btn.setAttribute('aria-pressed','false'), 900); }catch{}
          if (!ok){
            try{
              const alert=document.createElement('div'); alert.className='alert';
              alert.innerHTML=`<button class="alert-close" title="关闭" aria-label="关闭">&times;</button><div class="alert-content"><p>${currentLangCache==='en'?'Failed to copy image to clipboard':'复制图片到剪贴板失败'}</p></div>`;
              const md=card.querySelector('.md'); card.insertBefore(alert, md||card.firstChild);
            }catch{}
          } else {
            try{
              const hint=document.createElement('div');
              hint.style.position='absolute'; hint.style.right='14px'; hint.style.top='42px'; hint.style.fontSize='12px'; hint.style.padding='4px 8px'; hint.style.borderRadius='6px';
              const isDark = shadow?.host?.getAttribute('data-theme')==='dark';
              if (isDark){
                hint.style.background='rgba(59,130,246,.22)';
                hint.style.border='1px solid rgba(142,162,255,.55)';
                hint.style.color='#e6efff';
              } else {
                hint.style.background='rgba(34,197,94,.12)';
                hint.style.border='1px solid rgba(34,197,94,.35)';
                hint.style.color='#166534';
              }
              hint.textContent = currentLangCache==='en' ? 'Summary card copied. Paste anywhere.' : '已生成摘要卡片到剪贴板，可在任意处粘贴';
              card.appendChild(hint); setTimeout(()=>{ try{ hint.remove(); }catch{} }, 1400);
            }catch{}
          }
        });
      } else {
        btn.innerHTML = svg; btn.title = label; btn.setAttribute('aria-label', label);
      }
    }catch{}
  }

  // ===== Run 按钮 =====
  shadow.getElementById('sx-run').addEventListener('click', async ()=>{
    try{
      // Mark that summarize has been triggered to switch future Q&A into floating mode
      hasSummarizeTriggered = true;
      setSummarizing(shadow, true);
      // If in chat mode: gracefully hide chat, restore summary/cleaned
      try{
        const chatCard = shadow.getElementById('sx-chat');
        if (chatCard && chatCard.style.display !== 'none'){
          // If floating, shrink towards QA bar; else use existing fade
          if (chatCard.classList.contains('qa-float')){
            try{
              const qaBar = shadow.getElementById('sx-qa-area');
              const ccRect = chatCard.getBoundingClientRect();
              const qaRect = qaBar.getBoundingClientRect();
              const ccCenterY = ccRect.top + ccRect.height/2;
              const qaCenterY = qaRect.top + qaRect.height/2;
              const dy = Math.round(qaCenterY - ccCenterY);
              chatCard.style.transition = 'transform .24s cubic-bezier(.2,.7,.3,1), opacity .24s ease';
              chatCard.style.willChange = 'transform, opacity';
              chatCard.style.transform = `translateY(${dy}px) scale(.92)`;
              chatCard.style.opacity = '0';
              setTimeout(()=>{ try{ chatCard.style.display='none'; chatCard.classList.remove('qa-float'); chatCard.style.transition=''; chatCard.style.transform=''; chatCard.style.opacity=''; chatCard.style.willChange=''; }catch{} }, 250);
            }catch{
              chatCard.classList.add('chat-hide');
              setTimeout(()=>{ try{ chatCard.style.display='none'; chatCard.classList.remove('chat-hide'); }catch{} }, 280);
            }
          } else {
            chatCard.classList.add('chat-hide');
            setTimeout(()=>{ try{ chatCard.style.display='none'; chatCard.classList.remove('chat-hide'); }catch{} }, 280);
          }
          try{ shadow.getElementById('sx-summary').style.display=''; }catch{}
          try{ shadow.getElementById('sx-cleaned').style.display=''; }catch{}
        }
      }catch{}
      // 若为试用模式但尚未同意条款：直接跳转设置页并中止，不进入运行态
      try {
        const { aiProvider = 'trial', trial_consent = false } = await chrome.storage.sync.get({ aiProvider: 'trial', trial_consent: false });
        if ((aiProvider === 'trial') && !trial_consent) {
          // 在面板顶部显示一条提示，说明需要先在设置页勾选同意
          try {
            const hintZh = '试用模式需先同意通过代理传输页面内容。请在设置页勾选“我已阅读并同意”，保存后再试。';
            const hintEn = 'Trial mode requires consent to send page content via proxy. Open Settings, check consent, save, then retry.';
            const msg = (currentLangCache==='en') ? hintEn : hintZh;
            const box = shadow.getElementById('sx-summary');
            if (box) {
              box.innerHTML = `<div class="alert"><button class="alert-close" title="关闭" aria-label="关闭">&times;</button><div class="alert-content"><p>${escapeHtml(msg)}</p></div></div>`;
            }
          } catch {}
          try { await chrome.storage.sync.set({ need_trial_consent_focus: true }); } catch {}
          try { await chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' }); } catch { try { await chrome.runtime.openOptionsPage(); } catch {} }
          return;
        }
      } catch {}
      // Handle folded (empty) state: expand middle first, then reveal cards
      const wrapEl = shadow.getElementById('sx-wrap');
      const wasEmpty = !!wrapEl?.classList?.contains('is-empty');
      try{
        if (wasEmpty){
          wrapEl.classList.remove('fx-intro');
          wrapEl.classList.add('expanding');
        }else{
          wrapEl?.classList?.remove('fx-intro');
        }
      }catch{}

      setLoading(shadow,true);
      if (!wasEmpty) skeleton(shadow);

      const tabId=await getActiveTabId(); if(!tabId) throw new Error('未找到活动标签页');
      const resp=await chrome.runtime.sendMessage({type:'PANEL_RUN_FOR_TAB', tabId});
      if (!resp || resp.ok!==true) throw new Error(resp?.error||'运行失败');

      // After expansion, reveal cards and play pull-in animation
      if (wasEmpty){
        try{
          const container = shadow.getElementById('sx-container');
          // compute target height: wrap height minus appbar + footer heights
          const wrapRect = wrapEl.getBoundingClientRect();
          const appbar = shadow.querySelector('.appbar');
          const footer = shadow.querySelector('.footer');
          const qaBar  = shadow.getElementById('sx-qa-area');
          const appH = appbar ? appbar.getBoundingClientRect().height : 0;
          const footH = footer ? footer.getBoundingClientRect().height : 0;
          const qaH  = qaBar ? qaBar.getBoundingClientRect().height : 0;
          const target = Math.max(120, Math.round(wrapRect.height - appH - footH - qaH));
          // prepare container for smooth transition
          container.style.willChange = 'height';
          container.style.contain = 'layout style';
          container?.style.setProperty('--sx-target', target + 'px');

          let done = false; const finish = ()=>{
            if (done) return; done = true;
            try{
              wrapEl.classList.remove('is-empty');
              wrapEl.classList.remove('expanding');
              skeleton(shadow);
              const sCard = shadow.getElementById('sx-summary');
              const cCard = shadow.getElementById('sx-cleaned');
              sCard?.classList?.add('pull-in');
              cCard?.classList?.add('pull-in');
              setTimeout(()=>{ try{ sCard?.classList?.remove('pull-in'); cCard?.classList?.remove('pull-in'); }catch{} }, 700);
            }catch{}
          };
          // Use transitionend for smooth sync with the unroll
          container?.addEventListener('transitionend', (e)=>{ if (e.propertyName==='height') finish(); }, { once:true });
          // Fallback timeout in case transitionend is missed
          setTimeout(finish, 900);
        }catch{}
      } else {
        try{
          const sCard = shadow.getElementById('sx-summary');
          const cCard = shadow.getElementById('sx-cleaned');
          sCard?.classList?.add('pull-in');
          cCard?.classList?.add('pull-in');
          setTimeout(()=>{ try{ sCard?.classList?.remove('pull-in'); cCard?.classList?.remove('pull-in'); }catch{} }, 700);
        }catch{}
      }
      try{ if (wasEmpty) updateEmptyArrowPosition(); }catch{}

      try{
        const st=await getState(tabId);
        if (st.status==='partial'){ await renderCards(st.summary, null); }
        else if (st.status==='done'){ setLoading(shadow,true); skeleton(shadow); }
      }catch{}
      await pollUntilDone(shadow, tabId, (s,c)=>renderCards(s,c));
    }catch(e){
      setSummarizing(shadow,false); setLoading(shadow,false);
      const box=shadow.getElementById('sx-summary');
      box.innerHTML = `<div class="alert"><button class="alert-close" title="关闭" aria-label="关闭">&times;</button><div class="alert-content"><p>运行失败：${escapeHtml(e?.message||String(e))}</p></div></div>`;
    }
  });

  // ===== 启动：主题与存储、Vue尝试加载、渲染空态 =====
  (async ()=>{
    try{
      const { options_theme_override, float_theme_override } = await chrome.storage.sync.get(['options_theme_override','float_theme_override']);
      const pick=(v)=> (['auto','light','dark'].includes(v)? v: null);
      themeOverride = pick(options_theme_override)||pick(float_theme_override)||'auto';
    }catch{}
    applyThemeWithOverride(shadow); markThemeButtonsActive(shadow);

    await updateUIText();
    applyTrialLabelToFloatButton(shadow);
    try{ await updateAdblockIndicator(shadow); }catch{}
    try{ bindAdblockIndicatorToggle(shadow); }catch{}

    await tryLoadPetiteVue();
    if (PV) mountVue();

    try{
      const tabId=await getActiveTabId();
      if (!tabId){ await setEmpty(shadow); return; }
      const st=await getState(tabId);
      // Pre-mark summarize as triggered if panel state indicates it
      try{ hasSummarizeTriggered = ['running','partial','done'].includes(st?.status); }catch{}
      if (st.status==='running'){
        setSummarizing(shadow,true);
        const w=shadow.getElementById('sx-wrap'); w?.classList?.remove('fx-intro');
        if (!w?.classList?.contains('expanding')) w?.classList?.remove('is-empty');
        setLoading(shadow,true); skeleton(shadow); pollUntilDone(shadow, tabId, (s,c)=>renderCards(s,c));
      }
      else if (st.status==='partial'){
        setSummarizing(shadow,true);
        const w=shadow.getElementById('sx-wrap'); w?.classList?.remove('fx-intro');
        if (!w?.classList?.contains('expanding')) w?.classList?.remove('is-empty');
        setLoading(shadow,true); await renderCards(st.summary, null); pollUntilDone(shadow, tabId, (s,c)=>renderCards(s,c));
      }
      else if (st.status==='done'){
        setSummarizing(shadow,false);
        const w=shadow.getElementById('sx-wrap'); w?.classList?.remove('fx-intro');
        if (!w?.classList?.contains('expanding')) w?.classList?.remove('is-empty');
        setLoading(shadow,false); await renderCards(st.summary, st.cleaned); stopPolling();
      }
      else { await setEmpty(shadow); }
    }catch{ await setEmpty(shadow); }
  })();

  // ===== 广播同步 =====
  chrome.runtime.onMessage.addListener(async (msg)=>{
    if(!msg) return;
    if (msg.type==='PANEL_STATE_UPDATED'){
      const curId=await getActiveTabId(); if (msg.tabId!==curId) return;
      try{
        const st=await getState(curId);
        try{ hasSummarizeTriggered = ['running','partial','done'].includes(st?.status); }catch{}
        if (st.status==='running'){
          setSummarizing(shadow,true);
          const w=shadow.getElementById('sx-wrap'); w?.classList?.remove('fx-intro');
          if (!w?.classList?.contains('expanding')) w?.classList?.remove('is-empty');
          setLoading(shadow,true); skeleton(shadow);
        }
        else if (st.status==='partial'){
          setSummarizing(shadow,true);
          const w=shadow.getElementById('sx-wrap'); w?.classList?.remove('fx-intro');
          if (!w?.classList?.contains('expanding')) w?.classList?.remove('is-empty');
          setLoading(shadow,true); await renderCards(st.summary, null);
        }
        else if (st.status==='done'){
          setSummarizing(shadow,false);
          const w=shadow.getElementById('sx-wrap'); w?.classList?.remove('fx-intro');
          if (!w?.classList?.contains('expanding')) w?.classList?.remove('is-empty');
          setLoading(shadow,false); await renderCards(st.summary, st.cleaned); stopPolling();
        }
        else if (st.status==='error'){
          setSummarizing(shadow,false); setLoading(shadow,false);
          shadow.getElementById('sx-summary').innerHTML =
            `<div class="alert"><button class="alert-close" title="关闭" aria-label="关闭">&times;</button><div class="alert-content"><p>发生错误，请重试。</p></div></div>`;
          stopPolling();
        }
      }catch{}
    }else if (msg.type==='SX_CLOSE_FLOAT_PANEL'){
      const btn=shadow.getElementById('sx-close');
      if (btn) btn.click(); else { const host=document.getElementById(PANEL_ID); if (host){ host.remove(); window[MARK]=false; } stopPolling(); }
    }
  });

  // Lightweight message responder for background ping/show
  try{
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
      try{
        if (msg?.type === 'SX_PING_PANEL'){
          const host = document.getElementById(PANEL_ID);
          const visible = !!(host && host.style.display !== 'none');
          sendResponse({ ok:true, present: !!host, visible });
          return true;
        }
        if (msg?.type === 'SX_SHOW_PANEL'){
          const host = document.getElementById(PANEL_ID);
          if (host){ host.style.display = ''; try{ host.style.visibility=''; }catch{} }
          sendResponse({ ok:true, shown: !!host });
          return true;
        }
      }catch(e){ try{ sendResponse({ ok:false, error: String(e) }); }catch{} }
      return false;
    });
  }catch{}

  // ===== 强制深色模式（旧版注入保留为后备） =====
  function applyForceDarkMode(enabled) {
    if (enabled) {
      // 注入强制深色模式CSS
      const style = document.createElement('style');
      style.id = 'sx-force-dark-mode';
      style.textContent = `
        /* 强制深色模式（更温和）：
           - 仅为页面容器提供深色底色
           - 文本颜色统一为浅色
           - 不影响媒体元素（video/img/canvas/svg/iframe 等）的底色，避免遮挡视频 */
        html, body { background-color: #121212 !important; color: #eaeef5 !important; }
        /* 文本与图标（svg 也使用 currentColor 时仍能跟随）*/
        *, *::before, *::after { color: #eaeef5 !important; }
        /* 不为媒体元素强制设置背景色，避免视频/画布被黑色覆盖 */
        img, video, canvas, svg, iframe, embed, object, picture { background-color: transparent !important; }

        /* YouTube 站点常见容器背景（不影响视频区域）*/
        ytd-app,
        ytd-masthead,
        ytd-page-manager,
        ytd-browse,
        ytd-two-column-browse-results-renderer,
        ytd-rich-grid-renderer,
        ytd-watch-flexy,
        ytd-watch-flexy #columns,
        ytd-watch-flexy #primary,
        ytd-watch-flexy #secondary,
        #content,
        #page-manager,
        #container {
          background-color: #121212 !important;
        }

        /* GitHub 常见容器与变量覆盖（仅在 GitHub 选择器命中时生效）*/
        :root[data-color-mode],
        body[data-color-mode] {
          --color-canvas-default: #0f1624 !important;
          --color-canvas-subtle: #0d1422 !important;
          --color-border-default: #2a3a57 !important;
          --color-fg-default: #e6ebf2 !important;
          --color-accent-fg: #d6dbe5 !important;
        }
        .application-main,
        .markdown-body,
        .Layout,
        .Layout-main,
        .container-lg,
        .container-xl,
        .Box,
        .Box-body,
        .gollum-markdown-content,
        .blob-wrapper {
          background-color: #0f1624 !important;
          color: #e6ebf2 !important;
        }
        
        /* 链接：改为带灰度的浅色，避免突兀的蓝色 */
        a, a:visited, a:active { color: #d6dbe5 !important; }
        a:hover { color: #eef2f7 !important; }

        /* 移除一刀切背景覆盖，避免覆盖视频或交互控件；统一文字亮色的规则已在上方保留 */
        
        /* 处理选择文本 */
        ::selection {
          background-color: #4a9eff !important;
          color: #ffffff !important;
        }
      `;
      document.head.appendChild(style);

      // 智能本地加深：仅为明显浅底的容器加暗色基底（避免一刀切破坏）
      try{
        const MEDIA = new Set(['IMG','VIDEO','CANVAS','SVG','IFRAME','EMBED','OBJECT','PICTURE']);
        const hasBgImage = (cs)=>{
          const bi = cs.backgroundImage || '';
          return bi && bi !== 'none' && !/linear-gradient/i.test(bi);
        };
        const markNode = (el)=>{
          if (!el || el.nodeType!==1) return;
          // 距离视频区域很近的容器直接跳过，避免遮挡
          try{
            const nearVideo = el.closest('video, [class*="ytp-" i], [class*="video" i], [class*="player" i], [id*="video" i], [id*="player" i]');
            if (nearVideo) return;
          }catch{}
          if (MEDIA.has(el.tagName)) return;
          // 不处理极小元素，降低抖动（但放宽阈值，避免小徽标未处理）
          const rect = el.getBoundingClientRect?.();
          if (rect && (rect.width*rect.height) < 150) return;
          const cs = getComputedStyle(el);
          if (!cs) return;
          if (hasBgImage(cs)) return;
          const hasGlass = (cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none');
          const hasGradient = /linear-gradient/i.test(cs.backgroundImage || '');
          const bg = parseColorToRGB(cs.backgroundColor);
          if (!bg || bg.a < 0.05) return; // 近透明跳过
          const lum = relLuminance(bg);
          // 若是玻璃毛化容器，且背景为浅色/半透明/或有渐变，替换为暗色半透明玻璃
          if (hasGlass && (hasGradient || !bg || bg.a < 0.95) && (lum > 0.65)){
            el.classList.add('sx-dark-glass');
            return;
          }
          if (lum > 0.78) el.classList.add('sx-dark-bg');
          const bc = parseColorToRGB(cs.borderTopColor);
          if (bc && relLuminance(bc) > 0.7) el.classList.add('sx-dark-border');
        };
        const scanBatch = (root)=>{
          const all = (root||document).querySelectorAll('*');
          const MAX = 2000;
          const vh = window.innerHeight || document.documentElement.clientHeight || 800;
          let seen = 0;
          for (let i=0; i<all.length && seen<MAX; i++){
            const el = all[i];
            const rect = el.getBoundingClientRect?.();
            if (rect && (rect.bottom < -20 || rect.top > vh*1.8)) continue; // 只处理视口附近
            markNode(el);
            seen++;
          }
        };
        // 注入辅助样式（与主样式同 <style> 中）
        style.textContent += `\n`
          + `.sx-dark-bg{ background-color:#121826 !important; color:#e6ebf2 !important; }\n`
          + `.sx-dark-bg a, .sx-dark-bg a:visited, .sx-dark-bg a:active{ color:#d6dbe5 !important; }\n`
          + `.sx-dark-border{ border-color:#2a3a57 !important; }\n`
          + `.sx-dark-glass{ background-color: rgba(18,24,38,.45) !important; color:#e6ebf2 !important; border-color: rgba(42,58,87,.6) !important; backdrop-filter: saturate(1) blur(6px) !important; -webkit-backdrop-filter: saturate(1) blur(6px) !important; }\n`;
        // 初次扫描
        scanBatch(document);
        // 监听增量变化（仅 childList，避免属性循环），并使用 rAF 合批
        window.__sxForceDarkObserver && window.__sxForceDarkObserver.disconnect();
        window.__sxForceDarkObserver = new MutationObserver((muts)=>{
          if (window.__sxFDDebounce) return;
          window.__sxFDDebounce = true;
          requestAnimationFrame(()=>{
            window.__sxFDDebounce = false;
            const batch=[];
            for (const m of muts){
              if (m.type==='childList'){
                m.addedNodes && m.addedNodes.forEach(n=>{
                  if (n && n.nodeType===1){
                    batch.push(n);
                    try{ n.querySelectorAll && n.querySelectorAll('*').forEach(x=>batch.push(x)); }catch{}
                  }
                });
              }
            }
            let processed=0;
            for (const el of batch){ if (processed>600) break; markNode(el); processed++; }
          });
        });
        window.__sxForceDarkObserver.observe(document.documentElement, { childList:true, subtree:true });
      }catch{}
    } else {
      // 移除强制深色模式CSS
      const existingStyle = document.getElementById('sx-force-dark-mode');
      if (existingStyle) {
        existingStyle.remove();
      }
      // 清理智能标记与观察器
      try{ document.querySelectorAll('.sx-dark-bg').forEach(el=>el.classList.remove('sx-dark-bg')); }catch{}
      try{ document.querySelectorAll('.sx-dark-border').forEach(el=>el.classList.remove('sx-dark-border')); }catch{}
      try{ window.__sxForceDarkObserver && window.__sxForceDarkObserver.disconnect(); window.__sxForceDarkObserver=null; }catch{}
    }
  }

  // ===== 强制深色模式（优先 Dark Reader，失败回退到旧版注入） =====
  function applyForceDarkModeSmart(enabled){
    const tryEnableDarkReader = async () => {
      try{
        const libId = 'sx-darkreader-lib';
        const bridgeId = 'sx-darkreader-bridge';
        const inject = (src, id) => new Promise((res)=>{
          try{
            if (document.getElementById(id)) return res(true);
            const s = document.createElement('script');
            s.id = id; s.src = extURL(src); s.async = false; s.onload = () => res(true); s.onerror = () => res(false);
            (document.documentElement || document.head || document.body).appendChild(s);
          }catch{ res(false); }
        });
        const ok1 = await inject('vendor/darkreader.min.js', libId);
        if (!ok1) return false;
        const ok2 = await inject('vendor/sx-dark-bridge.js', bridgeId);
        if (!ok2) return false;
        return true;
      }catch{ return false; }
    };

    const postToggle = (on) => { try{ window.postMessage({ type: 'SX_FORCE_DARK_TOGGLE', enabled: !!on, options: { brightness: 100, contrast: 95, sepia: 0 } }, '*'); }catch{} };
    const markHostIgnored = (on)=>{
      try{
        const h=document.getElementById('sx-float-panel');
        if(!h) return;
        if(on){
          h.setAttribute('data-darkreader-ignore','');
          h.classList.add('surfingkeys_hints_host');
        } else {
          h.removeAttribute('data-darkreader-ignore');
          // Keep the class to be safe; removing could cause DR to re-instrument
          // h.classList.remove('surfingkeys_hints_host');
        }
      }catch{}
    };
    const enableFallback = () => {
      markHostIgnored(false);
      const existingLib = document.getElementById('sx-darkreader-lib'); if (existingLib) existingLib.remove();
      const existingBridge = document.getElementById('sx-darkreader-bridge'); if (existingBridge) existingBridge.remove();
      // 调用旧版注入函数作为回退
      try{ applyForceDarkMode(true); }catch{}
    };
    const disableFallback = () => { try{ const s=document.getElementById('sx-force-dark-mode'); s && s.remove(); }catch{} };

    if (enabled) {
      (async()=>{
        const ok = await tryEnableDarkReader();
        if (ok){
          markHostIgnored(true);
          disableFallback();
          try{ applyForceDarkMode(false); }catch{}
          postToggle(true);
          // 等待桥接标志，失败则回退
          let tries = 0;
          const check = ()=>{
            const flag = document.documentElement.getAttribute('data-sx-dark');
            if (flag === 'on') return; // 成功
            if (flag === 'err' || tries>10){ enableFallback(); return; }
            tries++; setTimeout(check, 60);
          };
          setTimeout(check, 100);
        } else {
          enableFallback();
        }
      })();
    } else {
      postToggle(false);
      markHostIgnored(false);
      disableFallback();
      try{ applyForceDarkMode(false); }catch{}
    }
  }

  // 初始化强制深色模式状态
  (async () => {
    try {
      const { force_dark_mode } = await chrome.storage.sync.get(['force_dark_mode']);
      forceDarkMode = !!force_dark_mode;
      const forceDarkBtn = shadow.getElementById('sx-force-dark-btn');
      if (forceDarkBtn) {
        forceDarkBtn.classList.toggle('active', forceDarkMode);
      }
      applyForceDarkModeSmart(forceDarkMode);
    } catch (e) {
      console.warn('Failed to load force dark mode setting:', e);
    }
  })();

  // ===== 存储变更 =====
  try{
    chrome.storage.onChanged.addListener((changes, area)=>{
      if (area==='sync' && changes.aiProvider) applyTrialLabelToFloatButton(shadow);
      if (area!=='sync') return;
      if (changes.adblock_enabled){ try{ updateAdblockIndicator(shadow); }catch{} }
      if (changes.options_theme_override || changes.float_theme_override){
        const next=(changes.options_theme_override?.newValue) ?? (changes.float_theme_override?.newValue);
        if (['auto','light','dark'].includes(next)){
          themeOverride=next; applyThemeWithOverride(shadow); markThemeButtonsActive(shadow);
        }
      }
      if (changes.force_dark_mode) {
        forceDarkMode = !!changes.force_dark_mode.newValue;
        const forceDarkBtn = shadow.getElementById('sx-force-dark-btn');
        if (forceDarkBtn) {
          forceDarkBtn.classList.toggle('active', forceDarkMode);
        }
        applyForceDarkModeSmart(forceDarkMode);
      }
    });
  }catch{}

  // ====== 元素选择器（生成按域名隐藏规则） ======
  function startElementPicker(){
    const originalDisplay = host.style.display;
    host.style.display = 'none';
    const overlay = document.createElement('div');
    overlay.id = 'sx-pick-overlay';
    overlay.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483646;pointer-events:none;';
    const rect = document.createElement('div');
    rect.id = 'sx-pick-rect';
    rect.style.cssText = 'position:fixed;border:2px dashed #2563eb;box-shadow:0 0 0 99999px rgba(37,99,235,.08) inset;pointer-events:none;transition:all .03s;';
    const tip = document.createElement('div');
    tip.id = 'sx-pick-tip';
    tip.style.cssText = 'position:fixed; padding:6px 8px; background:rgba(17,24,39,.9); color:#f8fafc; border-radius:8px; font-size:12px; pointer-events:none; max-width:50vw;';
    tip.textContent = (currentLangCache==='zh') ? '点击选中元素，按 Esc 退出' : 'Click to select element, press Esc to exit';
    overlay.appendChild(rect); overlay.appendChild(tip);
    document.documentElement.appendChild(overlay);

    let curEl = null;
    let confirming = false;
    const move = (e) => {
      if (confirming) return;
      const x = e.clientX, y = e.clientY;
      const el = document.elementFromPoint(x,y);
      if (!el || el === document.documentElement || el === document.body) return;
      if (host && (el === host || (host.contains && host.contains(el)))) return;
      curEl = el;
      const r = el.getBoundingClientRect();
      rect.style.left = r.left + 'px';
      rect.style.top = r.top + 'px';
      rect.style.width = r.width + 'px';
      rect.style.height = r.height + 'px';
      // tip position
      tip.style.left = Math.min(window.innerWidth - 260, Math.max(8, r.left)) + 'px';
      tip.style.top = Math.max(8, r.top - 32) + 'px';
    };

    const stopAll = (ev) => { try{ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); }catch{} };
    const key = (e) => { if (confirming) return; if (e.key === 'Escape') { stopPick(true); stopAll(e);} };
    const down = (e) => { if (confirming) return; stopAll(e); };
    const up = (e) => { if (confirming) return; stopAll(e); };
    const click = async (e) => {
      if (confirming) return; // let confirm dialog receive click
      if (!confirming) stopAll(e);
      if (!curEl) return;
      try {
        const selector = buildNiceSelector(curEl);
        const domain = location.hostname || '';
        const rule = `${domain}##${selector}`;
        confirming = true; // suspend event capture while confirming
        const ok = await confirmPick(rule);
        if (ok) {
          try {
            // Hide all elements matching the generated selector for immediate feedback
            const nodes = document.querySelectorAll(selector);
            nodes.forEach(n => { try { n.style.setProperty('display','none','important'); } catch{} });
          } catch{}
          try {
            const { adblock_user_rules_text = '' } = await chrome.storage.sync.get({ adblock_user_rules_text: '' });
            const lines = new Set((adblock_user_rules_text || '').split(/\r?\n/).map(s=>s.trim()).filter(Boolean));
            lines.add(rule);
            await chrome.storage.sync.set({ adblock_user_rules_text: Array.from(lines).join('\n') });
          } catch {}
          // Exit picking mode after confirm
          stopPick(true);
          return;
        }
      } finally {
        // On cancel: continue picking, restore hint
        if (document.getElementById('sx-pick-overlay')) {
          confirming = false;
          tip.textContent = (currentLangCache==='zh') ? '点击选中元素，按 Esc 退出' : 'Click to select element, press Esc to exit';
        }
      }
    };

    function stopPick(restore){
      try {
        window.removeEventListener('mousemove', move, true);
        window.removeEventListener('keydown', key, true);
        window.removeEventListener('pointerdown', down, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('click', click, true);
      } catch {}
      try { overlay.remove(); } catch {}
      if (restore) host.style.display = originalDisplay || '';
    }

    window.addEventListener('mousemove', move, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('click', click, true);
  }

  function buildNiceSelector(el){
    try{
      const isStableId = (id)=> /^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(id) && !/(\d{4,}|[A-Fa-f0-9]{6,})/.test(id);
      const isStableClass = (c)=> /^[a-z][a-z0-9-]{2,32}$/.test(c) && !/(\d{3,}|^css-|^jsx-|^sc-)/.test(c);
      const classesOf = (node)=> Array.from((node.classList||[])).filter(isStableClass);

      // 1) Prefer stable id on element
      if (el.id && isStableId(el.id)) return `#${el.id}`;
      // 2) Prefer stable classes on element (class chain only, for Low strength compatibility)
      const cls = classesOf(el);
      if (cls.length > 0) return `.${cls[0]}`;
      // 3) Walk up to find a stable ancestor class and combine with a stable class on element if any
      let p = el.parentElement;
      while (p && p !== document.body) {
        if (p.id && isStableId(p.id)) {
          // Avoid descendant selectors for Low; fall back to parent id only
          return `#${p.id}`;
        }
        const pc = classesOf(p);
        if (pc.length > 0) {
          // Use parent classes only to remain generic
          return `.${pc[0]}`;
        }
        p = p.parentElement;
      }
      // 4) If element is a heading, use heading tag as a last resort (Medium strength recommended)
      const tag = (el.tagName||'').toLowerCase();
      if (/^h[1-3]$/.test(tag)) return tag;
      // 5) Fallback to first class-like token from any ancestor (even if not fully stable)
      p = el.parentElement;
      while (p && p !== document.body) {
        const any = Array.from((p.classList||[])).filter(s=>/^[A-Za-z0-9_-]{2,32}$/.test(s));
        if (any.length) return `.${any[0]}`;
        p = p.parentElement;
      }
      return 'div';
    }catch{ return 'div'; }
  }

  async function confirmPick(rule){
    return new Promise((resolve)=>{
      try{
        const wrap = document.createElement('div');
        wrap.id='sx-pick-confirm';
        wrap.style.cssText = 'position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:2147483647;background:#0f172a;color:#f8fafc;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 12px;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.25)';
        const msg = document.createElement('div');
        msg.textContent = (currentLangCache==='zh'?'添加隐藏规则：':'Add hide rule:') + ' ' + rule;
        const row = document.createElement('div');
        row.style.cssText='display:flex;gap:8px;justify-content:flex-end;margin-top:8px';
        const ok = document.createElement('button'); ok.textContent = currentLangCache==='zh'?'确认添加':'Confirm';
        ok.style.cssText='appearance:none;border:1px solid #334155;background:#1b2a4b;color:#e2ebf8;border-radius:8px;padding:6px 10px;cursor:pointer;';
        const cancel = document.createElement('button'); cancel.textContent = currentLangCache==='zh'?'取消':'Cancel';
        cancel.style.cssText='appearance:none;border:1px solid #334155;background:#0b1220;color:#e2ebf8;border-radius:8px;padding:6px 10px;cursor:pointer;';
        ok.addEventListener('click', ()=>{ cleanup(); resolve(true); });
        cancel.addEventListener('click', ()=>{ cleanup(); resolve(false); });
        row.appendChild(cancel); row.appendChild(ok);
        wrap.appendChild(msg); wrap.appendChild(row);
        document.documentElement.appendChild(wrap);
        function cleanup(){ try{ wrap.remove(); }catch{} }
      }catch{ resolve(false); }
    });
  }

})();
