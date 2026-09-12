import type { CookieRef } from "../core/types.js";
export function webOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.origin : undefined;
  } catch {
    return undefined;
  }
}
export function hostOf(value: string): string | undefined {
  const origin = webOrigin(value);
  return origin ? new URL(origin).hostname : undefined;
}
export function domainMatches(host: string, domain: string): boolean {
  const bare = domain.replace(/^\./, "").toLowerCase();
  return host === bare || host.endsWith(`.${bare}`);
}
export function cookieAppliesToHost(
  cookie: CookieRef,
  host: string,
): boolean {
  const normalizedHost = host.toLowerCase();
  const cookieHost = cookie.domain.replace(/^\./, "").toLowerCase();
  const hostOnly = cookie.hostOnly ?? !cookie.domain.startsWith(".");
  return hostOnly
    ? normalizedHost === cookieHost
    : domainMatches(normalizedHost, cookieHost);
}
export function cookieAppliesToUrl(cookie: CookieRef, value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (!cookie.partitionKey) return cookieAppliesToHost(cookie, url.hostname);
  const topLevelSite = cookie.partitionKey.topLevelSite;
  if (!topLevelSite) return false;
  let partition: URL;
  try {
    partition = new URL(topLevelSite);
  } catch {
    return false;
  }
  return (
    url.protocol === partition.protocol &&
    domainMatches(url.hostname, partition.hostname)
  );
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
export function cookieOwner(cookie: CookieRef): string | undefined {
  return cookie.partitionKey
    ? hostOf(cookie.partitionKey.topLevelSite ?? "")
    : cookie.domain.replace(/^\./, "").toLowerCase();
}
export function unique<T>(items: T[], key: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The operation could not be completed. Please retry.";
}
