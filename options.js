document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('model');
  const autoTranslateSelect = document.getElementById('autoTranslate');
  const saveBtn = document.getElementById('saveBtn');
  const saveStatus = document.getElementById('saveStatus');

  const settings = await chrome.storage.local.get({
    apiKey: '',
    model: 'gpt-4o-mini',
    autoTranslate: 'auto',
  });

  apiKeyInput.value = settings.apiKey;
  modelSelect.value = settings.model;
  autoTranslateSelect.value = settings.autoTranslate;

  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (apiKey && !apiKey.startsWith('sk-')) {
      saveStatus.textContent = 'API key should start with "sk-"';
      saveStatus.className = 'save-status error';
      return;
    }

    await chrome.storage.local.set({
      apiKey,
      model: modelSelect.value,
      autoTranslate: autoTranslateSelect.value,
    });

    saveStatus.textContent = 'Settings saved!';
    saveStatus.className = 'save-status success';
    setTimeout(() => { saveStatus.textContent = ''; }, 3000);
  });
});
