import type { BookmarkRef, CookieRef, SiteRecord } from "./types.js";
import {
  cookieIdentity,
  cookieOwner,
  unique,
} from "../helpers/sites.js";

interface ParsedWebItem<T> {
  item: T;
  host: string;
  origin: string;
  protocol: string;
}

function parseWebUrl(
  value: string,
): { host: string; origin: string; protocol: string } | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      return undefined;
    return { host: url.hostname, origin: url.origin, protocol: url.protocol };
  } catch {
    return undefined;
  }
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
  const matches = index.get(host);
  if (matches) matches.push(cookie);
  else index.set(host, [cookie]);
}

function ancestorHosts(host: string): string[] {
  const ancestors: string[] = [];
  let candidate = host;
  while (candidate) {
    ancestors.push(candidate);
    const dot = candidate.indexOf(".");
    if (dot < 0) break;
    candidate = candidate.slice(dot + 1);
  }
  return ancestors;
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
        const host = cookie.domain.replace(/^\./, "").toLowerCase();
        const hostOnly = cookie.hostOnly ?? !cookie.domain.startsWith(".");
        addCookie(hostOnly ? this.hostOnly : this.domain, host, indexed);
        continue;
      }

      const partition = parseWebUrl(cookie.partitionKey.topLevelSite ?? "");
      if (!partition) continue;
      let byHost = this.partitions.get(partition.protocol);
      if (!byHost) {
        byHost = new Map();
        this.partitions.set(partition.protocol, byHost);
      }
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

function matchingGroups(
  host: string,
  groups: Map<string, SiteRecord>,
): SiteRecord[] {
  const matches: SiteRecord[] = [];
  let candidate = host;
  while (candidate) {
    const group = groups.get(candidate);
    if (group) matches.push(group);
    const dot = candidate.indexOf(".");
    if (dot < 0) break;
    candidate = candidate.slice(dot + 1);
  }
  return matches;
}

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
        cookiesAvailable: true,
      };
      groups.set(host, site);
    }
    site.cookies.push(cookie);
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
export function sitesFromBookmarks(
  bookmarks: BookmarkRef[],
  cookies?: CookieRef[],
  history: chrome.history.HistoryItem[] = [],
): SiteRecord[] {
  const groups = new Map<string, SiteRecord>();
  const cookieIndex = cookies && new CookieMatchIndex(cookies);
  const parsedHistory = parseWebItems(history, (visit) => visit.url);
  const matchedSchemeHosts = new Set<string>();
  const latestByHost = new Map<string, number>();
  const originsByHost = new Map<string, Set<string>>();
  for (const { item, host, origin } of parsedHistory) {
    if (item.lastVisitTime)
      latestByHost.set(
        host,
        Math.max(latestByHost.get(host) ?? 0, item.lastVisitTime),
      );
    let origins = originsByHost.get(host);
    if (!origins) {
      origins = new Set();
      originsByHost.set(host, origins);
    }
    origins.add(origin);
  }
  for (const bookmark of bookmarks) {
    const location = parseWebUrl(bookmark.url),
      origin = location?.origin,
      host = location?.host,
      protocol = location?.protocol;
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
        cookiesAvailable: cookies !== undefined,
      };
      groups.set(id, site);
    }
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
