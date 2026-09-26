import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launch, pause } from "./browser-harness.mjs";

const browser = await launch({ grantTestPermissions: true });
try {
  const page = await browser.attach(
    `chrome-extension://${browser.id}/app.html#bookmarks`,
  );
  const run = (expression) => browser.evaluate(page.sessionId, expression);

  const fixtures = await run(`(async () => {
    const [root] = await chrome.bookmarks.getTree();
    const base = root.children.find((node) => !node.unmodifiable);
    const source = await chrome.bookmarks.create({ parentId: base.id, title: 'Detail source' });
    const destination = await chrome.bookmarks.create({ parentId: base.id, title: 'Detail destination' });
    const duplicateFolder = await chrome.bookmarks.create({ parentId: base.id, title: 'Duplicate folder' });
    const first = await chrome.bookmarks.create({ parentId: source.id, title: 'Primary detail bookmark', url: 'https://details.example.test/article?edition=1#notes' });
    const duplicate = await chrome.bookmarks.create({ parentId: duplicateFolder.id, title: 'Exact saved copy', url: first.url });
    const kept = await chrome.bookmarks.create({parentId:duplicateFolder.id,title:'Keep this duplicate',url:first.url});
    const related = await chrome.bookmarks.create({ parentId: source.id, title: 'Another page on this site', url: 'https://details.example.test/other' });
    const unrelated = await chrome.bookmarks.create({ parentId: source.id, title: 'Unrelated selected row', url: 'https://unrelated.example.test/keep' });
    await chrome.cookies.set({ url: 'https://details.example.test/', name: 'session', value: 'fixture' });
    return { source: source.id, destination: destination.id, duplicateFolder: duplicateFolder.id, first: first.id, duplicate: duplicate.id, kept: kept.id, related: related.id, unrelated: unrelated.id };
  })()`);

  await browser.cmd("Page.reload", {}, page.sessionId);
  await pause(300);
  await run(`document.querySelectorAll('.folder-toggle').forEach((button) => {
    if (button.getAttribute('aria-expanded') === 'false') button.click();
  })`);
  await pause(250);
  await run(`Array.from(document.querySelectorAll('.bookmark-row .row-title')).find((button) => button.textContent === 'Primary detail bookmark').click()`);
  await pause(250);

  assert.deepEqual(
    await run(`Array.from(document.querySelectorAll('.details-drawer .detail-card > h3')).map((heading) => heading.firstChild.textContent)`),
    ["Basic information", "Website data", "Bookmark"],
    "Details expose the three approved sections",
  );
  assert.match(
    await run(`document.querySelector('.details-drawer').textContent`),
    /Detail source/,
    "The saved folder is visible",
  );
  assert.equal(
    await run(`!!document.querySelector('.details-drawer .bookmark-edit-action')`),
    true,
    "Existing bookmarks have an edit and move form",
  );
  await run(`document.querySelector('.details-drawer [aria-label="Close details"]').click()`);
  await pause(280);
  await run(`location.hash = 'sites'`);
  await pause(500);
  await run(`Array.from(document.querySelectorAll('.site-row .row-title')).find((button) => button.textContent === 'details.example.test').click()`);
  await pause(150);
  assert.match(await run(`document.querySelector('.details-drawer').textContent`), /Primary detail bookmark/, "The site workspace has loaded bookmark context before the edit");
  await run(`location.hash = 'bookmarks'`);
  await pause(300);
  await run(`document.querySelectorAll('.folder-toggle').forEach((button) => { if (button.getAttribute('aria-expanded') === 'false') button.click(); })`);
  await run(`Array.from(document.querySelectorAll('.bookmark-row .row-title')).find((button) => button.textContent === 'Primary detail bookmark').click()`);
  await pause(150);

  const beforeCount = await run(`chrome.bookmarks.search({}).then((nodes) => nodes.filter((node) => node.url).length)`);
  await run(`document.querySelector('.bookmark-edit-action').click()`);
  await run(`(() => {
    const editor = document.querySelector('.details-drawer .edit-bookmark');
    const form = editor.querySelector('form');
    form.elements.title.value = 'Moved detail bookmark';
    form.elements.parentId.value = ${JSON.stringify(fixtures.destination)};
    form.requestSubmit();
  })()`);
  await pause(500);
  assert.deepEqual(
    await run(`chrome.bookmarks.get(${JSON.stringify(fixtures.first)}).then(([node]) => ({ id: node.id, title: node.title, parentId: node.parentId }))`),
    { id: fixtures.first, title: "Moved detail bookmark", parentId: fixtures.destination },
    "Editing and moving preserves the bookmark identity",
  );
  assert.equal(
    await run(`chrome.bookmarks.search({}).then((nodes) => nodes.filter((node) => node.url).length)`),
    beforeCount,
    "Editing does not create a new bookmark",
  );
  assert.match(
    await run(`document.querySelector('.details-drawer').textContent`),
    /Saved in.*Detail destination/,
    "The refreshed details show the actual destination",
  );
  await run(`location.hash = 'sites'`);
  await pause(550);
  await run(`Array.from(document.querySelectorAll('.site-row .row-title')).find((button) => button.textContent === 'details.example.test').click()`);
  await pause(150);
  assert.match(await run(`document.querySelector('.details-drawer').textContent`), /Moved detail bookmark/, "A previously loaded site workspace refreshes after bookmark mutation");
  await run(`location.hash = 'bookmarks'`);
  await pause(350);
  await run(`document.querySelectorAll('.folder-toggle').forEach((button) => { if (button.getAttribute('aria-expanded') === 'false') button.click(); })`);
  await run(`Array.from(document.querySelectorAll('.bookmark-row .row-title')).find((button) => button.textContent === 'Moved detail bookmark').click()`);
  await pause(150);

  await run(`document.querySelector('input[aria-label="Select Unrelated selected row"]').click()`);
  assert.equal(
    await run(`document.querySelector('input[aria-label="Select Unrelated selected row"]').checked`),
    true,
  );
  await run(`document.querySelector('.details-drawer .detail-cleanup').click()`);
  await pause(80);
  assert.equal(
    await run(`document.querySelectorAll('dialog.cleanup-dialog').length`),
    1,
    "Direct cleanup opens the shared review flow",
  );
  await run(`document.querySelectorAll('.cleanup-choice input').forEach(input=>{if(!input.closest('label').textContent.includes('Remove selected bookmarks') && input.checked)input.click()})`);
  await run(`Array.from(document.querySelectorAll('dialog.cleanup-dialog button')).find((button) => button.textContent === 'Next').click()`);
  await pause(180);
  assert.equal(
    await run(`document.querySelector('dialog.cleanup-dialog .related-warning') === null`),
    true,
    "Bookmark-only cleanup does not warn about website data",
  );
  assert.equal(
    await run(`document.querySelectorAll('dialog.cleanup-dialog .duplicate-choices input').length`),
    2,
    "Both duplicate entries are offered separately",
  );
  assert.equal(
    await run(`document.querySelector('dialog.cleanup-dialog .duplicate-choices input').checked`),
    true,
    "Additional duplicates start checked",
  );
  assert.equal(
    await run(`document.querySelector('dialog.cleanup-dialog').textContent.includes('Another page on this site')`),
    false,
    "A different page is not selected as a duplicate",
  );
  await run(`(() => {
    window.originalGetTree = chrome.bookmarks.getTree.bind(chrome.bookmarks);
    window.treeGate = new Promise((resolve) => { window.releaseTreeGate = resolve; });
    chrome.bookmarks.getTree = (...args) => window.treeGate.then(() => window.originalGetTree(...args));
    document.querySelector('dialog.cleanup-dialog .duplicate-choices input').click();
  })()`);
  assert.equal(
    await run(`Array.from(document.querySelectorAll('dialog.cleanup-dialog button')).find((button) => button.textContent === 'Confirm cleanup').disabled`),
    true,
    "Confirmation is disabled while the reviewed snapshot rebuilds",
  );
  await run(`window.releaseTreeGate(); chrome.bookmarks.getTree = window.originalGetTree`);
  await pause(180);
  assert.equal(
    await run(`document.querySelectorAll('dialog.cleanup-dialog .selected-bookmark').length`),
    1,
    "The original bookmark is listed once; the unchecked copy remains in its checklist",
  );
  await run(`Array.from(document.querySelectorAll('.cleanup-dialog button')).find(button=>button.textContent==='Back').click()`); await pause(80);
  await run(`Array.from(document.querySelectorAll('.cleanup-dialog button')).find(button=>button.textContent==='Next').click()`); await pause(150);
  assert.equal(await run(`document.querySelector('.duplicate-choices input').checked`),false,'Back/Next preserves a duplicate deselection');
  await run(`document.querySelector('.duplicate-choices input').click()`); await pause(150);
  assert.equal(await run(`document.querySelector('.duplicate-choices input').checked`),true);
  await run(`Array.from(document.querySelectorAll('.duplicate-choices label')).find(label=>label.textContent.includes('Keep this duplicate')).querySelector('input').click()`); await pause(150);
  await run(`Array.from(document.querySelectorAll('dialog.cleanup-dialog button')).find((button) => button.textContent === 'Confirm cleanup').click()`);
  for (let index = 0; index < 40; index++) {
    await pause(100);
    if (await run(`chrome.runtime.sendMessage({type:'get-job'}).then((response) => response.value?.status === 'finished')`)) break;
  }
  assert.equal(await run(`chrome.bookmarks.get(${JSON.stringify(fixtures.first)}).then(() => false, () => true)`), true);
  assert.equal(await run(`chrome.bookmarks.get(${JSON.stringify(fixtures.duplicate)}).then(() => false, () => true)`), true);
  assert.equal(await run(`chrome.bookmarks.get(${JSON.stringify(fixtures.related)}).then(() => true, () => false)`), true);
  assert.equal(await run(`chrome.bookmarks.get(${JSON.stringify(fixtures.kept)}).then(() => true, () => false)`), true, 'Explicitly unchecked duplicate survives cleanup');
  assert.equal(await run(`chrome.bookmarks.get(${JSON.stringify(fixtures.unrelated)}).then(() => true, () => false)`), true);
  assert.equal(await run(`chrome.bookmarks.get(${JSON.stringify(fixtures.duplicateFolder)}).then(() => true, () => false)`), true, "Adding a duplicate does not select its parent folder");
  await pause(1100);
  assert.equal(
    await run(`document.querySelector('input[aria-label="Select Unrelated selected row"]')?.checked`),
    true,
    "Direct cleanup preserves unrelated batch selection",
  );

  await run(`(async () => {
    const folder = await chrome.bookmarks.create({ title: 'Long detail list' });
    for (let index = 0; index < 40; index++)
      await chrome.bookmarks.create({ parentId: folder.id, title: 'Lower row ' + index, url: 'https://lower-' + index + '.example.test/page' });
  })()`);
  await run(`Array.from(document.querySelectorAll('section:not([hidden]) button')).find((button) => button.getAttribute('aria-label') === 'Refresh').click()`);
  await pause(500);
  await run(`document.querySelectorAll('.folder-toggle').forEach((button) => { if (button.getAttribute('aria-expanded') === 'false') button.click(); })`);
  await pause(250);
  await run(`(() => { const rows = document.querySelectorAll('.bookmark-row .row-title'); const target = rows[rows.length - 1]; target.scrollIntoView({block:'center'}); target.click(); })()`);
  await pause(250);
  const out = "dist/audit";
  await mkdir(out, { recursive: true });
  async function capture(name, width, height) {
    await browser.cmd("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await pause(250);
    const shot = await browser.cmd("Page.captureScreenshot", { format: "png" }, page.sessionId);
    await writeFile(`${out}/${name}.png`, Buffer.from(shot.data, "base64"));
  }
  await capture("details-scrolled-desktop.png", 1360, 900);
  assert.equal(
    await run(`(() => { const rect = document.querySelector('.details-drawer [aria-label="Close details"]').getBoundingClientRect(); return rect.bottom > 0 && rect.top < innerHeight; })()`),
    true,
    "Sticky detail controls stay in the viewport for a lower row",
  );
  await run(`window.scrollTo(0, 0)`);
  await capture("details-desktop.png", 1360, 900);
  await capture("details-narrow-modal.png", 390, 844);
  assert.equal(await run(`document.querySelector('.details-drawer').matches(':modal')`), true, "Narrow details use a native modal");
  assert.equal(await run(`document.querySelector('.details-drawer').dataset.inspectionKey.startsWith('bookmark:')`), true);
  await run(`document.querySelector('.details-drawer .detail-cleanup').click()`);
  await pause(80);
  assert.equal(await run(`document.querySelector('dialog.cleanup-dialog').matches(':modal')`), true, "Cleanup opens above narrow details");
  await run(`document.querySelector('dialog.cleanup-dialog').close()`);
  await browser.cmd("Emulation.setDeviceMetricsOverride", { width: 1360, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await pause(250);
  assert.equal(await run(`document.querySelector('.details-drawer').matches(':modal')`), false, "Resizing restores the desktop panel without losing it");
  await browser.cmd("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await pause(200);
  const focusKey = await run(`document.querySelector('.details-drawer').dataset.inspectionKey`);
  await run(`document.querySelector('.details-drawer [aria-label="Close details"]').click()`);
  await pause(100);
  assert.equal(await run(`document.activeElement.dataset.focusKey`), focusKey, "Closing the narrow modal returns focus to the refreshed source row");

  console.log("Bookmark management: edit identity, isolated reviewed cleanup, duplicate defaults and decisions, sticky details and responsive modal passed.");
} finally {
  await browser.close();
}

const deniedBrowser = await launch();
try {
  const page = await deniedBrowser.attach(
    `chrome-extension://${deniedBrowser.id}/app.html#bookmarks`,
  );
  const run = (expression) => deniedBrowser.evaluate(page.sessionId, expression);
  await run(`chrome.bookmarks.create({ title: 'No permission detail', url: 'https://unchecked.example.test/page' })`);
  await deniedBrowser.cmd("Page.reload", {}, page.sessionId);
  await pause(300);
  await run(`Array.from(document.querySelectorAll('.bookmark-row .row-title')).find((button) => button.textContent === 'No permission detail').click()`);
  await pause(150);
  assert.equal(
    await run(`Array.from(document.querySelectorAll('.detail-value')).some((row) => row.textContent.includes('Detected cookies') && row.textContent.includes('Not checked'))`),
    true,
    "Unavailable cookie access is reported as Not checked",
  );
} finally {
  await deniedBrowser.close();
}
