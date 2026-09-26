import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launch, pause } from './browser-harness.mjs';

const before = process.argv.includes('--capture-before');
const browser = await launch({grantTestPermissions:true});
try {
  const page = await browser.attach(`chrome-extension://${browser.id}/app.html#sites`);
  const run = expression => browser.evaluate(page.sessionId, expression);
  const waitFor = async expression => {
    for (let i=0;i<100;i++) { if(await run(expression)) return; await pause(40); }
    assert.fail(`Timed out: ${expression}`);
  };
  await run(`(async()=>{
    for(const host of ['saved.test','unsaved.test','another.test'])
      await chrome.cookies.set({url:'https://'+host+'/',name:'session',value:'synthetic'});
    await chrome.bookmarks.create({title:'Saved reference',url:'https://saved.test/article'});
  })()`);
  await browser.cmd('Page.reload',{},page.sessionId);
  await waitFor(`!!document.querySelector('[data-focus-key="site:unsaved.test"]')`);
  assert.equal(await run(`document.querySelector('.site-row .site-cookie-count').title`),'Detected cookies: 1','Cookie count has a hover explanation');
  await run(`const search=document.querySelector('input[aria-label="Find a website"]');search.value='.test';search.dispatchEvent(new Event('input'))`);
  const out = `dist/product-ux/${before?'before':'after'}`;
  await mkdir(out,{recursive:true});
  async function capture(name,width=1360,height=900) {
    await browser.cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page.sessionId);
    await pause(300);
    assert.equal(await run(`document.documentElement.scrollWidth>innerWidth`),false);
    const shot=await browser.cmd('Page.captureScreenshot',{format:'png'},page.sessionId);
    await writeFile(`${out}/${name}.png`,Buffer.from(shot.data,'base64'));
  }
  await capture('sites');
  if (!before) {
    const filter = `document.querySelector('select[aria-label="Filter sites by bookmark status"]')`;
    const search = `document.querySelector('input[aria-label="Find a website"]')`;
    const setFilter = value => run(`${filter}.value=${JSON.stringify(value)};${filter}.dispatchEvent(new Event('change'))`);
    const visibleHosts = `Array.from(document.querySelectorAll('.site-row .row-title')).map(node=>node.textContent)`;
    await setFilter('saved');
    assert.deepEqual(await run(visibleHosts),['saved.test']);
    await run(`document.querySelector('input[aria-label="Select saved.test"]').click();document.querySelector('[data-focus-key="site:saved.test"]').click()`);
    await waitFor(`document.querySelector('.details h2')?.textContent==='saved.test'`);
    await setFilter('unsaved');
    assert.deepEqual(await run(visibleHosts),['another.test','unsaved.test']);
    assert.match(await run(`document.querySelector('section:not([hidden]) .selection-count').textContent`),/1 selected · 1 outside results/);
    assert.equal(await run(`document.querySelector('.details h2').textContent`),'saved.test');
    await run(`document.querySelector('section:not([hidden]) .list-selection input').click()`);
    assert.match(await run(`document.querySelector('section:not([hidden]) .selection-count').textContent`),/3 selected/);
    await run(`document.querySelector('section:not([hidden]) .list-selection input').click()`);
    assert.match(await run(`document.querySelector('section:not([hidden]) .selection-count').textContent`),/1 selected · 1 outside results/);
    await run(`document.querySelector('section:not([hidden]) .toolbar-actions .primary').click()`);
    await waitFor(`!!document.querySelector('.cleanup-dialog')`);
    await run(`Array.from(document.querySelectorAll('.cleanup-dialog button')).find(b=>b.textContent==='Next').click()`);
    await waitFor(`!!document.querySelector('.cleanup-targets')`);
    assert.deepEqual(await run(`Array.from(document.querySelectorAll('.cleanup-targets .affected-title')).map(node=>node.textContent)`),['saved.test'],'Filtering does not alter hidden cleanup targets');
    await run(`document.querySelector('.cleanup-dialog').close(); location.hash='home'`);
    await waitFor(`!document.querySelector('.dashboard').hidden`);
    await run(`location.hash='sites'`);
    await waitFor(`!${filter}.closest('section').hidden`);
    assert.equal(await run(`${filter}.value`),'unsaved','Filter persists across navigation');
    await run(`${search}.value='no-match-at-all';${search}.dispatchEvent(new Event('input'))`);
    assert.equal(await run(`document.querySelector('section:not([hidden]) .list-selection input').disabled`),true);
    assert.match(await run(`document.querySelector('.result-count').textContent`),/^0 of /);
    await run(`document.querySelector('.reset-filters').click()`);
    assert.equal(await run(`${filter}.value`),'all');
    assert.equal(await run(`${search}.value`),'');
    assert.equal(await run(`document.activeElement===${search}`),true,'Reset returns keyboard focus to search');
    assert.equal(await run(`document.querySelector('input[aria-label="Select saved.test"]').checked`),true,'Reset never clears selection');
    await run(`${search}.value='.test';${search}.dispatchEvent(new Event('input'))`);
    await setFilter('unsaved'); await capture('unbookmarked'); await capture('unbookmarked-narrow',390,844);
    await setFilter('all');
  }
  console.log(before?'Site discovery audit captures saved.':'Site discovery: bookmark filters, hidden selection, review scope, reset, navigation and responsive layouts passed.');
} finally { await browser.close(); }
