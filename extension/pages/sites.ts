import { permissionAction } from "../components/permission-action.js";
import { workspaceToolbar, selectionControl } from "../components/workspace-controls.js";
import { infoPopover, toast } from "../components/feedback.js";
import { currentForm, requestLeave } from "../components/form-session.js";
import { iconButton } from "../components/icons.js";
import { detailsDrawer } from "../components/details-drawer.js";
import { readBookmarks } from "../browser/bookmarks.js";
import {
  coverage,
  hasSiteAccess,
  requestSiteAccess,
  scanSites,
} from "../browser/site-data.js";
import { requestHistory } from "../browser/history.js";
import { analyzeImpact } from "../core/impact.js";
import type {
  BookmarkFolder,
  BookmarkRef,
  CleanupOptions,
  Job,
  SiteRecord,
} from "../core/types.js";
import { Selection } from "../core/state.js";
import { cleanupDialog } from "../components/cleanup-dialog.js";
import {
  button,
  el,
  heading,
  status,
} from "../components/dom.js";
import {
  siteDetails,
  type DetailsSnapshot,
} from "../components/site-details.js";
import { siteTimeline } from "../components/site-timeline.js";
import type { WorkspacePage } from "./bookmarks.js";

export function sitesPage(onStarted: (job: Job) => void): WorkspacePage {
  const page = el("section");
  page.append(heading("Site data cleanup", "Choose the sites you no longer need."));
  page.querySelector("h1")!.append(infoPopover("About site discovery", coverage));
  let sites: SiteRecord[] = [];
  let allBookmarks: BookmarkRef[] = [];
  let folders: BookmarkFolder[] = [];
  let loaded = false;
  let busy = false;
  let datesLoading = false;
  let generation = 0;
  let inspectedSiteId: string | undefined;
  let inspectedRequest = 0;
  let cleanupBlocked = true;
  const selection = new Selection();
  const feedback = el("div");
  const list = el("div", "workspace-list");
  const drawer = detailsDrawer();
  const search = el("input");
  search.type = "search";
  search.placeholder = "Find a website";
  search.setAttribute("aria-label", "Find a website");
  const order = el("select");
  order.setAttribute("aria-label", "Order by last recorded visit");
  for (const [value, label] of [
    ["oldest", "Oldest visit first"],
    ["newest", "Newest visit first"],
  ]) {
    const option = el("option", "", label);
    option.value = value;
    order.append(option);
  }
  const bookmarkFilter = el("select");
  bookmarkFilter.setAttribute("aria-label", "Filter sites by bookmark status");
  for (const [value, label] of [["all", "All sites"], ["saved", "Bookmarked"], ["unsaved", "Not bookmarked"]]) {
    const option = el("option", "", label);
    option.value = value;
    bookmarkFilter.append(option);
  }
  const refresh = iconButton("refresh", "Refresh", () => void load(true));
  const count = el("span", "selection-count");
  const access = permissionAction({
    label: "Allow site discovery", request: requestSiteAccess,
    granted: "Site discovery enabled.", declined: "Site access declined. You can still use Bookmark cleanup.",
    onGranted: () => load(true, false),
  });
  access.hidden = true;
  const history = permissionAction({
    label: "Enable visit dates", icon: "history", request: requestHistory,
    granted: "Visit dates enabled.", declined: "History access declined. Cleanup still works.",
    onGranted: () => load(true, false),
  });

  function visible() {
    return sites
      .filter(
        (site) =>
          site.host.includes(search.value.trim().toLowerCase()) &&
          (bookmarkFilter.value === "all" || (bookmarkFilter.value === "saved" ? site.bookmarks.length > 0 : site.bookmarks.length === 0)),
      )
      .sort((a, b) => {
        if (datesLoading) return a.host.localeCompare(b.host);
        if (!a.lastVisit && !b.lastVisit) return a.host.localeCompare(b.host);
        if (!a.lastVisit) return 1;
        if (!b.lastVisit) return -1;
        return (
          (order.value === "oldest"
            ? a.lastVisit - b.lastVisit
            : b.lastVisit - a.lastVisit) || a.host.localeCompare(b.host)
        );
      });
  }

  function changed() {
    count.textContent = all.update();
    clear.hidden = selection.ids.size === 0;
    clean.disabled = busy || cleanupBlocked || !selection.ids.size;
  }

  function detailsFor(site: SiteRecord): HTMLElement {
    const content = siteDetails(site, {
      allBookmarks,
      folders,
      detectedSites: sites,
      loadingDates: datesLoading,
      onCleanup: (target) => { if (!cleanupBlocked) openDirectCleanup(target); },
      onMutation: reconcileMutation,
    });
    const clean = content.querySelector<HTMLButtonElement>(".detail-cleanup");
    if (clean) clean.disabled = cleanupBlocked;
    return content;
  }

  async function inspect(site: SiteRecord, trigger: HTMLElement) {
    if (!(await requestLeave())) return;
    inspectedSiteId = site.id;
    const current = sites.find(item => item.id === site.id) ?? site;
    const source = list.querySelector<HTMLElement>(`[data-focus-key="site:${CSS.escape(site.id)}"]`) ?? trigger;
    inspectedRequest = drawer.open(detailsFor(current), source);
  }

  let enrichmentDeferred = false;
  function deferEnrichmentUpdate() { enrichmentDeferred = true; }
  document.addEventListener("editor-closed", () => {
    if (enrichmentDeferred) { enrichmentDeferred = false; updateOpenDetails(); }
  });

  function updateOpenDetails() {
    if (!inspectedSiteId || !drawer.isOpen(`site:${inspectedSiteId}`)) return;
    if (currentForm()) {
      deferEnrichmentUpdate();
      return;
    }
    const current = sites.find((site) => site.id === inspectedSiteId);
    if (current) drawer.update(detailsFor(current), inspectedRequest);
    else
      drawer.update(
        status("This detected site is no longer available. Close details to continue."),
        inspectedRequest,
      );
  }

  function render() {
    changed();
    order.disabled = datesLoading;
    order.title = datesLoading ? "Visit dates are still loading" : "";
    const filtered = visible();
    const resultCount = el("span", "fine result-count", `${filtered.length} of ${sites.length} sites`);
    resultCount.setAttribute("role", "status");
    const reset = button("Reset filters", () => {
      search.value = "";
      bookmarkFilter.value = "all";
      render();
      search.focus();
    }, "quiet reset-filters");
    const filtersActive = !!search.value.trim() || bookmarkFilter.value !== "all";
    reset.hidden = !filtersActive;
    const resultInfo = el("div", "list-results");
    resultInfo.append(resultCount, reset);
    resultInfo.hidden = !loaded;
    list.replaceChildren(
      all.element,
      resultInfo,
      filtered.length
        ? siteTimeline(filtered, selection, inspect, changed)
        : status(
            loaded
              ? sites.length
                ? "No websites match these filters."
                : "No cookies detected. Other site storage may still exist."
              : "Allow site discovery to list detected data.",
          ),
    );
    all.update();
    drawer.syncInspection();
  }

  async function reconcileMutation(
    id: string | undefined,
    mutation: { created: boolean; error?: string },
  ): Promise<DetailsSnapshot | undefined> {
    const [scan, bookmarks] = await Promise.all([scanSites(), readBookmarks()]);
    sites = scan.sites;
    allBookmarks = bookmarks.bookmarks;
    folders = bookmarks.folders;
    selection.retain(new Set(sites.map((site) => site.id)));
    render();
    document.dispatchEvent(new CustomEvent("bookmarks-changed", { detail: "sites" }));
    const site = inspectedSiteId
      ? sites.find((item) => item.id === inspectedSiteId)
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

  async function prepareSites(
    ids: ReadonlySet<string>,
    options: CleanupOptions,
  ) {
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
    if (cleanupBlocked) return;
    const ids = new Set([site.id]);
    cleanupDialog((options) => prepareSites(ids, options), false, onStarted, { label: `This site: ${site.host}` });
  }

  const clean = button("Clean up selected…", async () => {
    if (cleanupBlocked) return;
    if (!(await requestLeave())) return;
    const ids = new Set(selection.ids);
    cleanupDialog((options) => prepareSites(ids, options), false, onStarted, { label: `Selected: ${ids.size} ${ids.size === 1 ? "site" : "sites"}` });
  }, "primary");
  const all = selectionControl(selection, () => new Set(visible().map(site => site.id)), () => !!search.value.trim() || bookmarkFilter.value !== "all", render, () => cleanupBlocked);
  const clear = iconButton("clear", "Clear selection", () => {
    selection.ids.clear();
    render();
  });
  const toolbar = workspaceToolbar([refresh, search, order, bookmarkFilter, history], [clear, count, clean]);
  page.append(toolbar, access, feedback);
  const workspace = el("div", "workspace");
  workspace.append(list);
  page.append(workspace);
  search.addEventListener("input", render);
  order.addEventListener("change", render);
  bookmarkFilter.addEventListener("change", render);

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
    feedback.replaceChildren(status(loaded ? "Refreshing detected data…" : "Loading detected data…", true));
    list.setAttribute("aria-busy", "true");
    void chrome.permissions.contains({ permissions: ["history"] }).then(
      (allowed) => { history.hidden = allowed; },
      () => { history.hidden = false; },
    );
    try {
      if (!(await hasSiteAccess())) {
        if (current !== generation) return;
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
      const result = await scanSites((basic) => {
        if (current !== generation) return;
        sites = basic.sites;
        loaded = true;
        render();
        feedback.replaceChildren(status("Loading visit dates…", true));
        updateOpenDetails();
      });
      const bookmarks = await bookmarksPromise;
      if (current !== generation) return;
      sites = result.sites;
      allBookmarks = bookmarks.bookmarks;
      folders = bookmarks.folders;
      datesLoading = false;
      selection.retain(new Set(sites.map((site) => site.id)));
      loaded = true;
      render();
      updateOpenDetails();
      feedback.replaceChildren(...result.warnings.map((warning) => status(warning)));
      if (announce) toast("Site data refreshed.");
    } catch {
      if (current !== generation) return;
      datesLoading = false;
      toast("Could not refresh site data. Try Refresh again.", "error");
      feedback.replaceChildren(
        status(
          loaded
            ? "Refresh failed. The previous list may be stale. Try Refresh again."
            : "Could not discover site data. Check access and try Refresh again.",
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

  render();
  return {
    element: page,
    load: () => load(),
    refresh: () => (loaded && !currentForm() ? load(true, false) : Promise.resolve()),
    setCleanupJob: (job, unavailable = false) => {
      const nextBlocked = unavailable || job?.status === "running";
      if (cleanupBlocked === nextBlocked) return;
      cleanupBlocked = nextBlocked;
      changed();
      updateOpenDetails();
    },
    invalidate: () => {
      generation++;
      loaded = false;
      busy = false;
    },
  };
}
