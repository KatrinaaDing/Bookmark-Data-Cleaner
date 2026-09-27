import { test } from "node:test";
import assert from "node:assert/strict";
import { ancestorHosts, hostOf, parseWebUrl, webOrigin } from "../extension/helpers/url.js";
import { cookieOwner, describeCookieScope, isHostOnly } from "../extension/helpers/cookies.js";
import { getOrInsert, unique } from "../extension/helpers/collections.js";
import { plural } from "../extension/helpers/format.js";

test("web URL parsing accepts only HTTP and HTTPS", () => {
  assert.deepEqual(parseWebUrl("https://Example.test:8443/a?b"), {
    host: "example.test",
    origin: "https://example.test:8443",
    protocol: "https:",
  });
  assert.equal(parseWebUrl("file:///tmp/a"), undefined);
  assert.equal(parseWebUrl("not a url"), undefined);
  assert.equal(webOrigin("http://example.test/path"), "http://example.test");
  assert.equal(hostOf("chrome://settings"), undefined);
});

test("ancestor hosts walk from the host to its top-level label", () => {
  assert.deepEqual(ancestorHosts("a.b.test"), ["a.b.test", "b.test", "test"]);
  assert.deepEqual(ancestorHosts("localhost"), ["localhost"]);
});

test("cookie ownership follows domain or partition top-level site", () => {
  const base = { name: "n", path: "/", secure: true, storeId: "0" };
  assert.equal(cookieOwner({ ...base, domain: ".Example.test" }), "example.test");
  assert.equal(isHostOnly({ ...base, domain: ".example.test" }), false);
  assert.equal(isHostOnly({ ...base, domain: "example.test" }), true);
  const partitioned = { ...base, domain: "embed.test", partitionKey: { topLevelSite: "https://top.test" } };
  assert.equal(cookieOwner(partitioned), "top.test");
  assert.match(describeCookieScope(partitioned), /partition https:\/\/top\.test · cross-site ancestor: unknown$/);
});

test("collection and format helpers", () => {
  assert.deepEqual(unique([{ k: "a", v: 1 }, { k: "a", v: 2 }, { k: "b", v: 3 }], (item) => item.k), [{ k: "a", v: 2 }, { k: "b", v: 3 }]);
  const map = new Map<string, number[]>();
  getOrInsert(map, "x", () => []).push(1);
  getOrInsert(map, "x", () => []).push(2);
  assert.deepEqual(map.get("x"), [1, 2]);
  assert.equal(plural(1, "site"), "1 site");
  assert.equal(plural(2, "site"), "2 sites");
  assert.equal(plural(0, "empty folder removed", "empty folders removed"), "0 empty folders removed");
});
