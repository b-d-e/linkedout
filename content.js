// LinkedOut - Content script for LinkedIn
// Detects posts, requests translations, injects UI

class LinkedOutController {
  constructor() {
    this.enabled = true;
    this.autoTranslate = true;
    this.observer = null;
    this.processedPosts = new WeakSet();
    this.translationCache = new TranslationCache();
    this.batchTimer = null;
    this.BATCH_DELAY = 500;
  }

  async init() {
    const settings = await chrome.storage.local.get({
      enabled: true,
      autoTranslate: 'auto',
      apiKey: '',
    });

    this.enabled = settings.enabled;
    this.autoTranslate = settings.autoTranslate === 'auto';

    if (!this.enabled) return;

    if (!settings.apiKey) {
      this.showSetupBanner();
      return;
    }

    this.startObserver();
    this.watchNavigation();
    this.retryInitialScan();

    // Re-scan when tab becomes visible again (e.g. switching back from another tab)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.enabled) this.processExistingPosts();
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'TOGGLE_ENABLED') {
        this.enabled = msg.enabled;
        if (this.enabled) {
          this.processExistingPosts();
          this.startObserver();
        } else {
          this.stopObserver();
          this.removeAllTranslations();
        }
      }
    });
  }

  // --- DOM Observation ---

  startObserver() {
    if (this.observer) return; // already running

    // Always observe document.body — LinkedIn's feed container may not exist yet
    this.observer = new MutationObserver(() => {
      if (this.batchTimer) clearTimeout(this.batchTimer);
      this.batchTimer = setTimeout(() => this.processExistingPosts(), this.BATCH_DELAY);
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stopObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  // LinkedIn's feed loads progressively — retry a few times to catch it
  retryInitialScan() {
    const delays = [0, 500, 1500, 3000, 5000];
    delays.forEach(ms => setTimeout(() => this.processExistingPosts(), ms));
  }

  // Handle LinkedIn SPA navigation (feed -> profile, etc.)
  watchNavigation() {
    let lastUrl = location.href;
    const check = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // New page via SPA nav — restart observer on new DOM
        this.stopObserver();
        setTimeout(() => {
          this.startObserver();
          this.processExistingPosts();
        }, 1000);
      }
    };
    // LinkedIn uses pushState/replaceState for navigation
    const wrap = (method) => {
      const orig = history[method];
      history[method] = function (...args) {
        orig.apply(this, args);
        check();
      };
    };
    wrap('pushState');
    wrap('replaceState');
    window.addEventListener('popstate', check);
  }

  // --- Post Detection ---

  processExistingPosts() {
    if (!this.enabled) return;

    const posts = document.querySelectorAll(LinkedOutSelectors.getAllPostSelector());
    posts.forEach(postEl => {
      if (this.processedPosts.has(postEl)) return;
      this.processedPosts.add(postEl);
      this.processPost(postEl);
    });
  }

  async processPost(postEl) {
    const textEl = LinkedOutSelectors.queryFirst(postEl, LinkedOutSelectors.POST_TEXT);
    if (!textEl) return;

    const postText = textEl.innerText.trim();
    if (!postText || postText.length < 20) return;

    const cacheKey = this.hashText(postText);

    const toggleBtn = this.injectToggleButton(postEl, textEl);

    // Check cache
    const cached = await this.translationCache.get(cacheKey);
    if (cached) {
      this.injectTranslation(textEl, cached, toggleBtn);
      postEl.dataset.linkedout = 'true';
      return;
    }

    if (!this.autoTranslate) {
      // Manual mode: translate on button click
      toggleBtn.addEventListener('click', async () => {
        if (toggleBtn.dataset.state === 'untranslated') {
          this.showLoading(toggleBtn);
          await this.translateAndInject(postEl, textEl, postText, cacheKey, toggleBtn);
        }
      }, { once: true });
      return;
    }

    // Auto mode: translate immediately
    this.showLoading(toggleBtn);
    await this.translateAndInject(postEl, textEl, postText, cacheKey, toggleBtn);
  }

  async translateAndInject(postEl, textEl, postText, cacheKey, toggleBtn) {
    try {
      const translation = await this.requestTranslation(postText);
      await this.translationCache.set(cacheKey, translation);
      this.injectTranslation(textEl, translation, toggleBtn);
      postEl.dataset.linkedout = 'true';
    } catch (err) {
      console.error('[LinkedOut]', err);
      this.showError(postEl, toggleBtn, err.message);
    }
  }

  // --- API Communication ---

  requestTranslation(postText) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'TRANSLATE', postText },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.translation);
          }
        }
      );
    });
  }

  // --- UI Injection ---

  injectToggleButton(postEl, textEl) {
    const btn = document.createElement('button');
    btn.className = 'linkedout-toggle';
    btn.title = 'LinkedOut: translate this post';
    btn.textContent = 'LO';
    btn.dataset.state = 'untranslated';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (btn.dataset.state === 'translated' || btn.dataset.state === 'original') {
        this.toggleView(textEl, btn);
      }
    });

    const wrapper = textEl.closest('.feed-shared-update-v2__description-wrapper')
      || textEl.parentElement;
    if (wrapper) {
      wrapper.style.position = 'relative';
      wrapper.appendChild(btn);
    }

    return btn;
  }

  injectTranslation(textEl, translation, toggleBtn) {
    // Save original HTML and translation for toggling
    if (!textEl.dataset.linkedoutOriginal) {
      textEl.dataset.linkedoutOriginal = textEl.innerHTML;
    }
    textEl.dataset.linkedoutCached = translation;

    // Find all direct text nodes and span children (the actual post text),
    // but leave interactive elements like "See more" buttons alone
    const textSpans = textEl.querySelectorAll('span.break-words, span[dir]');
    if (textSpans.length > 0) {
      // Replace just the text spans
      textSpans.forEach((span, i) => {
        if (i === 0) {
          span.innerHTML = '<span class="linkedout-badge">linkedout</span> ' + this.escapeHtml(translation);
        } else {
          span.style.display = 'none';
          span.classList.add('linkedout-hidden-span');
        }
      });
    } else {
      // Fallback: replace innerHTML but try to preserve buttons
      const seeMore = textEl.querySelector('button');
      textEl.innerHTML =
        '<span class="linkedout-badge">linkedout</span> ' +
        this.escapeHtml(translation);
      if (seeMore) textEl.appendChild(seeMore);
    }

    textEl.classList.add('linkedout-translated');

    toggleBtn.dataset.state = 'translated';
    toggleBtn.innerHTML = '<<';
    toggleBtn.title = 'Show original';
    toggleBtn.classList.remove('linkedout-loading');
  }

  toggleView(textEl, toggleBtn) {
    if (toggleBtn.dataset.state === 'translated') {
      // Restore original
      if (textEl.dataset.linkedoutOriginal) {
        textEl.innerHTML = textEl.dataset.linkedoutOriginal;
      }
      textEl.classList.remove('linkedout-translated');
      toggleBtn.dataset.state = 'original';
      toggleBtn.textContent = 'LO';
      toggleBtn.title = 'Show translation';
    } else {
      // Re-translate — we have the translation cached, re-trigger processPost
      // For simplicity, just use the cached data attribute
      const cached = textEl.dataset.linkedoutCached;
      if (cached) {
        this.injectTranslation(textEl, cached, toggleBtn);
      }
    }
  }

  showLoading(toggleBtn) {
    toggleBtn.classList.add('linkedout-loading');
    toggleBtn.textContent = '';
    toggleBtn.innerHTML = '<span class="linkedout-spinner"></span>';
  }

  showError(postEl, toggleBtn, message) {
    toggleBtn.classList.remove('linkedout-loading');
    toggleBtn.classList.add('linkedout-error');
    toggleBtn.innerHTML = '!';
    toggleBtn.title = `Error: ${message}`;

    // Show a visible banner for rate limit / API errors
    const isRateLimit = /rate limit/i.test(message);
    const banner = document.createElement('div');
    banner.className = 'linkedout-rate-limit-banner';
    banner.textContent = isRateLimit
      ? 'LinkedOut: Rate limited — wait a moment and scroll again'
      : `LinkedOut: ${message}`;
    const textEl = LinkedOutSelectors.queryFirst(postEl, LinkedOutSelectors.POST_TEXT);
    if (textEl && textEl.parentElement) {
      textEl.parentElement.insertBefore(banner, textEl);
      setTimeout(() => banner.remove(), 8000);
    }
  }

  showSetupBanner() {
    const feed = LinkedOutSelectors.queryFirst(document, LinkedOutSelectors.FEED_CONTAINER);
    if (!feed) return;

    const banner = document.createElement('div');
    banner.className = 'linkedout-setup-banner';
    banner.innerHTML = '<strong>LinkedOut</strong> needs an OpenAI API key. <a href="#" id="linkedout-open-options">Set it up here</a>.';
    banner.querySelector('#linkedout-open-options').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    });
    feed.prepend(banner);
  }

  removeAllTranslations() {
    // Restore original text for all translated posts
    document.querySelectorAll('.linkedout-translated').forEach(el => {
      if (el.dataset.linkedoutOriginal) {
        el.innerHTML = el.dataset.linkedoutOriginal;
      }
      el.classList.remove('linkedout-translated');
      delete el.dataset.linkedoutOriginal;
      delete el.dataset.linkedoutCached;
    });
    document.querySelectorAll('.linkedout-toggle').forEach(el => el.remove());
    document.querySelectorAll('[data-linkedout]').forEach(el => {
      delete el.dataset.linkedout;
    });
  }

  // --- Utilities ---

  hashText(text) {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return 'lo_' + Math.abs(hash).toString(36);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const linkedout = new LinkedOutController();
linkedout.init();
