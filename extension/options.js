document.getElementById('save').addEventListener('click', function () {
  const apiBase = document.getElementById('apiBase').value.trim() || 'http://localhost:8000';
  const dashboardUrl = document.getElementById('dashboardUrl').value.trim() || 'http://localhost:5173';
  chrome.storage.sync.set({ apiBase, dashboardUrl }, function () {
    alert('Saved. Reload Gmail for the extension to use the new URLs.');
  });
});

chrome.storage.sync.get({ apiBase: 'http://localhost:8000', dashboardUrl: 'http://localhost:5173' }, function (o) {
  document.getElementById('apiBase').value = o.apiBase;
  document.getElementById('dashboardUrl').value = o.dashboardUrl;
});
