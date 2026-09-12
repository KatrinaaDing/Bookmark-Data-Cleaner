import type {
  BookmarkRef,
  CleanupOptions,
  CookieRef,
  SiteRecord,
} from "./types.js";
import {
  cookieOwner,
  domainMatches,
  hostOf,
  webOrigin,
} from "../helpers/sites.js";

export interface CleanupImpact {
  duplicates: BookmarkRef[];
  relatedBookmarks: BookmarkRef[];
  relatedSites: SiteRecord[];
}

function hasWebsiteData(options?: CleanupOptions): boolean {
  return (
    options === undefined ||
    options.cookies ||
    options.savedData ||
    options.cache ||
    options.workers
  );
}

function cookieScopeHost(cookie: CookieRef): string | undefined {
  return cookie.partitionKey
    ? cookieOwner(cookie)
    : cookie.domain.replace(/^\./, "").toLowerCase();
}

function hostInCookieScope(host: string, cookie: CookieRef): boolean {
  const scope = cookieScopeHost(cookie);
  return !!scope && domainMatches(host, scope);
}

function siteHosts(site: SiteRecord): Set<string> {
  const hosts = new Set<string>();
  if (hostOf(`https://${site.host}`)) hosts.add(site.host.toLowerCase());
  for (const origin of site.origins) {
    const host = hostOf(origin);
    if (host) hosts.add(host);
  }
  for (const bookmark of site.bookmarks) {
    const host = hostOf(bookmark.url);
    if (host) hosts.add(host);
  }
  return hosts;
}

export function analyzeImpact(
  targets: SiteRecord[],
  allBookmarks: BookmarkRef[],
  detectedSites: SiteRecord[] = [],
  options?: CleanupOptions,
): CleanupImpact {
  const selectedBookmarkIds = new Set(
    targets.flatMap((site) => site.bookmarks.map((bookmark) => bookmark.id)),
  );
  const selectedUrls = new Set(
    targets.flatMap((site) => site.bookmarks.map((bookmark) => bookmark.url)),
  );
  const selectedSiteIds = new Set(targets.map((site) => site.id));
  const duplicates = allBookmarks.filter(
    (bookmark) =>
      !selectedBookmarkIds.has(bookmark.id) && selectedUrls.has(bookmark.url),
  );
  if (!hasWebsiteData(options))
    return { duplicates, relatedBookmarks: [], relatedSites: [] };

  const includesOriginEffects =
    options === undefined ||
    options.savedData ||
    options.cache ||
    options.workers;
  const includesCookieEffects = options === undefined || options.cookies;
  const selectedOrigins = new Set(
    targets
      .flatMap((site) => site.origins)
      .map((origin) => webOrigin(origin))
      .filter((origin): origin is string => !!origin),
  );
  const selectedCookies = targets.flatMap((site) => site.cookies);
  const isRelatedUrl = (url: string): boolean => {
    const origin = webOrigin(url);
    const host = hostOf(url);
    return (
      (includesOriginEffects && !!origin && selectedOrigins.has(origin)) ||
      (includesCookieEffects &&
        !!host &&
        selectedCookies.some((cookie) => hostInCookieScope(host, cookie)))
    );
  };
  const duplicateIds = new Set(duplicates.map((bookmark) => bookmark.id));
  const relatedBookmarks = allBookmarks.filter(
    (bookmark) =>
      !selectedBookmarkIds.has(bookmark.id) &&
      !duplicateIds.has(bookmark.id) &&
      isRelatedUrl(bookmark.url),
  );
  const relatedSites = detectedSites.filter((site) => {
    if (selectedSiteIds.has(site.id)) return false;
    if (
      includesOriginEffects &&
      site.origins.some((origin) => selectedOrigins.has(origin))
    )
      return true;
    for (const host of siteHosts(site))
      if (
        includesCookieEffects &&
        selectedCookies.some((cookie) => hostInCookieScope(host, cookie))
      )
        return true;
    return false;
  });
  return { duplicates, relatedBookmarks, relatedSites };
}
