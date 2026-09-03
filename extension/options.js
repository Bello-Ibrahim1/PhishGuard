function maybeRequestApiHost(apiBase) {
  try {
    const origin = new URL(apiBase).origin + "/*";
    if (chrome.permissions && chrome.permissions.request) {
      chrome.permissions.request({ origins: [origin] }, () => {});
    }
  } catch (e) {}
}

document.getElementById('save').addEventListener('click', function () {
  const apiBase = document.getElementById('apiBase').value.trim() || 'http://localhost:8000';
  const dashboardUrl = document.getElementById('dashboardUrl').value.trim() || 'http://localhost:5173';
  maybeRequestApiHost(apiBase);
  chrome.storage.sync.set({ apiBase, dashboardUrl }, function () {
    const el = document.getElementById('status');
    el.textContent = 'Saved. Reload your inbox tab for PhishGuard to use the new settings.';
    setTimeout(() => { el.textContent = ''; }, 4000);
  });
});

chrome.storage.sync.get({ apiBase: 'http://localhost:8000', dashboardUrl: 'http://localhost:5173' }, function (o) {
  document.getElementById('apiBase').value = o.apiBase;
  document.getElementById('dashboardUrl').value = o.dashboardUrl;
});
