import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inventoryFromCookies,
  sitesFromBookmarks,
} from "../extension/core/inventory.js";
import {
  cookieAppliesToUrl,
  cookieIdentity,
  webOrigin,
} from "../extension/helpers/sites.js";
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

test("inventory indexes repeated history hosts while preserving latest dates and known ports", () => {
  const sites = inventoryFromCookies(
    [cookie],
    [
      { id: "1", url: "https://example.test:8443/old", lastVisitTime: 10 },
      { id: "2", url: "https://example.test:8443/new", lastVisitTime: 30 },
      { id: "3", url: "http://example.test/plain", lastVisitTime: 20 },
    ],
    [
      {
        id: "saved",
        title: "Saved page",
        url: "https://example.test/saved?keep=yes",
        path: "Work",
      },
    ],
  );
  assert.equal(sites[0].lastVisit, 30);
  assert.deepEqual(sites[0].origins.sort(), [
    "http://example.test",
    "https://example.test",
    "https://example.test:8443",
  ]);
  assert.deepEqual(sites[0].urls, ["https://example.test/saved?keep=yes"]);
});

test("bookmark inventory distinguishes unread cookies from a successful empty read", () => {
  const bookmark = {
    id: "1",
    title: "Saved page",
    url: "https://example.test/page",
    path: "Work",
  };
  assert.equal(sitesFromBookmarks([bookmark])[0].cookiesAvailable, false);
  assert.equal(sitesFromBookmarks([bookmark], [])[0].cookiesAvailable, true);
  assert.equal(inventoryFromCookies([], [], []).length, 0);
});

test("same-host bookmark groups retain matching partition cookies in either URL-scheme order", () => {
  const partitioned: CookieRef = {
    name: "partitioned",
    domain: "third-party.test",
    hostOnly: true,
    path: "/",
    secure: true,
    storeId: "0",
    partitionKey: {
      topLevelSite: "https://example.test",
      hasCrossSiteAncestor: true,
    },
  };
  const httpsBookmark = {
    id: "https",
    title: "Secure page",
    url: "https://example.test/secure",
    path: "Work",
  };
  const httpBookmark = {
    id: "http",
    title: "Plain page",
    url: "http://example.test/plain",
    path: "Work",
  };
  for (const bookmarks of [
    [httpsBookmark, httpBookmark],
    [httpBookmark, httpsBookmark],
  ]) {
    const [site] = sitesFromBookmarks(bookmarks, [partitioned]);
    assert.deepEqual(
      site.bookmarks.map(({ id }) => id),
      bookmarks.map(({ id }) => id),
    );
    assert.deepEqual(site.cookies.map(({ name }) => name), ["partitioned"]);
  }
});

test("indexed bookmark cookie matching preserves host, domain, partition, identity, and invalid-URL semantics", () => {
  const bookmarks = [
    {
      id: "https-app",
      title: "Secure app",
      url: "https://app.example.test/secure",
      path: "Work",
    },
    {
      id: "http-app",
      title: "Plain app",
      url: "http://app.example.test/plain",
      path: "Work",
    },
    {
      id: "https-app-again",
      title: "Secure app again",
      url: "https://app.example.test/another-page",
      path: "Work",
    },
    {
      id: "api",
      title: "API",
      url: "https://api.example.test/v1",
      path: "Work",
    },
    { id: "settings", title: "Settings", url: "chrome://settings", path: "" },
    { id: "broken", title: "Broken", url: "not a URL", path: "" },
  ];
  const cookies: CookieRef[] = [
    { ...cookie, name: "host-only", domain: "app.example.test", hostOnly: true },
    { ...cookie, name: "domain", domain: ".example.test" },
    { ...cookie, name: "parent-domain", domain: ".test" },
    { ...cookie, name: "lookalike", domain: ".notexample.test" },
    {
      ...cookie,
      name: "https-partition-a",
      domain: "third-party.test",
      partitionKey: {
        topLevelSite: "https://example.test",
        hasCrossSiteAncestor: true,
      },
    },
    {
      ...cookie,
      name: "https-partition-b",
      domain: "fourth-party.test",
      partitionKey: {
        topLevelSite: "https://example.test",
        hasCrossSiteAncestor: false,
      },
    },
    {
      ...cookie,
      name: "http-partition",
      domain: "third-party.test",
      partitionKey: {
        topLevelSite: "http://example.test",
        hasCrossSiteAncestor: true,
      },
    },
    {
      ...cookie,
      name: "other-partition",
      domain: "third-party.test",
      partitionKey: {
        topLevelSite: "https://other.test",
        hasCrossSiteAncestor: true,
      },
    },
    {
      ...cookie,
      name: "invalid-partition",
      domain: "third-party.test",
      partitionKey: { topLevelSite: "not a URL" },
    },
  ];
  const sites = sitesFromBookmarks(bookmarks, cookies);

  for (const site of sites) {
    const expected = [
      ...new Map(
        site.bookmarks
          .flatMap((bookmark) =>
            cookies.filter((item) => cookieAppliesToUrl(item, bookmark.url)),
          )
          .map((item) => [cookieIdentity(item), item]),
      ).values(),
    ];
    assert.deepEqual(site.cookies, expected);
  }
  assert.deepEqual(
    sites.find((site) => site.id === "bookmark:settings")?.cookies,
    [],
  );
  assert.deepEqual(
    sites.find((site) => site.id === "bookmark:broken")?.cookies,
    [],
  );
});
