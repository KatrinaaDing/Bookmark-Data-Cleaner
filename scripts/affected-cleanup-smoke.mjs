import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launch, pause } from './browser-harness.mjs';

const browser = await launch({ grantTestPermissions: true });
try {
  const page = await browser.attach(`chrome-extension://${browser.id}/app.html#bookmarks`);
  const run = expression => browser.evaluate(page.sessionId, expression);
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) { if (await run(expression)) return; await pause(40); }
    assert.fail(`Timed out: ${expression}`);
  };
  const click = label => run(`Array.from(document.querySelectorAll('.cleanup-dialog button')).find(b=>b.textContent===${JSON.stringify(label)}).click()`);
  const fixture = await run(`(async()=>{
    const folder=await chrome.bookmarks.create({title:'Affected cleanup fixtures'});
    const bookmarks=[];
    for(const [title,url] of [['Precision touchpad driver documentation for laptop and desktop trackpads — implementation notes and troubleshooting','https://scope.test/article'],['Related','https://app.scope.test/other'],['Keep','https://scope.test/kept']])
      bookmarks.push(await chrome.bookmarks.create({parentId:folder.id,title,url}));
    await chrome.cookies.set({url:'https://scope.test/',domain:'.scope.test',name:'shared',value:'synthetic'});
    await chrome.cookies.set({url:'https://app.scope.test/',name:'private',value:'synthetic'});
    return {base:bookmarks[0].id,related:bookmarks[1].id,keep:bookmarks[2].id};
  })()`);
  await browser.cmd('Page.reload',{},page.sessionId);
  await waitFor(`!!document.querySelector('[data-focus-key="bookmark:${fixture.base}"]')`);
  await run(`document.querySelectorAll('.folder-toggle[aria-expanded="false"]').forEach(b=>b.click());document.querySelector('[data-focus-key="bookmark:${fixture.base}"]').click()`);
  await waitFor(`!!document.querySelector('.detail-cleanup')`);
  assert.equal(await run(`document.querySelector('.detail-metadata').tagName`),'DIV','History is available without expansion');
  assert.equal(await run(`!!document.querySelector('.details .info-control')`),false,'The visible website-data warning is not duplicated in a tooltip');
  assert.equal(await run(`document.querySelector('.related-disclosure a').getAttribute('rel')`),'noopener noreferrer');
  await run(`document.querySelector('.detail-cleanup').click()`);
  await waitFor(`document.querySelector('#cleanup-count-cookies')?.textContent==='1 detected cookie'`);
  await click('Next');
  await waitFor(`document.querySelector('.cleanup-dialog')?.getAttribute('aria-busy')==='false' && !!document.querySelector('.related-warning input')`);
  const reviewedOrigins = await run(`Array.from(document.querySelectorAll('.cleanup-scope .url')).map(n=>n.textContent).filter(text=>text.startsWith('http'))`);
  const choice = `document.querySelector('input[data-bookmark-id="${fixture.related}"]')`;
  assert.equal(await run(`${choice}.checked`),false,'Related bookmarks are opt-in');
  await run(`${choice}.click()`);
  await waitFor(`document.querySelector('.cleanup-dialog').getAttribute('aria-busy')==='false'`);
  assert.equal(await run(`${choice}.checked`),true);
  assert.match(await run(`document.querySelector('.bookmark-removals h3').textContent`),/\(2\)/);
  await click('Back'); await click('Next');
  await waitFor(`!!${choice} && document.querySelector('.cleanup-dialog').getAttribute('aria-busy')==='false'`);
  assert.equal(await run(`${choice}.checked`),true,'Explicit related choices survive Back/Next');
  await mkdir('dist/affected-cleanup', {recursive:true});
  for (const [name,width,height] of [['desktop',1360,1000],['narrow',390,844]]) {
    await browser.cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page.sessionId);
    await pause(250);
    assert.equal(await run(`document.querySelector('.cleanup-body').scrollWidth<=document.querySelector('.cleanup-body').clientWidth`),true);
    const screenshot=await browser.cmd('Page.captureScreenshot',{format:'png'},page.sessionId);
    await writeFile(`dist/affected-cleanup/${name}.png`,Buffer.from(screenshot.data,'base64'));
    await run(`document.querySelector('.related-warning').scrollIntoView({block:'end'})`);
    const choices=await browser.cmd('Page.captureScreenshot',{format:'png'},page.sessionId);
    await writeFile(`dist/affected-cleanup/${name}-choices.png`,Buffer.from(choices.data,'base64'));
  }
  await run(`window.sentPlan=undefined;window.holdJob=true;const send=chrome.runtime.sendMessage.bind(chrome.runtime);chrome.runtime.sendMessage=(message,...args)=>{if(message.type==='get-job'&&window.holdJob&&window.startedJob)return Promise.resolve({ok:true,value:window.startedJob});if(message.type==='start-cleanup'){window.sentPlan=structuredClone(message.plan);return send(message,...args).then(response=>{window.startedJob=response.value;return response})}return send(message,...args)}`);
  await click('Confirm cleanup');
  await waitFor(`!document.querySelector('.cleanup-dialog')`);
  assert.deepEqual(await run(`window.startedJob.busyBookmarkIds`),[fixture.base,fixture.related],'Busy IDs include the initiating bookmark and explicitly selected related bookmark');
  assert.equal(await run(`!document.querySelector('.drawer-cleanup-overlay').hidden && document.querySelector('.drawer-content').inert`),true,'The details content is covered and inert');
  assert.equal(await run(`document.querySelector('.drawer-header button').disabled`),false,'Close details stays usable');
  assert.equal(await run(`document.querySelector('.detail-cleanup').disabled`),true,'The details cleanup button cannot start another job');
  for (const id of [fixture.base,fixture.related])
    assert.equal(await run(`document.querySelector('[data-focus-key="bookmark:${id}"]').closest('.bookmark-row').classList.contains('is-cleaning')`),true,'Chosen bookmarks show busy rows');
  assert.equal(await run(`document.querySelector('[data-focus-key="bookmark:${fixture.keep}"]').closest('.bookmark-row').classList.contains('is-cleaning')`),false,'Unchosen bookmark stays normal');
  assert.equal(await run(`document.querySelector('section:not([hidden]) .toolbar-actions .primary').disabled`),true,'Toolbar cannot start another cleanup');
  assert.equal(await run(`!!document.querySelector('.toast-progress .spinner')`),true,'A persistent progress toast remains visible after review closes');
  assert.equal(await run(`document.querySelector('.toast-progress').closest('.toast-host').matches(':popover-open')`),true,'Progress toast is visible over the workspace');
  await pause(250);
  const progressShot=await browser.cmd('Page.captureScreenshot',{format:'png'},page.sessionId);
  await writeFile('dist/affected-cleanup/progress-toast.png',Buffer.from(progressShot.data,'base64'));
  await browser.cmd('Emulation.setDeviceMetricsOverride',{width:1360,height:900,deviceScaleFactor:1,mobile:false},page.sessionId);
  await pause(300);
  assert.equal(await run(`document.querySelector('.details-drawer').dataset.mode`),'panel','Running details can switch from narrow modal to desktop panel');
  assert.equal(await run(`!document.querySelector('.drawer-cleanup-overlay').hidden`),true);
  const desktopProgress=await browser.cmd('Page.captureScreenshot',{format:'png'},page.sessionId);
  await writeFile('dist/affected-cleanup/progress-panel-desktop.png',Buffer.from(desktopProgress.data,'base64'));
  await run(`document.querySelector('.drawer-header button').click()`);
  await waitFor(`!document.querySelector('.details-drawer')?.open`);
  assert.equal(await run(`document.querySelector('[data-focus-key="bookmark:${fixture.related}"]').closest('.bookmark-row').querySelector('.row-cleanup-status .spinner')!==null`),true,'Tree progress remains after details closes');
  await run(`document.querySelector('input[aria-label="Find a bookmark"]').value='Related';document.querySelector('input[aria-label="Find a bookmark"]').dispatchEvent(new Event('input'))`);
  assert.equal(await run(`document.querySelector('.search-results .bookmark-row').classList.contains('is-cleaning')`),true,'Filtered results reuse the same busy state');
  await run(`document.querySelector('input[aria-label="Find a bookmark"]').value='';document.querySelector('input[aria-label="Find a bookmark"]').dispatchEvent(new Event('input'))`);
  const plan=await run(`window.sentPlan`);
  assert.deepEqual(plan.sites.flatMap(s=>s.origins),reviewedOrigins,'Related deletion does not add its origin');
  assert.deepEqual(plan.sites.flatMap(s=>s.cookies.map(c=>c.name)),['shared'],'Related deletion does not add private cookies');
  assert.deepEqual(plan.sites.flatMap(s=>s.bookmarks.map(b=>b.id)).sort(),[fixture.base,fixture.related].sort());
  await waitFor(`chrome.bookmarks.get(${JSON.stringify(fixture.related)}).then(()=>false,()=>true)`);
  await run(`window.holdJob=false`);
  await waitFor(`document.querySelector('.toast-operation .operation')?.textContent.includes('Selected cleanup requests completed')`);
  assert.equal(await run(`document.querySelector('.toast-progress')===null`),true,'Spinner disappears when cleanup finishes');
  assert.equal(await run(`document.querySelector('#operation').childElementCount`),0,'Completed results no longer sit above the workspace');
  assert.equal(await run(`document.querySelector('.toast-operation').classList.contains('toast-persistent')`),true,'Results remain until dismissed');
  assert.match(await run(`document.querySelector('.toast-operation .operation-counts').textContent`),/2 bookmarks removed/,'Completion toast includes the result summary');
  assert.equal(await run(`!!document.querySelector('.toast-operation .operation-details')`),true,'Operation details remain available in the toast');
  await pause(250);
  const completionShot=await browser.cmd('Page.captureScreenshot',{format:'png'},page.sessionId);
  await writeFile('dist/affected-cleanup/completion-toast.png',Buffer.from(completionShot.data,'base64'));
  await browser.cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false},page.sessionId);
  await pause(250);
  assert.equal(await run(`document.querySelector('.toast-operation').getBoundingClientRect().right<=innerWidth`),true,'Results toast fits narrow screens');
  const narrowCompletion=await browser.cmd('Page.captureScreenshot',{format:'png'},page.sessionId);
  await writeFile('dist/affected-cleanup/completion-toast-narrow.png',Buffer.from(narrowCompletion.data,'base64'));
  await run(`document.querySelector('.toast-operation button[aria-label="Dismiss results"]').click()`);
  assert.equal(await run(`document.querySelector('.toast-operation')===null`),true,'Results toast can be dismissed');
  await browser.cmd('Emulation.setDeviceMetricsOverride',{width:1360,height:900,deviceScaleFactor:1,mobile:false},page.sessionId);
  assert.equal(await run(`chrome.bookmarks.get(${JSON.stringify(fixture.keep)}).then(()=>true,()=>false)`),true,'Unchecked related bookmark survives');
  assert.equal(await run(`chrome.cookies.get({url:'https://app.scope.test/',name:'private'}).then(c=>!!c)`),true,'Unreviewed website data survives');

  const dataOnlyId = await run(`(async()=>{
    const saved=await chrome.bookmarks.create({title:'Data-only bookmark',url:'https://data-only.test/page'});
    await chrome.cookies.set({url:'https://data-only.test/',name:'session',value:'synthetic'});
    return saved.id;
  })()`);
  await run(`document.querySelector('.toolbar-filters .icon-button').click()`);
  await waitFor(`!!document.querySelector('[data-focus-key="bookmark:${dataOnlyId}"]')`);
  await run(`document.querySelectorAll('.folder-toggle[aria-expanded="false"]').forEach(button=>button.click());document.querySelector('[data-focus-key="bookmark:${dataOnlyId}"]').click()`);
  await waitFor(`document.querySelector('.details h2')?.textContent==='Data-only bookmark'`);
  await run(`document.querySelector('.detail-cleanup').click()`);
  await waitFor(`document.querySelector('#cleanup-count-bookmarks')?.textContent.includes('bookmark')`);
  await run(`document.querySelector('#cleanup-count-bookmarks').closest('.cleanup-choice').querySelector('input').click()`);
  await click('Next');
  await waitFor(`document.querySelector('#cleanup-title')?.textContent.includes('Step 2') && document.querySelector('.cleanup-dialog').getAttribute('aria-busy')==='false'`);
  assert.equal(await run(`document.querySelector('.bookmark-removals')===null`),true);
  await run(`window.startedJob=undefined;window.holdJob=true`);
  await click('Confirm cleanup');
  await waitFor(`!document.querySelector('.cleanup-dialog')`);
  assert.deepEqual(await run(`window.startedJob.busyBookmarkIds`),[dataOnlyId],'Data-only bookmark remains a progress target');
  assert.equal(await run(`window.sentPlan.options.bookmarks`),false,'Data-only cleanup does not authorize bookmark removal');
  assert.equal(await run(`document.querySelector('[data-focus-key="bookmark:${dataOnlyId}"]').closest('.bookmark-row').classList.contains('is-cleaning')`),true);
  assert.equal(await run(`!document.querySelector('.drawer-cleanup-overlay').hidden`),true);
  await run(`window.holdJob=false`);
  await waitFor(`!document.querySelector('[data-focus-key="bookmark:${dataOnlyId}"]').closest('.bookmark-row').classList.contains('is-cleaning')`);
  assert.equal(await run(`chrome.bookmarks.get(${JSON.stringify(dataOnlyId)}).then(()=>true,()=>false)`),true,'Data-only bookmark remains saved');
  assert.equal(await run(`document.querySelector('.drawer-cleanup-overlay').hidden && !document.querySelector('.drawer-content').inert`),true,'Details return to normal after data-only cleanup');
  assert.equal(await run(`document.querySelector('.detail-cleanup').disabled`),false);
  await waitFor(`!!document.querySelector('.toast-operation')`);
  await run(`document.querySelector('.detail-cleanup').click()`);
  await waitFor(`!!document.querySelector('.cleanup-dialog')`);
  assert.equal(await run(`document.querySelector('.toast-operation')===null`),true,'Opening another review clears the previous result toast');
  await click('Cancel');
  await waitFor(`!document.querySelector('.cleanup-dialog')`);

  // A failed rebuild may not authorize the former snapshot; managed choices stay disabled.
  await run(`(async()=>{
    const {cleanupDialog}=await import('./components/cleanup-dialog.js');
    const base={id:'base',title:'Base',url:'https://fake.test/',path:'Saved'};
    const related={...base,id:'related',url:'https://fake.test/related'};
    const managed={...related,id:'managed',unmodifiable:true};
    cleanupDialog(async(options,extras)=>{
      if(window.failAffectedReview)throw Error('Affected scope refresh failed');
      return {sites:[{id:'fake.test',host:'fake.test',origins:['https://fake.test'],urls:[base.url],cookies:[],bookmarks:[base,...(extras.has('related')?[related]:[])]}],impact:{duplicates:[],relatedBookmarks:[related,managed],relatedSites:[]}};
    },true,()=>{});
  })()`);
  await waitFor(`document.querySelector('#cleanup-count-bookmarks')?.textContent==='1 bookmark'`);
  await click('Next');
  await waitFor(`!!document.querySelector('input[data-bookmark-id="managed"]')`);
  assert.equal(await run(`document.querySelector('input[data-bookmark-id="managed"]').disabled`),true);
  await run(`window.failAffectedReview=true;document.querySelector('input[data-bookmark-id="related"]').click()`);
  await waitFor(`document.querySelector('.cleanup-feedback')?.textContent.includes('Affected scope refresh failed')`);
  assert.equal(await run(`Array.from(document.querySelectorAll('.cleanup-footer button')).find(b=>b.textContent==='Confirm cleanup').disabled`),true,'Failure invalidates the previous plan');
  await run(`window.failAffectedReview=false`);
  await click('Retry review');
  await waitFor(`document.querySelector('.cleanup-dialog').getAttribute('aria-busy')==='false' && document.querySelector('.cleanup-feedback').textContent===''`);
  assert.equal(await run(`document.querySelector('input[data-bookmark-id="related"]').checked`),true);
  await click('Cancel');
  console.log('Affected cleanup: opt-in, Back/Next, managed protection, failed rebuild, exact submitted scope, actual deletion and unrelated data retention passed.');
} finally { await browser.close(); }
