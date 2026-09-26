import { permissionAction } from "../components/permission-action.js";
import { workspaceToolbar, selectionControl } from "../components/workspace-controls.js";
import { bookmarkSummary } from "../components/bookmark-summary.js";
import { infoPopover, toast } from "../components/feedback.js";
import { currentForm, requestLeave } from "../components/form-session.js";
import { iconButton } from "../components/icons.js";
import { detailsDrawer } from "../components/details-drawer.js";
import { readBookmarks } from "../browser/bookmarks.js";
import { readHistory, requestHistory } from "../browser/history.js";
import { hasSiteAccess, readCookies } from "../browser/site-data.js";
import { sitesFromBookmarks } from "../core/inventory.js";
import { analyzeImpact, withBookmarkRemovals } from "../core/impact.js";
import { Selection } from "../core/state.js";
import type {
  BookmarkFolder,
  BookmarkRef,
  CookieRef,
  Job,
  SiteRecord,
} from "../core/types.js";
import { bookmarkTree, setBookmarkRowBusy, type TreeView } from "../components/bookmark-tree.js";
import { cleanupDialog } from "../components/cleanup-dialog.js";
import { button, checkbox, clickableRow, el, heading, status } from "../components/dom.js";
import {
  siteDetails,
  type DetailsSnapshot,
} from "../components/site-details.js";

export interface WorkspacePage {
  element: HTMLElement;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  invalidate: () => void;
  setCleanupJob: (job?: Job, unavailable?: boolean) => void;
}

export function bookmarksPage(onStarted: (job: Job) => void): WorkspacePage {
  const page = el("section");
  page.append(
    heading("Bookmark cleanup", "Select bookmarks to review their site data."),
  );
  page.querySelector("h1")!.append(infoPopover("About bookmark cleanup", "Search saved titles, URLs or folder paths. Select bookmarks to review their website data and choose whether to delete the bookmarks too."));
  const search = el("input"); search.type = "search"; search.placeholder = "Find a bookmark"; search.setAttribute("aria-label", "Find a bookmark");
  const count = el("span", "selection-count", "0 selected");
  const selection = new Selection();
  const expanded = new Set<string>();
  let records: BookmarkRef[] = [];
  let folders: BookmarkFolder[] = [];
  let tree: chrome.bookmarks.BookmarkTreeNode[] = [];
  let treeView: TreeView | undefined;
  let detailSites: SiteRecord[] = [];
  let cachedCookies: CookieRef[] | undefined;
  let cachedHistory: chrome.history.HistoryItem[] = [];
  let detailsLoading = false;
  let loaded = false;
  let busy = false;
  let generation = 0;
  let inspectedId: string | undefined;
  let inspectedRequest = 0;
  let cleanupJob: Job | undefined;
  let cleanupUnavailable = true;
  const list = el("div", "workspace-list");
  const feedback = el("div");
  const drawer = detailsDrawer();
  const cleanupBlocked = () => cleanupUnavailable || cleanupJob?.status === "running";
  const busyBookmarkIds = () => new Set(cleanupJob?.status === "running" ? cleanupJob.busyBookmarkIds ?? [] : []);

  function inventory(items: BookmarkRef[], cookies = cachedCookies) {
    return cookies === undefined
      ? sitesFromBookmarks(items, undefined, cachedHistory)
      : sitesFromBookmarks(items, cookies, cachedHistory);
  }

  async function freshCookieSnapshot(): Promise<CookieRef[] | undefined> {
    if (!(await hasSiteAccess())) return undefined;
    try {
      return await readCookies();
    } catch {
      return undefined;
    }
  }

  function siteFor(id: string): SiteRecord | undefined {
    return detailSites.find((site) =>
      site.bookmarks.some((bookmark) => bookmark.id === id),
    );
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
        if (bookmark && !cleanupBlocked()) openDirectCleanup(bookmark);
      },
      onMutation: reconcileMutation,
    });
    content.querySelector<HTMLButtonElement>(".detail-cleanup")?.toggleAttribute("disabled", !!cleanupBlocked());
    return content;
  }

  let enrichmentDeferred = false;
  function deferEnrichmentUpdate() { enrichmentDeferred = true; }
  document.addEventListener("editor-closed", () => {
    if (enrichmentDeferred) { enrichmentDeferred = false; updateOpenDetails(); }
  });

  function updateOpenDetails() {
    if (!inspectedId || !drawer.isOpen(`bookmark:${inspectedId}`)) return;
    if (currentForm()) {
      deferEnrichmentUpdate();
      return;
    }
    drawer.update(detailsFor(inspectedId), inspectedRequest);
    drawer.setCleanupBusy(busyBookmarkIds().has(inspectedId));
  }

  function matches() {
    const query = search.value.trim().toLowerCase();
    return records.filter(bookmark => `${bookmark.title} ${bookmark.url} ${bookmark.path}`.toLowerCase().includes(query));
  }
  const all = selectionControl(selection,
    () => search.value.trim() ? new Set(matches().filter(bookmark => !bookmark.unmodifiable).map(bookmark => bookmark.id)) : treeView?.ids() ?? new Set(),
    () => !!search.value.trim(), () => { treeView?.update(); renderTree(false); }, cleanupBlocked);
  function renderTree(rebuild = true) {
    if (rebuild || !treeView) treeView = bookmarkTree(tree, selection, expanded, (id, trigger) => { void inspect(id, trigger); }, changed);
    if (search.value.trim()) {
      const results = el("div", "search-results");
      for (const bookmark of matches()) {
        const row = el("div", "bookmark-row");
        const check = checkbox("", value => { if (cleanupBlocked()) return; selection.set(bookmark.id, value); changed(); });
        check.input.setAttribute("aria-label", `Select ${bookmark.title || "untitled"}`);
        check.input.checked = selection.ids.has(bookmark.id); check.input.disabled = !!bookmark.unmodifiable || !!cleanupBlocked();
        const title = button("", () => { void inspect(bookmark.id, title); }, "row-title");
        title.append(bookmarkSummary(bookmark)); title.dataset.focusKey = `bookmark:${bookmark.id}`;
        row.dataset.bookmarkId = bookmark.id;
        row.append(check.label, title); clickableRow(row, title); results.append(row);
      }
      if (!results.childElementCount) results.append(status("No bookmarks match this search. Try a title, URL or folder name."));
      list.replaceChildren(all.element, results);
    } else {
      list.replaceChildren(all.element, treeView!.element);
      if (!records.length) list.append(status("No bookmarks yet. Saved bookmarks will appear here."));
    }
    syncCleanupPresentation();
    drawer.syncInspection();
    changed();
  }

  async function reconcileMutation(
    id: string | undefined,
    mutation: { created: boolean; error?: string },
  ): Promise<DetailsSnapshot | undefined> {
    const result = await readBookmarks();
    records = result.bookmarks;
    folders = result.folders;
    tree = result.tree;
    selection.retain(new Set([...records.map(bookmark => bookmark.id), ...folders.map(folder => folder.id)]));
    detailSites = inventory(records);
    renderTree();
    changed();
    document.dispatchEvent(new CustomEvent("bookmarks-changed", { detail: "bookmarks" }));
    const snapshotId = mutation.created ? id : inspectedId;
    const inspected = snapshotId
      ? records.find((bookmark) => bookmark.id === snapshotId)
      : undefined;
    const site = inspected ? siteFor(inspected.id) : inspectedId ? siteFor(inspectedId) : undefined;
    if (!site) {
      if (inspectedId && drawer.isOpen(`bookmark:${inspectedId}`))
        drawer.update(
          status("This bookmark was removed. Close details to continue."),
          inspectedRequest,
        );
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

  async function prepareBookmarks(
    baseIds: ReadonlySet<string>,
    options: import("../core/types.js").CleanupOptions,
    extras: ReadonlySet<string>,
    selectedFolders: import("../core/types.js").FolderRef[] = [],
  ) {
    const fresh = await readBookmarks();
    const base = fresh.bookmarks.filter((bookmark) => baseIds.has(bookmark.id));
    if (!base.length && !selectedFolders.length)
      throw Error("The selected bookmark is no longer available.");
    const cookies = options.cookies ? await freshCookieSnapshot() : undefined;
    if (options.cookies && cookies === undefined)
      throw Error("Cookie access is required to prepare this cleanup.");
    const contextual = cookies === undefined
      ? sitesFromBookmarks(base, undefined, cachedHistory)
      : sitesFromBookmarks(base, cookies, cachedHistory);
    const planSites = withBookmarkRemovals(contextual, fresh.bookmarks, options, extras);
    return {
      sites: planSites,
      folders: selectedFolders,
      impact: analyzeImpact(contextual, fresh.bookmarks, detailSites, options),
      contextualBookmarks: base,
    };
  }

  function openDirectCleanup(bookmark: BookmarkRef) {
    if (cleanupBlocked()) return;
    const ids = new Set([bookmark.id]);
    const current = records.find(item => item.id === bookmark.id) ?? bookmark;
    cleanupDialog(
      (options, extras) => prepareBookmarks(ids, options, extras),
      true,
      onStarted,
      { label: current.title || "Untitled", bookmark: current },
    );
  }

  const clean = button(
    "Clean up selected…",
    async () => {
      if (cleanupBlocked()) return;
      if (!(await requestLeave())) return;
      const ids = new Set(selection.ids);
      const selectedFolders = treeView?.folders() ?? [];
      const bookmarkCount = records.filter(bookmark => ids.has(bookmark.id)).length;
      cleanupDialog(
        (options, extras) =>
          prepareBookmarks(ids, options, extras, selectedFolders),
        true,
        onStarted,
        { label: `Selected: ${bookmarkCount} ${bookmarkCount === 1 ? "bookmark" : "bookmarks"}${selectedFolders.length ? ` · ${selectedFolders.length} ${selectedFolders.length === 1 ? "folder" : "folders"} (only if empty)` : ""}` },
      );
    },
    "primary",
  );
  clean.disabled = true;
  const clear = iconButton("clear", "Clear selection", () => {
    selection.ids.clear();
    treeView?.update();
    renderTree(false);
    search.focus();
  });
  clear.hidden = true;
  const refresh = iconButton("refresh", "Refresh", () => void load(true));
  const history = permissionAction({
    label: "Enable visit dates", icon: "history", request: requestHistory,
    granted: "Visit dates enabled.", declined: "History access declined. Cleanup still works.",
    onGranted: () => load(true, false),
  });
  const toolbar = workspaceToolbar([refresh, search, history], [clear, count, clean]);
  search.addEventListener("input", () => renderTree(false));
  page.append(toolbar, feedback);
  const workspace = el("div", "workspace");
  workspace.append(list);
  page.append(workspace);

  function changed() {
    count.textContent = all.update();
    clear.hidden = selection.ids.size === 0;
    clean.disabled = busy || !!cleanupBlocked() || !selection.ids.size;
  }

  function syncCleanupPresentation() {
    const ids = busyBookmarkIds();
    treeView?.setCleanupBusy(ids, !!cleanupBlocked());
    for (const row of list.querySelectorAll<HTMLElement>(".search-results .bookmark-row"))
      setBookmarkRowBusy(row, ids.has(row.dataset.bookmarkId ?? ""));
    if (inspectedId && drawer.isOpen(`bookmark:${inspectedId}`)) {
      drawer.setCleanupBusy(ids.has(inspectedId));
      const clean = document.querySelector<HTMLButtonElement>(".details-drawer .detail-cleanup");
      if (clean) clean.disabled = !!cleanupBlocked();
    }
    changed();
  }

  async function inspect(id: string, trigger: HTMLElement) {
    if (!(await requestLeave())) return;
    inspectedId = id;
    const source = list.querySelector<HTMLElement>(`[data-focus-key="bookmark:${CSS.escape(id)}"]`) ?? trigger;
    inspectedRequest = drawer.open(detailsFor(id), source);
    drawer.setCleanupBusy(busyBookmarkIds().has(id));
  }

  async function load(force = false, announce = force) {
    if (busy || (loaded && !force)) return;
    if (force && !(await requestLeave())) return;
    if (busy) return;
    const current = ++generation;
    busy = true;
    refresh.disabled = true;
    refresh.setAttribute("aria-busy", "true");
    refresh.classList.add("refreshing");
    changed();
    feedback.replaceChildren(status(loaded ? "Refreshing bookmarks…" : "Loading bookmarks…", true));
    list.setAttribute("aria-busy", "true");
    void chrome.permissions.contains({ permissions: ["history"] }).then(
      (allowed) => { history.hidden = allowed; },
      () => { history.hidden = false; },
    );
    try {
      const result = await readBookmarks();
      if (current !== generation) return;
      records = result.bookmarks;
      folders = result.folders;
      tree = result.tree;
      selection.retain(new Set([...records.map(bookmark => bookmark.id), ...folders.map(folder => folder.id)]));
      cachedCookies = undefined;
      cachedHistory = [];
      detailSites = inventory(records);
      detailsLoading = true;
      renderTree();
      loaded = true;
      feedback.replaceChildren();
      updateOpenDetails();

      const [visits, cookies] = await Promise.all([
        readHistory(),
        freshCookieSnapshot(),
      ]);
      if (current !== generation) return;
      cachedHistory = visits.history;
      cachedCookies = cookies;
      detailSites = inventory(records);
      detailsLoading = false;
      updateOpenDetails();
      if (visits.warning) feedback.replaceChildren(status(visits.warning));
      if (announce) toast("Bookmarks refreshed.");
    } catch {
      if (current !== generation) return;
      detailsLoading = false;
      toast("Could not refresh bookmarks. Try Refresh again.", "error");
      feedback.replaceChildren(
        status(
          loaded
            ? "Could not refresh. The previous bookmark list is shown; try Refresh again."
            : "Could not load bookmarks. Try Refresh again.",
        ),
      );
    } finally {
      if (current === generation) {
        busy = false;
        refresh.disabled = false;
        refresh.setAttribute("aria-busy", "false");
        refresh.classList.remove("refreshing");
        list.removeAttribute("aria-busy");
        changed();
      }
    }
  }

  return {
    element: page,
    load: () => load(),
    refresh: () => (loaded && !currentForm() ? load(true, false) : Promise.resolve()),
    setCleanupJob: (job, unavailable = false) => {
      if (cleanupUnavailable === unavailable && cleanupJob?.id === job?.id &&
          cleanupJob?.status === job?.status) return;
      cleanupJob = job;
      cleanupUnavailable = unavailable;
      syncCleanupPresentation();
    },
    invalidate: () => {
      generation++;
      loaded = false;
      busy = false;
    },
  };
}
