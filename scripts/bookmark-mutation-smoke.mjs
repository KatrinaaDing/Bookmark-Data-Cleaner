import assert from "node:assert/strict";
import { launch } from "./browser-harness.mjs";

const browser = await launch();
try {
  const page = await browser.attach(`chrome-extension://${browser.id}/app.html`);
  const result = await browser.evaluate(
    page.sessionId,
    `(async () => {
      const bookmarks = await import('./browser/bookmarks.js');
      const [root] = await chrome.bookmarks.getTree();
      const base = root.children.find((node) => !node.unmodifiable);
      if (!base) throw Error('No writable bookmark root is available.');
      const source = await chrome.bookmarks.create({
        parentId: base.id,
        title: 'Bookmark Cleaner mutation source',
      });
      const destination = await chrome.bookmarks.create({
        parentId: base.id,
        title: 'Bookmark Cleaner mutation destination',
      });
      try {
        const created = await bookmarks.saveBookmark(
          'Created title',
          'https://mutation.example.test/original',
          source.id,
        );
        const updated = await bookmarks.updateBookmark(created.id, {
          title: 'Updated title',
          url: 'https://mutation.example.test/updated?kept=yes',
          parentId: destination.id,
        });
        const inventory = await bookmarks.readBookmarks();
        const saved = inventory.bookmarks.find((item) => item.id === created.id);
        let invalidRejected = false;
        try {
          await bookmarks.updateBookmark(created.id, {
            title: 'Invalid',
            url: 'javascript:alert(1)',
            parentId: destination.id,
          });
        } catch {
          invalidRejected = true;
        }
        await chrome.bookmarks.remove(created.id);
        return {
          createdId: created.id,
          updatedId: updated.id,
          title: saved?.title,
          url: saved?.url,
          parentId: saved?.parentId,
          destinationId: destination.id,
          path: saved?.path,
          invalidRejected,
        };
      } finally {
        await chrome.bookmarks.remove(source.id).catch(() => {});
        await chrome.bookmarks.remove(destination.id).catch(() => {});
      }
    })()`,
  );
  assert.equal(result.updatedId, result.createdId);
  assert.equal(result.title, "Updated title");
  assert.equal(result.url, "https://mutation.example.test/updated?kept=yes");
  assert.equal(result.parentId, result.destinationId);
  assert.match(result.path, /Bookmark Cleaner mutation destination$/);
  assert.equal(result.invalidRejected, true);
  console.log(
    "Browser bookmarks: create, update, move, metadata refresh and URL rejection passed in a disposable profile.",
  );
} finally {
  await browser.close();
}
