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
  checkbox,
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
  const bookmarked = checkbox("Bookmarked only", () => render());
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
          (!bookmarked.input.checked || site.bookmarks.length),
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
    count.hidden = selection.ids.size === 0;
    clear.hidden = selection.ids.size === 0;
    clean.disabled = busy || !selection.ids.size;
  }

  function detailsFor(site: SiteRecord): HTMLElement {
    return siteDetails(site, {
      allBookmarks,
      folders,
      detectedSites: sites,
      loadingDates: datesLoading,
      onCleanup: (target) => openDirectCleanup(target),
      onMutation: reconcileMutation,
    });
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
    list.replaceChildren(
      all.element,
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
    const ids = new Set([site.id]);
    cleanupDialog((options) => prepareSites(ids, options), false, onStarted);
  }

  const clean = button("Clean up data", async () => {
    if (!(await requestLeave())) return;
    const ids = new Set(selection.ids);
    cleanupDialog((options) => prepareSites(ids, options), false, onStarted);
  }, "primary");
  const all = selectionControl(selection, () => new Set(visible().map(site => site.id)), () => !!search.value.trim() || bookmarked.input.checked, render);
  const clear = iconButton("clear", "Clear selection", () => {
    selection.ids.clear();
    render();
  });
  const toolbar = workspaceToolbar([refresh, search, order, bookmarked.label, history], [clear, count, clean]);
  page.append(toolbar, access, feedback);
  const workspace = el("div", "workspace");
  workspace.append(list);
  page.append(workspace);
  search.addEventListener("input", render);
  order.addEventListener("change", render);

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
    invalidate: () => {
      generation++;
      loaded = false;
      busy = false;
    },
  };
}
