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
  chrome.storage.sync.get({ dashboardUrl: 'http://localhost:5173' }, o => window.open(o.dashboardUrl, '_blank'));
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
