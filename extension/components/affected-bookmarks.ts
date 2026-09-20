import type { CleanupImpact } from "../core/impact.js";
import type { BookmarkRef } from "../core/types.js";
import { el } from "./dom.js";
import { bookmarkSummary } from "./bookmark-summary.js";

function bookmarkLine(bookmark: BookmarkRef): HTMLElement {
  const line = el("li", "affected-entry");
  line.append(bookmarkSummary(bookmark));
  return line;
}

export function affectedBookmarks(impact: CleanupImpact): HTMLElement {
  const content = el("div", "affected-bookmarks");
  if (impact.duplicates.length) {
    content.append(
      el("h4", "", "Other bookmarks for this URL"),
    );
    const list = el("ul");
    for (const bookmark of impact.duplicates) list.append(bookmarkLine(bookmark));
    content.append(list);
  }
  if (impact.relatedBookmarks.length || impact.relatedSites.length) {
    content.append(
      el("h4", "", "Other pages affected by this cleanup"),
    );
    if (impact.relatedBookmarks.length) {
      const list = el("ul");
      for (const bookmark of impact.relatedBookmarks)
        list.append(bookmarkLine(bookmark));
      content.append(list);
    }
    for (const site of impact.relatedSites)
      content.append(el("p", "affected-site", site.host));
  }
  if (!content.childElementCount)
    content.append(
      el("p", "fine", "No other saved pages are known to share this cleanup scope."),
    );
  return content;
}
