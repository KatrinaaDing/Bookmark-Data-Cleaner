import assert from "node:assert/strict";
import http from "node:http";
import { launch } from "./browser-harness.mjs";
const server = http.createServer((req, res) => {
  if (req.url === "/sw.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(
      "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(clients.claim()));",
    );
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><title>Disposable storage fixture</title>");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await launch({ grantTestPermissions: true });
try {
  const port = server.address().port;
  const origins = [
    `http://remove.localhost:${port}`,
    `http://keep.localhost:${port}`,
  ];
  for (const origin of origins) {
    const page = await browser.attach(origin);
    await browser.evaluate(
      page.sessionId,
      `(async()=>{
    localStorage.setItem('fixture','keep-me');
    await new Promise((resolve,reject)=>{const request=indexedDB.open('fixture',1);request.onupgradeneeded=()=>request.result.createObjectStore('data');request.onerror=()=>reject(request.error);request.onsuccess=()=>{request.result.close();resolve();};});
    const cache=await caches.open('fixture');await cache.put('/value',new Response('fixture'));
    await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
  })()`,
    );
    await browser.cmd("Target.closeTarget", { targetId: page.targetId });
  }
  const app = await browser.attach(`chrome-extension://${browser.id}/app.html`);
  await browser.evaluate(
    app.sessionId,
    `(async()=>{const {removeData}=await import('./browser/site-data.js');await removeData({id:'remove.localhost',host:'remove.localhost',origins:[${JSON.stringify(origins[0])}],urls:[],cookies:[],bookmarks:[]},{cookies:false,savedData:true,cache:true,workers:true,bookmarks:false});})()`,
  );
  const counts = [];
  for (const origin of origins) {
    const page = await browser.attach(origin);
    counts.push(
      await browser.evaluate(
        page.sessionId,
        `(async()=>({local:localStorage.getItem('fixture'),idb:(await indexedDB.databases()).length,caches:(await caches.keys()).length,workers:(await navigator.serviceWorker.getRegistrations()).length}))()`,
      ),
    );
  }
  assert.deepEqual(counts[0], { local: null, idb: 0, caches: 0, workers: 0 });
  assert.deepEqual(counts[1], {
    local: "keep-me",
    idb: 1,
    caches: 1,
    workers: 1,
  });
  console.log(
    "Real Chrome storage: selected origin cleared Local Storage, IndexedDB, CacheStorage and workers; control origin preserved.",
  );
} finally {
  await browser.close();
  server.close();
}
