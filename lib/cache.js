// Two-tier translation cache: in-memory (fast) + chrome.storage.local (persistent)

class TranslationCache {
  constructor() {
    this.memoryCache = new Map();
    this.MAX_MEMORY = 200;
    this.MAX_STORAGE = 1000;
    this.STORAGE_KEY = 'linkedout_cache';
  }

  async get(key) {
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    const data = await chrome.storage.local.get(this.STORAGE_KEY);
    const cache = data[this.STORAGE_KEY] || {};
    if (cache[key]) {
      this.memoryCache.set(key, cache[key].translation);
      return cache[key].translation;
    }

    return null;
  }

  async set(key, translation) {
    this.memoryCache.set(key, translation);

    if (this.memoryCache.size > this.MAX_MEMORY) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    const data = await chrome.storage.local.get(this.STORAGE_KEY);
    const cache = data[this.STORAGE_KEY] || {};
    cache[key] = { translation, timestamp: Date.now() };

    const entries = Object.entries(cache);
    if (entries.length > this.MAX_STORAGE) {
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      entries.slice(0, entries.length - this.MAX_STORAGE).forEach(([k]) => delete cache[k]);
    }

    await chrome.storage.local.set({ [this.STORAGE_KEY]: cache });

    // Update translation count
    const { translationCount = 0 } = await chrome.storage.local.get('translationCount');
    await chrome.storage.local.set({ translationCount: translationCount + 1 });
  }

  async clear() {
    this.memoryCache.clear();
    await chrome.storage.local.remove(this.STORAGE_KEY);
  }
}
