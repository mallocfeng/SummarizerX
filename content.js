// content.js —— 提供探针与抓取 API
(function () {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "PING_EXTRACTOR") { sendResponse({ ok: true }); return true; }
    if (msg?.type === "GET_PAGE_RAW") {
      try {
        const fn = window.__AI_READ_EXTRACT__;
        const { title, text, pageLang, markdown } = fn ? fn() : {
          title: document.title || "",
          text: document.body?.innerText || "",
          pageLang: document.documentElement.getAttribute("lang") || "",
          markdown: ""
        };
        sendResponse({ ok: true, payload: { title, text, url: location.href, pageLang, markdown } });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
      return true;
    }
  });
})();