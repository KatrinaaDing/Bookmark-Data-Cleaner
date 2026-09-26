import type { CleanupImpact } from "../core/impact.js";
import type { BookmarkRef } from "../core/types.js";
import { el } from "./dom.js";

/** Lists render through the caller so details can reuse its actionable saved-bookmark entries. */
export function affectedBookmarks(impact: CleanupImpact, bookmarkList: (bookmarks: BookmarkRef[]) => HTMLElement): HTMLElement {
  const content = el("div", "affected-bookmarks");
  if (impact.duplicates.length) {
    const disclosure = el("details", "related-disclosure duplicate-disclosure");
    disclosure.append(el("summary", "", `${impact.duplicates.length} other ${impact.duplicates.length === 1 ? "bookmark" : "bookmarks"} for this exact URL`));
    disclosure.append(bookmarkList(impact.duplicates));
    content.append(disclosure);
  }
  if (impact.relatedBookmarks.length || impact.relatedSites.length) {
    const disclosure = el("details", "related-disclosure");
    disclosure.append(el("summary", "", impact.relatedBookmarks.length
      ? `${impact.relatedBookmarks.length} saved ${impact.relatedBookmarks.length === 1 ? "page" : "pages"} may be affected`
      : `${impact.relatedSites.length} other ${impact.relatedSites.length === 1 ? "site" : "sites"} may be affected`));

    if (impact.relatedBookmarks.length)
      disclosure.append(bookmarkList(impact.relatedBookmarks));
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
