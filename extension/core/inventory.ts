import type { BookmarkRef, CookieRef, SiteRecord } from "./types.js";
import {
  cookieAppliesToUrl,
  cookieIdentity,
  cookieOwner,
  unique,
} from "../helpers/sites.js";

interface ParsedWebItem<T> {
  item: T;
  host: string;
  origin: string;
}

function parseWebUrl(
  value: string,
): { host: string; origin: string } | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      return undefined;
    return { host: url.hostname, origin: url.origin };
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
  const parsedHistory = parseWebItems(history, (visit) => visit.url);
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
      host = location?.host;
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
    if (origin && host) {
      site.origins.push(origin, `https://${host}`, `http://${host}`);
      site.cookies.push(
        ...(cookies ?? []).filter((cookie) =>
          cookieAppliesToUrl(cookie, bookmark.url),
        ),
      );
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
