import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCleanupPlan, executeCleanup } from "../extension/core/cleanup.js";
import { noCleanup, type SiteRecord } from "../extension/core/types.js";
const site = (id: string, bookmark = id): SiteRecord => ({
  id,
  host: id,
  origins: [`https://${id}`],
  urls: [],
  cookies: [],
  bookmarks: [{ id: bookmark, title: id, url: `https://${id}/page`, path: "" }],
});
test("rejects empty targets/categories and unsupported origins before deletion", () => {
  assert.throws(() => buildCleanupPlan([], { ...noCleanup, cache: true }));
  assert.throws(() => buildCleanupPlan([site("example.test")], noCleanup));
  assert.throws(() =>
    buildCleanupPlan(
      [{ ...site("example.test"), origins: ["file:///secret"] }],
      { ...noCleanup, cache: true },
    ),
  );
});
test("duplicate sites retain both bookmarks and freeze a snapshot of selection", () => {
  const a = site("example.test", "1"),
    b = site("example.test", "2");
  const plan = buildCleanupPlan([a, b], {
    ...noCleanup,
    cache: true,
    bookmarks: true,
  });
  a.origins.push("https://unrelated.test");
  assert.equal(plan.sites.length, 1);
  assert.deepEqual(plan.sites[0].origins, ["https://example.test"]);
  assert.deepEqual(
    plan.sites[0].bookmarks.map((b) => b.id),
    ["1", "2"],
  );
});
test("failed site cleanup preserves its bookmarks; unrelated success proceeds and folders are awaited deepest first", async () => {
  const calls: string[] = [];
  const plan = buildCleanupPlan(
    [site("fail.test", "1"), site("ok.test", "2")],
    { ...noCleanup, cache: true, bookmarks: true },
    [
      { id: "parent", depth: 0 },
      { id: "child", depth: 1 },
    ],
  );
  const result = await executeCleanup(plan, {
    removeData: async (s) => {
      calls.push(s.host);
      if (s.host === "fail.test") throw Error("Denied");
    },
    removeBookmark: async (id) => {
      calls.push(id);
    },
    removeFolder: async (id) => {
      calls.push(id);
    },
  });
  assert.deepEqual(calls, ["fail.test", "ok.test", "2", "child", "parent"]);
  assert.equal(result.filter((r) => r.status === "failed").length, 1);
  assert.equal(result.find((r) => r.target === "1")?.status, "unverified");
  assert.equal(result.find((r) => r.target === "1")?.retained, true);
  assert.equal(result.find((r) => r.target === "1")?.label, "fail.test");
  assert.equal(result.find((r) => r.target === "2")?.retained, undefined);
});
test("bookmark-only cleanup never calls browsing-data APIs", async () => {
  const calls: string[] = [];
  await executeCleanup(
    buildCleanupPlan([site("ok.test")], { ...noCleanup, bookmarks: true }),
    {
      removeData: async () => {
        throw Error("Must not call");
      },
      removeBookmark: async (id) => {
        calls.push(id);
      },
      removeFolder: async () => {},
    },
  );
  assert.deepEqual(calls, ["ok.test"]);
});

test("mixed-category failure reports each category and keeps dependent bookmarks", async () => {
  const calls: string[] = [];
  const result = await executeCleanup(
    buildCleanupPlan([site("example.test", "1")], {
      ...noCleanup,
      cookies: true,
      cache: true,
      bookmarks: true,
    }),
    {
      removeData: async (_, options) => {
        if (options.cookies) {
          calls.push("cookies");
        }
        if (options.cache) {
          calls.push("cache");
          throw Error("Cache failed");
        }
      },
      removeBookmark: async () => {
        calls.push("bookmark");
      },
      removeFolder: async () => {},
    },
  );
  assert.deepEqual(
    result.filter((o) => o.kind === "data").map((o) => o.status),
    ["completed", "failed"],
  );
  assert.deepEqual(calls, ["cookies", "cache"]);
});


test("a bookmark shared by multiple cleanup targets waits for every dependency and is removed once", async () => {
  for (const failedHost of ["first.test", "last.test", undefined]) {
    const calls: string[] = [];
    const result = await executeCleanup(buildCleanupPlan(
      [site("first.test", "shared"), site("last.test", "shared")],
      { ...noCleanup, cookies: true, bookmarks: true },
    ), {
      removeData: async target => { calls.push(target.host); if (target.host === failedHost) throw Error("Denied"); },
      removeBookmark: async id => { calls.push(id); },
      removeFolder: async () => {},
    });
    assert.deepEqual(calls, failedHost ? ["first.test", "last.test"] : ["first.test", "last.test", "shared"]);
    const bookmarks = result.filter(outcome => outcome.kind === "bookmark");
    assert.equal(bookmarks.length, 1);
    assert.equal(bookmarks[0].retained, failedHost ? true : undefined);
  }
});
