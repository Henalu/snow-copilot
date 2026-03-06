// SN Assistant — options.js

async function load() {
  const { backendUrl, autoShow } = await chrome.storage.sync.get({
    backendUrl: '',
    autoShow: true
  });
  document.getElementById('backendUrl').value = backendUrl;
  document.getElementById('autoShow').checked = autoShow;
}

document.getElementById('btnSave').addEventListener('click', async () => {
  const backendUrl = document.getElementById('backendUrl').value.trim().replace(/\/$/, '');
  const autoShow = document.getElementById('autoShow').checked;

  await chrome.storage.sync.set({ backendUrl, autoShow });

  const status = document.getElementById('status');
  status.classList.add('show');
  setTimeout(() => status.classList.remove('show'), 2500);
});

load();
