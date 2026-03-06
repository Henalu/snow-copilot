// SN Assistant — service-worker.js
// Coordina mensajes entre popup/options y content script

chrome.runtime.onInstalled.addListener(() => {
  console.log('SN Assistant installed');
  // Defaults
  chrome.storage.sync.set({
    autoShow: true,
    backendUrl: ''
  });
});

// Relay de mensajes desde options/popup al content script activo
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_SIDEBAR') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SIDEBAR' });
      }
    });
  }
  return true;
});
