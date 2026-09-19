import type { CleanupImpact } from "../core/impact.js";
import type { BookmarkRef } from "../core/types.js";
import { el } from "./dom.js";

function bookmarkLine(bookmark: BookmarkRef): HTMLElement {
  const line = el("li", "affected-entry");
  line.append(
    el("span", "affected-title", bookmark.title || "Untitled"),
    el("span", "fine", bookmark.path || "Bookmarks"),
  );
  return line;
}

export function affectedBookmarks(impact: CleanupImpact): HTMLElement {
  const content = el("div", "affected-bookmarks");
  if (impact.duplicates.length) {
    content.append(
      el("h4", "", "Exact copies"),
    );
    const list = el("ul");
    for (const bookmark of impact.duplicates) list.append(bookmarkLine(bookmark));
    content.append(list);
  }
  if (impact.relatedBookmarks.length || impact.relatedSites.length) {
    content.append(
      el("h4", "", "Shared website data"),
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
