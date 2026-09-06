import { iconButton } from "../components/icons.js";
import { detailsDrawer } from "../components/details-drawer.js";
import {
  coverage,
  hasSiteAccess,
  readCookies,
  requestSiteAccess,
  scanSites,
} from "../browser/site-data.js";
import { requestHistory } from "../browser/history.js";
import { cookieOwner } from "../helpers/sites.js";
import type { Job, SiteRecord } from "../core/types.js";
import { Selection } from "../core/state.js";
import { cleanupDialog } from "../components/cleanup-dialog.js";
import {
  button,
  checkbox,
  disclosure,
  el,
  heading,
  status,
} from "../components/dom.js";
import { siteDetails } from "../components/site-details.js";
import { siteTimeline } from "../components/site-timeline.js";
export function sitesPage(onStarted: (job: Job) => void): {
  element: HTMLElement;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const page = el("section");
  page.append(
    heading("Site data cleanup", "Choose the sites you no longer need."),
  );
  page.append(disclosure("About this list", coverage));
  let sites: SiteRecord[] = [],
    loaded = false,
    busy = false;
  const selection = new Selection();
  const feedback = el("div"),
    list = el("div", "workspace-list");
  const drawer = detailsDrawer();
  const toolbar = el("div", "toolbar");
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
  const refresh = iconButton("refresh", "Refresh", () => {
    void load(true);
  });
  const count = el("span", "selection-count");
  const clean = button(
    "Review cleanup",
    () =>
      cleanupDialog(
        async (options) => {
          const cookies = options.cookies ? await readCookies() : [];
          return {
            sites: sites
              .filter((s) => selection.ids.has(s.id))
              .map((site) => ({
                ...site,
                bookmarks: [],
                cookies: cookies.filter((c) => cookieOwner(c) === site.host),
              })),
          };
        },
        false,
        onStarted,
      ),
    "primary",
  );
  const all = iconButton("select", "Select visible", () => {
    for (const site of visible()) selection.set(site.id, true);
    render();
  });
  const clear = iconButton("clear", "Clear selection", () => {
    selection.ids.clear();
    render();
  });
  const access = button(
    "Allow site discovery",
    () => {
      void requestSiteAccess().then(
        (granted) => {
          if (granted) {
            access.hidden = true;
            void load(true);
          } else
            feedback.replaceChildren(
              status(
                "Site access declined. Allow site discovery to build this list, or use Bookmark cleanup.",
              ),
            );
        },
        () =>
          feedback.replaceChildren(
            status("Could not request access. Try again."),
          ),
      );
    },
    "primary",
  );
  access.hidden = true;
  const history = iconButton("history", "Enable visit dates", () => {
    void requestHistory()
      .then((granted) => {
        if (granted) void load(true);
        else
          feedback.replaceChildren(
            status(
              "History access declined. You can still clean detected site data.",
            ),
          );
      })
      .catch(() =>
        feedback.replaceChildren(
          status("Could not request history access. Try again."),
        ),
      );
  });
  toolbar.append(search, order, bookmarked.label, refresh);
  toolbar.append(all, clear, history, count, clean);
  page.append(toolbar, access, feedback);
  const workspace = el("div", "workspace");
  workspace.append(list);
  page.append(workspace);
  function visible() {
    return sites
      .filter(
        (site) =>
          site.host.includes(search.value.trim().toLowerCase()) &&
          (!bookmarked.input.checked || site.bookmarks.length),
      )
      .sort((a, b) => {
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
    count.textContent = `${selection.ids.size} selected`;
    count.hidden = selection.ids.size === 0;
    clear.disabled = selection.ids.size === 0;
    clean.disabled = busy || !selection.ids.size;
  }
  function render() {
    changed();
    const filtered = visible();
    list.replaceChildren(
      filtered.length
        ? siteTimeline(
            filtered,
            selection,
            (site, trigger) =>
              drawer.open(
                siteDetails(site, () => {
                  void load(true);
                }),
                trigger,
              ),
            changed,
          )
        : status(
            loaded
              ? sites.length
                ? "No websites match these filters."
                : "No cookies detected. Other site storage may still exist."
              : "Allow site discovery to list detected data.",
          ),
    );
    all.disabled = !filtered.length;
  }
  search.addEventListener("input", render);
  order.addEventListener("change", render);
  async function load(force = false) {
    if (busy || (loaded && !force)) return;
    busy = true;
    void chrome.permissions
      .contains({ permissions: ["history"] })
      .then((allowed) => {
        history.hidden = allowed;
      })
      .catch(() => {
        history.hidden = false;
      });
    refresh.disabled = true;
    changed();
    feedback.replaceChildren(
      status(
        loaded ? "Refreshing detected data…" : "Loading detected data…",
        true,
      ),
    );
    list.setAttribute("aria-busy", "true");
    try {
      if (!(await hasSiteAccess())) {
        access.hidden = false;
        feedback.replaceChildren(
          status(
            "Discovery needs cookie and website access. Browsing data stays in your browser.",
          ),
        );
        render();
        return;
      }
      access.hidden = true;
      const result = await scanSites();
      sites = result.sites;
      selection.retain(new Set(sites.map((s) => s.id)));
      loaded = true;

      render();
      feedback.replaceChildren(
        ...result.warnings.map((warning) => status(warning)),
      );
    } catch {
      feedback.replaceChildren(
        status(
          loaded
            ? "Refresh failed. The previous list may be stale. Try Refresh again."
            : "Could not discover site data. Check access and try Refresh again.",
        ),
      );
    } finally {
      busy = false;
      refresh.disabled = false;
      list.removeAttribute("aria-busy");
      changed();
    }
  }
  render();
  return {
    element: page,
    load: () => load(),
    refresh: () => (loaded ? load(true) : Promise.resolve()),
  };
}
