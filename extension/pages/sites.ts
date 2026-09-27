import { permissionAction } from "../components/permission-action.js";
import { workspaceToolbar, selectionControl, selectionActions, searchInput, filterSelect } from "../components/workspace-controls.js";
import { toast } from "../components/feedback.js";
import { requestLeave } from "../components/form-session.js";
import { detailsDrawer } from "../components/details-drawer.js";
import { emit } from "../components/events.js";
import { readBookmarks } from "../browser/bookmarks.js";
import {
  coverage,
  hasSiteAccess,
  requestSiteAccess,
  scanSites,
} from "../browser/site-data.js";
import { analyzeImpact } from "../core/impact.js";
import type {
  BookmarkFolder,
  BookmarkRef,
  CleanupOptions,
  Job,
  SiteRecord,
} from "../core/types.js";
import { Selection } from "../core/state.js";
import { plural } from "../helpers/format.js";
import { cleanupDialog, type PreparedCleanup } from "../components/cleanup-dialog.js";
import { button, el, status } from "../components/dom.js";
import { siteDetails, type DetailsSnapshot } from "../components/site-details.js";
import { siteTimeline } from "../components/site-timeline.js";
import {
  CleanupJobState,
  Inspection,
  WorkspaceLoader,
  historyAccessAction,
  reportLoadFailure,
  workspaceLayout,
  type WorkspacePage,
} from "./workspace.js";

/** Undated sites last; while dates load, keep a stable alphabetical order. */
function byLastVisit(order: "oldest" | "newest", datesLoading: boolean) {
  return (a: SiteRecord, b: SiteRecord): number => {
    if (datesLoading) return a.host.localeCompare(b.host);
    if (!a.lastVisit && !b.lastVisit) return a.host.localeCompare(b.host);
    if (!a.lastVisit) return 1;
    if (!b.lastVisit) return -1;
    return (
      (order === "oldest"
        ? a.lastVisit - b.lastVisit
        : b.lastVisit - a.lastVisit) || a.host.localeCompare(b.host)
    );
  };
}

export function sitesPage(onStarted: (job: Job) => void): WorkspacePage {
  const layout = workspaceLayout({
    title: "Site data cleanup",
    description: "Choose the sites you no longer need.",
    infoLabel: "About site discovery",
    info: coverage,
  });
  const { list, feedback } = layout;
  let sites: SiteRecord[] = [];
  let allBookmarks: BookmarkRef[] = [];
  let folders: BookmarkFolder[] = [];
  let datesLoading = false;
  const cleanupJob = new CleanupJobState();
  const selection = new Selection();
  const drawer = detailsDrawer();
  const inspection = new Inspection({
    drawer,
    list,
    kind: "site",
    render: (id) => {
      const site = sites.find((item) => item.id === id);
      return site
        ? detailsFor(site)
        : status("This detected site is no longer available. Close details to continue.");
    },
  });
  const search = searchInput("Find a website");
  const order = filterSelect("Order by last recorded visit", [
    ["oldest", "Oldest visit first"],
    ["newest", "Newest visit first"],
  ] as const);
  const bookmarkFilter = filterSelect("Filter sites by bookmark status", [
    ["all", "All sites"],
    ["saved", "Bookmarked"],
    ["unsaved", "Not bookmarked"],
  ] as const);
  const access = permissionAction({
    label: "Allow site discovery", request: requestSiteAccess,
    granted: "Site discovery enabled.", declined: "Site access declined. You can still use Bookmark cleanup.",
    onGranted: () => loader.load(true, false),
  });
  access.hidden = true;
  const history = historyAccessAction(() => loader.load(true, false));

  const filtersActive = () => !!search.value.trim() || bookmarkFilter.value !== "all";
  function visible() {
    const query = search.value.trim().toLowerCase();
    return sites
      .filter(
        (site) =>
          site.host.includes(query) &&
          (bookmarkFilter.value === "all" || (bookmarkFilter.value === "saved" ? site.bookmarks.length > 0 : site.bookmarks.length === 0)),
      )
      .sort(byLastVisit(order.value, datesLoading));
  }

  function detailsFor(site: SiteRecord): HTMLElement {
    const content = siteDetails(site, {
      allBookmarks,
      folders,
      detectedSites: sites,
      loadingDates: datesLoading,
      onCleanup: (target) => { if (!cleanupJob.blocked) openDirectCleanup(target); },
      onMutation: reconcileMutation,
    });
    const clean = content.querySelector<HTMLButtonElement>(".detail-cleanup");
    if (clean) clean.disabled = cleanupJob.blocked;
    return content;
  }

  function resultSummary(shown: number): HTMLElement {
    const resultCount = el("span", "fine result-count", `${shown} of ${sites.length} sites`);
    resultCount.setAttribute("role", "status");
    const reset = button("Reset filters", () => {
      search.value = "";
      bookmarkFilter.value = "all";
      render();
      search.focus();
    }, "quiet reset-filters");
    reset.hidden = !filtersActive();
    const resultInfo = el("div", "list-results");
    resultInfo.append(resultCount, reset);
    resultInfo.hidden = !loader.loaded;
    return resultInfo;
  }

  function emptyMessage(): string {
    if (!loader.loaded) return "Allow site discovery to list detected data.";
    return sites.length
      ? "No websites match these filters."
      : "No cookies detected. Other site storage may still exist.";
  }

  function render() {
    changed();
    order.disabled = datesLoading;
    order.title = datesLoading ? "Visit dates are still loading" : "";
    const filtered = visible();
    list.replaceChildren(
      all.element,
      resultSummary(filtered.length),
      filtered.length
        ? siteTimeline(filtered, selection, (site, trigger) => void inspection.open(site.id, trigger), changed)
        : status(emptyMessage()),
    );
    all.update();
    drawer.syncInspection();
  }

  /** Replace inventory and bookmark data and keep selections that still exist. */
  function applyInventory(scanned: SiteRecord[], bookmarks: Awaited<ReturnType<typeof readBookmarks>>) {
    sites = scanned;
    allBookmarks = bookmarks.bookmarks;
    folders = bookmarks.folders;
    selection.retain(new Set(sites.map((site) => site.id)));
  }

  async function reconcileMutation(id: string | undefined): Promise<DetailsSnapshot | undefined> {
    const [scan, bookmarks] = await Promise.all([scanSites(), readBookmarks()]);
    applyInventory(scan.sites, bookmarks);
    render();
    emit("bookmarks-changed", "sites");
    const site = inspection.id
      ? sites.find((item) => item.id === inspection.id)
      : undefined;
    if (!site) return undefined;
    return {
      site,
      inspectedBookmark: id
        ? allBookmarks.find((bookmark) => bookmark.id === id)
        : undefined,
      allBookmarks,
      folders,
      detectedSites: sites,
    };
  }

  /** Data-only cleanup from a fresh scan; bookmarks are impact information, never targets. */
  async function prepareSites(
    ids: ReadonlySet<string>,
    options: CleanupOptions,
  ): Promise<PreparedCleanup> {
    const [scan, bookmarks] = await Promise.all([scanSites(), readBookmarks()]);
    const targets = scan.sites
      .filter((site) => ids.has(site.id))
      .map((site) => ({ ...site, bookmarks: [] }));
    if (!targets.length) throw Error("The selected site is no longer available.");
    return {
      sites: targets,
      impact: analyzeImpact(targets, bookmarks.bookmarks, scan.sites, options),
    };
  }

  function openDirectCleanup(site: SiteRecord) {
    if (cleanupJob.blocked) return;
    const ids = new Set([site.id]);
    cleanupDialog((options) => prepareSites(ids, options), false, onStarted, { label: `This site: ${site.host}` });
  }

  const all = selectionControl(selection, () => new Set(visible().map(site => site.id)), filtersActive, render, () => cleanupJob.blocked);
  const actions = selectionActions({
    selection,
    selectAll: all,
    disabled: () => loader.busy || cleanupJob.blocked,
    onClean: async () => {
      if (cleanupJob.blocked) return;
      if (!(await requestLeave())) return;
      const ids = new Set(selection.ids);
      cleanupDialog((options) => prepareSites(ids, options), false, onStarted, { label: `Selected: ${plural(ids.size, "site")}` });
    },
    onClear: () => render(),
  });
  const changed = actions.update;
  const loader: WorkspaceLoader = new WorkspaceLoader({
    list,
    feedback,
    subject: "detected data",
    changed,
    beforeLoad: history.sync,
    run: async ({ isCurrent, announce }) => {
      if (!(await hasSiteAccess())) {
        if (!isCurrent()) return;
        access.hidden = false;
        feedback.replaceChildren(
          status("Discovery needs cookie and website access. Browsing data stays in your browser."),
        );
        render();
        return;
      }
      access.hidden = true;
      const bookmarksPromise = readBookmarks();
      datesLoading = true;
      // Show cookie-based sites first; visit dates follow from history.
      const result = await scanSites((basic) => {
        if (!isCurrent()) return;
        sites = basic.sites;
        loader.loaded = true;
        render();
        feedback.replaceChildren(status("Loading visit dates…", true));
        inspection.update();
      });
      const bookmarks = await bookmarksPromise;
      if (!isCurrent()) return;
      applyInventory(result.sites, bookmarks);
      datesLoading = false;
      loader.loaded = true;
      render();
      inspection.update();
      feedback.replaceChildren(...result.warnings.map((warning) => status(warning)));
      if (announce) toast("Site data refreshed.");
    },
    failed: () => {
      datesLoading = false;
      reportLoadFailure(feedback, "Could not refresh site data. Try Refresh again.",
        loader.loaded
          ? "Refresh failed. The previous list may be stale. Try Refresh again."
          : "Could not discover site data. Check access and try Refresh again.");
    },
  });
  layout.mount(workspaceToolbar([loader.refreshButton, search, order, bookmarkFilter, history.element], actions.elements), access, feedback);
  search.addEventListener("input", render);
  order.addEventListener("change", render);
  bookmarkFilter.addEventListener("change", render);

  render();
  return {
    element: layout.element,
    load: () => loader.load(),
    refresh: () => loader.refresh(),
    setCleanupJob: (job, unavailable = false) => {
      const wasBlocked = cleanupJob.blocked;
      cleanupJob.set(job, unavailable);
      if (cleanupJob.blocked === wasBlocked) return;
      changed();
      inspection.update();
    },
    invalidate: () => loader.invalidate(),
  };
}
