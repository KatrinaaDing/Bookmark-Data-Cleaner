import { iconButton } from "../components/icons.js";
import { detailsDrawer } from "../components/details-drawer.js";
import { readBookmarks } from "../browser/bookmarks.js";
import { readHistory, requestHistory } from "../browser/history.js";
import { hasSiteAccess, readCookies } from "../browser/site-data.js";
import { sitesFromBookmarks } from "../core/inventory.js";
import { analyzeImpact } from "../core/impact.js";
import { Selection } from "../core/state.js";
import type {
  BookmarkFolder,
  BookmarkRef,
  CookieRef,
  Job,
  SiteRecord,
} from "../core/types.js";
import { bookmarkTree, type TreeView } from "../components/bookmark-tree.js";
import { cleanupDialog } from "../components/cleanup-dialog.js";
import { button, el, heading, status } from "../components/dom.js";
import {
  siteDetails,
  type DetailsSnapshot,
} from "../components/site-details.js";

export interface WorkspacePage {
  element: HTMLElement;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  invalidate: () => void;
}

export function bookmarksPage(onStarted: (job: Job) => void): WorkspacePage {
  const page = el("section");
  page.append(
    heading("Bookmark cleanup", "Select bookmarks to review their site data."),
  );
  const toolbar = el("div", "toolbar");
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
  const list = el("div", "workspace-list");
  const feedback = el("div");
  const drawer = detailsDrawer();

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

  function detailsFor(id: string, notice?: string): HTMLElement {
    const inspected = records.find((bookmark) => bookmark.id === id);
    const site = siteFor(id);
    if (!inspected || !site)
      return status("This bookmark is no longer available. Close details to continue.");
    return siteDetails(site, {
      inspectedBookmark: inspected,
      allBookmarks: records,
      folders,
      detectedSites: detailSites,
      loadingDates: detailsLoading,
      notice,
      onCleanup: (_site, bookmark) => {
        if (bookmark) openDirectCleanup(bookmark);
      },
      onMutation: reconcileMutation,
    });
  }

  function deferEnrichmentUpdate() {
    const opened = document.querySelectorAll<HTMLElement>(
      ".details-drawer .edit-bookmark:not([hidden]), .details-drawer .create-bookmark[open]",
    );
    for (const disclosure of opened)
      disclosure.addEventListener(
        "toggle",
        () => {
          if (
            !document.querySelector(
              ".details-drawer .edit-bookmark:not([hidden]), .details-drawer .create-bookmark[open]",
            )
          )
            updateOpenDetails(undefined, true);
        },
        { once: true },
      );
  }

  function updateOpenDetails(notice?: string, optionalEnrichment = false) {
    if (!inspectedId || !drawer.isOpen(`bookmark:${inspectedId}`)) return;
    if (
      optionalEnrichment &&
      document.querySelector(
        ".details-drawer .edit-bookmark:not([hidden]), .details-drawer .create-bookmark[open]",
      )
    ) {
      deferEnrichmentUpdate();
      return;
    }
    drawer.update(detailsFor(inspectedId, notice), inspectedRequest);
  }

  function renderTree() {
    treeView = bookmarkTree(
      tree,
      selection,
      expanded,
      (id, trigger) => inspect(id, trigger),
      changed,
    );
    list.replaceChildren(treeView.element);
    if (!records.length)
      list.append(status("No bookmarks yet. Saved bookmarks will appear here."));
  }

  async function reconcileMutation(
    id: string | undefined,
    mutation: { created: boolean; error?: string },
  ): Promise<DetailsSnapshot | undefined> {
    const result = await readBookmarks();
    records = result.bookmarks;
    folders = result.folders;
    tree = result.tree;
    selection.retain(new Set(records.map((bookmark) => bookmark.id)));
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
    const removalIds = options.bookmarks
      ? new Set([...baseIds, ...extras])
      : new Set<string>();
    const removal = fresh.bookmarks.filter((bookmark) => removalIds.has(bookmark.id));
    const planSites = cookies === undefined
      ? sitesFromBookmarks(removal, undefined, cachedHistory)
      : sitesFromBookmarks(removal, cookies, cachedHistory);
    if (!options.bookmarks) {
      for (const site of contextual)
        planSites.push({ ...site, bookmarks: [] });
    }
    return {
      sites: planSites,
      folders: selectedFolders,
      impact: analyzeImpact(contextual, fresh.bookmarks, detailSites, options),
    };
  }

  function openDirectCleanup(bookmark: BookmarkRef) {
    const ids = new Set([bookmark.id]);
    cleanupDialog(
      (options, extras) => prepareBookmarks(ids, options, extras),
      true,
      onStarted,
    );
  }

  const clean = button(
    "Clean up data",
    () => {
      const ids = new Set(selection.ids);
      const selectedFolders = treeView?.folders() ?? [];
      cleanupDialog(
        (options, extras) =>
          prepareBookmarks(ids, options, extras, selectedFolders),
        true,
        onStarted,
      );
    },
    "primary",
  );
  clean.disabled = true;
  const clear = iconButton("clear", "Clear selection", () => {
    selection.ids.clear();
    treeView?.update();
  });
  clear.hidden = true;
  const refresh = iconButton("refresh", "Refresh", () => void load(true));
  const history = iconButton("history", "Enable visit dates", () => {
    void requestHistory().then(
      (granted) => {
        history.hidden = granted;
        feedback.replaceChildren(
          status(
            granted
              ? "Visit dates enabled. Refreshing details…"
              : "History access declined. Bookmark cleanup still works.",
          ),
        );
        if (granted) void load(true);
      },
      () => feedback.replaceChildren(status("Could not request history access. Try again.")),
    );
  });
  toolbar.append(refresh, history, clear, count, clean);
  page.append(toolbar, feedback);
  const workspace = el("div", "workspace");
  workspace.append(list);
  page.append(workspace);

  function changed() {
    count.textContent = `${selection.ids.size} selected`;
    count.hidden = selection.ids.size === 0;
    clear.hidden = selection.ids.size === 0;
    clean.disabled = busy || !selection.ids.size;
  }

  function inspect(id: string, trigger: HTMLElement) {
    inspectedId = id;
    inspectedRequest = drawer.open(detailsFor(id), trigger);
  }

  async function load(force = false) {
    if (busy || (loaded && !force)) return;
    const current = ++generation;
    busy = true;
    refresh.disabled = true;
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
      selection.retain(new Set(records.map((bookmark) => bookmark.id)));
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
      updateOpenDetails(undefined, true);
      if (visits.warning) feedback.replaceChildren(status(visits.warning));
    } catch {
      if (current !== generation) return;
      detailsLoading = false;
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
        list.removeAttribute("aria-busy");
        changed();
      }
    }
  }

  return {
    element: page,
    load: () => load(),
    refresh: () => (loaded ? load(true) : Promise.resolve()),
    invalidate: () => {
      generation++;
      loaded = false;
      busy = false;
    },
  };
}
