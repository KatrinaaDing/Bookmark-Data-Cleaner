import type { BookmarkRef, CookieRef, SiteRecord } from "./types.js";
import {
  cookieIdentity,
  cookieOwner,
  domainMatches,
  hostOf,
  unique,
  webOrigin,
} from "../helpers/sites.js";
export function inventoryFromCookies(
  cookies: CookieRef[],
  history: chrome.history.HistoryItem[],
  bookmarks: BookmarkRef[],
): SiteRecord[] {
  const groups = new Map<string, SiteRecord>();
  for (const cookie of cookies) {
    const host = cookieOwner(cookie);
    if (!host) continue;
    let site = groups.get(host);
    if (!site) {
      site = {
        id: host,
        host,
        origins: [`http://${host}`, `https://${host}`],
        urls: [],
        cookies: [],
        bookmarks: [],
      };
      groups.set(host, site);
    }
    site.cookies.push(cookie);
  }
  for (const site of groups.values()) {
    site.cookies = unique(site.cookies, cookieIdentity);
    for (const item of history) {
      const host = hostOf(item.url ?? "");
      if (!host || !domainMatches(host, site.host)) continue;
      if (item.lastVisitTime)
        site.lastVisit = Math.max(site.lastVisit ?? 0, item.lastVisitTime);
      site.urls.push(item.url!);
      site.origins.push(webOrigin(item.url!)!);
    }
    site.bookmarks = bookmarks.filter((item) => {
      const host = hostOf(item.url);
      return host !== undefined && domainMatches(host, site.host);
    });
    site.urls = [
      ...new Set([...site.urls, ...site.bookmarks.map((b) => b.url)]),
    ];
    site.origins = [
      ...new Set([
        ...site.origins,
        ...site.bookmarks.map((b) => webOrigin(b.url)!),
      ]),
    ];
  }
  return [...groups.values()];
}
export function sitesFromBookmarks(
  bookmarks: BookmarkRef[],
  cookies: CookieRef[] = [],
  history: chrome.history.HistoryItem[] = [],
): SiteRecord[] {
  const groups = new Map<string, SiteRecord>();
  for (const bookmark of bookmarks) {
    const origin = webOrigin(bookmark.url),
      host = hostOf(bookmark.url);
    // Non-web bookmarks can be removed independently but never become data targets.
    const id = host ?? `bookmark:${bookmark.id}`;
    let site = groups.get(id);
    if (!site) {
      site = {
        id,
        host: host ?? bookmark.title,
        origins: [],
        urls: [],
        cookies: [],
        bookmarks: [],
      };
      groups.set(id, site);
    }
    site.bookmarks.push(bookmark);
    site.urls.push(bookmark.url);
    if (origin && host) {
      site.origins.push(origin, `https://${host}`, `http://${host}`);
      site.cookies = cookies.filter((c) =>
        c.partitionKey
          ? !!cookieOwner(c) && domainMatches(host, cookieOwner(c)!)
          : domainMatches(host, c.domain),
      );
      for (const visit of history)
        if (hostOf(visit.url ?? "") === host && visit.lastVisitTime)
          site.lastVisit = Math.max(site.lastVisit ?? 0, visit.lastVisitTime);
    }
  }
  return [...groups.values()].map((site) => ({
    ...site,
    origins: [...new Set(site.origins)],
  }));
}
