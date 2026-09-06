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
