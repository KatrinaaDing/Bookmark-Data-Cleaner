import type { CleanupOptions, CookieRef, ScanResult, SiteRecord } from '../core/types.js';
import { inventoryFromCookies } from '../core/inventory.js';
import { readBookmarks } from './bookmarks.js';
import { readHistory } from './history.js';
import { cookieIdentity, unique } from '../helpers/sites.js';
const access: chrome.permissions.Permissions = {permissions:['cookies'],origins:['http://*/*','https://*/*']};
export const coverage = 'Sites detected through cookies, including partitioned cookies. Sites with only other storage may be missing. Dates describe retained visits, not data age.';
export function hasSiteAccess(): Promise<boolean> { return chrome.permissions.contains(access); }
export function requestSiteAccess(): Promise<boolean> { return chrome.permissions.request(access); }
export async function readCookies(): Promise<CookieRef[]> {
  if (!await hasSiteAccess()) throw Error('Allow cookie and website access to discover stored site data.');
  const stores = await chrome.cookies.getAllCookieStores();
  const cookies = (await Promise.all(stores.map(store => chrome.cookies.getAll({storeId:store.id,partitionKey:{}})))).flat();
  return unique(cookies.map(({name,domain,path,secure,storeId,partitionKey})=>({name,domain,path,secure,storeId,...(partitionKey ? {partitionKey} : {})})),cookieIdentity);
}
export async function scanSites(): Promise<ScanResult> {
  const [cookies, visits, bookmarks] = await Promise.all([readCookies(),readHistory(),readBookmarks()]);
  return {sites:inventoryFromCookies(cookies,visits.history,bookmarks.bookmarks),coverage,warnings:visits.warning ? [visits.warning]:[]};
}
export async function removeData(site: SiteRecord, options: CleanupOptions): Promise<void> {
  if (!site.origins.length) throw Error('No valid website origins selected.');
  const errors: string[] = [];
  if (options.cookies) {
    if (!await hasSiteAccess()) throw Error('Cookie access is required. Bookmarks have been kept.');
    for (const cookie of site.cookies) {
      try {
        const details: chrome.cookies.CookieDetails = {url:`${cookie.secure?'https':'http'}://${cookie.domain.replace(/^\./,'')}${cookie.path}`,name:cookie.name,storeId:cookie.storeId,...(cookie.partitionKey ? {partitionKey:cookie.partitionKey} : {})};
        await chrome.cookies.remove(details);
        // Removal can return null when the cookie was already absent. Verify by exact identity.
        const remaining = await chrome.cookies.getAll({domain:cookie.domain,name:cookie.name,storeId:cookie.storeId,partitionKey:cookie.partitionKey ?? {}});
        if (remaining.some(c=>cookieIdentity(c)===cookieIdentity(cookie))) throw Error('A selected cookie could not be removed.');
      } catch { errors.push(`Could not remove a cookie for ${cookie.domain}.`); }
    }
  }
  const data: chrome.browsingData.DataTypeSet = {};
  if(options.savedData) Object.assign(data,{localStorage:true,indexedDB:true,fileSystems:true});
  if(options.cache) Object.assign(data,{cache:true,cacheStorage:true});
  if(options.workers) data.serviceWorkers=true;
  if(Object.keys(data).length) {
    const origins: [string,...string[]] = [site.origins[0],...site.origins.slice(1)];
    try { await chrome.browsingData.remove({origins},data); } catch { errors.push('Some selected site-data requests failed.'); }
  }
  if(errors.length) throw Error(errors.join(' '));
}
