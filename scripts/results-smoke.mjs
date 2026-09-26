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
  const completed = {id:'synthetic',status:'finished',completed:1,total:1,outcomes:[
    {target:'saved.test',kind:'data',status:'completed',message:'Cookies and sign-in data: cleanup request completed.'},
    {target:'123',label:'Saved reference',kind:'bookmark',status:'completed',message:'Removed Saved reference.'},
  ]};
  const incomplete = {...completed,outcomes:[
    completed.outcomes[0],
    {target:'saved.test',kind:'data',status:'failed',message:'Saved site data: synthetic API failure.'},
    {target:'123',label:'Saved reference',retained:true,kind:'bookmark',status:'unverified',message:'Kept because site cleanup did not complete.'},
  ]};
  const show = job => run(`import('./components/operation-status.js').then(({operationStatus})=>document.querySelector('#operation').replaceChildren(operationStatus(${JSON.stringify(job)})))`);
  await show(completed); await capture('completed');
  if (!before) {
    assert.match(await run(`document.querySelector('.operation-counts').textContent`),/1 website-data request completed · 1 bookmark removed/);
    assert.equal(await run(`document.querySelector('.operation details').open`),false);
    assert.equal(await run(`document.querySelector('.operation').getBoundingClientRect().height < 180`),true,'Completed results leave room for the next task');
  }
  await show(incomplete); await capture('incomplete');
  await capture('incomplete-narrow',390,844);
  if (!before) {
    assert.match(await run(`document.querySelector('.operation-counts').textContent`),/1 bookmark kept · 1 operation failed/);
    assert.doesNotMatch(await run(`document.querySelector('.operation-counts').textContent`),/unverified/);
    assert.deepEqual(await run(`Array.from(document.querySelectorAll('.operation details')).map(node=>node.open)`),[true,false],'Problems are expanded; completed operations remain secondary');
    assert.equal(await run(`document.querySelectorAll('.result-target')[1].textContent`),'Saved reference');
    const legacy = {...incomplete,outcomes:[{...incomplete.outcomes[2],retained:undefined,label:undefined}]};
    await show(legacy);
    assert.match(await run(`document.querySelector('.operation-counts').textContent`),/1 outcome unverified/);
    assert.doesNotMatch(await run(`document.querySelector('.operation-counts').textContent`),/bookmark kept/,'Old ambiguous outcomes are not reclassified as known retention');
    await show({...completed,status:'unverified',outcomes:[]});
    assert.match(await run(`document.querySelector('.operation').textContent`),/Cleanup interrupted/);
    assert.doesNotMatch(await run(`document.querySelector('.operation').textContent`),/requests completed/);
    await show({...completed,outcomes:[{target:'456',kind:'folder',status:'completed',message:'Removed empty folder.'}]});
    assert.equal(await run(`document.querySelector('.operation-counts').textContent`),'1 empty folder removed');
    await show({...completed,status:'running',total:0,completed:0,outcomes:[]});
    assert.match(await run(`document.querySelector('.operation').textContent`),/Cleaning selected folders/);
    assert.equal(await run(`document.querySelector('.operation button')===null`),true);
    await show(completed);
    await run(`document.querySelector('.operation button[aria-label="Dismiss results"]').click()`);
    assert.equal(await run(`document.querySelector('.operation')===null && document.activeElement.id==='content'`),true);
  }
  console.log(before?'Product audit captures saved.':'Results UX: honest units, known retention, legacy uncertainty, compact results, focus and responsive layout passed.');
} finally { await browser.close(); }
