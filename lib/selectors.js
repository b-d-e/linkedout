// LinkedIn DOM selector definitions
// Isolated here for easy updates when LinkedIn changes their markup

const LinkedOutSelectors = {
  // Primary: URN-based selectors (most stable — works on feed + profiles)
  POST_CONTAINERS: [
    '[data-chameleon-result-urn*="update"]',
    'div[data-id*="urn:li:activity"]',
    '[data-urn*="urn:li:activity"]',
  ],

  // Secondary: Semantic class-based selectors (feed + profile activity)
  POST_CONTAINERS_FALLBACK: [
    '.feed-shared-update-v2',
    '.occludable-update',
    '.profile-creator-shared-feed-update__container',
    '.pv-recent-activity-section__feed-container > div',
  ],

  // Tertiary: Structural selectors (least stable)
  POST_CONTAINERS_STRUCTURAL: [
    '.scaffold-finite-scroll__content > div',
  ],

  // Post text content selectors (feed + profile + detail views)
  POST_TEXT: [
    '.feed-shared-update-v2__description',
    '.feed-shared-text',
    '.break-words',
    '[data-test-id="main-feed-activity-content"]',
    '.update-components-text',
    '.feed-shared-inline-show-more-text',
    '.update-components-text__text-view',
  ],

  // Feed container (MutationObserver target — feed + profile sections)
  FEED_CONTAINER: [
    '.scaffold-finite-scroll__content',
    'main.scaffold-layout__main',
    '.pv-recent-activity-section__feed-container',
    '.profile-creator-shared-feed-update__container',
    '#main',
  ],

  getAllPostSelector() {
    return [
      ...this.POST_CONTAINERS,
      ...this.POST_CONTAINERS_FALLBACK,
      ...this.POST_CONTAINERS_STRUCTURAL,
    ].join(', ');
  },

  queryFirst(element, selectorArray) {
    for (const selector of selectorArray) {
      const result = element.querySelector(selector);
      if (result) return result;
    }
    return null;
  },

  queryAll(element, selectorArray) {
    const results = new Set();
    for (const selector of selectorArray) {
      element.querySelectorAll(selector).forEach(el => results.add(el));
    }
    return [...results];
  }
};
