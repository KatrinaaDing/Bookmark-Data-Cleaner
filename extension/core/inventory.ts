import type { BookmarkRef, CookieRef, SiteRecord } from "./types.js";
import { cookieHost, cookieIdentity, cookieOwner, isHostOnly } from "../helpers/cookies.js";
import { getOrInsert, unique } from "../helpers/collections.js";
import { ancestorHosts, parseWebUrl, type WebLocation } from "../helpers/url.js";

interface ParsedWebItem<T> extends WebLocation {
  item: T;
}

function parseWebItems<T>(
  items: T[],
  urlOf: (item: T) => string | undefined,
): ParsedWebItem<T>[] {
  const parsed: ParsedWebItem<T>[] = [];
  for (const item of items) {
    const value = urlOf(item);
    if (!value) continue;
    const location = parseWebUrl(value);
    if (!location) continue;
    parsed.push({ item, ...location });
  }
  return parsed;
}

interface IndexedCookie {
  cookie: CookieRef;
  order: number;
}

function addCookie(
  index: Map<string, IndexedCookie[]>,
  host: string,
  cookie: IndexedCookie,
): void {
  getOrInsert(index, host, () => []).push(cookie);
}

class CookieMatchIndex {
  private readonly hostOnly = new Map<string, IndexedCookie[]>();
  private readonly domain = new Map<string, IndexedCookie[]>();
  private readonly partitions = new Map<
    string,
    Map<string, IndexedCookie[]>
  >();

  constructor(cookies: CookieRef[]) {
    for (const [order, cookie] of cookies.entries()) {
      const indexed = { cookie, order };
      if (!cookie.partitionKey) {
        addCookie(isHostOnly(cookie) ? this.hostOnly : this.domain, cookieHost(cookie), indexed);
        continue;
      }

      const partition = parseWebUrl(cookie.partitionKey.topLevelSite ?? "");
      if (!partition) continue;
      const byHost = getOrInsert(this.partitions, partition.protocol, () => new Map());
      addCookie(byHost, partition.host, indexed);
    }
  }

  matching(host: string, protocol: string): CookieRef[] {
    const candidates = [...(this.hostOnly.get(host) ?? [])];
    const partitionHosts = this.partitions.get(protocol);
    for (const ancestor of ancestorHosts(host)) {
      candidates.push(...(this.domain.get(ancestor) ?? []));
      candidates.push(...(partitionHosts?.get(ancestor) ?? []));
    }
    candidates.sort((left, right) => left.order - right.order);
    return candidates.map(({ cookie }) => cookie);
  }
}

function emptySite(
  id: string,
  host: string,
  origins: string[],
  cookiesAvailable: boolean,
): SiteRecord {
  return { id, host, origins, urls: [], cookies: [], bookmarks: [], cookiesAvailable };
}

function matchingGroups(
  host: string,
  groups: Map<string, SiteRecord>,
): SiteRecord[] {
  return ancestorHosts(host).flatMap((ancestor) => groups.get(ancestor) ?? []);
}

/** Site-data workspace: one record per cookie owner, enriched by visits and bookmarks. */
export function inventoryFromCookies(
  cookies: CookieRef[],
  history: chrome.history.HistoryItem[],
  bookmarks: BookmarkRef[],
): SiteRecord[] {
  const groups = new Map<string, SiteRecord>();
  for (const cookie of cookies) {
    const host = cookieOwner(cookie);
    if (!host) continue;
    getOrInsert(groups, host, () =>
      emptySite(host, host, [`http://${host}`, `https://${host}`], true),
    ).cookies.push(cookie);
  }
  for (const site of groups.values())
    site.cookies = unique(site.cookies, cookieIdentity);
  for (const { item, host, origin } of parseWebItems(
    history,
    (entry) => entry.url,
  ))
    for (const site of matchingGroups(host, groups)) {
      if (item.lastVisitTime)
        site.lastVisit = Math.max(site.lastVisit ?? 0, item.lastVisitTime);
      site.origins.push(origin);
    }
  for (const { item, host, origin } of parseWebItems(
    bookmarks,
    (entry) => entry.url,
  ))
    for (const site of matchingGroups(host, groups)) {
      site.bookmarks.push(item);
      site.urls.push(item.url);
      site.origins.push(origin);
    }
  for (const site of groups.values()) {
    site.urls = [...new Set(site.urls)];
    site.origins = [...new Set(site.origins)];
  }
  return [...groups.values()];
}
/** Bookmark workspace: one record per bookmarked host, enriched by cookies and visits. */
export function sitesFromBookmarks(
  bookmarks: BookmarkRef[],
  cookies?: CookieRef[],
  history: chrome.history.HistoryItem[] = [],
): SiteRecord[] {
  const groups = new Map<string, SiteRecord>();
  const cookieIndex = cookies && new CookieMatchIndex(cookies);
  const matchedSchemeHosts = new Set<string>();
  const latestByHost = new Map<string, number>();
  const originsByHost = new Map<string, Set<string>>();
  for (const { item, host, origin } of parseWebItems(history, (visit) => visit.url)) {
    if (item.lastVisitTime)
      latestByHost.set(
        host,
        Math.max(latestByHost.get(host) ?? 0, item.lastVisitTime),
      );
    getOrInsert(originsByHost, host, () => new Set()).add(origin);
  }
  for (const bookmark of bookmarks) {
    const location = parseWebUrl(bookmark.url),
      origin = location?.origin,
      host = location?.host,
      protocol = location?.protocol;
    // Non-web bookmarks can be removed independently but never become data targets.
    const id = host ?? `bookmark:${bookmark.id}`;
    const site = getOrInsert(groups, id, () =>
      emptySite(id, host ?? bookmark.title, [], cookies !== undefined),
    );
    site.bookmarks.push(bookmark);
    site.urls.push(bookmark.url);
    if (origin && host && protocol) {
      site.origins.push(origin, `https://${host}`, `http://${host}`);
      const schemeHost = `${protocol}\u0000${host}`;
      if (!matchedSchemeHosts.has(schemeHost)) {
        site.cookies.push(...(cookieIndex?.matching(host, protocol) ?? []));
        matchedSchemeHosts.add(schemeHost);
      }
      site.lastVisit = latestByHost.get(host);
      site.origins.push(...(originsByHost.get(host) ?? []));
    }
  }
  return [...groups.values()].map((site) => ({
    ...site,
    origins: [...new Set(site.origins)],
    cookies: unique(site.cookies, cookieIdentity),
  }));
}
