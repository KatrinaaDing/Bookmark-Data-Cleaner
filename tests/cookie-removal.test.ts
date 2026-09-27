import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { cookieExpiry, removeSelectedCookies } from "../extension/browser/cookie-removal.js";
import { cookieIdentity } from "../extension/helpers/cookies.js";
import type { CookieRef } from "../extension/core/types.js";

const target: CookieRef = {
  name: "session", domain: "example.test", hostOnly: true, path: "/",
  secure: true, httpOnly: false, storeId: "0",
};
const originalChrome = globalThis.chrome;
afterEach(() => Object.defineProperty(globalThis, "chrome", { configurable: true, value: originalChrome }));

function mockCookies(initial: CookieRef[], beforeSet?: (jar: CookieRef[]) => void) {
  const jar = [...initial];
  const writes: chrome.cookies.SetDetails[] = [];
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: { cookies: {
      getAll: async () => [...jar],
      remove: () => { throw Error("URL/name removal must never be used"); },
      set: async (details: chrome.cookies.SetDetails) => {
        writes.push(details);
        beforeSet?.(jar);
        const identity: CookieRef = {
          ...target, name: details.name ?? "", domain: details.domain ?? new URL(details.url).hostname,
          path: details.path ?? "/", storeId: details.storeId ?? "0", partitionKey: details.partitionKey,
        };
        const index = jar.findIndex((cookie) => cookieIdentity(cookie) === cookieIdentity(identity));
        if (index >= 0) jar.splice(index, 1);
        return null;
      },
    } },
  });
  return { jar, writes };
}

test("expiry preserves domain/host scope, complete partition, store and prefix attributes", () => {
  const host = cookieExpiry({ ...target, name: "__Host-Http-session", httpOnly: true });
  assert.equal("domain" in host, false);
  assert.equal(host.secure, true);
  assert.equal(host.httpOnly, true);
  assert.equal(host.expirationDate, 1);
  const partitionKey = { topLevelSite: "https://example.test", hasCrossSiteAncestor: false };
  const domain = cookieExpiry({ ...target, domain: ".example.test", hostOnly: false, storeId: "1", partitionKey });
  assert.equal(domain.domain, ".example.test");
  assert.equal(domain.storeId, "1");
  assert.deepEqual(domain.partitionKey, partitionKey);
  assert.notEqual(domain.partitionKey, partitionKey);
});

test("paths that could expire a different canonical path are blocked", () => {
  for (const path of ["/a?b", "/a#b", "/a/../b", "/a/%2e%2e/b", "/a\\b", "/a b", "/a;b", "/é", "", "relative", "/a\tb"])
    assert.throws(() => cookieExpiry({ ...target, path }), /path would be normalized/);
  for (const path of ["/", "/a/b", "/a%3Fb", "/a%23b", "/a%20b", "/a%2Fb"])
    assert.equal(cookieExpiry({ ...target, path }).path, path);
});

test("incomplete or ambiguous scope metadata is refused", () => {
  for (const changes of [
    { hostOnly: undefined }, { httpOnly: undefined }, { storeId: "" },
    { domain: ".example.test" }, { domain: "example.test:443" }, { domain: "EXAMPLE.test" },
    { partitionKey: {} }, { partitionKey: { topLevelSite: "https://example.test" } },
    { partitionKey: { topLevelSite: "https://example.test/", hasCrossSiteAncestor: false } },
  ]) assert.throws(() => cookieExpiry({ ...target, ...changes }), /unsupported/);
});

test("names and prefix requirements that cannot be represented exactly refuse before writing", () => {
  for (const name of [" leading", "trailing ", "a=b", "a;b", "a\nb", "é"])
    assert.throws(() => cookieExpiry({ ...target, name }), /name cannot be represented/);
  for (const changes of [
    { name: "__Secure-session", secure: false },
    { name: "__Host-session", hostOnly: false, domain: ".example.test" },
    { name: "__Host-session", path: "/a" },
    { name: "__Http-session", httpOnly: false },
    { name: "__Host-Http-session", httpOnly: false },
  ]) assert.throws(() => cookieExpiry({ ...target, ...changes }), /prefix attributes/);
});

test("store and both partition-key components isolate otherwise identical targets", async () => {
  const partitionKey = { topLevelSite: "https://example.test", hasCrossSiteAncestor: false };
  const selected = { ...target, partitionKey };
  const neighbours = [
    target,
    { ...selected, storeId: "1" },
    { ...selected, partitionKey: { ...partitionKey, hasCrossSiteAncestor: true } },
    { ...selected, partitionKey: { ...partitionKey, topLevelSite: "https://other.test" } },
  ];
  const { jar, writes } = mockCookies([selected, ...neighbours]);
  await removeSelectedCookies([selected]);
  assert.deepEqual(jar, neighbours);
  assert.equal(writes.length, 1);
});

test("already absent target makes no mutation even with a same-name domain neighbour", async () => {
  const neighbour = { ...target, domain: ".example.test", hostOnly: false };
  const { jar, writes } = mockCookies([neighbour]);
  await removeSelectedCookies([target]);
  assert.deepEqual(jar, [neighbour]);
  assert.equal(writes.length, 0);
});

test("a cookie introduced after preflight survives exact expiry; repeated target is written once", async () => {
  const neighbour = { ...target, domain: ".example.test", hostOnly: false };
  const { jar, writes } = mockCookies([target], (cookies) => { cookies.push(neighbour); });
  await removeSelectedCookies([target, { ...target }]);
  assert.deepEqual(jar, [neighbour]);
  assert.equal(writes.length, 1);
});

test("all selected identities are validated before the first mutation", async () => {
  const { jar, writes } = mockCookies([target]);
  await assert.rejects(removeSelectedCookies([target, { ...target, path: "/a?b" }]), /unsupported/);
  assert.equal(writes.length, 0);
  assert.deepEqual(jar, [target]);
});

test("read or expiry failures and recreated identities fail without broad fallback or replay", async () => {
  let sets = 0;
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { cookies: {
    getAll: async () => [target], set: async () => { sets++; return null; },
  } } });
  await assert.rejects(removeSelectedCookies([target]), /remains or was recreated/);
  assert.equal(sets, 1);
});

test("inventory read failures prevent mutation; browser write failures are not retried", async () => {
  let writes = 0;
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { cookies: {
    getAll: async () => { throw Error("Cookie store is unavailable"); },
    set: async () => { writes++; },
  } } });
  await assert.rejects(removeSelectedCookies([target]), /store is unavailable/);
  assert.equal(writes, 0);
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { cookies: {
    getAll: async () => [target],
    set: async () => { writes++; throw Error("Cookie write denied"); },
  } } });
  await assert.rejects(removeSelectedCookies([target]), /write denied.*Bookmarks have been kept/);
  assert.equal(writes, 1);
});
