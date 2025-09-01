// options.preload.js — define SXUI early without inline script (MV3 CSP compliant)
(() => {
  try {
    window.SXUI = window.SXUI || {
      eyeOpen: false,
      focus: {
        aiProvider: false,
        apiKey: false,
        baseURL: false,
        model_extract: false,
        model_summarize: false,
        output_lang: false,
        extract_mode: false
      }
    };
  } catch {}
})();

