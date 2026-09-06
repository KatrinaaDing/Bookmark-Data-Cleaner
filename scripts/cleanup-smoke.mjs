import assert from "node:assert/strict";
import { launch } from "./browser-harness.mjs";
const browser = await launch({ grantTestPermissions: true });
try {
  const page = await browser.attach(
    `chrome-extension://${browser.id}/page.html`,
  );
  const result = await browser.evaluate(
    page.sessionId,
    `(async()=>{
    const {scanSites,removeData}=await import('./browser/site-data.js');
    const {noCleanup}=await import('./core/types.js');
    await chrome.cookies.set({url:'https://orphan.test/',name:'keep',value:'1'});
    await chrome.cookies.set({url:'https://chip.test/',name:'chip',value:'1',secure:true,sameSite:'no_restriction',partitionKey:{topLevelSite:'https://parent.test',hasCrossSiteAncestor:true}});
    await chrome.cookies.set({url:'https://chip.test/',name:'chip',value:'2',secure:true,sameSite:'no_restriction',partitionKey:{topLevelSite:'https://other.test',hasCrossSiteAncestor:true}});
    const scan=await scanSites();
    const parent=scan.sites.find(s=>s.host==='parent.test');
    await removeData(parent,{...noCleanup,cookies:true});
    const after=await scanSites();
    return {before:scan.sites.map(s=>s.host).sort(),after:after.sites.map(s=>s.host).sort(),valuesStored:scan.sites.some(s=>s.cookies.some(c=>'value' in c))};
  })()`,
  );
  assert.deepEqual(result.before, ["orphan.test", "other.test", "parent.test"]);
  assert.deepEqual(result.after, ["orphan.test", "other.test"]);
  assert.equal(result.valuesStored, false);
  console.log(
    "Real Chrome cleanup: selected partition removed; other partition and unrelated cookies preserved.",
  );
} finally {
  await browser.close();
}
