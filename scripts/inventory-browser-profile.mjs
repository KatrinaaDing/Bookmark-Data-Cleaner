// Diagnostic only: synthetic adapter reads, real extension rendering in a disposable profile.
// Run after build with CHROME_BIN set. No timing assertion or personal data access.
import assert from "node:assert/strict";
import { launch } from "./browser-harness.mjs";

const browser = await launch({ grantTestPermissions: true });
try {
  const page = await browser.attach(`chrome-extension://${browser.id}/app.html`);
  await browser.cmd("Emulation.setDeviceMetricsOverride", { width: 1360, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  const result = await browser.evaluate(page.sessionId, `(async () => {
    const { bookmarksPage } = await import('./pages/bookmarks.js');
    const bookmarks = Array.from({ length: 5000 }, (_, index) => ({
      id: 'profile-' + index, parentId: '1', title: 'Saved page ' + index,
      url: 'https://site' + index + '.test/page',
    }));
    const cookies = bookmarks.map((bookmark, index) => ({
      name: 'session', domain: 'site' + index + '.test', hostOnly: true,
      path: '/', secure: true, httpOnly: false, storeId: '0',
    }));
    chrome.bookmarks.getTree = async () => [{ id: '0', title: '', children: [
      { id: '1', parentId: '0', title: 'Profile fixtures', children: bookmarks },
    ] }];
    chrome.cookies.getAllCookieStores = async () => [{ id: '0', tabIds: [] }];
    chrome.cookies.getAll = async () => cookies;
    chrome.permissions.contains = async () => true;
    chrome.history.search = async () => [];
    const workspace = bookmarksPage(() => {});
    document.getElementById('pages').replaceChildren(workspace.element);
    const started = performance.now();
    await workspace.load();
    const loadMs = performance.now() - started;
    const rows = document.querySelectorAll('.bookmark-row').length;
    const toggle = document.querySelector('.folder-toggle');
    const expansionStarted = performance.now();
    toggle.click();
    // Flush layout, then yield through a paint opportunity.
    document.querySelector('.bookmark-tree').getBoundingClientRect();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const expansionMs = performance.now() - expansionStarted;
    const inspectionStarted = performance.now();
    const first = document.querySelector('.bookmark-row .row-title');
    first.click();
    const inspectionMs = performance.now() - inspectionStarted;
    await new Promise(resolve => setTimeout(resolve, 300));
    const search = document.querySelector('input[aria-label="Find a bookmark"]');
    const searchSamples = [];
    for (const query of ['Saved page 4999', 'site123.test', 'Profile fixtures', 'no match', '']) {
      const start = performance.now();
      search.value = query;
      search.dispatchEvent(new Event('input', {bubbles:true}));
      document.querySelector('.workspace-list').getBoundingClientRect();
      searchSamples.push({query, milliseconds:performance.now()-start, matches:document.querySelectorAll('.bookmark-row').length});
    }
    return {
      searchSamples,
      userAgent: navigator.userAgent, fixture: { bookmarks: bookmarks.length, cookies: cookies.length },
      rows, loadMs, expansionMs, inspectionMs,
      inspected: document.querySelector('.details-drawer')?.dataset.inspectionKey,
      cookiesShown: Array.from(document.querySelectorAll('.detail-value')).find(row => row.textContent.includes('Detected cookies'))?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth,
      limitation: 'Synthetic immediate browser API reads. Load includes inventory and DOM creation; expansion includes layout and a paint opportunity, not the full animation. No real-profile I/O or CPU trace.',
    };
  })()`);
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.rows, 5000);
  assert.equal(result.inspected, "bookmark:profile-0");
  assert.equal(result.cookiesShown, "Detected cookies1");
  assert.equal(result.overflow, false);
} finally {
  await browser.close();
}
