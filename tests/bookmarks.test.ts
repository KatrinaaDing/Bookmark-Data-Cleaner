import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  readBookmarks,
  saveBookmark,
  updateBookmark,
} from "../extension/browser/bookmarks.js";

const originalChrome = globalThis.chrome;
afterEach(() => {
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: originalChrome,
  });
});

function installBookmarks(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
  const byId = new Map<string, chrome.bookmarks.BookmarkTreeNode>();
  function collect(items: chrome.bookmarks.BookmarkTreeNode[]) {
    for (const item of items) {
      byId.set(item.id, item);
      collect(item.children ?? []);
    }
  }
  collect(nodes);
  const api = {
    getTree: async () => nodes,
    get: async (id: string | string[]) =>
      (Array.isArray(id) ? id : [id])
        .map((value) => byId.get(value))
        .filter((value): value is chrome.bookmarks.BookmarkTreeNode => !!value),
    create: async (details: chrome.bookmarks.CreateDetails) => {
      const created: chrome.bookmarks.BookmarkTreeNode = {
        id: "created",
        parentId: details.parentId ?? "1",
        title: details.title ?? "",
        url: details.url,
        syncing: false,
      };
      byId.set(created.id, created);
      return created;
    },
    update: async (
      id: string,
      changes: chrome.bookmarks.UpdateChanges,
    ) => {
      const node = byId.get(id)!;
      Object.assign(node, changes);
      return node;
    },
    move: async (id: string, destination: chrome.bookmarks.MoveDestination) => {
      const node = byId.get(id)!;
      node.parentId = destination.parentId;
      return node;
    },
  };
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: { bookmarks: api },
  });
}

function fixtureTree(): chrome.bookmarks.BookmarkTreeNode[] {
  return [
    {
      id: "0",
      title: "",
      syncing: false,
      children: [
        {
          id: "1",
          parentId: "0",
          title: "Bookmarks bar",
          syncing: false,
          children: [
            {
              id: "10",
              parentId: "1",
              title: "Work",
              syncing: false,
              children: [
                {
                  id: "saved",
                  parentId: "10",
                  index: 2,
                  title: "Saved",
                  url: "https://example.test/page",
                  dateAdded: 10,
                  dateLastUsed: 20,
                  syncing: false,
                },
              ],
            },
            {
              id: "20",
              parentId: "1",
              title: "Managed",
              unmodifiable: "managed",
              syncing: false,
              children: [
                {
                  id: "21",
                  parentId: "20",
                  title: "Child",
                  syncing: false,
                  children: [
                    {
                      id: "managed-saved",
                      parentId: "21",
                      title: "Managed saved",
                      url: "https://managed.test/",
                      syncing: false,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}

test("bookmark reads include folder breadcrumbs, metadata, and inherited protection", async () => {
  installBookmarks(fixtureTree());
  const result = await readBookmarks();
  assert.deepEqual(result.folders, [
    { id: "1", title: "Bookmarks bar", path: "Bookmarks bar" },
    { id: "10", title: "Work", path: "Bookmarks bar / Work" },
    {
      id: "20",
      title: "Managed",
      path: "Bookmarks bar / Managed",
      unmodifiable: true,
    },
    {
      id: "21",
      title: "Child",
      path: "Bookmarks bar / Managed / Child",
      unmodifiable: true,
    },
  ]);
  assert.deepEqual(result.bookmarks, [
    {
      id: "saved",
      title: "Saved",
      url: "https://example.test/page",
      path: "Bookmarks bar / Work",
      parentId: "10",
      index: 2,
      dateAdded: 10,
      dateLastUsed: 20,
    },
    {
      id: "managed-saved",
      title: "Managed saved",
      url: "https://managed.test/",
      path: "Bookmarks bar / Managed / Child",
      parentId: "21",
      unmodifiable: true,
    },
  ]);
});

test("bookmark save validates an explicit destination and returns the created node", async () => {
  installBookmarks(fixtureTree());
  const created = await saveBookmark(
    "New",
    "https://example.test/new",
    "10",
  );
  assert.equal(created.id, "created");
  assert.equal(created.parentId, "10");
  await assert.rejects(
    saveBookmark("Bad", "javascript:alert(1)", "10"),
    /HTTP or HTTPS/,
  );
  await assert.rejects(
    saveBookmark("Managed", "https://example.test/", "21"),
    /managed/i,
  );
  await assert.rejects(
    saveBookmark("Missing", "https://example.test/", ""),
    /could not be found/i,
  );
});

test("bookmark update preserves identity, moves folders, and rejects protected sources", async () => {
  installBookmarks(fixtureTree());
  const updated = await updateBookmark("saved", {
    title: "Renamed",
    url: "https://example.test/renamed",
    parentId: "1",
  });
  assert.equal(updated.id, "saved");
  assert.equal(updated.title, "Renamed");
  assert.equal(updated.url, "https://example.test/renamed");
  assert.equal(updated.parentId, "1");
  await assert.rejects(
    updateBookmark("managed-saved", {
      title: "Nope",
      url: "https://managed.test/changed",
      parentId: "1",
    }),
    /managed/i,
  );
});
