// Advanced settings (self-hosting: API/dashboard URL overrides) are only ever shown to
// PhishGuard's own developer account, so ordinary users just see a clean "connected and
// ready" Settings page. This is a real gate, not just hidden UI: it checks the email of
// whoever is actually signed into this Chrome profile via chrome.identity, which nobody
// else can fake without your Google credentials — unlike hiding markup, which anyone could
// still find by reading the extension's source.
const ALLOWED_DEV_EMAILS = ["bello.ibrahim.idowu@gmail.com"];

const HOSTED_API = "https://phishguard-api-877x.onrender.com";
const HOSTED_DASHBOARD = "https://phish-guard-swart.vercel.app";

function maybeRequestApiHost(apiBase) {
  try {
    const origin = new URL(apiBase).origin + "/*";
    if (chrome.permissions && chrome.permissions.request) {
      chrome.permissions.request({ origins: [origin] }, () => {});
    }
  } catch (e) {}
}

function buildAdvancedSection() {
  const mount = document.getElementById('advancedMount');
  if (!mount) return;

  mount.innerHTML = `
    <details class="card advanced">
      <summary>Advanced (self-hosting)</summary>
      <div class="advanced-body">
        <label>API URL (backend)</label>
        <input type="text" id="apiBase" placeholder="${HOSTED_API}">
        <div class="hint">Only change this if you're running your own backend instead of the hosted one.</div>
        <label>Dashboard URL (full report page)</label>
        <input type="text" id="dashboardUrl" placeholder="${HOSTED_DASHBOARD}">
        <div class="hint">Only change this if you're running your own dashboard instead of the hosted one.</div>
        <button id="save">Save settings</button>
        <div class="status" id="status"></div>
      </div>
    </details>
  `;

  document.getElementById('save').addEventListener('click', function () {
    const apiBase = document.getElementById('apiBase').value.trim() || HOSTED_API;
    const dashboardUrl = document.getElementById('dashboardUrl').value.trim() || HOSTED_DASHBOARD;
    maybeRequestApiHost(apiBase);
    chrome.storage.sync.set({ apiBase, dashboardUrl }, function () {
      const el = document.getElementById('status');
      el.textContent = 'Saved. Reload your inbox tab for PhishGuard to use the new settings.';
      setTimeout(() => { el.textContent = ''; }, 4000);
    });
  });

  chrome.storage.sync.get({ apiBase: HOSTED_API, dashboardUrl: HOSTED_DASHBOARD }, function (o) {
    document.getElementById('apiBase').value = o.apiBase;
    document.getElementById('dashboardUrl').value = o.dashboardUrl;
  });
}

function isDevAccount(email) {
  return !!email && ALLOWED_DEV_EMAILS.includes(String(email).toLowerCase());
}

// chrome.identity.getProfileUserInfo reads the Google account this Chrome *profile* is
// signed into — no extra OAuth consent screen, since "identity" is already a granted
// permission. If nobody's signed into the profile, or it's not an allow-listed email,
// this silently does nothing and the page stays on the plain "ready" card.
function showDebugLine(text) {
  // TEMPORARY diagnostic — remove once dev-account detection is confirmed working.
  const el = document.createElement("div");
  el.style.cssText = "font-size:10px;opacity:.55;margin-top:10px;font-family:monospace;word-break:break-all";
  el.textContent = text;
  document.body.appendChild(el);
}

try {
  if (!chrome.identity) {
    showDebugLine('DEBUG: chrome.identity is undefined in this context');
  } else {
    chrome.identity.getProfileUserInfo({ accountStatus: "ANY" }, function (info) {
      const email = info && info.email ? info.email : "";
      showDebugLine('DEBUG: getProfileUserInfo returned email="' + email + '" (match=' + isDevAccount(email) + ')');
      if (isDevAccount(email)) buildAdvancedSection();
    });
  }
} catch (e) {
  showDebugLine('DEBUG: threw ' + (e && e.message));
}
