import {
  noCleanup,
  type BookmarkRef,
  type CleanupOptions,
  type CleanupPlan,
  type FolderRef,
  type Outcome,
  type SiteRecord,
} from "./types.js";
import { DATA_CATEGORIES, hasData } from "./cleanup-options.js";
import { cookieIdentity } from "../helpers/cookies.js";
import { unique } from "../helpers/collections.js";
import { errorMessage } from "../helpers/errors.js";
import { webOrigin } from "../helpers/url.js";

function validateSite(site: SiteRecord, options: CleanupOptions): void {
  if (hasData(options) && !site.origins.length)
    throw Error("Only HTTP and HTTPS bookmarks support site-data cleanup.");
  for (const origin of site.origins)
    if (webOrigin(origin) !== origin)
      throw Error("Cleanup requires valid HTTP or HTTPS origins.");
}

/** Merge records sharing a site ID and remove repeated origins, bookmarks and cookie identities. */
function mergeSites(sites: SiteRecord[]): SiteRecord[] {
  const groups = new Map<string, SiteRecord>();
  for (const site of sites) {
    const existing = groups.get(site.id);
    if (existing) {
      existing.origins.push(...site.origins);
      existing.bookmarks.push(...site.bookmarks);
      existing.cookies.push(...site.cookies);
    } else groups.set(site.id, site);
  }
  return [...groups.values()].map((site) => ({
    ...site,
    origins: [...new Set(site.origins)],
    bookmarks: unique(site.bookmarks, (b) => b.id),
    cookies: unique(site.cookies, cookieIdentity),
  }));
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
  for (const site of snapshot.sites) validateSite(site, options);
  snapshot.sites = mergeSites(snapshot.sites);
  // Deepest folders first so parents can become empty.
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

type OutcomeBase = Omit<Outcome, "status" | "message">;

/** Run one operation and record it as completed or failed; never throws. */
async function attempt(
  outcomes: Outcome[],
  base: OutcomeBase,
  operation: () => Promise<void>,
  completedMessage: string,
  failedMessage: (error: unknown) => string = errorMessage,
): Promise<boolean> {
  try {
    await operation();
    outcomes.push({ ...base, status: "completed", message: completedMessage });
    return true;
  } catch (error) {
    outcomes.push({ ...base, status: "failed", message: failedMessage(error) });
    return false;
  }
}

function bookmarkBase(bookmark: BookmarkRef): OutcomeBase {
  return { target: bookmark.id, label: bookmark.title || bookmark.url, kind: "bookmark" };
}

/**
 * Clear each site's selected data categories, then its bookmarks. A bookmark shared by
 * several sites is removed after its last dependency, and only if every one succeeded.
 */
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
    for (const { key, label } of DATA_CATEGORIES)
      if (plan.options[key]) {
        const succeeded = await attempt(
          outcomes,
          { target: site.host, kind: "data" },
          () => operations.removeData(site, { ...noCleanup, [key]: true }),
          `${label}: cleanup request completed.`,
          (error) => `${label}: ${errorMessage(error)}`,
        );
        dataSucceeded &&= succeeded;
      }
    if (plan.options.bookmarks)
      for (const bookmark of site.bookmarks) {
        if (removed.has(bookmark.id)) continue;
        if (!dataSucceeded) retained.add(bookmark.id);
        if (lastDependency.get(bookmark.id) !== index) continue;
        if (retained.has(bookmark.id)) {
          outcomes.push({
            ...bookmarkBase(bookmark),
            retained: true,
            status: "unverified",
            message: "Kept because site cleanup did not complete.",
          });
          continue;
        }
        if (
          await attempt(
            outcomes,
            bookmarkBase(bookmark),
            () => operations.removeBookmark(bookmark.id),
            `Removed ${bookmark.title || "untitled bookmark"}.`,
          )
        )
          removed.add(bookmark.id);
      }
    await progress(index + 1, [...outcomes]);
  }
  if (plan.options.bookmarks)
    for (const folder of plan.folders)
      await attempt(
        outcomes,
        { target: folder.id, kind: "folder" },
        () => operations.removeFolder(folder.id),
        "Removed empty folder.",
      );
  return outcomes;
}
