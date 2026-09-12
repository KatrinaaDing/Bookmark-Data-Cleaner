import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeImpact } from "../extension/core/impact.js";
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
