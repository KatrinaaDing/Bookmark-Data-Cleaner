// Destructive assertions use only synthetic cookies in the harness's disposable profile.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { launch } from "./browser-harness.mjs";

const rawPaths = [
  ["query", "/a?b", "/a%3Fb"],
  ["fragment", "/a#b", "/a%23b"],
  ["dot", "/a/../b", "/b"],
  ["space", "/a b", "/a%20b"],
  ["backslash", "/a\\b", "/a/b"],
];
const server = createServer((req, res) => {
  if (req.url === "/") res.setHeader("Set-Cookie", rawPaths.flatMap(([name, raw, canonical]) => [
    `${name}=raw; Path=${raw}`, `${name}=canonical; Path=${canonical}`,
  ]));
  res.end("Synthetic cookie path fixture");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await launch({ grantTestPermissions: true });
  await browser.attach(`http://127.0.0.1:${server.address().port}/`);
  const page = await browser.attach(`chrome-extension://${browser.id}/app.html`);
  const result = await browser.evaluate(page.sessionId, `(async () => {
    const { readCookies, scanSites, removeData } = await import('./browser/site-data.js');
    const { cookieIdentity } = await import('./helpers/cookies.js');
    const { noCleanup } = await import('./core/types.js');
    const outcomes = [];
    // set() returns a URL/name lookup result, which can be a neighbour. Read the
    // intended fixture back by exact attributes instead of trusting that result.
    const set = async details => {
      const requested = { value: 'fixture', secure: true, path: '/', ...details };
      await chrome.cookies.set(requested);
      if (requested.expirationDate === 1) return;
      const matches = (await chrome.cookies.getAll({partitionKey:{}})).filter(cookie =>
        cookie.name === requested.name && cookie.path === requested.path &&
        cookie.domain === (requested.domain ?? new URL(requested.url).hostname) &&
        cookie.hostOnly === !requested.domain &&
        (cookie.partitionKey?.topLevelSite ?? '') === (requested.partitionKey?.topLevelSite ?? '') &&
        cookie.partitionKey?.hasCrossSiteAncestor === requested.partitionKey?.hasCrossSiteAncestor);
      if (matches.length !== 1 || matches[0].value !== requested.value)
        throw Error('Fixture identity was not established: ' + JSON.stringify({requested,matches}));
      return matches[0];
    };
    const all = async () => (await chrome.cookies.getAll({ partitionKey: {} }))
      .filter(cookie => cookie.domain.endsWith('.test') || cookie.domain === '127.0.0.1')
      .sort((a, b) => cookieIdentity(a).localeCompare(cookieIdentity(b)));
    const same = (actual, expected, label) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw Error(label + ': ' + JSON.stringify({actual, expected}));
    };
    const site = cookies => ({ id: 'fixture', host: 'fixture.test', origins: ['https://fixture.test'], urls: [], bookmarks: [], cookies });
    async function removeAndAssert(label, targets, execute) {
      const before = await all();
      const ids = new Set(targets.map(cookieIdentity));
      await (execute ? execute() : removeData(site(targets), {...noCleanup, cookies: true}));
      same(await all(), before.filter(cookie => !ids.has(cookieIdentity(cookie))), label);
      outcomes.push(label);
    }
    {
      const url = 'https://host-collision.test/';
      await set({url, name:'session', domain:'.host-collision.test', value:'keep-domain'});
      const host = await set({url, name:'session', value:'target-host'});
      await removeAndAssert('host-only target preserves older domain identity', [host]);
    }
    {
      const url = 'https://domain-collision.test/';
      await set({url, name:'session', value:'keep-host'});
      const domain = await set({url, name:'session', domain:'.domain-collision.test', value:'target-domain'});
      await removeAndAssert('domain target preserves older host-only identity', [domain]);
    }
    {
      const url = 'https://child.parent-scope.test/';
      await set({url, name:'session', domain:'.parent-scope.test', value:'keep-parent'});
      const child = await set({url, name:'session', domain:'.child.parent-scope.test', value:'target-child'});
      await removeAndAssert('child domain preserves parent domain', [child]);
    }
    {
      const url = 'https://paths.test/';
      await set({url, name:'session', path:'/', value:'keep-root'});
      const selected = await set({url, name:'session', path:'/a', value:'target-path'});
      await set({url, name:'session', path:'/a/b', value:'keep-child'});
      await removeAndAssert('overlapping paths preserve both neighbours', [selected]);
    }
    {
      const url = 'https://absent.test/';
      await set({url, name:'session', domain:'.absent.test', value:'keep-domain'});
      const selected = await set({url, name:'session', value:'target-host'});
      await set({url, name:'session', expirationDate:1});
      await removeAndAssert('already absent target preserves matching neighbour', [selected]);
    }
    {
      const url = 'https://review-race.test/';
      await set({url, name:'session', value:'reviewed-host'});
      const reviewed = (await scanSites()).sites.find(site => site.host === 'review-race.test');
      await set({url, name:'session', domain:'.review-race.test', value:'introduced-after-review'});
      await removeAndAssert('real scan snapshot preserves identity added after review', reviewed.cookies,
        () => removeData(reviewed, {...noCleanup, cookies:true}));
    }
    {
      const url = 'https://write-race.test/';
      const selected = await set({url, name:'session', value:'reviewed-host'});
      const originalSet = chrome.cookies.set;
      let injected = false;
      chrome.cookies.set = async details => {
        if (details.expirationDate === 1 && !injected) {
          injected = true;
          await originalSet({url, name:'session', secure:true, path:'/', domain:'.write-race.test', value:'added-after-preflight'});
        }
        return originalSet(details);
      };
      try { await removeData(site([selected]), {...noCleanup, cookies:true}); }
      finally { chrome.cookies.set = originalSet; }
      same(injected, true, 'race hook ran');
      const remaining = (await all()).filter(c => c.domain.endsWith('write-race.test'));
      same(remaining.map(c => [c.domain, c.value]), [['.write-race.test','added-after-preflight']], 'write race');
      outcomes.push('identity introduced between preflight and write survives');
    }
    {
      const url = 'https://absent-write-race.test/';
      const selected = await set({url, name:'session'});
      const originalSet = chrome.cookies.set;
      let injected = false;
      chrome.cookies.set = async details => {
        if (details.expirationDate === 1 && !injected) {
          injected = true;
          await originalSet({url, name:'session', secure:true, path:'/', expirationDate:1});
          await originalSet({url, name:'session', secure:true, path:'/', domain:'.absent-write-race.test', value:'keep-new-domain'});
        }
        return originalSet(details);
      };
      try { await removeData(site([selected]), {...noCleanup, cookies:true}); }
      finally { chrome.cookies.set = originalSet; }
      same(injected, true, 'absent race hook ran');
      const remaining = (await all()).filter(c => c.domain.endsWith('absent-write-race.test'));
      same(remaining.map(c => [c.domain, c.value]), [['.absent-write-race.test','keep-new-domain']], 'absent write race');
      outcomes.push('target disappearing after preflight cannot redirect expiry to a new neighbour');
    }
    {
      const url = 'https://partitions.test/';
      const base = {url, name:'session'};
      await set({...base, value:'unpartitioned'});
      const selected = await set({...base, value:'same-site', partitionKey:{topLevelSite:'https://partitions.test',hasCrossSiteAncestor:false}});
      await set({...base, value:'cross-site', partitionKey:{topLevelSite:'https://partitions.test',hasCrossSiteAncestor:true}});
      await set({...base, value:'other-site', partitionKey:{topLevelSite:'https://other.test',hasCrossSiteAncestor:true}});
      await removeAndAssert('complete partition key preserves ancestor-bit and top-level-site siblings', [selected]);
    }
    {
      const url = 'https://duplicate.test/';
      const selected = await set({url, name:'session'});
      await set({url, name:'session', domain:'.duplicate.test', value:'keep-domain'});
      await removeAndAssert('duplicate identity across consecutive site requests is harmless', [selected], async () => {
        await removeData(site([selected, selected]), {...noCleanup, cookies:true});
        await removeData(site([selected]), {...noCleanup, cookies:true});
      });
    }
    {
      const url = 'https://insecure.test/';
      await set({url, name:'session', domain:'.insecure.test', value:'keep-secure'});
      const selected = await set({url, name:'session', secure:false, value:'target-nonsecure'});
      await removeAndAssert('non-Secure target preserves Secure neighbour', [selected]);
    }
    for (const name of ['__Host-session','__Secure-session','__Http-session','__Host-Http-session','']) {
      const selected = await set({url:'https://prefixes.test/', name, httpOnly:true});
      await removeAndAssert('prefix and HttpOnly expiry: ' + (name || '(empty name)'), [selected]);
    }
    for (const [name, raw, canonical] of ${JSON.stringify(rawPaths)}) {
      const matching = (await all()).filter(c => c.domain === '127.0.0.1' && c.name === name);
      same(matching.map(c => c.path).sort(), [raw, canonical].sort(), 'raw HTTP fixture ' + name);
      const before = await all();
      let message = '';
      try { await removeData(site([matching.find(c => c.path === raw)]), {...noCleanup, cookies:true}); }
      catch(error) { message = error.message; }
      if (!message.includes('path would be normalized')) throw Error('Expected path refusal: ' + name + ': ' + message);
      same(await all(), before, 'unsupported raw path preserves all cookies');
      outcomes.push('raw HTTP path safely refused: ' + name);
      await removeAndAssert('canonical path removal preserves raw-path neighbour: ' + name,
        [matching.find(c => c.path === canonical)]);
    }
    const inventory = await readCookies();
    same(inventory.some(c => 'value' in c), false, 'inventory stores no cookie values');
    return { userAgent:navigator.userAgent, stores:await chrome.cookies.getAllCookieStores(), outcomes };
  })()`);
  assert.equal(result.outcomes.length, 26);
  console.log(JSON.stringify(result, null, 2));
  console.log("Browser cookie scope: 26 exact-scope and safe-refusal cases passed; unrelated identities preserved.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
