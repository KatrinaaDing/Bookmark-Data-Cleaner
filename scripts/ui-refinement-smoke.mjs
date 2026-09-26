import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launch, pause } from "./browser-harness.mjs";
const browser = await launch({ grantTestPermissions: true });
try {
  const page = await browser.attach(
    `chrome-extension://${browser.id}/app.html#bookmarks`,
  );
  await browser.cmd("Emulation.setDeviceMetricsOverride", { width: 1360, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  const run = (expression) => browser.evaluate(page.sessionId, expression);
  async function waitFor(expression) {
    for(let attempt=0;attempt<80;attempt++) { if(await run(expression)) return; await pause(25); }
    assert.fail(`Timed out waiting for ${expression}`);
  }
  await run(`(async()=>{
    const folder=await chrome.bookmarks.create({title:'Refinement fixtures'});
    for(let i=0;i<35;i++)await chrome.bookmarks.create({parentId:folder.id,title:'Reference '+i,url:'https://example.test/page/'+i});
  })()`);
  await browser.cmd("Page.reload", {}, page.sessionId);
  await pause(350);
  await run(
    `document.querySelectorAll('.folder-toggle').forEach(b=>{if(b.getAttribute('aria-expanded')==='false')b.click();})`,
  );
  await pause(300);
  assert.equal(await run(`['body', '.bookmark-row .row-title', '.folder-toggle'].every(selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize) >= 15)`), true, "Extension UA styles must not shrink primary row text");
  assert.equal(await run(`parseFloat(getComputedStyle(document.querySelector('.row-host')).fontSize) < parseFloat(getComputedStyle(document.querySelector('.row-title')).fontSize)`), true, "Metadata is secondary to the row title");
  await run(`document.querySelector('.bookmark-row').click()`);
  await pause(300);
  assert.equal(
    await run(`!!document.querySelector('.details-drawer[open]')`),
    true,
  );
  assert.equal(
    await run(
      `document.querySelector('.workspace-list').getBoundingClientRect().right <= document.querySelector('.details-drawer').getBoundingClientRect().left`,
    ),
    true,
  );
  assert.equal(
    await run(
      `!!document.querySelector('.details-drawer .bookmark-editor')`,
    ),
    false,
    "Edit form is disclosed on demand",
  );
  assert.equal(await run(`document.querySelector('.address-disclosure') === null`), true, 'Redundant bookmark address list is removed');
  await run(`document.querySelector('.bookmark-edit-action').click()`);
  await run(`document.querySelector('.edit-bookmark input').value='Unsaved draft';document.querySelector('.bookmark-edit-action').click()`);
  await pause(80);
  await run(`Array.from(document.querySelectorAll('.unsaved-dialog button')).find(button=>button.textContent==='Keep editing').click()`);
  assert.equal(await run(`document.activeElement.value`), 'Unsaved draft', 'Keep editing restores the draft and focus');
  await run(`document.querySelector('.bookmark-edit-action').click()`); await pause(50);
  await run(`Array.from(document.querySelectorAll('.unsaved-dialog button')).find(button=>button.textContent==='Discard').click()`); await pause(250);
  await waitFor(`!document.querySelector('.bookmark-editor')`);
  assert.equal(await run(`!!document.querySelector('.bookmark-editor')`),false,'Discard removes the form state');
  assert.equal(await run(`Math.abs(document.querySelector('.workspace-list').getBoundingClientRect().width / document.querySelector('.details-rail').getBoundingClientRect().width - 1.5) < .02`), true, "List and details use a 3:2 split");
  assert.deepEqual(await run(`Array.from(document.querySelectorAll('.detail-card > h3')).map((heading) => heading.firstChild.textContent)`), ["Basic information", "Website data", "Bookmark"], "Details use the three approved sections");
  assert.equal(await run(`document.querySelector('.details-drawer').textContent.includes('Refinement fixtures')`), true, "Saved folder is recognizable");
  assert.equal(await run(`document.querySelector('.bookmark-row .row-title').getAttribute('aria-current')`), 'true', "The inspected row is marked separately from cleanup selection");
  await run(`document.querySelectorAll('.bookmark-row')[1].click()`);
  assert.equal(await run(`document.querySelectorAll('[data-focus-key][aria-current="true"]').length`), 1, "Only the current inspected row is marked");
  await pause(350);
  assert.equal(await run(`document.querySelector('.details-drawer').textContent.includes('Reference 1')`), true, "Main list remains interactive");
  await run(`document.querySelector('.bookmark-row').click()`);
  await pause(350);
  await run(`document.querySelector('.details-drawer .bookmark-copy-action').click()`);
  assert.equal(await run(`document.querySelector('.details-drawer .create-bookmark')?.getAnimations().length > 0`), true, "Disclosure expansion animates");
  await pause(350);
  await run(`document.querySelector('.details-drawer .bookmark-copy-action').click()`);
  assert.equal(await run(`document.querySelector('.details-drawer .create-bookmark')?.getAnimations().length > 0`), true, "Disclosure collapse animates");
  await pause(350);
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
  await pause(350);
  assert.equal(
    await run(`!!document.querySelector('.details-drawer[open]')`),
    false,
  );
  assert.equal(await run(`document.activeElement.textContent`), "Reference 0");
  await run(`document.querySelector('.bookmark-row .row-title').click()`);
  await pause(150);
  await run(
    `document.querySelector('.bookmark-edit-action').click()`,
  );
  await run(`const form=document.querySelector('.bookmark-editor');form.elements.url.value+='?edited';form.requestSubmit()`);
  await pause(350);
  assert.equal(await run(`document.querySelector('.bookmark-row .row-title').getAttribute('aria-current')`), 'true', "Inspected row survives list refresh");
  await run(
    `document.querySelector('.details-drawer [aria-label="Close details"]').click()`,
  );
  await pause(350);
  assert.equal(
    await run(`document.activeElement.matches('.bookmark-row .row-title')`),
    true,
    "Closing after save returns focus to the refreshed source row",
  );
  assert.equal(await run(`document.activeElement.textContent`), "Reference 0");
  assert.equal(await run(`document.querySelectorAll('[data-focus-key][aria-current="true"]').length`), 0, "Closing clears the inspected state");
  // A delayed details request must not reopen the card after the user closes it.
  await run(
    `(async()=>{const {detailsDrawer}=await import('./components/details-drawer.js');window.testDrawer=detailsDrawer();const token=window.testDrawer.open(document.createElement('section'),document.querySelector('.row-title'));window.testDrawer.close();await new Promise(r=>setTimeout(r,350));window.testDrawer.update(document.createElement('section'),token);})()`,
  );
  assert.equal(
    await run(`!!document.querySelector('.details-drawer[open]')`),
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
      `document.querySelector('.details-drawer').getAnimations().length`,
    ),
    0,
  );
  await run(
    `document.querySelector('.details-drawer [aria-label="Close details"]').click()`,
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
    if (await run(`innerWidth !== ${width} || innerHeight !== ${height}`))
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
  assert.equal(await run(`document.querySelector('.details-drawer').matches(':modal')`), true, "Narrow details use a native modal");
  // Reproduce the Sites editor with long bookmark values and a long folder option.
  await run(`(async()=>{
    const {siteDetails}=await import('./components/site-details.js');
    const saved={id:'fixture',parentId:'folder',title:'Long saved page 标题 '.repeat(8),url:'https://example.test/'+ 'long-address/'.repeat(20),path:'Saved / '+ 'Nested folder '.repeat(20)};
    const site={id:'example.test',host:'example.test',origins:['https://example.test'],urls:[saved.url],cookies:[{domain:'.example.test',path:'/',secure:true,hostOnly:false}],bookmarks:[saved]};
    const related={...saved,id:'related',title:'Shared cookie page',url:'https://sub.example.test/page'};
    const duplicate={...saved,id:'duplicate',title:'Another saved copy'};
    const otherSite={...site,id:'sub.example.test',host:'sub.example.test',origins:['https://sub.example.test'],urls:[related.url],bookmarks:[related]};
    document.querySelector('.drawer-content').replaceChildren(siteDetails(site,{allBookmarks:[saved,duplicate,related],detectedSites:[site,otherSite],folders:[{id:'folder',title:saved.path,path:saved.path}],onCleanup:()=>{}}));
    document.querySelector('.bookmark-edit-action').click();
  })()`);
  assert.equal(await run(`document.querySelectorAll('.details .affected-title').length`), 3, 'Merging site details preserves distinct bookmark IDs including copies and related pages');
  assert.equal(await run(`document.querySelectorAll('.details .saved-page').length`), 1, 'The saved bookmark is not repeated in the shared-data section');
  assert.equal(await run(`document.querySelector('.details .affected-site')?.textContent`), 'sub.example.test', 'Broader cookie effects remain visible');
  for (const width of [1360, 800, 390]) {
    await browser.cmd('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:false}, page.sessionId);
    await pause(300);
    assert.equal(await run(`Array.from(document.querySelectorAll('.bookmark-editor input, .bookmark-editor select')).every(field=>{
      const rect=field.getBoundingClientRect(), form=field.closest('form').getBoundingClientRect(), card=field.closest('.detail-card').getBoundingClientRect();
      return rect.width>0 && rect.left>=form.left-1 && rect.right<=form.right+1 && rect.right<=card.right+1;
    })`), true, 'Edit and create controls fit with long values at '+width+'px');
    assert.equal(await run(`document.querySelector('.details-drawer').scrollWidth <= document.querySelector('.details-drawer').clientWidth`), true, 'Drawer has no horizontal overflow');
    const info = `document.querySelector('.details .info-control button')`;
    await run(`${info}.blur();${info}.focus()`);
    assert.equal(await run(`!!document.querySelector('.details .info-popover:popover-open')`),true,'Keyboard focus opens explanatory help without expanding the card');
    await browser.cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
    assert.equal(await run(`!!document.querySelector('.details .info-popover:popover-open')`),false,'Escape closes help before the drawer');
    assert.equal(await run(`!!document.querySelector('.details-drawer[open]')`),true);
    if (width !== 800) {
      await run(`document.querySelector('.bookmark-editor').scrollIntoView({block:'start'})`);
      await capture('long-editor-'+width,width,900);
      await run(`${info}.scrollIntoView({block:'center'});${info}.click()`);
      await capture('website-help-'+width,width,900);
      await run(`${info}.click()`);
    }

  }
  await run(`(async()=>{
    const {siteDetails}=await import('./components/site-details.js');
    const empty=siteDetails({id:'empty.test',host:'empty.test',origins:['https://empty.test'],urls:[],cookies:[],bookmarks:[]});
    document.querySelector('.drawer-content').replaceChildren(empty);
  })()`);
  assert.equal(await run(`document.querySelector('.address-disclosure')===null`),true);
  assert.match(await run(`document.querySelector('.details').textContent`), /No bookmarks saved/);
  assert.equal(await run(`document.querySelector('.bookmark-copy-action').getAttribute('aria-label')`),'Save bookmark');
  await run(`document.querySelector('.bookmark-copy-action').click()`); await pause(80);
  assert.match(await run(`document.querySelector('.details').textContent`), /No writable bookmark destination/);
  await run(`location.hash='home'`);
  await pause(350);
  assert.equal(
    await run(`!!document.querySelector('.details-drawer[open]')`),
    false,
  );
  await capture("home", 1360, 900);
  console.log(
    "Refinement: animated folders, three detail sections, editor disclosure, responsive modal, focus, reduced motion and route cleanup passed.",
  );
} finally {
  await browser.close();
}
