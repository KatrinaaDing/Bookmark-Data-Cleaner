import type { CleanupImpact } from "../core/impact.js";
import type { BookmarkRef } from "../core/types.js";
import { plural } from "../helpers/format.js";
import { el } from "./dom.js";

type BookmarkList = (bookmarks: BookmarkRef[]) => HTMLElement;

/** Collapsed list of other bookmarks saved for the exact same URL. */
export function duplicateDisclosure(duplicates: BookmarkRef[], bookmarkList: BookmarkList): HTMLDetailsElement {
  const disclosure = el("details", "related-disclosure duplicate-disclosure");
  disclosure.append(
    el("summary", "", `${plural(duplicates.length, "other bookmark", "other bookmarks")} for this exact URL`),
    bookmarkList(duplicates),
  );
  return disclosure;
}

/** Lists render through the caller so details can reuse its actionable saved-bookmark entries. */
export function affectedBookmarks(impact: CleanupImpact, bookmarkList: BookmarkList): HTMLElement {
  const content = el("div", "affected-bookmarks");
  if (impact.duplicates.length)
    content.append(duplicateDisclosure(impact.duplicates, bookmarkList));
  if (impact.relatedBookmarks.length || impact.relatedSites.length) {
    const disclosure = el("details", "related-disclosure");
    disclosure.append(el("summary", "", impact.relatedBookmarks.length
      ? `${plural(impact.relatedBookmarks.length, "saved page")} may be affected`
      : `${plural(impact.relatedSites.length, "other site")} may be affected`));

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
