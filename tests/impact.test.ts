import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeImpact, withBookmarkRemovals } from "../extension/core/impact.js";
import type {
  BookmarkRef,
  CleanupOptions,
  SiteRecord,
} from "../extension/core/types.js";

const selected: BookmarkRef = {
  id: "a",
  title: "Selected",
  url: "https://example.test/a?view=full#top",
  path: "Work",
};
const target: SiteRecord = {
  id: "example.test",
  host: "example.test",
  origins: ["https://example.test"],
  urls: [selected.url],
  cookies: [],
  bookmarks: [selected],
};
const allBookmarks: BookmarkRef[] = [
  selected,
  {
    id: "b",
    title: "Exact copy",
    url: "https://example.test/a?view=full#top",
    path: "Reading",
  },
  {
    id: "c",
    title: "Different page",
    url: "https://example.test/a?view=compact#top",
    path: "Personal",
  },
  {
    id: "d",
    title: "Lookalike",
    url: "https://notexample.test/a?view=full#top",
    path: "Elsewhere",
  },
];

test("impact keeps exact URL copies separate from same-origin saved pages", () => {
  const result = analyzeImpact([target], allBookmarks);
  assert.deepEqual(
    result.duplicates.map(({ id, path }) => ({ id, path })),
    [{ id: "b", path: "Reading" }],
  );
  assert.deepEqual(result.relatedBookmarks.map(({ id }) => id), ["c"]);
});

test("bookmark-only impact has copies but no website-data relationships", () => {
  const bookmarkOnly: CleanupOptions = {
    cookies: false,
    savedData: false,
    cache: false,
    workers: false,
    bookmarks: true,
  };
  const result = analyzeImpact([target], allBookmarks, [], bookmarkOnly);
  assert.deepEqual(result.duplicates.map(({ id }) => id), ["b"]);
  assert.deepEqual(result.relatedBookmarks, []);
  assert.deepEqual(result.relatedSites, []);
});

test("cookie impact includes parent-domain and partition scopes but isolates lookalikes", () => {
  const cookieTarget: SiteRecord = {
    ...target,
    cookies: [
      {
        name: "parent",
        domain: ".example.test",
        path: "/",
        secure: true,
        storeId: "0",
      },
      {
        name: "partitioned",
        domain: "third-party.test",
        path: "/",
        secure: true,
        storeId: "0",
        partitionKey: {
          topLevelSite: "https://example.test",
          hasCrossSiteAncestor: true,
        },
      },
    ],
  };
  const bookmarks: BookmarkRef[] = [
    selected,
    {
      id: "sub",
      title: "App",
      url: "https://app.example.test/account",
      path: "Apps",
    },
    {
      id: "lookalike",
      title: "Other",
      url: "https://notexample.test/account",
      path: "Other",
    },
  ];
  const detectedSites: SiteRecord[] = [
    cookieTarget,
    {
      id: "app.example.test",
      host: "app.example.test",
      origins: ["https://app.example.test"],
      urls: [],
      cookies: [],
      bookmarks: [],
    },
    {
      id: "notexample.test",
      host: "notexample.test",
      origins: ["https://notexample.test"],
      urls: [],
      cookies: [],
      bookmarks: [],
    },
  ];
  const result = analyzeImpact([cookieTarget], bookmarks, detectedSites);
  assert.deepEqual(result.relatedBookmarks.map(({ id }) => id), ["sub"]);
  assert.deepEqual(result.relatedSites.map(({ id }) => id), [
    "app.example.test",
  ]);
});

test("selected bookmark and site IDs never appear in related results", () => {
  const result = analyzeImpact(
    [target],
    [selected, { ...selected, id: "copy" }],
    [{ ...target, bookmarks: [] }],
  );
  assert.deepEqual(result.duplicates.map(({ id }) => id), ["copy"]);
  assert.deepEqual(result.relatedSites, []);
});

test("explicit saved-data options do not report cookie-only domain effects", () => {
  const scopedTarget: SiteRecord = {
    ...target,
    cookies: [
      {
        name: "parent",
        domain: ".example.test",
        path: "/",
        secure: true,
        storeId: "0",
      },
    ],
  };
  const sameOrigin = {
    id: "same-origin",
    title: "Same origin",
    url: "https://example.test/other",
    path: "Work",
  };
  const cookieOnly = {
    id: "cookie-scope",
    title: "Sibling host",
    url: "https://app.example.test/other",
    path: "Work",
  };
  const savedDataOnly: CleanupOptions = {
    cookies: false,
    savedData: true,
    cache: false,
    workers: false,
    bookmarks: false,
  };
  const result = analyzeImpact(
    [scopedTarget],
    [selected, sameOrigin, cookieOnly],
    [],
    savedDataOnly,
  );
  assert.deepEqual(result.relatedBookmarks.map(({ id }) => id), [
    "same-origin",
  ]);
});

test("cookie-only impact keeps host-only cookies on their exact host", () => {
  const hostOnlyTarget: SiteRecord = {
    ...target,
    origins: [],
    cookies: [
      {
        name: "host-only",
        domain: "example.test",
        hostOnly: true,
        path: "/",
        secure: true,
        storeId: "0",
      },
    ],
  };
  const cookieOnly: CleanupOptions = {
    cookies: true,
    savedData: false,
    cache: false,
    workers: false,
    bookmarks: false,
  };
  const exactHost = {
    id: "exact-host",
    title: "Exact host",
    url: "https://example.test/account",
    path: "Work",
  };
  const subdomain = {
    id: "subdomain",
    title: "Subdomain",
    url: "https://app.example.test/account",
    path: "Work",
  };
  const result = analyzeImpact(
    [hostOnlyTarget],
    [selected, exactHost, subdomain],
    [],
    cookieOnly,
  );
  assert.deepEqual(result.relatedBookmarks.map(({ id }) => id), [
    "exact-host",
  ]);
});

test("cookie-only impact uses the domain prefix when hostOnly metadata is absent", () => {
  const legacyDomainTarget: SiteRecord = {
    ...target,
    origins: [],
    cookies: [
      {
        name: "legacy-domain",
        domain: ".example.test",
        path: "/",
        secure: true,
        storeId: "0",
      },
    ],
  };
  const cookieOnly: CleanupOptions = {
    cookies: true,
    savedData: false,
    cache: false,
    workers: false,
    bookmarks: false,
  };
  const subdomain = {
    id: "subdomain",
    title: "Subdomain",
    url: "https://app.example.test/account",
    path: "Work",
  };
  const result = analyzeImpact(
    [legacyDomainTarget],
    [selected, subdomain],
    [],
    cookieOnly,
  );
  assert.deepEqual(result.relatedBookmarks.map(({ id }) => id), [
    "subdomain",
  ]);
});

test("partition impact preserves the top-level site scheme", () => {
  const partitionTarget: SiteRecord = {
    ...target,
    origins: [],
    cookies: [
      {
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
      },
    ],
  };
  const cookieOnly: CleanupOptions = {
    cookies: true,
    savedData: false,
    cache: false,
    workers: false,
    bookmarks: false,
  };
  const httpsBookmark = {
    id: "https-partition",
    title: "HTTPS partition",
    url: "https://app.example.test/account",
    path: "Work",
  };
  const httpBookmark = {
    id: "http-partition",
    title: "HTTP partition",
    url: "http://app.example.test/account",
    path: "Work",
  };
  const httpsSite: SiteRecord = {
    id: "https-site",
    host: "app.example.test",
    origins: ["https://app.example.test"],
    urls: [],
    cookies: [],
    bookmarks: [],
  };
  const httpSite: SiteRecord = {
    id: "http-site",
    host: "app.example.test",
    origins: ["http://app.example.test"],
    urls: [],
    cookies: [],
    bookmarks: [],
  };
  const result = analyzeImpact(
    [partitionTarget],
    [selected, httpsBookmark, httpBookmark],
    [httpsSite, httpSite],
    cookieOnly,
  );
  assert.deepEqual(result.relatedBookmarks.map(({ id }) => id), [
    "https-partition",
  ]);
  assert.deepEqual(result.relatedSites.map(({ id }) => id), ["https-site"]);
});


test("explicit affected removals never widen website data and reject managed or unrelated extras", () => {
  const related = { id: "sub", title: "Related", url: "https://app.example.test/private", path: "Work" };
  const managed = { ...related, id: "managed", unmodifiable: true };
  const parent = { ...target, cookies: [{ name: "session", domain: ".example.test", path: "/", storeId: "0", secure: true }] };
  const options: CleanupOptions = { cookies: true, savedData: true, cache: true, workers: true, bookmarks: true };
  const inventory = [...allBookmarks, related, managed];
  const result = withBookmarkRemovals([parent], inventory, options, new Set(["sub", "managed", "d"]));
  assert.deepEqual(result[0].bookmarks.map(b => b.id), ["a", "sub"]);
  assert.deepEqual(result[0].origins, parent.origins);
  assert.deepEqual(result[0].cookies, parent.cookies);
  assert.deepEqual(result[0].urls, parent.urls);
  assert.deepEqual(parent.bookmarks.map(b => b.id), ["a"], "Preparation does not mutate the base targets");
  assert.deepEqual(withBookmarkRemovals([parent], inventory, { ...options, bookmarks: false }, new Set(["sub"]))[0].bookmarks, []);
  assert.deepEqual(withBookmarkRemovals([{ ...parent, cookies: [] }], inventory, options, new Set(["sub"]))[0].bookmarks.map(b => b.id), ["a"], "Stale cookie-only relationship cannot authorize removal");
  const bookmarkOnly = { cookies: false, savedData: false, cache: false, workers: false, bookmarks: true };
  assert.deepEqual(withBookmarkRemovals([parent], inventory, bookmarkOnly, new Set(["sub", "b"]))[0].bookmarks.map(b => b.id), ["a", "b"], "Only exact copies remain eligible when data cleanup is off");
});
