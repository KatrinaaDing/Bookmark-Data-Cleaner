import { test } from "node:test";
import assert from "node:assert/strict";
import { inventoryFromCookies } from "../extension/core/inventory.js";
import { webOrigin, cookieIdentity } from "../extension/helpers/sites.js";
import type { CookieRef } from "../extension/core/types.js";
const cookie: CookieRef = {
  name: "session",
  domain: ".example.test",
  path: "/",
  secure: true,
  storeId: "0",
};
test("normalizes web origins without changing scheme, port, or matching lookalike domains", () => {
  assert.equal(
    webOrigin("https://EXAMPLE.test:8443/path?q=1"),
    "https://example.test:8443",
  );
  assert.equal(webOrigin("chrome://settings"), undefined);
  const sites = inventoryFromCookies(
    [cookie],
    [{ id: "1", url: "https://notexample.test/", lastVisitTime: 99 }],
    [],
  );
  assert.equal(sites[0].lastVisit, undefined);
});
test("inventory is data first, preserves unknown history and uses latest matching visit", () => {
  const sites = inventoryFromCookies(
    [cookie, { ...cookie, domain: "orphan.test" }],
    [
      { id: "1", url: "https://example.test/a", lastVisitTime: 10 },
      { id: "2", url: "https://example.test/b", lastVisitTime: 20 },
      { id: "3", url: "https://history-only.test/", lastVisitTime: 30 },
    ],
    [],
  );
  assert.deepEqual(sites.map((s) => s.host).sort(), [
    "example.test",
    "orphan.test",
  ]);
  assert.equal(sites.find((s) => s.host === "example.test")?.lastVisit, 20);
  assert.equal(
    sites.find((s) => s.host === "orphan.test")?.lastVisit,
    undefined,
  );
});
test("partitioned cookie belongs to its top-level site and keeps distinct partition identities", () => {
  const first = {
    ...cookie,
    partitionKey: {
      topLevelSite: "https://parent.test",
      hasCrossSiteAncestor: true,
    },
  };
  const second = {
    ...cookie,
    partitionKey: {
      topLevelSite: "https://other.test",
      hasCrossSiteAncestor: true,
    },
  };
  assert.notEqual(cookieIdentity(first), cookieIdentity(second));
  const sites = inventoryFromCookies([first, second], [], []);
  assert.deepEqual(sites.map((s) => s.host).sort(), [
    "other.test",
    "parent.test",
  ]);
  assert.equal(sites.find((s) => s.host === "parent.test")?.cookies.length, 1);
});

test("bookmarked subdomain includes cookies partitioned under its registrable top-level site", async () => {
  const { sitesFromBookmarks } = await import("../extension/core/inventory.js");
  const sites = sitesFromBookmarks(
    [{ id: "1", title: "App", url: "https://app.example.test/", path: "" }],
    [
      {
        ...cookie,
        domain: "third.test",
        partitionKey: {
          topLevelSite: "https://example.test",
          hasCrossSiteAncestor: true,
        },
      },
    ],
  );
  assert.equal(sites[0].cookies.length, 1);
});
