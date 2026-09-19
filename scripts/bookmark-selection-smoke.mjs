import assert from "node:assert/strict";
import { launch, pause } from "./browser-harness.mjs";

const browser = await launch({ grantTestPermissions: true });
let fixture;
try {
  const page = await browser.attach(
    `chrome-extension://${browser.id}/app.html#bookmarks`,
  );
  const run = (expression) => browser.evaluate(page.sessionId, expression);

  fixture = await run(`(async () => {
    const [root] = await chrome.bookmarks.getTree();
    const base = root.children.find((node) => !node.unmodifiable);
    if (!base) throw Error("No writable bookmark root is available.");
    const folder = await chrome.bookmarks.create({
      parentId: base.id,
      title: "Selection reset fixtures",
    });
    const empty = await chrome.bookmarks.create({
      parentId: base.id,
      title: "Empty selection fixture",
    });
    const first = await chrome.bookmarks.create({
      parentId: folder.id,
      title: "Selection reset first",
      url: "https://selection-reset-first.example.test/",
    });
    const second = await chrome.bookmarks.create({
      parentId: folder.id,
      title: "Selection reset second",
      url: "https://selection-reset-second.example.test/",
    });
    return { folder: folder.id, empty: empty.id, first: first.id, second: second.id };
  })()`);

  await browser.cmd("Page.reload", {}, page.sessionId);
  await pause(300);
  await run(`(() => {
    for (let index = 0; index < 20; index++) {
      const next = Array.from(document.querySelectorAll('.folder-toggle')).find(
        (button) => button.textContent !== 'Selection reset fixtures' && button.getAttribute('aria-expanded') === 'false',
      );
      if (!next) break;
      next.click();
    }
  })()`);
  await pause(300);

  await run(`document.querySelector('input[aria-label="Select Selection reset fixtures"]').click()`);
  await run(`document.querySelector('input[aria-label="Select Empty selection fixture"]').click()`);
  assert.equal(
    await run(`document.querySelector('.selection-count').textContent`),
    "3 selected",
    "Collapsed and empty-folder selections are counted",
  );
  assert.equal(
    await run(`document.querySelector('[aria-label="Clear selection"]').hidden`),
    false,
    "Clear selection is visible when useful",
  );

  await run(`Array.from(document.querySelectorAll('.folder-toggle')).find((button) => button.textContent === 'Selection reset fixtures').click()`);
  await pause(250);
  await run(`document.querySelector('input[aria-label="Select Selection reset first"]').click()`);
  assert.equal(
    await run(`document.querySelector('input[aria-label="Select Selection reset fixtures"]').indeterminate`),
    true,
    "A partially selected folder is mixed",
  );
  await run(`document.querySelector('button[data-focus-key="bookmark:${fixture.second}"]').click()`);
  await pause(180);
  const inspectionKey = await run(`document.querySelector('.details-drawer').dataset.inspectionKey`);

  await run(`document.querySelector('[aria-label="Clear selection"]').click()`);
  assert.equal(
    await run(`document.querySelector('.selection-count').hidden`),
    true,
    "The selection count hides after clearing",
  );
  assert.equal(
    await run(`Array.from(document.querySelectorAll('.toolbar button')).find((button) => button.textContent === 'Review cleanup').disabled`),
    true,
    "Review cleanup is disabled after clearing",
  );
  assert.equal(
    await run(`(() => {
      const folder = document.querySelector('input[aria-label="Select Selection reset fixtures"]');
      const empty = document.querySelector('input[aria-label="Select Empty selection fixture"]');
      return !folder.checked && !folder.indeterminate && !empty.checked;
    })()`),
    true,
    "Clear resets selected descendants, mixed parents and empty folders",
  );
  assert.equal(
    await run(`document.querySelector('.details-drawer').dataset.inspectionKey`),
    inspectionKey,
    "Clearing selection preserves inspection",
  );
  console.log("Bookmark selection: clear resets collapsed descendants, mixed parents and empty folders.");
} finally {
  await browser.close();
}
