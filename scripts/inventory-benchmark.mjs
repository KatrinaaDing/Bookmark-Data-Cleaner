import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const warmups = 2;
const samples = 5;
const fixtureMode = process.argv[2] ?? "all";
if (!["all", "repeated", "distinct"].includes(fixtureMode))
  throw new Error("Usage: node scripts/inventory-benchmark.mjs [all|repeated|distinct]");

function parseWebUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return { host: url.hostname, origin: url.origin };
  } catch {
    return undefined;
  }
}

function oldBookmarkInventory(bookmarks, cookies, cookieAppliesToUrl, cookieIdentity) {
  const groups = new Map();
  for (const bookmark of bookmarks) {
    const location = parseWebUrl(bookmark.url);
    const origin = location?.origin;
    const host = location?.host;
    const id = host ?? `bookmark:${bookmark.id}`;
    let site = groups.get(id);
    if (!site) {
      site = {
        id,
        host: host ?? bookmark.title,
        origins: [],
        urls: [],
        cookies: [],
        bookmarks: [],
        cookiesAvailable: true,
      };
      groups.set(id, site);
    }
    site.bookmarks.push(bookmark);
    site.urls.push(bookmark.url);
    if (origin && host) {
      site.origins.push(origin, `https://${host}`, `http://${host}`);
      site.cookies.push(...cookies.filter((cookie) => cookieAppliesToUrl(cookie, bookmark.url)));
      site.lastVisit = undefined;
    }
  }
  return [...groups.values()].map((site) => ({
    ...site,
    origins: [...new Set(site.origins)],
    cookies: [...new Map(site.cookies.map((cookie) => [cookieIdentity(cookie), cookie])).values()],
  }));
}

function fixture(bookmarkCount, cookieCount, hostCount) {
  const host = (number) =>
    `app-${number % hostCount}.team-${number % 20}.region-${number % 5}.example.test`;
  const bookmarks = Array.from({ length: bookmarkCount }, (_, index) => {
    const scheme = index % 3 === 0 ? "http" : "https";
    const port = index % 11 === 0 ? ":8443" : "";
    return {
      id: `bookmark-${index}`,
      title: `App ${index % 80}`,
      url: `${scheme}://${host(index)}${port}/section/${index % 17}?variant=${index % 7}`,
      path: "Benchmark",
    };
  });
  const cookies = Array.from({ length: cookieCount }, (_, index) => {
    const group = index % 20;
    const base = {
      name: `cookie-${index}`,
      domain: `.team-${group}.region-${group % 5}.example.test`,
      path: "/",
      secure: index % 2 === 0,
      storeId: String(index % 3),
    };
    switch (index % 8) {
      case 0:
        return { ...base, domain: host(index), hostOnly: true };
      case 1:
        return base;
      case 2:
        return { ...base, domain: `.region-${group % 5}.example.test` };
      case 3:
        return { ...base, domain: ".example.test" };
      case 4:
        return {
          ...base,
          domain: "third-party.test",
          partitionKey: {
            topLevelSite: `https://team-${group}.region-${group % 5}.example.test`,
            hasCrossSiteAncestor: true,
          },
        };
      case 5:
        return {
          ...base,
          domain: "third-party.test",
          partitionKey: {
            topLevelSite: `http://team-${group}.region-${group % 5}.example.test`,
            hasCrossSiteAncestor: false,
          },
        };
      case 6:
        return { ...base, domain: `.unrelated-${group}.test` };
      default:
        return {
          ...base,
          domain: "third-party.test",
          partitionKey: {
            topLevelSite: `https://other-${group}.test`,
            hasCrossSiteAncestor: true,
          },
        };
    }
  });
  return { bookmarks, cookies };
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

function measure(run) {
  for (let index = 0; index < warmups; index += 1) run();
  const timings = [];
  for (let index = 0; index < samples; index += 1) {
    const start = performance.now();
    run();
    timings.push(performance.now() - start);
  }
  return median(timings);
}

const output = await mkdtemp(path.join(os.tmpdir(), "inventory-benchmark-"));
try {
  execFileSync(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      "-p",
      "tsconfig.test.json",
      "--outDir",
      output,
    ],
    { stdio: "inherit" },
  );
  const inventory = await import(
    pathToFileURL(path.join(output, "extension/core/inventory.js")).href,
  );
  const sites = await import(
    pathToFileURL(path.join(output, "extension/helpers/sites.js")).href,
  );

  console.log(`Node ${process.version}; V8 ${process.versions.v8}`);
  console.log("Browser: not profiled by this Node diagnostic.");
  console.log(`Warmups: ${warmups}; timed samples: ${samples}; median milliseconds.`);
  const scenarios = [
    ...(fixtureMode !== "distinct"
      ? [
          { bookmarkCount: 1_000, hostCount: 80, label: "repeated 80 hosts" },
          { bookmarkCount: 5_000, hostCount: 80, label: "repeated 80 hosts" },
        ]
      : []),
    ...(fixtureMode !== "repeated"
      ? [
          { bookmarkCount: 1_000, hostCount: 1_000, label: "distinct hosts" },
          { bookmarkCount: 5_000, hostCount: 5_000, label: "distinct hosts" },
        ]
      : []),
  ];
  for (const { bookmarkCount, hostCount, label } of scenarios) {
    const { bookmarks, cookies } = fixture(bookmarkCount, 5_000, hostCount);
    const baseline = () =>
      oldBookmarkInventory(
        bookmarks,
        cookies,
        sites.cookieAppliesToUrl,
        sites.cookieIdentity,
      );
    const indexed = () => inventory.sitesFromBookmarks(bookmarks, cookies);
    assert.deepEqual(indexed(), baseline());
    const baselineMs = measure(baseline);
    const indexedMs = measure(indexed);
    console.log(
      `${bookmarkCount.toLocaleString()} bookmarks x 5,000 cookies (${label}): baseline ${baselineMs.toFixed(1)} ms, indexed ${indexedMs.toFixed(1)} ms, ${(baselineMs / indexedMs).toFixed(1)}x`,
    );
  }
} finally {
  await rm(output, { recursive: true, force: true });
}
