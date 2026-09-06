import assert from 'node:assert/strict';
import { launch, pause } from './browser-harness.mjs';
const browser = await launch();
try {
  const page = await browser.attach(`chrome-extension://${browser.id}/page.html`);
  await browser.evaluate(page.sessionId, `chrome.bookmarks.create({title:'Synthetic bookmark',url:'https://example.test/path'})`);
  await browser.cmd('Page.reload', {}, page.sessionId);
  await pause(600);
  assert.equal(await browser.evaluate(page.sessionId, `document.body.textContent.includes('Synthetic bookmark')`), true);
  assert.ok(await browser.evaluate(page.sessionId, `document.querySelectorAll('.folder').length`) > 0);
  await browser.evaluate(page.sessionId, `document.querySelector('.folder input').click()`);
  console.log('Legacy compiled app: folders, bookmark rendering and selection passed.');
} finally { await browser.close(); }
