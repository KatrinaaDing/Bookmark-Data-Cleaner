import type { CookieRef } from "../core/types.js";
import { domainMatches, hostOf, parseWebUrl } from "./url.js";

/** Lower-case cookie domain without its leading dot. */
export function cookieHost(cookie: CookieRef): string {
  return cookie.domain.replace(/^\./, "").toLowerCase();
}
export function isHostOnly(cookie: CookieRef): boolean {
  return cookie.hostOnly ?? !cookie.domain.startsWith(".");
}
export function cookieAppliesToHost(
  cookie: CookieRef,
  host: string,
): boolean {
  const normalizedHost = host.toLowerCase();
  return isHostOnly(cookie)
    ? normalizedHost === cookieHost(cookie)
    : domainMatches(normalizedHost, cookieHost(cookie));
}
export function cookieAppliesToUrl(cookie: CookieRef, value: string): boolean {
  const url = parseWebUrl(value);
  if (!url) return false;
  if (!cookie.partitionKey) return cookieAppliesToHost(cookie, url.host);
  const partition = parseAnyUrl(cookie.partitionKey.topLevelSite);
  return (
    !!partition &&
    url.protocol === partition.protocol &&
    domainMatches(url.host, partition.hostname)
  );
}
function parseAnyUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}
export function cookieIdentity(cookie: CookieRef): string {
  return JSON.stringify([
    cookie.storeId,
    cookie.domain,
    cookie.path,
    cookie.name,
    cookie.partitionKey?.topLevelSite ?? "",
    cookie.partitionKey?.hasCrossSiteAncestor ?? null,
  ]);
}
/** Ordinary cookies belong to their domain; partitioned cookies to their top-level site. */
export function cookieOwner(cookie: CookieRef): string | undefined {
  return cookie.partitionKey
    ? hostOf(cookie.partitionKey.topLevelSite ?? "")
    : cookieHost(cookie);
}
/** Human-readable scope used when reviewing exactly which identity is expired. */
export function describeCookieScope(cookie: CookieRef): string {
  const partition = cookie.partitionKey
    ? ` · partition ${cookie.partitionKey.topLevelSite} · cross-site ancestor: ${cookie.partitionKey.hasCrossSiteAncestor ?? "unknown"}`
    : " · unpartitioned";
  return `${cookie.domain} · ${cookie.hostOnly ? "host-only" : "domain cookie"} · ${cookie.name} · path ${cookie.path} · store ${cookie.storeId}${partition}`;
}
