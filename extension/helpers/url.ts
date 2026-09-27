export interface WebLocation {
  host: string;
  origin: string;
  protocol: "http:" | "https:";
}

/** Parse an HTTP(S) address; every other scheme or invalid input is not a web location. */
export function parseWebUrl(value: string): WebLocation | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return { host: url.hostname, origin: url.origin, protocol: url.protocol };
  } catch {
    return undefined;
  }
}
export function webOrigin(value: string): string | undefined {
  return parseWebUrl(value)?.origin;
}
export function hostOf(value: string): string | undefined {
  return parseWebUrl(value)?.host;
}
export function domainMatches(host: string, domain: string): boolean {
  const bare = domain.replace(/^\./, "").toLowerCase();
  return host === bare || host.endsWith(`.${bare}`);
}
/** The host itself followed by each parent domain, e.g. a.b.test, b.test, test. */
export function ancestorHosts(host: string): string[] {
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
