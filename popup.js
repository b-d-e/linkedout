document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('enableToggle');
  const status = document.getElementById('status');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const postCount = document.getElementById('postCount');

  const { enabled, apiKey, translationCount } = await chrome.storage.local.get({
    enabled: true,
    apiKey: '',
    translationCount: 0,
  });

  toggle.checked = enabled;
  postCount.textContent = translationCount;

  if (!apiKey) {
    status.textContent = 'API key not set!';
    status.style.color = '#e74c3c';
  }

  toggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ enabled: toggle.checked });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'TOGGLE_ENABLED',
        enabled: toggle.checked,
      });
    }
  });

  clearCacheBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove('linkedout_cache');
    await chrome.storage.local.set({ translationCount: 0 });
    postCount.textContent = '0';
    status.textContent = 'Cache cleared';
    status.style.color = '#27ae60';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });

  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
