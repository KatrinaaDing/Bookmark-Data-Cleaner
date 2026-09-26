import type { CleanupImpact } from "../core/impact.js";
import type { BookmarkRef } from "../core/types.js";
import { el } from "./dom.js";
import { bookmarkSummary } from "./bookmark-summary.js";

function bookmarkLine(bookmark: BookmarkRef): HTMLElement {
  const line = el("li", "affected-entry");
  line.append(bookmarkSummary(bookmark, false, true));
  return line;
}

export function affectedBookmarks(impact: CleanupImpact): HTMLElement {
  const content = el("div", "affected-bookmarks");
  if (impact.duplicates.length) {
    const disclosure = el("details", "related-disclosure duplicate-disclosure");
    disclosure.append(el("summary", "", `${impact.duplicates.length} other ${impact.duplicates.length === 1 ? "bookmark" : "bookmarks"} for this exact URL`));
    const list = el("ul");
    for (const bookmark of impact.duplicates) list.append(bookmarkLine(bookmark));
    disclosure.append(list);
    content.append(disclosure);
  }
  if (impact.relatedBookmarks.length || impact.relatedSites.length) {
    const disclosure = el("details", "related-disclosure");
    disclosure.append(el("summary", "", impact.relatedBookmarks.length
      ? `${impact.relatedBookmarks.length} saved ${impact.relatedBookmarks.length === 1 ? "page" : "pages"} may be affected`
      : `${impact.relatedSites.length} other ${impact.relatedSites.length === 1 ? "site" : "sites"} may be affected`));

    if (impact.relatedBookmarks.length) {
      const list = el("ul");
      for (const bookmark of impact.relatedBookmarks)
        list.append(bookmarkLine(bookmark));
      disclosure.append(list);
    }
    for (const site of impact.relatedSites)
      disclosure.append(el("p", "affected-site", site.host));
    content.append(disclosure);
  }
  if (!content.childElementCount)
    content.append(
      el("p", "fine", "No other saved pages are known to share this cleanup scope."),
    );
  return content;
}
