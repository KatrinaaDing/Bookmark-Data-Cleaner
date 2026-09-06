import { iconButton } from "../components/icons.js";
import { detailsDrawer } from "../components/details-drawer.js";
import { readBookmarks } from "../browser/bookmarks.js";
import { readHistory, requestHistory } from "../browser/history.js";
import { hasSiteAccess, readCookies } from "../browser/site-data.js";
import { sitesFromBookmarks } from "../core/inventory.js";
import { Selection } from "../core/state.js";
import type { BookmarkRef, Job } from "../core/types.js";
import { bookmarkTree, type TreeView } from "../components/bookmark-tree.js";
import { cleanupDialog } from "../components/cleanup-dialog.js";
import { button, el, heading, status } from "../components/dom.js";
import { siteDetails } from "../components/site-details.js";
export function bookmarksPage(onStarted: (job: Job) => void): {
  element: HTMLElement;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const page = el("section");
  page.append(
    heading("Bookmark cleanup", "Select bookmarks to review their site data."),
  );
  const toolbar = el("div", "toolbar");
  const count = el("span", "selection-count", "0 selected");
  const selection = new Selection(),
    expanded = new Set<string>();
  let records: BookmarkRef[] = [],
    treeView: TreeView | undefined,
    loaded = false,
    busy = false;
  const list = el("div", "workspace-list"),
    feedback = el("div");
  const drawer = detailsDrawer();
  const clean = button(
    "Review cleanup",
    () =>
      cleanupDialog(
        async (options) => {
          const cookies = options.cookies ? await readCookies() : [];
          return {
            sites: sitesFromBookmarks(
              records.filter((b) => selection.ids.has(b.id)),
              cookies,
            ),
            folders: treeView?.folders(),
          };
        },
        true,
        onStarted,
      ),
    "primary",
  );
  clean.disabled = true;
  const refresh = iconButton("refresh", "Refresh", () => {
    void load(true);
  });
  const history = iconButton("history", "Enable visit dates", () => {
    void requestHistory()
      .then((granted) => {
        history.hidden = granted;
        feedback.replaceChildren(
          status(
            granted
              ? "Visit dates enabled. Select a title to see them."
              : "History access declined. Bookmark cleanup still works.",
          ),
        );
      })
      .catch(() =>
        feedback.replaceChildren(
          status("Could not request history access. Try again."),
        ),
      );
  });
  toolbar.append(refresh, history, count, clean);
  page.append(toolbar, feedback);
  const workspace = el("div", "workspace");
  workspace.append(list);
  page.append(workspace);
  function changed() {
    count.textContent = `${selection.ids.size} selected`;
    count.hidden = selection.ids.size === 0;
    clean.disabled = busy || !selection.ids.size;
  }
  async function inspect(id: string, trigger: HTMLElement) {
    const bookmark = records.find((b) => b.id === id);
    if (!bookmark) return;
    const request = drawer.open(
      status("Loading local details…", true),
      trigger,
    );
    try {
      const [visits, cookies] = await Promise.all([
        readHistory(),
        hasSiteAccess().then((allowed) => (allowed ? readCookies() : [])),
      ]);
      drawer.update(
        siteDetails(
          sitesFromBookmarks([bookmark], cookies, visits.history)[0],
          () => {
            void load(true);
          },
        ),
        request,
      );
    } catch {
      drawer.update(
        status("Could not load details. Close and select the item to retry."),
        request,
      );
    }
  }
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
      status(loaded ? "Refreshing bookmarks…" : "Loading bookmarks…", true),
    );
    list.setAttribute("aria-busy", "true");
    try {
      const result = await readBookmarks();
      records = result.bookmarks;
      const available = new Set<string>();
      function collect(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
        for (const node of nodes) {
          available.add(node.id);
          collect(node.children ?? []);
        }
      }
      collect(result.tree);
      selection.retain(available);
      treeView = bookmarkTree(
        result.tree,
        selection,
        expanded,
        (id, trigger) => {
          void inspect(id, trigger);
        },
        changed,
      );
      list.replaceChildren(treeView.element);
      if (!records.length)
        list.append(
          status("No bookmarks yet. Saved bookmarks will appear here."),
        );
      loaded = true;

      feedback.replaceChildren();
    } catch {
      feedback.replaceChildren(
        status(
          loaded
            ? "Could not refresh. The previous bookmark list is shown; try Refresh again."
            : "Could not load bookmarks. Try Refresh again.",
        ),
      );
    } finally {
      busy = false;
      refresh.disabled = false;
      list.removeAttribute("aria-busy");
      changed();
    }
  }
  return {
    element: page,
    load: () => load(),
    refresh: () => (loaded ? load(true) : Promise.resolve()),
  };
}
