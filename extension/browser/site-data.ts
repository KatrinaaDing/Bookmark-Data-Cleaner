import type {
  CleanupOptions,
  CookieRef,
  ScanResult,
  SiteRecord,
} from "../core/types.js";
import { inventoryFromCookies } from "../core/inventory.js";
import type { DataCategory } from "../core/cleanup-options.js";
import { readBookmarks } from "./bookmarks.js";
import { readHistory } from "./history.js";
import { cookieIdentity } from "../helpers/cookies.js";
import { unique } from "../helpers/collections.js";
import { removeSelectedCookies } from "./cookie-removal.js";
const access: chrome.permissions.Permissions = {
  permissions: ["cookies"],
  origins: ["http://*/*", "https://*/*"],
};
export const coverage =
  "Sites detected through cookies, including partitioned cookies. Sites with only other storage may be missing. Dates describe retained visits, not data age.";
export function hasSiteAccess(): Promise<boolean> {
  return chrome.permissions.contains(access);
}
export function requestSiteAccess(): Promise<boolean> {
  return chrome.permissions.request(access);
}
export async function readCookies(): Promise<CookieRef[]> {
  if (!(await hasSiteAccess()))
    throw Error(
      "Allow cookie and website access to discover stored site data.",
    );
  const stores = await chrome.cookies.getAllCookieStores();
  const cookies = (
    await Promise.all(
      stores.map((store) =>
        chrome.cookies.getAll({ storeId: store.id, partitionKey: {} }),
      ),
    )
  ).flat();
  return unique(
    cookies.map(
      ({ name, domain, hostOnly, path, secure, httpOnly, storeId, partitionKey }) => ({
        name,
        domain,
        hostOnly,
        path,
        secure,
        httpOnly,
        storeId,
        ...(partitionKey ? { partitionKey } : {}),
      }),
    ),
    cookieIdentity,
  );
}
export async function scanSites(
  onBasic?: (result: ScanResult) => void,
): Promise<ScanResult> {
  const cookiesPromise = readCookies();
  const bookmarksPromise = readBookmarks();
  const historyPromise = readHistory();
  const [cookies, bookmarks] = await Promise.all([
    cookiesPromise,
    bookmarksPromise,
  ]);
  onBasic?.({
    sites: inventoryFromCookies(cookies, [], bookmarks.bookmarks),
    coverage,
    warnings: [],
  });
  const visits = await historyPromise;
  return {
    sites: inventoryFromCookies(cookies, visits.history, bookmarks.bookmarks),
    coverage,
    warnings: visits.warning ? [visits.warning] : [],
  };
}
/** browsingData types cleared for each origin-scoped category. */
const originDataTypes: Record<Exclude<DataCategory, "cookies">, chrome.browsingData.DataTypeSet> = {
  savedData: { localStorage: true, indexedDB: true, fileSystems: true },
  cache: { cache: true, cacheStorage: true },
  workers: { serviceWorkers: true },
};
export async function removeData(
  site: SiteRecord,
  options: CleanupOptions,
): Promise<void> {
  if (!site.origins.length) throw Error("No valid website origins selected.");
  if (options.cookies) {
    if (!(await hasSiteAccess()))
      throw Error("Cookie access is required. Bookmarks have been kept.");
    await removeSelectedCookies(site.cookies);
  }
  const data: chrome.browsingData.DataTypeSet = {};
  for (const [category, types] of Object.entries(originDataTypes))
    if (options[category as keyof typeof originDataTypes]) Object.assign(data, types);
  if (!Object.keys(data).length) return;
  const origins: [string, ...string[]] = [site.origins[0], ...site.origins.slice(1)];
  try {
    await chrome.browsingData.remove({ origins }, data);
  } catch {
    throw Error("Some selected site-data requests failed.");
  }
}
