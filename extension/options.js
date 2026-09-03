function maybeRequestApiHost(apiBase) {
  try {
    const origin = new URL(apiBase).origin + "/*";
    if (chrome.permissions && chrome.permissions.request) {
      chrome.permissions.request({ origins: [origin] }, () => {});
    }
  } catch (e) {}
}

document.getElementById('save').addEventListener('click', function () {
  const apiBase = document.getElementById('apiBase').value.trim() || 'https://phishguard-api-877x.onrender.com';
  const dashboardUrl = document.getElementById('dashboardUrl').value.trim() || 'https://phish-guard-swart.vercel.app';
  maybeRequestApiHost(apiBase);
  chrome.storage.sync.set({ apiBase, dashboardUrl }, function () {
    const el = document.getElementById('status');
    el.textContent = 'Saved. Reload your inbox tab for PhishGuard to use the new settings.';
    setTimeout(() => { el.textContent = ''; }, 4000);
  });
});

chrome.storage.sync.get({ apiBase: 'https://phishguard-api-877x.onrender.com', dashboardUrl: 'https://phish-guard-swart.vercel.app' }, function (o) {
  document.getElementById('apiBase').value = o.apiBase;
  document.getElementById('dashboardUrl').value = o.dashboardUrl;
});
