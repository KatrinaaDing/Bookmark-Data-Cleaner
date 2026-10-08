import { workspaceToolbar, selectionControl, selectionActions, searchInput, filterSelect } from "../components/workspace-controls.js";
import { bookmarkSummary } from "../components/bookmark-summary.js";
import { bookmarkSignals, matchesUseFilter, USE_FILTER_OPTIONS, type BookmarkSignals } from "../components/bookmark-signals.js";
import { toast } from "../components/feedback.js";
import { requestLeave } from "../components/form-session.js";
import { detailsDrawer } from "../components/details-drawer.js";
import { emit } from "../components/events.js";
import { readBookmarks } from "../browser/bookmarks.js";
import { hasHistoryAccess, readHistory } from "../browser/history.js";
import { hasSiteAccess, readCookies } from "../browser/site-data.js";
import { sitesFromBookmarks } from "../core/inventory.js";
import { analyzeImpact, withBookmarkRemovals } from "../core/impact.js";
import { Selection } from "../core/state.js";
import type {
  BookmarkFolder,
  BookmarkRef,
  CleanupOptions,
  CookieRef,
  FolderRef,
  Job,
  SiteRecord,
} from "../core/types.js";
import { plural } from "../helpers/format.js";
import { bookmarkRowLabel, bookmarkRowSignals, bookmarkTree, setBookmarkRowBusy, type TreeView } from "../components/bookmark-tree.js";
import { cleanupDialog, type PreparedCleanup } from "../components/cleanup-dialog.js";
import { button, checkbox, clickableRow, el, status } from "../components/dom.js";
import { siteDetails, type DetailsSnapshot } from "../components/site-details.js";
import type { BookmarkMutation } from "../components/bookmark-editor.js";
import {
  CleanupJobState,
  Inspection,
  WorkspaceLoader,
  historyAccessAction,
  reportLoadFailure,
  workspaceLayout,
  type WorkspacePage,
} from "./workspace.js";

async function freshCookieSnapshot(): Promise<CookieRef[] | undefined> {
  if (!(await hasSiteAccess())) return undefined;
  try {
    return await readCookies();
  } catch {
    return undefined;
  }
}

export function bookmarksPage(onStarted: (job: Job) => void): WorkspacePage {
  const layout = workspaceLayout({
    title: "Bookmark cleanup",
    description: "Select bookmarks to review their site data.",
    infoLabel: "About bookmark cleanup",
    info: "Search saved titles, URLs or folder paths, or filter by recorded use: the date a bookmark was last opened or its site last visited. Select bookmarks to review their website data and choose whether to delete the bookmarks too.",
  });
  const { list, feedback } = layout;
  const search = searchInput("Find a bookmark");
  const useFilter = filterSelect("Filter bookmarks by recorded use", USE_FILTER_OPTIONS);
  const selection = new Selection();
  const expanded = new Set<string>();
  const cleanupJob = new CleanupJobState();
  let records: BookmarkRef[] = [];
  let folders: BookmarkFolder[] = [];
  let tree: chrome.bookmarks.BookmarkTreeNode[] = [];
  let treeView: TreeView | undefined;
  /** Contextual site records for details; enriched once cookies and history load. */
  let detailSites: SiteRecord[] = [];
  let siteByBookmark = new Map<string, SiteRecord>();
  let cachedCookies: CookieRef[] | undefined;
  let cachedHistory: chrome.history.HistoryItem[] = [];
  let detailsLoading = false;
  let historyEnabled = false;
  const drawer = detailsDrawer();
  const inspection = new Inspection({
    drawer,
    list,
    kind: "bookmark",
    render: detailsFor,
    afterRender: (id) => drawer.setCleanupBusy(cleanupJob.busyBookmarkIds().has(id)),
  });

  function inventory(items: BookmarkRef[], cookies = cachedCookies) {
    return sitesFromBookmarks(items, cookies, cachedHistory);
  }

  /** Replace contextual sites and the per-bookmark index that rows and details read. */
  function setDetailSites(sites: SiteRecord[]) {
    detailSites = sites;
    siteByBookmark = new Map(sites.flatMap((site) => site.bookmarks.map((bookmark) => [bookmark.id, site] as const)));
  }

  function siteFor(id: string): SiteRecord | undefined {
    return siteByBookmark.get(id);
  }

  function signalsFor(id: string): BookmarkSignals {
    const bookmark = records.find((item) => item.id === id);
    return bookmark ? bookmarkSignals(bookmark, siteFor(id), detailsLoading) : { loading: detailsLoading };
  }

  function detailsFor(id: string): HTMLElement {
    const inspected = records.find((bookmark) => bookmark.id === id);
    const site = siteFor(id);
    if (!inspected || !site)
      return status("This bookmark is no longer available. Close details to continue.");
    const content = siteDetails(site, {
      inspectedBookmark: inspected,
      allBookmarks: records,
      folders,
      detectedSites: detailSites,
      loadingDates: detailsLoading,
      onCleanup: (_site, bookmark) => {
        if (bookmark && !cleanupJob.blocked) openDirectCleanup(bookmark);
      },
      onMutation: reconcileMutation,
    });
    content.querySelector<HTMLButtonElement>(".detail-cleanup")?.toggleAttribute("disabled", cleanupJob.blocked);
    return content;
  }

  /** Replace bookmark data and keep selections that still exist. */
  function applyBookmarks(result: Awaited<ReturnType<typeof readBookmarks>>) {
    records = result.bookmarks;
    folders = result.folders;
    tree = result.tree;
    selection.retain(new Set([...records.map(bookmark => bookmark.id), ...folders.map(folder => folder.id)]));
  }

  const query = () => search.value.trim();
  const useFilterActive = () => useFilter.value !== "all";
  const filtersActive = () => !!query() || useFilterActive();
  function matches() {
    const text = query().toLowerCase();
    const now = Date.now();
    const found = records
      .map((bookmark) => ({ bookmark, signals: signalsFor(bookmark.id) }))
      .filter(({ bookmark, signals }) =>
        `${bookmark.title} ${bookmark.url} ${bookmark.path}`.toLowerCase().includes(text) &&
        matchesUseFilter(useFilter.value, signals, now));
    // Age filters list the longest-unused bookmarks first.
    if (useFilterActive() && useFilter.value !== "never")
      found.sort((a, b) => (a.signals.lastActivity ?? 0) - (b.signals.lastActivity ?? 0));
    return found.map(({ bookmark }) => bookmark);
  }
  const all = selectionControl(selection,
    () => filtersActive() ? new Set(matches().filter(bookmark => !bookmark.unmodifiable).map(bookmark => bookmark.id)) : treeView?.ids() ?? new Set(),
    filtersActive, () => { treeView?.update(); renderTree(false); }, () => cleanupJob.blocked);

  function resetFilters() {
    search.value = "";
    useFilter.value = "all";
    renderTree(false);
    search.focus();
  }

  function resultSummary(shown: number): HTMLElement {
    const resultInfo = el("div", "list-results");
    const resultCount = el("span", "fine result-count", `${shown} of ${records.length} bookmarks`);
    resultCount.setAttribute("role", "status");
    resultInfo.append(resultCount, button("Reset filters", resetFilters, "quiet reset-filters"));
    if (useFilterActive() && !historyEnabled && !detailsLoading)
      resultInfo.append(el("p", "fine filter-hint", "Visit dates are off, so only the date a bookmark was last opened counts. Enable visit dates for a fuller picture."));
    return resultInfo;
  }

  function searchResults(): HTMLElement {
    const results = el("div", "search-results");
    const found = matches();
    results.append(resultSummary(found.length));
    for (const bookmark of found) {
      const row = el("div", "bookmark-row");
      const check = checkbox("", value => { if (cleanupJob.blocked) return; selection.set(bookmark.id, value); changed(); });
      check.input.setAttribute("aria-label", `Select ${bookmark.title || "untitled"}`);
      check.input.checked = selection.ids.has(bookmark.id); check.input.disabled = !!bookmark.unmodifiable || cleanupJob.blocked;
      const title = button("", () => { void inspection.open(bookmark.id, title); }, "row-title");
      title.append(bookmarkSummary(bookmark)); title.dataset.focusKey = `bookmark:${bookmark.id}`;
      row.dataset.bookmarkId = bookmark.id;
      row.append(check.label, bookmarkRowLabel(title, bookmark.url), bookmarkRowSignals(signalsFor(bookmark.id)));
      clickableRow(row, title); results.append(row);
    }
    if (!found.length)
      results.append(status(useFilterActive() && !query()
        ? (useFilter.value === "never" ? `Every bookmark has a recorded use.` : "No bookmarks have gone unused that long.")
        : "No bookmarks match this search. Try a title, URL or folder name."));
    return results;
  }

  function renderTree(rebuild = true) {
    if (rebuild || !treeView) treeView = bookmarkTree(tree, selection, expanded, (id, trigger) => { void inspection.open(id, trigger); }, changed, signalsFor);
    useFilter.disabled = detailsLoading;
    useFilter.title = detailsLoading ? "Visit dates are still loading" : "";
    if (filtersActive()) list.replaceChildren(all.element, searchResults());
    else {
      list.replaceChildren(all.element, treeView.element);
      if (!records.length) list.append(status("No bookmarks yet. Saved bookmarks will appear here."));
    }
    syncCleanupPresentation();
    drawer.syncInspection();
    changed();
  }

  async function reconcileMutation(
    id: string | undefined,
    mutation: BookmarkMutation,
  ): Promise<DetailsSnapshot | undefined> {
    applyBookmarks(await readBookmarks());
    setDetailSites(inventory(records));
    renderTree();
    emit("bookmarks-changed", "bookmarks");
    const snapshotId = mutation.created ? id : inspection.id;
    const inspected = snapshotId
      ? records.find((bookmark) => bookmark.id === snapshotId)
      : undefined;
    const siteId = inspected?.id ?? inspection.id;
    const site = siteId ? siteFor(siteId) : undefined;
    if (!site) {
      if (inspection.isOpen())
        inspection.show(status("This bookmark was removed. Close details to continue."));
      return undefined;
    }
    return {
      site,
      inspectedBookmark: inspected,
      allBookmarks: records,
      folders,
      detectedSites: detailSites,
    };
  }

  /** Build a cleanup from fresh browser reads; `extras` are opted-in related bookmarks. */
  async function prepareBookmarks(
    baseIds: ReadonlySet<string>,
    options: CleanupOptions,
    extras: ReadonlySet<string>,
    selectedFolders: FolderRef[] = [],
  ): Promise<PreparedCleanup> {
    const fresh = await readBookmarks();
    const base = fresh.bookmarks.filter((bookmark) => baseIds.has(bookmark.id));
    if (!base.length && !selectedFolders.length)
      throw Error("The selected bookmark is no longer available.");
    const cookies = options.cookies ? await freshCookieSnapshot() : undefined;
    if (options.cookies && cookies === undefined)
      throw Error("Cookie access is required to prepare this cleanup.");
    const contextual = sitesFromBookmarks(base, cookies, cachedHistory);
    return {
      sites: withBookmarkRemovals(contextual, fresh.bookmarks, options, extras),
      folders: selectedFolders,
      impact: analyzeImpact(contextual, fresh.bookmarks, detailSites, options),
      contextualBookmarks: base,
    };
  }

  function openDirectCleanup(bookmark: BookmarkRef) {
    if (cleanupJob.blocked) return;
    const ids = new Set([bookmark.id]);
    const current = records.find(item => item.id === bookmark.id) ?? bookmark;
    cleanupDialog(
      (options, extras) => prepareBookmarks(ids, options, extras),
      true,
      onStarted,
      { label: current.title || "Untitled", bookmark: current },
    );
  }

  const actions = selectionActions({
    selection,
    selectAll: all,
    disabled: () => loader.busy || cleanupJob.blocked,
    onClean: async () => {
      if (cleanupJob.blocked) return;
      if (!(await requestLeave())) return;
      const ids = new Set(selection.ids);
      const selectedFolders = treeView?.folders() ?? [];
      const bookmarkCount = records.filter(bookmark => ids.has(bookmark.id)).length;
      cleanupDialog(
        (options, extras) =>
          prepareBookmarks(ids, options, extras, selectedFolders),
        true,
        onStarted,
        { label: `Selected: ${plural(bookmarkCount, "bookmark")}${selectedFolders.length ? ` · ${plural(selectedFolders.length, "folder")} (only if empty)` : ""}` },
      );
    },
    onClear: () => {
      treeView?.update();
      renderTree(false);
      search.focus();
    },
  });
  const changed = actions.update;
  const history = historyAccessAction(() => loader.load(true, false));
  const loader: WorkspaceLoader = new WorkspaceLoader({
    list,
    feedback,
    subject: "bookmarks",
    changed,
    beforeLoad: history.sync,
    run: async ({ isCurrent, announce }) => {
      const result = await readBookmarks();
      if (!isCurrent()) return;
      applyBookmarks(result);
      cachedCookies = undefined;
      cachedHistory = [];
      setDetailSites(inventory(records));
      detailsLoading = true;
      renderTree();
      loader.loaded = true;
      feedback.replaceChildren();
      inspection.update();

      // Dates and cookie counts enrich rows and details after the list is usable.
      const [visits, cookies, history] = await Promise.all([
        readHistory(),
        freshCookieSnapshot(),
        hasHistoryAccess().catch(() => false),
      ]);
      if (!isCurrent()) return;
      cachedHistory = visits.history;
      cachedCookies = cookies;
      historyEnabled = history;
      setDetailSites(inventory(records));
      detailsLoading = false;
      treeView?.refreshSignals();
      renderTree(false);
      inspection.update();
      if (visits.warning) feedback.replaceChildren(status(visits.warning));
      if (announce) toast("Bookmarks refreshed.");
    },
    failed: () => {
      detailsLoading = false;
      reportLoadFailure(feedback, "Could not refresh bookmarks. Try Refresh again.",
        loader.loaded
          ? "Could not refresh. The previous bookmark list is shown; try Refresh again."
          : "Could not load bookmarks. Try Refresh again.");
    },
  });
  layout.mount(workspaceToolbar([loader.refreshButton, search, useFilter, history.element], actions.elements), feedback);
  search.addEventListener("input", () => renderTree(false));
  useFilter.addEventListener("change", () => renderTree(false));

  function syncCleanupPresentation() {
    const ids = cleanupJob.busyBookmarkIds();
    treeView?.setCleanupBusy(ids, cleanupJob.blocked);
    for (const row of list.querySelectorAll<HTMLElement>(".search-results .bookmark-row"))
      setBookmarkRowBusy(row, ids.has(row.dataset.bookmarkId ?? ""));
    if (inspection.isOpen()) {
      drawer.setCleanupBusy(ids.has(inspection.id));
      const clean = document.querySelector<HTMLButtonElement>(".details-drawer .detail-cleanup");
      if (clean) clean.disabled = cleanupJob.blocked;
    }
    changed();
  }

  return {
    element: layout.element,
    load: () => loader.load(),
    refresh: () => loader.refresh(),
    setCleanupJob: (job, unavailable = false) => {
      if (cleanupJob.set(job, unavailable)) syncCleanupPresentation();
    },
    invalidate: () => loader.invalidate(),
  };
}
