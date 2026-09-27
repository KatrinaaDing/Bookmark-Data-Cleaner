import type { CookieRef } from "../core/types.js";
import { cookieIdentity } from "../helpers/cookies.js";
import { unique } from "../helpers/collections.js";

function unsupported(cookie: CookieRef, reason: string): never {
  throw Error(
    `Cookie cleanup for ${cookie.domain} is unsupported: ${reason}. ` +
      "No cookies in this site request were changed. Refresh the inventory or clear this cookie in browser settings. Bookmarks have been kept.",
  );
}

/** Build an expired replacement of the reviewed identity, never a URL/name removal. */
export function cookieExpiry(cookie: CookieRef): chrome.cookies.SetDetails {
  if (
    typeof cookie.hostOnly !== "boolean" ||
    typeof cookie.httpOnly !== "boolean" ||
    typeof cookie.secure !== "boolean" ||
    !cookie.storeId
  )
    unsupported(cookie, "required scope metadata is missing");

  // CreateSanitizedCookie rejects names changed by token parsing. Check first
  // so even a later unsupported cookie cannot leave this request half applied.
  if (
    !/^[\x20-\x7e]*$/.test(cookie.name) ||
    cookie.name.trim() !== cookie.name ||
    /[;=]/.test(cookie.name)
  )
    unsupported(cookie, "the cookie name cannot be represented exactly");

  const host = cookie.domain.replace(/^\./, "");
  let url: URL;
  try {
    // HTTPS permits expiry of both Secure and non-Secure cookies, including
    // non-Secure cookies with a same-name Secure neighbour at another scope.
    url = new URL(`https://${host}/`);
  } catch {
    unsupported(cookie, "the cookie domain cannot be represented exactly");
  }
  if (
    url.hostname !== host ||
    url.host !== host ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    cookie.hostOnly === cookie.domain.startsWith(".")
  )
    unsupported(cookie, "the cookie domain cannot be represented exactly");

  // Chromium's CreateSanitizedCookie canonicalizes the explicit path. Cookie
  // paths read from HTTP Set-Cookie need not already be URL-canonical. In
  // particular, expiry of /a?b could delete /a%3Fb instead. Refuse those paths.
  if (
    !/^\/[\x21-\x7e]*$/.test(cookie.path) ||
    /[?#\\;]/.test(cookie.path) ||
    new URL(url.origin + cookie.path).pathname !== cookie.path
  )
    unsupported(cookie, "the cookie path would be normalized by the browser");

  const prefix = cookie.name.toLowerCase();
  if (
    ((prefix.startsWith("__secure-") || prefix.startsWith("__host-") ||
      prefix.startsWith("__http-")) && !cookie.secure) ||
    (prefix.startsWith("__host-") && (!cookie.hostOnly || cookie.path !== "/")) ||
    ((prefix.startsWith("__http-") || prefix.startsWith("__host-http-")) && !cookie.httpOnly)
  )
    unsupported(cookie, "the required cookie-prefix attributes are missing");

  if (cookie.partitionKey) {
    const { topLevelSite, hasCrossSiteAncestor } = cookie.partitionKey;
    if (!topLevelSite || typeof hasCrossSiteAncestor !== "boolean")
      unsupported(cookie, "the complete partition key is missing");
    let partition: URL;
    try {
      partition = new URL(topLevelSite);
    } catch {
      unsupported(cookie, "the partition site cannot be represented exactly");
    }
    if (
      !["https:", "http:"].includes(partition.protocol) ||
      partition.origin !== topLevelSite ||
      !cookie.secure
    )
      unsupported(cookie, "the partition site cannot be represented exactly");
  }

  // Keeping these attributes is required for the corresponding cookie prefixes.
  // Other browser validation failures are surfaced; there is no broader fallback.
  return {
    url: url.href,
    name: cookie.name,
    value: cookie.name ? "" : "expired",
    ...(cookie.hostOnly ? {} : { domain: cookie.domain }),
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    storeId: cookie.storeId,
    expirationDate: 1,
    ...(cookie.partitionKey ? { partitionKey: { ...cookie.partitionKey } } : {}),
  };
}

async function matchingCookies(cookie: CookieRef): Promise<chrome.cookies.Cookie[]> {
  const candidates = await chrome.cookies.getAll({
    domain: cookie.domain,
    name: cookie.name,
    path: cookie.path,
    storeId: cookie.storeId,
    partitionKey: cookie.partitionKey ?? {},
  });
  return candidates.filter(
    (candidate) =>
      cookieIdentity(candidate) === cookieIdentity(cookie) &&
      candidate.hostOnly === cookie.hostOnly,
  );
}

export async function removeSelectedCookies(cookies: CookieRef[]): Promise<void> {
  const selected = unique(cookies, cookieIdentity);
  // Validate the whole site request before its first mutation. This check is
  // not a lock: safety against other identities comes from explicit set scope.
  selected.forEach(cookieExpiry);
  const prepared = [];
  for (const cookie of selected) {
    const current = await matchingCookies(cookie);
    if (!current.length) continue;
    if (current.length !== 1)
      unsupported(cookie, "the browser returned indistinguishable cookie identities");
    prepared.push({ cookie, details: cookieExpiry(current[0]) });
  }
  for (const { cookie, details } of prepared) {
    try {
      // Expiry can legitimately return null, or a same-name neighbour from the
      // API's follow-up URL lookup. Neither is evidence of what was removed.
      await chrome.cookies.set(details);
      if ((await matchingCookies(cookie)).length)
        throw Error("The selected identity remains or was recreated during cleanup.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Browser request failed.";
      throw Error(
        `Could not finish cookie cleanup for ${cookie.domain}: ${reason} ` +
          "Some earlier cookies may have been removed. Refresh before retrying. Bookmarks have been kept.",
      );
    }
  }
}
