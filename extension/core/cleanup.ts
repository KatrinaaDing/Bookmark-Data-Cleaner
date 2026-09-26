import {
  noCleanup,
  type CleanupOptions,
  type CleanupPlan,
  type FolderRef,
  type Outcome,
  type SiteRecord,
} from "./types.js";
import {
  cookieIdentity,
  errorMessage,
  unique,
  webOrigin,
} from "../helpers/sites.js";
export function hasData(options: CleanupOptions): boolean {
  return (
    options.cookies || options.savedData || options.cache || options.workers
  );
}
export function buildCleanupPlan(
  sites: SiteRecord[],
  options: CleanupOptions,
  folders: FolderRef[] = [],
): CleanupPlan {
  if (!sites.length && !(options.bookmarks && folders.length))
    throw Error("Select at least one bookmark or site.");
  if (!hasData(options) && !options.bookmarks)
    throw Error("Choose what to remove.");
  const snapshot = structuredClone({ sites, options, folders });
  const groups = new Map<string, SiteRecord>();
  for (const site of snapshot.sites) {
    if (hasData(options) && !site.origins.length)
      throw Error("Only HTTP and HTTPS bookmarks support site-data cleanup.");
    for (const origin of site.origins)
      if (webOrigin(origin) !== origin)
        throw Error("Cleanup requires valid HTTP or HTTPS origins.");
    const existing = groups.get(site.id);
    if (existing) {
      existing.origins.push(...site.origins);
      existing.bookmarks.push(...site.bookmarks);
      existing.cookies.push(...site.cookies);
    } else groups.set(site.id, site);
  }
  snapshot.sites = [...groups.values()].map((site) => ({
    ...site,
    origins: [...new Set(site.origins)],
    bookmarks: unique(site.bookmarks, (b) => b.id),
    cookies: unique(site.cookies, cookieIdentity),
  }));
  snapshot.folders = unique(snapshot.folders, (f) => f.id).sort(
    (a, b) => b.depth - a.depth,
  );
  if (
    options.bookmarks &&
    !hasData(options) &&
    !snapshot.sites.some((s) => s.bookmarks.length) &&
    !snapshot.folders.length
  )
    throw Error("No bookmarks selected for removal.");
  return snapshot;
}
export interface CleanupOperations {
  removeData(site: SiteRecord, options: CleanupOptions): Promise<void>;
  removeBookmark(id: string): Promise<void>;
  removeFolder(id: string): Promise<void>;
}
export async function executeCleanup(
  plan: CleanupPlan,
  operations: CleanupOperations,
  progress: (
    completed: number,
    outcomes: Outcome[],
  ) => Promise<void> | void = () => {},
): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  const removed = new Set<string>();
  const retained = new Set<string>();
  const lastDependency = new Map<string, number>();
  plan.sites.forEach((site, index) => {
    for (const bookmark of site.bookmarks) lastDependency.set(bookmark.id, index);
  });
  for (const [index, site] of plan.sites.entries()) {
    let dataSucceeded = true;
    const categories = [
      ["cookies", "Cookies and sign-in data"],
      ["savedData", "Saved site data"],
      ["cache", "Cached resources"],
      ["workers", "Background workers"],
    ] as const;
    for (const [category, label] of categories)
      if (plan.options[category]) {
        try {
          await operations.removeData(site, { ...noCleanup, [category]: true });
          outcomes.push({
            target: site.host,
            kind: "data",
            status: "completed",
            message: `${label}: cleanup request completed.`,
          });
        } catch (error) {
          dataSucceeded = false;
          outcomes.push({
            target: site.host,
            kind: "data",
            status: "failed",
            message: `${label}: ${errorMessage(error)}`,
          });
        }
      }
    if (plan.options.bookmarks)
      for (const bookmark of site.bookmarks) {
        if (removed.has(bookmark.id)) continue;
        if (!dataSucceeded) retained.add(bookmark.id);
        if (lastDependency.get(bookmark.id) !== index) continue;
        if (retained.has(bookmark.id)) {
          outcomes.push({
            target: bookmark.id,
            label: bookmark.title || bookmark.url,
            retained: true,
            kind: "bookmark",
            status: "unverified",
            message: "Kept because site cleanup did not complete.",
          });
          continue;
        }
        try {
          await operations.removeBookmark(bookmark.id);
          removed.add(bookmark.id);
          outcomes.push({
            target: bookmark.id,
            label: bookmark.title || bookmark.url,
            kind: "bookmark",
            status: "completed",
            message: `Removed ${bookmark.title || "untitled bookmark"}.`,
          });
        } catch (error) {
          outcomes.push({
            target: bookmark.id,
            label: bookmark.title || bookmark.url,
            kind: "bookmark",
            status: "failed",
            message: errorMessage(error),
          });
        }
      }
    await progress(index + 1, [...outcomes]);
  }
  if (plan.options.bookmarks)
    for (const folder of plan.folders) {
      try {
        await operations.removeFolder(folder.id);
        outcomes.push({
          target: folder.id,
          kind: "folder",
          status: "completed",
          message: "Removed empty folder.",
        });
      } catch (error) {
        outcomes.push({
          target: folder.id,
          kind: "folder",
          status: "failed",
          message: errorMessage(error),
        });
      }
    }
  return outcomes;
}
