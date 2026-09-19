// Run after npm run build:
// CHROME_BIN='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' node docs/improvements/evidence/2026-09-19/reproduce-cookie-scope.mjs
// Creates and removes a disposable browser profile; touches synthetic .test cookies only.
import { launch } from '../../../../scripts/browser-harness.mjs';
const browser = await launch({ grantTestPermissions: true });
try {
  const page = await browser.attach(`chrome-extension://${browser.id}/app.html`);
  const result = await browser.evaluate(page.sessionId, `(async () => {
    const { scanSites, removeData } = await import('./browser/site-data.js');
    const { noCleanup } = await import('./core/types.js');
    const observations = [];
    for (const scenario of ['collision', 'absent-reviewed', 'direct-api', 'reviewed-race']) {
      const host = scenario + '.test';
      const base = {url:'https://' + host + '/',name:'session',path:'/',secure:true};
      if (scenario !== 'reviewed-race') await chrome.cookies.set({...base,domain:'.' + host,value:'older-domain'});
      await new Promise(resolve => setTimeout(resolve, 25));
      const target = await chrome.cookies.set({...base,value:'newer-host'});
      let reviewed;
      if (scenario === 'reviewed-race') {
        reviewed = (await scanSites()).sites.find(site => site.host === host);
        await chrome.cookies.set({...base,domain:'.' + host,value:'unreviewed-domain'});
      }
      if (scenario === 'absent-reviewed') {
        await chrome.cookies.set({...base,value:'expired',expirationDate:1});
      }
      const summarize = cookies => cookies.map(({domain,hostOnly,name,path,value}) => ({domain,hostOnly,name,path,value}));
      const before = summarize(await chrome.cookies.getAll({domain:host,name:'session'}));
      let status = 'success', removal;
      try {
        if (scenario === 'direct-api') {
          removal = await chrome.cookies.remove({url:base.url,name:base.name,storeId:target.storeId});
        } else {
          const site = reviewed ?? {id:host,host,origins:['https://' + host],urls:[],cookies:[target],bookmarks:[]};
          await removeData(site,{...noCleanup,cookies:true});
        }
      } catch(error) { status = error.message; }
      const after = summarize(await chrome.cookies.getAll({domain:host,name:'session'}));
      observations.push({scenario,reviewed,before,status,removal,after});
    }
    return {userAgent:navigator.userAgent,observations};
  })()`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
