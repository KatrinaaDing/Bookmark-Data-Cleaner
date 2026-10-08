// Capture store listing assets from the built extension with synthetic data:
// three 1280×800 screenshots and the 1400×560 / 440×280 promo tiles.
// Output goes to images/store/. Uses a disposable profile like the smoke tests.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { launch, pause } from "./browser-harness.mjs";

const out = "images/store";
await mkdir(out, { recursive: true });
const browser = await launch({ grantTestPermissions: true });
try {
  const page = await browser.attach(`chrome-extension://${browser.id}/app.html`);
  const run = (expression) => browser.evaluate(page.sessionId, expression);
  const waitFor = async (expression, tries = 60) => {
    for (let i = 0; i < tries; i++) {
      if (await run(expression)) return;
      await pause(100);
    }
    throw Error(`Timed out waiting for ${expression}`);
  };
  async function capture(name, width, height) {
    await browser.cmd("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await pause(400);
    const shot = await browser.cmd("Page.captureScreenshot", { format: "png" }, page.sessionId);
    await writeFile(`${out}/${name}.png`, Buffer.from(shot.data, "base64"));
    console.log(`Wrote ${out}/${name}.png`);
  }

  await run(`(async()=>{
    const bar=(await chrome.bookmarks.getTree())[0].children[0];
    const other=(await chrome.bookmarks.getTree())[0].children[1];
    const mk=(parentId,title,url)=>chrome.bookmarks.create({parentId,title,...(url?{url}:{})});
    const reading=await mk(bar.id,'Reading list');
    await mk(reading.id,'Why slow interfaces feel broken','https://essays.quietdesk.app/slow-interfaces');
    await mk(reading.id,'A field guide to weeknight cooking','https://weeknightkitchen.co/guide');
    await mk(reading.id,'Mechanical keyboard build log','https://forum.retrokeys.net/threads/build-log-2019');
    const work=await mk(bar.id,'Work');
    await mk(work.id,'Design system documentation','https://docs.lumen-ui.dev/getting-started');
    await mk(work.id,'Sprint board','https://boards.taskflow.example/team/sprints');
    await mk(work.id,'Expense portal','https://expenses.corpcloud.example/login');
    const old=await mk(other.id,'Old projects');
    await mk(old.id,'Conference 2022 — schedule','https://conf2022.webdevdays.example/schedule');
    await mk(old.id,'Lamp studio order status','https://shop.lampstudio.de/orders/48213');
    await mk(old.id,'Freelance invoice template','https://templates.ledgerly.example/invoice');
    await mk(old.id,'Old apartment listing','https://listings.cityflats.example/apt/2210');
    for(const [host,count] of [['essays.quietdesk.app',2],['forum.retrokeys.net',5],['docs.lumen-ui.dev',1],['boards.taskflow.example',4],['expenses.corpcloud.example',3],['conf2022.webdevdays.example',2],['shop.lampstudio.de',6],['listings.cityflats.example',3],['tracker.adnetwork.example',8],['cdn.widgetlabs.example',1]])
      for(let i=0;i<count;i++)await chrome.cookies.set({url:'https://'+host+'/',name:'c'+i,value:'x',expirationDate:Date.now()/1000+86400*365});
    for(const url of ['https://docs.lumen-ui.dev/getting-started','https://boards.taskflow.example/team/sprints','https://essays.quietdesk.app/slow-interfaces'])await chrome.history.addUrl({url});
  })()`);
  await pause(300);

  // 1. Overview with counts.
  await run(`location.hash='home'`);
  await waitFor(`document.querySelector('.card-stat')?.textContent.includes('bookmark')`);
  await capture("1-overview", 1280, 800);

  // 2. Bookmarks with cookies and dates on rows, one bookmark inspected.
  await run(`location.hash='bookmarks'`);
  await waitFor(`document.querySelectorAll('.bookmark-tree .bookmark-row').length>=10 && !document.querySelector('select[aria-label="Filter bookmarks by recorded use"]').disabled`);
  await run(`document.querySelectorAll('.folder-toggle').forEach(t=>{ if(t.getAttribute('aria-expanded')!=='true') t.click(); })`);
  await pause(400);
  await run(`Array.from(document.querySelectorAll('.bookmark-row .row-title')).find(b=>b.textContent==='Lamp studio order status').click()`);
  await pause(500);
  await capture("2-bookmarks", 1280, 800);

  // 3. Cleanup review, step 2, for the inspected bookmark.
  await run(`document.querySelector('.details-drawer .detail-cleanup').click()`);
  await waitFor(`document.querySelector('.cleanup-dialog') && document.querySelector('#cleanup-count-cookies')?.textContent.includes('cookie')`);
  await run(`Array.from(document.querySelectorAll('.cleanup-dialog button')).find(b=>b.textContent==='Next').click()`);
  await waitFor(`document.querySelector('.cleanup-dialog h2')?.textContent.includes('Step 2') && !document.querySelector('.cleanup-dialog [aria-busy="true"]')`);
  await capture("3-review", 1280, 800);
  await run(`document.querySelector('.cleanup-dialog')?.close()`);

  // 4. Site data with the unbookmarked filter, showing cookie-only sites.
  await run(`location.hash='sites'`);
  await waitFor(`document.querySelectorAll('.site-row').length>=8`);
  await run(`const s=document.querySelector('input[aria-label="Find a website"]');s.value='example';s.dispatchEvent(new Event('input',{bubbles:true}))`);
  await pause(300);
  await capture("4-site-data", 1280, 800);

  // Promo tiles: icon, name and tagline on the app's white surface.
  const svg = (await readFile("extension/icons/icon.svg", "utf8")).replace(/#/g, "%23");
  const tile = (iconSize, titleSize, tagSize, gap) => `data:text/html,<style>
    html,body{margin:0;height:100%;background:%23ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:%23212529}
    .tile{display:flex;align-items:center;justify-content:center;gap:${gap}px;height:100%}
    .tile svg{width:${iconSize}px;height:${iconSize}px;flex:none}
    h1{margin:0;font-size:${titleSize}px;font-weight:600;letter-spacing:-0.03em;color:%230b5ed7;line-height:1.1}
    p{margin:${Math.round(tagSize * 0.5)}px 0 0;font-size:${tagSize}px;color:%23626a75}
  </style><div class="tile">${svg}<div><h1>Bookmark Data Cleaner</h1><p>Choose the sites. Clear their data.</p></div></div>`;
  for (const [name, width, height, icon, title, tag, gap] of [["promo-1400x560", 1400, 560, 200, 64, 30, 56], ["promo-440x280", 440, 280, 96, 30, 15, 28]]) {
    const promo = await browser.attach(tile(icon, title, tag, gap));
    await browser.cmd("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, promo.sessionId);
    await pause(300);
    const shot = await browser.cmd("Page.captureScreenshot", { format: "png" }, promo.sessionId);
    await writeFile(`${out}/${name}.png`, Buffer.from(shot.data, "base64"));
    console.log(`Wrote ${out}/${name}.png`);
  }
} finally {
  await browser.close();
}
