import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { scanSites } from "../extension/browser/site-data.js";
import type { ScanResult } from "../extension/core/types.js";

const originalChrome = globalThis.chrome;
afterEach(() => {
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: originalChrome,
  });
});

test("site scan emits basic cookie and bookmark inventory before history enrichment", async () => {
  let finishHistory!: (items: chrome.history.HistoryItem[]) => void;
  const history = new Promise<chrome.history.HistoryItem[]>((resolve) => {
    finishHistory = resolve;
  });
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      permissions: { contains: async () => true },
      cookies: {
        getAllCookieStores: async () => [{ id: "0", tabIds: [] }],
        getAll: async () => [
          {
            name: "session",
            domain: ".example.test",
            hostOnly: false,
            path: "/",
            secure: true,
            httpOnly: false,
            session: true,
            storeId: "0",
          },
        ],
      },
      bookmarks: {
        getTree: async () => [
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
                    id: "saved",
                    parentId: "1",
                    title: "Saved",
                    url: "https://example.test/saved",
                    syncing: false,
                  },
                ],
              },
            ],
          },
        ],
      },
      history: { search: async () => history },
    },
  });
  let receiveBasic!: (result: ScanResult) => void;
  const basicReceived = new Promise<ScanResult>((resolve) => {
    receiveBasic = resolve;
  });
  const finalPending = scanSites(receiveBasic);
  const basic = await basicReceived;
  assert.equal(basic.sites[0].cookiesAvailable, true);
  assert.equal(basic.sites[0].lastVisit, undefined);
  assert.deepEqual(basic.sites[0].urls, ["https://example.test/saved"]);

  finishHistory([
    {
      id: "visit",
      url: "https://example.test:8443/visited",
      lastVisitTime: 42,
    },
  ]);
  const enriched = await finalPending;
  assert.equal(enriched.sites[0].lastVisit, 42);
  assert.equal(
    enriched.sites[0].origins.includes("https://example.test:8443"),
    true,
  );
});
