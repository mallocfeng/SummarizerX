// sidepanel.trial-label.js
// 侧边栏按钮文案：trial => “试用摘要”，否则 “提取并摘要”
const BTN_ID = "btn-run";
const LABEL_DEFAULT = "提取并摘要";
const LABEL_TRIAL   = "试用摘要";

async function applyTrialLabel() {
  try {
    const { aiProvider } = await chrome.storage.sync.get(["aiProvider"]);
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    if ((aiProvider || "trial") === "trial") {
      btn.textContent = LABEL_TRIAL;
      btn.title = "当前为试用模式（通过代理调用），点击开始试用摘要";
    } else {
      btn.textContent = LABEL_DEFAULT;
      btn.title = "点击提取正文并生成摘要";
    }
  } catch {
    const btn = document.getElementById(BTN_ID);
    if (btn) {
      btn.textContent = LABEL_DEFAULT;
      btn.title = "点击提取正文并生成摘要";
    }
  }
}

// 首次加载
document.addEventListener("DOMContentLoaded", applyTrialLabel);

// 监听设置变化
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.aiProvider) applyTrialLabel();
});