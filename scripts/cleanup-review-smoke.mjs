import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launch, pause } from "./browser-harness.mjs";

const browser = await launch({ grantTestPermissions: true });
try {
  const page = await browser.attach(`chrome-extension://${browser.id}/app.html`);
  const run = (expression) => browser.evaluate(page.sessionId, expression);
  await run(`(async () => {
    const { cleanupDialog } = await import('./components/cleanup-dialog.js');
    window.prepared = [];
    window.started = 0;
    window.openReview = () => cleanupDialog(async (options) => {
      window.prepared.push(options);
      if (window.prepareGate) await window.prepareGate;
      return { sites: [{ id: 'review.test', host: 'review.test', origins: ['https://review.test'], urls: [], cookies: [],
        bookmarks: [{ id: 'review-fixture', title: 'Review fixture', url: 'https://review.test/', path: 'Saved' }] }] };
    }, true, () => { window.started++; });
    window.openReview();
  })()`);
  await pause(100);
  const review = `Array.from(document.querySelectorAll('.cleanup-dialog button')).find(button => button.textContent === 'Next')`;
  const category = (label) => `Array.from(document.querySelectorAll('.cleanup-dialog label')).find(label => label.textContent === ${JSON.stringify(label)}).querySelector('input')`;
  assert.equal(await run(`Array.from(document.querySelectorAll('.cleanup-choice input')).every(input=>input.checked)`), true, "All available categories start selected");
  assert.equal(await run(`document.querySelectorAll('.cleanup-count').length`), 5);
  assert.equal(await run(`document.querySelector('.cleanup-count').textContent`), '0 detected cookies');
  assert.equal(await run(`Array.from(document.querySelectorAll('.cleanup-count')).at(-1).textContent`), '1 bookmark');
  await run(`document.querySelectorAll('.cleanup-choice input').forEach(input=>{if(input.checked)input.click()}); window.prepared=[]`);
  assert.equal(await run(`${review}.disabled`), true, "No category means no review action");
  await run(`${review}.click()`);
  assert.equal(await run(`window.prepared.length`), 0, "Disabled review does not prepare a plan");
  await run(`${category("Delete bookmarks")}.click()`);
  assert.equal(await run(`${review}.disabled`), false);
  await run(`${category("Delete bookmarks")}.click()`);
  assert.equal(await run(`${review}.disabled`), true, "Removing the last choice disables review again");
  await run(`window.nextWidth=${review}.getBoundingClientRect().width`);
  await run(`${category("Delete bookmarks")}.click(); window.prepareGate = new Promise(resolve => { window.releasePrepare = resolve; }); ${review}.click()`);
  assert.equal(await run(`Array.from(document.querySelectorAll('.cleanup-dialog input, .cleanup-dialog .dialog-actions button')).every(control => control.disabled)`), true, "Preparation freezes choices and actions");
  assert.equal(await run(`Math.abs(${review}.getBoundingClientRect().width-window.nextWidth)<.5`),true,"Pending actions retain their width");
  await run(`window.releasePrepare(); window.prepareGate = undefined`);
  await pause(100);
  assert.equal(await run(`document.activeElement.id`), "cleanup-title", "Review starts on its summary heading, not Confirm");
  assert.equal(await run(`document.activeElement.textContent`), "Step 2 — Review this cleanup");
  await browser.cmd("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: String.fromCharCode(13) }, page.sessionId);
  await browser.cmd("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }, page.sessionId);
  assert.equal(await run(`window.started`), 0, "Enter at review arrival does not start cleanup");
  assert.equal(await run(`document.querySelector('.cleanup-dialog').open`), true);
  await run(`Array.from(document.querySelectorAll('.cleanup-dialog button')).find(button => button.textContent === 'Back').click()`);
  await pause(80);
  assert.equal(await run(`${category("Delete bookmarks")}.checked`), true, "Back retains explicit choices");
  assert.equal(await run(`${review}.disabled`), false);
  assert.equal(await run(`!!document.querySelector(".cleanup-feedback .spinner")`), false, "Back clears the completed preparation spinner");

  // An unavailable cookie choice must not leave a checked, disabled category in the next plan.
  await run(`${category("Delete bookmarks")}.click(); ${category("Cookies and sign-in data")}.click(); ${review}.click()`);
  await pause(80);
  await run(`chrome.permissions.contains = async () => false; Array.from(document.querySelectorAll('.cleanup-dialog button')).find(button => button.textContent === 'Back').click()`);
  await pause(80);
  assert.equal(await run(`${category("Cookies and sign-in data")}.disabled`), true);
  assert.equal(await run(`${category("Cookies and sign-in data")}.checked`), false);
  assert.equal(await run(`${review}.disabled`), true, "Unavailable cookie access cannot enable review");
  await run(`${category("Delete bookmarks")}.click(); ${review}.click()`);
  await pause(80);
  assert.equal(await run(`window.prepared.at(-1).cookies`), false, "The next plan excludes the unavailable, unchecked cookie category");
  assert.equal(await run(`window.prepared.at(-1).bookmarks`), true);

  await mkdir("dist/review", { recursive: true });
  for (const [name, width, height] of [["desktop", 1360, 900], ["narrow", 390, 844]]) {
    await browser.cmd("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    assert.equal(await run(`document.documentElement.scrollWidth > innerWidth`), false);
    const shot = await browser.cmd("Page.captureScreenshot", { format: "png" }, page.sessionId);
    await writeFile(`dist/review/${name}.png`, Buffer.from(shot.data, "base64"));
  }
  await browser.cmd("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }, page.sessionId);
  await pause(80);
  assert.equal(await run(`!!document.querySelector('.cleanup-dialog')`), false, "Escape dismisses review without cleanup");
  assert.equal(await run(`window.started`), 0);
  // Preview counts deduplicate shared targets; origin counts never pretend to be stored items.
  await run(`(async()=>{
    chrome.permissions.contains=async()=>true;
    const {cleanupDialog}=await import('./components/cleanup-dialog.js');
    const cookie={name:'session',domain:'.preview.test',path:'/',storeId:'0',secure:true};
    const bookmark={id:'same',title:'Preview bookmark',url:'https://preview.test/',path:'Saved'};
    window.openPreview=()=>cleanupDialog(async()=>{
      if(window.previewGate)await window.previewGate;
      if(window.previewFailure)throw Error('Preview failed');
      return {sites:[{id:'preview.test',host:'preview.test',origins:['https://preview.test','http://preview.test'],urls:[],cookies:[cookie,cookie],bookmarks:[bookmark,bookmark]}],folders:[{id:'folder',depth:1}]};
    },true,()=>{window.started++});
    window.openPreview();
  })()`);
  await pause(100);
  assert.deepEqual(await run(`Array.from(document.querySelectorAll('.cleanup-count')).map(node=>node.textContent)`), ['1 detected cookie','If present','If present','If present','1 bookmark · 1 folder if empty']);
  for (const [name,width,height] of [['choices-desktop',1360,900],['choices-narrow',390,844]]) {
    await browser.cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page.sessionId);
    assert.equal(await run(`document.querySelector('.cleanup-dialog').scrollWidth<=document.querySelector('.cleanup-dialog').clientWidth`),true);
    const shot=await browser.cmd('Page.captureScreenshot',{format:'png'},page.sessionId);
    await writeFile('dist/review/'+name+'.png',Buffer.from(shot.data,'base64'));
  }
  await run(`document.querySelector('.cleanup-dialog').close();window.previewFailure=true;window.openPreview()`);
  await pause(100);
  assert.equal(await run(`document.querySelector('.cleanup-count').textContent`),'Count unavailable','Read failure is not displayed as zero');
  await run(`document.querySelector('.cleanup-dialog').close();window.previewFailure=false;window.previewGate=new Promise(resolve=>window.releasePreview=resolve);window.openPreview()`);
  await pause(50);
  await run(`document.querySelector('.cleanup-dialog').close();window.releasePreview()`);
  await pause(50);
  assert.equal(await run(`document.querySelector('.cleanup-dialog')===null`),true,'Late preview does not reopen a dismissed dialog');
  await run(`(async()=>{
    const {cleanupDialog}=await import('./components/cleanup-dialog.js');
    const base={id:'base',title:'Base',url:'https://review.test/',path:'Saved'};
    const duplicate={...base,id:'duplicate',title:'Duplicate'};
    cleanupDialog(async(options,extras)=>{
      if(window.failReview)throw Error('Cannot refresh review');
      return {sites:[{id:'review.test',host:'review.test',origins:['https://review.test'],urls:[],cookies:[],bookmarks:[base,...(extras.has('duplicate')?[duplicate]:[])]}],impact:{duplicates:[duplicate],relatedBookmarks:[],relatedSites:[]}};
    },true,()=>{window.started++});
  })()`);
  await pause(80);
  await run(`${review}.click()`); await pause(80);
  await run(`window.failReview=true;document.querySelector('.duplicate-choices input').click()`); await pause(80);
  assert.match(await run(`document.querySelector('.cleanup-feedback').textContent`),/Cannot refresh review/);
  assert.equal(await run(`Array.from(document.querySelectorAll('.cleanup-dialog button')).find(button=>button.textContent==='Confirm cleanup').disabled`),true,'Failed re-preparation cannot authorize the old plan');
  await run(`Array.from(document.querySelectorAll('.cleanup-dialog button')).find(button=>button.textContent==='Confirm cleanup').click()`);
  assert.equal(await run(`window.started`),0);
  await run(`window.failReview=false;Array.from(document.querySelectorAll('.cleanup-dialog button')).find(button=>button.textContent==='Retry review').click()`); await pause(80);
  assert.equal(await run(`Array.from(document.querySelectorAll('.cleanup-dialog button')).find(button=>button.textContent==='Confirm cleanup').disabled`),false);
  assert.match(await run(`document.querySelector('.cleanup-targets').textContent`),/review.test/,'Review names its target websites outside technical details');
  for (const [name,width,height] of [['review-duplicates-desktop',1360,900],['review-duplicates-narrow',390,844]]) {
    await browser.cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page.sessionId);
    await pause(220);
    const shot=await browser.cmd('Page.captureScreenshot',{format:'png'},page.sessionId);
    await writeFile('dist/review/'+name+'.png',Buffer.from(shot.data,'base64'));
  }
  await run(`document.querySelector('.cleanup-dialog').close()`);
  console.log("Cleanup review: category availability, frozen preparation, safe keyboard focus, Back, permission loss and Escape passed.");
} finally {
  await browser.close();
}
