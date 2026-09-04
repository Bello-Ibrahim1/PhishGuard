// Split out of popup.html into its own file because Manifest V3's default CSP for
// extension pages ("script-src 'self'") silently blocks inline <script> tags — Chrome
// just never runs them, with no visible error to the user, which is why every button in
// the popup looked "broken" (none of the click listeners below were ever being attached).
document.getElementById('open').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { cmd: "open_panel" }, () => {
    if (chrome.runtime.lastError) {
      // No content script listening on this tab — it's not a Gmail/Outlook/Yahoo mail
      // tab, or the tab was open before the extension was last loaded/reloaded and hasn't
      // been refreshed since. Tell the user why, instead of the button silently doing
      // nothing (the previous, harder-to-diagnose symptom).
      showNotice("PhishGuard isn't active on this tab. Open Gmail, Outlook, or Yahoo Mail (and refresh the tab if you just reloaded the extension), then try again.");
      return;
    }
    window.close();
  });
});
document.getElementById('options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
document.getElementById('report').addEventListener('click', async (e) => {
  e.preventDefault();
  // pgClientId is the same private per-install id panel.js attaches to every scored
  // email (see getClientId() there) — passed here as ?uid= so the dashboard only ever
  // asks the backend for THIS install's reports, not everyone's. If it hasn't been
  // generated yet (e.g. Settings/report opened before any email was ever scanned),
  // generate it now so the dashboard link is scoped from the very first open too.
  chrome.storage.sync.get(
    { dashboardUrl: 'https://phish-guard-swart.vercel.app', pgClientId: null },
    o => {
      const openWithId = (id) => {
        const sep = o.dashboardUrl.includes('?') ? '&' : '?';
        window.open(o.dashboardUrl + sep + 'uid=' + encodeURIComponent(id), '_blank');
      };
      if (o.pgClientId) {
        openWithId(o.pgClientId);
      } else {
        const id = (crypto && crypto.randomUUID) ? crypto.randomUUID()
          : 'pg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        chrome.storage.sync.set({ pgClientId: id }, () => openWithId(id));
      }
    }
  );
});

function showNotice(text) {
  // Styled entirely from popup.html's #pop-notice rule (which follows the same
  // light/dark tokens as the rest of the popup) rather than an inline style here, so this
  // notice re-themes correctly if the OS color scheme changes instead of staying stuck
  // with whatever colors were hardcoded at the moment it was written.
  let el = document.getElementById('pop-notice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pop-notice';
    document.querySelector('.pop-body').appendChild(el);
  }
  el.textContent = text;
}
