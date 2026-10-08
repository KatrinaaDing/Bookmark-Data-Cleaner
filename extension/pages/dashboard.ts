import { el, heading, disclosure } from "../components/dom.js";
import { hasSiteAccess, readCookies } from "../browser/site-data.js";
import { inventoryFromCookies } from "../core/inventory.js";
import { plural } from "../helpers/format.js";

export interface Dashboard {
  element: HTMLElement;
  /** Re-read the counts shown on the cards. */
  refresh(): void;
}

async function bookmarkCount(): Promise<string> {
  const tree = await chrome.bookmarks.getTree();
  let count = 0;
  const visit = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
    for (const node of nodes) {
      if (node.url) count++;
      else visit(node.children ?? []);
    }
  };
  visit(tree);
  return count ? `${plural(count, "bookmark")} saved` : "No bookmarks saved yet";
}

async function siteCount(): Promise<string> {
  if (!(await hasSiteAccess())) return "Needs one-time site access";
  const sites = inventoryFromCookies(await readCookies(), [], []).length;
  return sites ? `${plural(sites, "site")} with cookies` : "No cookies detected";
}

export function dashboard(): Dashboard {
  const page = el("section", "dashboard");
  page.append(heading(
    "Clean up sites you no longer use.",
    "Start from old bookmarks or sites with leftover cookies. Review exactly what goes before anything is removed.",
  ));
  const cards = el("div", "feature-cards");
  const stats = new Map<string, HTMLElement>();
  for (const [route, title, description, action] of [
    [
      "bookmarks",
      "Bookmarks",
      "Find bookmarks you have not opened in a while and clear the data their sites left behind.",
      "Review bookmarks",
    ],
    [
      "sites",
      "Site data",
      "See every site that stored cookies, even without a bookmark, and clear the ones you are done with.",
      "Review site data",
    ],
  ]) {
    const card = el("a", "feature-card");
    card.href = `#${route}`;
    const stat = el("p", "card-stat");
    stat.setAttribute("aria-live", "polite");
    stats.set(route, stat);
    card.append(
      el("h2", "", title),
      stat,
      el("p", "", description),
      el("span", "card-action", action),
    );
    cards.append(card);
  }
  page.append(
    cards,
    el("p", "local-note", "Processed locally. Nothing is sent anywhere, and you choose what is removed."),
    disclosure(
      "How cleanup works",
      "Pick bookmarks or sites, choose which data types to clear, then review the exact list before confirming. Site discovery uses cookies; sites with only other storage may be missing. No website previews or analytics.",
    ),
  );
  let generation = 0;
  function refresh() {
    const current = ++generation;
    for (const [route, read] of [["bookmarks", bookmarkCount], ["sites", siteCount]] as const)
      void read().then(
        (text) => { if (current === generation) stats.get(route)!.textContent = text; },
        () => { if (current === generation) stats.get(route)!.textContent = ""; },
      );
  }
  refresh();
  return { element: page, refresh };
}
