import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launch, pause } from "./browser-harness.mjs";
const browser = await launch({ grantTestPermissions: true });
try {
  const page = await browser.attach(
    `chrome-extension://${browser.id}/app.html#bookmarks`,
  );
  const run = (expression) => browser.evaluate(page.sessionId, expression);
  await run(`(async()=>{
    const folder=await chrome.bookmarks.create({title:'Refinement fixtures'});
    for(let i=0;i<35;i++)await chrome.bookmarks.create({parentId:folder.id,title:'Reference '+i,url:'https://example.test/page/'+i});
  })()`);
  await browser.cmd("Page.reload", {}, page.sessionId);
  await pause(250);
  await run(
    `document.querySelectorAll('.folder-toggle').forEach(b=>{if(b.getAttribute('aria-expanded')==='false')b.click();})`,
  );
  await pause(300);
  await run(`document.querySelector('.bookmark-row .row-title').click()`);
  await pause(300);
  assert.equal(
    await run(`!!document.querySelector('dialog.details-drawer[open]')`),
    true,
  );
  assert.equal(
    await run(`getComputedStyle(document.documentElement).overflowY`),
    "hidden",
  );
  assert.equal(
    await run(
      `document.querySelector('.workspace').getBoundingClientRect().width === document.querySelector('.workspace-list').getBoundingClientRect().width`,
    ),
    true,
  );
  assert.equal(
    await run(
      `document.querySelector('dialog.details-drawer .save-bookmark').checkVisibility()`,
    ),
    false,
    "Save form is disclosed on demand",
  );
  await browser.cmd(
    "Input.dispatchKeyEvent",
    {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    },
    page.sessionId,
  );
  await pause(250);
  assert.equal(
    await run(`!!document.querySelector('dialog.details-drawer[open]')`),
    false,
  );
  assert.equal(await run(`document.activeElement.textContent`), "Reference 0");
  // A delayed details request must not reopen the card after the user closes it.
  await run(
    `(async()=>{const {detailsDrawer}=await import('./components/details-drawer.js');window.testDrawer=detailsDrawer();const token=window.testDrawer.open(document.createElement('section'),document.querySelector('.row-title'));window.testDrawer.close();await new Promise(r=>setTimeout(r,250));window.testDrawer.update(document.createElement('section'),token);})()`,
  );
  assert.equal(
    await run(`!!document.querySelector('dialog.details-drawer[open]')`),
    false,
  );
  await browser.cmd(
    "Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
    page.sessionId,
  );
  await run(`document.querySelector('.bookmark-row .row-title').click()`);
  await pause(100);
  assert.equal(
    await run(
      `document.querySelector('dialog.details-drawer').getAnimations().length`,
    ),
    0,
  );
  await run(
    `document.querySelector('dialog.details-drawer[open] [aria-label="Close details"]').click()`,
  );
  await pause(50);
  await browser.cmd(
    "Emulation.setEmulatedMedia",
    { features: [] },
    page.sessionId,
  );
  const out = "dist/refinement";
  await mkdir(out, { recursive: true });
  async function capture(name, width, height) {
    await browser.cmd(
      "Emulation.setDeviceMetricsOverride",
      { width, height, deviceScaleFactor: 1, mobile: false },
      page.sessionId,
    );
    await pause(300);
    assert.equal(
      await run("document.documentElement.scrollWidth > innerWidth"),
      false,
    );
    const shot = await browser.cmd(
      "Page.captureScreenshot",
      { format: "png" },
      page.sessionId,
    );
    await writeFile(`${out}/${name}.png`, Buffer.from(shot.data, "base64"));
  }
  await run(`window.scrollTo(0,0)`);
  await capture("bookmarks", 1360, 900);
  await run(`document.querySelector('.bookmark-row .row-title').click()`);
  await capture("details", 1360, 900);
  await capture("details-narrow", 390, 844);
  await run(`location.hash='home'`);
  await pause(250);
  assert.equal(
    await run(`!!document.querySelector('dialog.details-drawer[open]')`),
    false,
  );
  await capture("home", 1360, 900);
  console.log(
    "Refinement: animated folders, drawer dismissal/focus, one scroll surface, progressive disclosure, reduced motion and route cleanup passed.",
  );
} finally {
  await browser.close();
}
