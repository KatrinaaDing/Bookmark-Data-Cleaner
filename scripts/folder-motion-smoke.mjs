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
  const transition = await run(
    `(()=>{const t=Array.from(document.querySelectorAll('.folder-toggle')).find(b=>b.textContent.includes('Refinement fixtures')); t.click();return {height:document.getElementById(t.getAttribute('aria-controls')).getBoundingClientRect().height,expanded:t.getAttribute('aria-expanded')};})()`,
  );
  assert.ok(
    transition.height > 0,
    "Folder remains rendered during closing animation",
  );
  assert.equal(transition.expanded, "false");
  await pause(350);
  assert.equal(
    await run(
      `(()=>{const t=Array.from(document.querySelectorAll('.folder-toggle')).find(b=>b.textContent.includes('Refinement fixtures'));return document.getElementById(t.getAttribute('aria-controls')).getBoundingClientRect().height})()`,
    ),
    0,
  );
  await run(
    `Array.from(document.querySelectorAll('.folder-toggle')).find(b=>b.textContent.includes('Refinement fixtures')).click()`,
  );
  await pause(300);
  await run(
    `(()=>{const toggle=Array.from(document.querySelectorAll('.folder-toggle')).find(b=>b.textContent.includes('Refinement fixtures'));toggle.click();toggle.click();toggle.click();})()`,
  );
  await pause(300);
  assert.equal(
    await run(
      `(()=>{const toggle=Array.from(document.querySelectorAll('.folder-toggle')).find(b=>b.textContent.includes('Refinement fixtures'));const content=document.getElementById(toggle.getAttribute('aria-controls'));return content.inert && content.getBoundingClientRect().height===0;})()`,
    ),
    true,
    "Rapid toggles finish collapsed and unfocusable",
  );
  await browser.cmd(
    "Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
    page.sessionId,
  );
  await run(
    `Array.from(document.querySelectorAll('.folder-toggle')).find(b=>b.textContent.includes('Refinement fixtures')).click()`,
  );
  assert.equal(
    await run(
      `(()=>{const toggle=Array.from(document.querySelectorAll('.folder-toggle')).find(b=>b.textContent.includes('Refinement fixtures'));const content=document.getElementById(toggle.getAttribute('aria-controls'));return content.getBoundingClientRect().height>0 && content.getAnimations().length===0;})()`,
    ),
    true,
    "Reduced-motion expansion is immediate",
  );
  console.log(
    "Folder motion: visible closing transition and fully collapsed end state passed.",
  );
} finally {
  await browser.close();
}
