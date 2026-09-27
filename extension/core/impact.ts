import type {
  BookmarkRef,
  CleanupOptions,
  CookieRef,
  SiteRecord,
} from "./types.js";
import { hasData, hasOriginData } from "./cleanup-options.js";
import { cookieAppliesToHost, cookieAppliesToUrl } from "../helpers/cookies.js";
import { unique } from "../helpers/collections.js";
import { hostOf, webOrigin } from "../helpers/url.js";

export interface CleanupImpact {
  duplicates: BookmarkRef[];
  relatedBookmarks: BookmarkRef[];
  relatedSites: SiteRecord[];
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

function cookieAffectsSite(cookie: CookieRef, site: SiteRecord): boolean {
  if (!cookie.partitionKey)
    return [...siteHosts(site)].some((host) =>
      cookieAppliesToHost(cookie, host),
    );
  return [
    ...site.origins,
    ...site.urls,
    ...site.bookmarks.map((bookmark) => bookmark.url),
  ].some((value) => cookieAppliesToUrl(cookie, value));
}

/** Without explicit options, report the effects of clearing every data category. */
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
  if (options && !hasData(options))
    return { duplicates, relatedBookmarks: [], relatedSites: [] };

  const includesOriginEffects = !options || hasOriginData(options);
  const includesCookieEffects = !options || options.cookies;
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
        selectedCookies.some((cookie) => cookieAppliesToUrl(cookie, url)))
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
    if (
      includesCookieEffects &&
      selectedCookies.some((cookie) => cookieAffectsSite(cookie, site))
    )
      return true;
    return false;
  });
  return { duplicates, relatedBookmarks, relatedSites };
}

/** Add only explicitly chosen, currently affected bookmarks without widening data targets.
 * A bookmark shared by several targets belongs to each dependency; execution waits
 * for all of them before deciding whether the bookmark can be removed.
 */
export function withBookmarkRemovals(
  targets: SiteRecord[],
  allBookmarks: BookmarkRef[],
  options: CleanupOptions,
  extraIds: ReadonlySet<string>,
): SiteRecord[] {
  const candidates = allBookmarks.filter(bookmark => !bookmark.unmodifiable && extraIds.has(bookmark.id));
  return targets.map(target => {
    if (!options.bookmarks) return { ...target, bookmarks: [] };
    const impact = analyzeImpact([target], candidates, [], options);
    const extras = [...impact.duplicates, ...impact.relatedBookmarks];
    return { ...target, bookmarks: unique([...target.bookmarks, ...extras], bookmark => bookmark.id) };
  });
}
