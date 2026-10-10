import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launch, pause } from "./browser-harness.mjs";
const browser = await launch({ grantTestPermissions: true });
try {
  const page = await browser.attach(
    `chrome-extension://${browser.id}/app.html`,
  );
  const run = (expression) => browser.evaluate(page.sessionId, expression);

  const fixtures = await run(`(async()=>{
    const folder=await chrome.bookmarks.create({title:'A quieter browser'});
    const nested=await chrome.bookmarks.create({parentId:folder.id,title:'Read and revisit'});
    const a=await chrome.bookmarks.create({parentId:nested.id,title:'Design notes',url:'https://design.test/notes'});
    const b=await chrome.bookmarks.create({parentId:nested.id,title:'An old project',url:'https://old.test/project'});
    const duplicate=await chrome.bookmarks.create({parentId:folder.id,title:'More design notes',url:'https://design.test/another'});
    for(const host of ['design.test','old.test','orphan.test'])await chrome.cookies.set({url:'https://'+host+'/',name:'session',value:'fixture'});
    await chrome.history.addUrl({url:'https://design.test/notes'});
    return {folder:folder.id,nested:nested.id,a:a.id,b:b.id,duplicate:duplicate.id};
  })()`);
  assert.equal(
    await run(`document.querySelectorAll('.feature-card').length`),
    2,
  );
  await run(`location.hash='bookmarks'`);
  await pause(250);
  await run(
    `document.querySelectorAll('.folder-toggle').forEach(b=>{if(b.getAttribute('aria-expanded')==='false')b.click()})`,
  );
  assert.equal(
    await run(`document.querySelectorAll('.bookmark-row').length`),
    3,
  );
  await run(
    `Array.from(document.querySelectorAll('.row-title')).find(b=>b.textContent==='Design notes').click()`,
  );
  await pause(150);
  assert.equal(
    await run(`document.querySelector('.details h2').textContent`),
    "Design notes",
  );
  await run(
    `document.querySelector('.details-drawer [aria-label="Close details"]').click()`,
  );
  await pause(350);
  await run(
    `document.querySelector('input[aria-label="Select Design notes"]').click()`,
  );
  assert.equal(
    await run(
      `document.querySelector('input[aria-label="Select Read and revisit"]').indeterminate`,
    ),
    true,
  );
  // Deselect one of two same-domain bookmarks and keep the other selected.
  await run(
    `document.querySelector('input[aria-label="Select More design notes"]').click(); document.querySelector('input[aria-label="Select Design notes"]').click()`,
  );
  await run(
    `Array.from(document.querySelectorAll('section:not([hidden]) button')).find(b=>b.textContent==='Clean up selected…').click()`,
  );
  await pause(80);
  assert.equal(
    await run(
      `Array.from(document.querySelectorAll('dialog.cleanup-dialog button')).find(b=>b.textContent==='Next').disabled`,
    ),
    false,
    "Available cleanup categories are selected by default",
  );
  await run(
    `document.querySelectorAll('.cleanup-choice input').forEach(input=>{if(!input.closest('label').textContent.includes('Delete bookmarks') && input.checked)input.click()}); Array.from(document.querySelectorAll('dialog.cleanup-dialog button')).find(b=>b.textContent==='Next').click()`,
  );
  await pause(80);
  assert.equal(
    await run(`document.querySelector('dialog.cleanup-dialog h2').textContent`),
    "Step 2 — Review this cleanup",
  );
  await run(
    `Array.from(document.querySelectorAll('dialog.cleanup-dialog button')).find(b=>b.textContent==='Confirm cleanup').click()`,
  );
  await pause(300);
  for (let i = 0; i < 50 && !(await run(`!!document.querySelector('.toast-operation')`)); i++) await pause(100);
  assert.equal(await run(`!!document.querySelector('.toast-operation')`), true, "A finished cleanup shows its results toast");
  await run(`document.querySelector('.toast-operation button[aria-label="Dismiss results"]').click()`);
  await pause(300);
  await browser.cmd("Page.reload", {}, page.sessionId);
  await pause(600);
  assert.equal(await run(`document.querySelector('.toast-operation')===null`), true, "Dismissed results do not return after a reload");
  assert.equal(
    await run(
      `chrome.bookmarks.get(${JSON.stringify(fixtures.a)}).then(()=>true)`,
    ),
    true,
  );
  assert.equal(
    await run(
      `chrome.bookmarks.get(${JSON.stringify(fixtures.duplicate)}).then(()=>false,()=>true)`,
    ),
    true,
  );
  assert.equal(
    await run(
      `chrome.cookies.getAll({domain:'design.test'}).then(c=>c.length)`,
    ),
    1,
  );
  await run(`location.hash='sites'`);
  await pause(250);
  // Edge may seed its own Bing/MSN cookies in a fresh profile. Filter through the UI to the reserved fixture domains.
  await run(
    `const search=document.querySelector('input[aria-label="Find a website"]');search.value='.test';search.dispatchEvent(new Event('input',{bubbles:true}));`,
  );
  assert.equal(await run(`document.querySelectorAll('.site-row').length`), 3);
  assert.equal(
    await run(
      `document.querySelector('.timeline-year:last-of-type').textContent`,
    ),
    "No matching history",
  );
  await run(
    `Array.from(document.querySelectorAll('.site-row .row-title')).find(b=>b.textContent==='old.test').click()`,
  );
  await pause(1100);
  assert.deepEqual(await run(`Array.from(document.querySelectorAll('.details .affected-title')).map(el=>el.textContent)`), ['An old project'], 'Site details show a saved bookmark once, with its actions, rather than repeating it as an affected page');
  assert.equal(await run(`!!document.querySelector('.detail-bookmarks .bookmark-edit-action')`), true, 'Merged site data keeps bookmark management available');
  await run(
    `document.querySelector('#operation button[aria-label="Dismiss results"]')?.click()`,
  );
  await run(
    `Array.from(document.querySelectorAll('.site-row .row-title')).find(b=>b.textContent==='old.test').click()`,
  );
  const out = "dist/screenshots";
  await mkdir(out, { recursive: true });
  async function capture(name, width, height) {
    await browser.cmd(
      "Emulation.setDeviceMetricsOverride",
      { width, height, deviceScaleFactor: 1, mobile: false },
      page.sessionId,
    );
    await pause(50);
    const shot = await browser.cmd(
      "Page.captureScreenshot",
      { format: "png", captureBeyondViewport: true },
      page.sessionId,
    );
    await writeFile(`${out}/${name}.png`, Buffer.from(shot.data, "base64"));
    assert.equal(
      await run("document.documentElement.scrollWidth > innerWidth"),
      false,
      `overflow ${name}`,
    );
  }
  await capture("sites-desktop", 1360, 960);
  await capture("sites-mobile", 390, 844);
  await run(
    `Array.from(document.querySelectorAll('.site-row .row-title')).find(b=>b.textContent==='old.test').click()`,
  );
  assert.equal(
    await run(`!!document.querySelector('.details-drawer')`),
    true,
  );
  await run(
    `document.querySelector('.details-drawer [aria-label="Close details"]').click()`,
  );
  await pause(350);
  assert.equal(await run(`document.activeElement.textContent`), "old.test");
  await run(`location.hash='bookmarks'`);
  await capture("bookmarks-desktop", 1360, 960);
  await run(`location.hash='home'`);
  await capture("home-desktop", 1360, 960);
  await capture("home-mobile", 390, 844);
  await run(`location.hash='sites'`);
  await pause(50);
  await run(
    `document.querySelector('input[aria-label="Select old.test"]').click(); Array.from(document.querySelectorAll('section:not([hidden]) button')).find(b=>b.textContent==='Clean up selected…').click()`,
  );
  await pause(80);
  await run(
    `document.querySelectorAll('.cleanup-choice input').forEach(input=>{if(!input.closest('label').textContent.includes('Cookies and sign-in data') && input.checked)input.click()}); Array.from(document.querySelectorAll('dialog.cleanup-dialog button')).find(b=>b.textContent==='Next').click()`,
  );
  await pause(80);
  await run(
    `Array.from(document.querySelectorAll('dialog.cleanup-dialog button')).find(b=>b.textContent==='Confirm cleanup').click()`,
  );
  for (let i = 0; i < 50; i++) {
    await pause(100);
    if (
      await run(
        `chrome.runtime.sendMessage({type:'get-job'}).then(r=>r.value?.status==='finished')`,
      )
    )
      break;
  }
  assert.deepEqual(
    await run(
      `chrome.cookies.getAll({}).then(c=>c.filter(item=>item.domain.endsWith('.test')).map(item=>item.domain).sort())`,
    ),
    ["design.test", "orphan.test"],
  );
  assert.equal(
    await run(
      `chrome.bookmarks.get(${JSON.stringify(fixtures.b)}).then(()=>true)`,
    ),
    true,
  );
  // The cleaned site stays visible, struck through and unselectable, until a manual refresh.
  for (let i = 0; i < 50 && !(await run(`!!document.querySelector('.site-row.is-cleaned')`)); i++) await pause(100);
  assert.equal(await run(`document.querySelector('.site-row.is-cleaned .row-title')?.textContent`), "old.test", "Cleaned site remains listed after the automatic refresh");
  assert.equal(await run(`document.querySelector('.site-row.is-cleaned .site-cleaned')?.textContent`), "Cleaned");
  assert.equal(await run(`document.querySelector('.site-row.is-cleaned input').disabled`), true);
  assert.equal(await run(`document.querySelector('.site-row.is-cleaned input').checked`), false, "A cleaned site leaves the selection");
  assert.match(await run(`document.querySelector('section:not([hidden]) .selection-count').textContent`), /^0 selected/);
  await run(`document.querySelector('section:not([hidden]) button[aria-label="Refresh"]').click()`);
  for (let i = 0; i < 50 && (await run(`!!document.querySelector('.site-row.is-cleaned')`)); i++) await pause(100);
  assert.equal(await run(`Array.from(document.querySelectorAll('.site-row .row-title')).some(b=>b.textContent==='old.test')`), false, "Manual refresh drops the cleaned site");
  await run(`location.hash='home'`);
  // The ordinary package must run without network fetches; this profile has synthetic data only.
  await browser.cmd("Network.enable", {}, page.sessionId);
  await browser.cmd(
    "Network.emulateNetworkConditions",
    { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 },
    page.sessionId,
  );
  await browser.cmd("Page.reload", {}, page.sessionId);
  await pause(500);
  assert.equal(
    await run(`document.querySelectorAll('.feature-card').length`),
    2,
  );
  console.log(
    "UI smoke: routes, tree selection, metadata, bookmark-only and site-cookie cleanup, timeline, cleaned-site rows, responsive focus/overflow, remembered result dismissal and offline reload passed.",
  );
} finally {
  await browser.close();
}
