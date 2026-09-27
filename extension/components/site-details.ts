import type {
  BookmarkFolder,
  BookmarkRef,
  SiteRecord,
} from "../core/types.js";
import { analyzeImpact } from "../core/impact.js";
import { dateText } from "../helpers/format.js";
import { button, el } from "./dom.js";
import { affectedBookmarks, duplicateDisclosure } from "./affected-bookmarks.js";
import { icon } from "./icons.js";
import { bookmarkLink } from "./bookmark-summary.js";
import { requestLeave } from "./form-session.js";
import { infoPopover } from "./feedback.js";
import type { BookmarkMutation } from "./bookmark-editor.js";
import { savedBookmarkActions } from "./saved-bookmark-actions.js";

export interface DetailsSnapshot {
  site: SiteRecord;
  inspectedBookmark?: BookmarkRef;
  allBookmarks: BookmarkRef[];
  folders: BookmarkFolder[];
  detectedSites: SiteRecord[];
}

export interface SiteDetailsOptions {
  inspectedBookmark?: BookmarkRef;
  allBookmarks?: BookmarkRef[];
  folders?: BookmarkFolder[];
  detectedSites?: SiteRecord[];
  loadingDates?: boolean;
  onCleanup?: (site: SiteRecord, bookmark?: BookmarkRef) => void;
  onMutation?: (
    id: string | undefined,
    result: BookmarkMutation,
  ) => Promise<DetailsSnapshot | undefined>;
}

function detailCard(title: string): HTMLElement {
  const card = el("section", "detail-card");
  const header = el("div", "detail-card-header");
  header.append(el("h3", "", title));
  card.append(header);
  return card;
}

function cardHeader(card: HTMLElement): HTMLElement {
  return card.querySelector<HTMLElement>(".detail-card-header")!;
}

function valueRow(label: string, value: string): HTMLElement {
  const row = el("div", "detail-value");
  row.append(el("span", "detail-label", label), el("span", "", value));
  return row;
}

export function siteDetails(
  site?: SiteRecord,
  options: SiteDetailsOptions = {},
): HTMLElement {
  const panel = el("section", "details");
  panel.setAttribute("aria-label", "Site details");
  if (!site) {
    panel.append(
      el("h2", "", "A closer look"),
      el(
        "p",
        "muted",
        "Select a title to see its local details. No website is loaded.",
      ),
    );
    return panel;
  }

  const inspected = options.inspectedBookmark;
  const allBookmarks = options.allBookmarks ?? site.bookmarks;
  const folders = options.folders ?? [];
  const detectedSites = options.detectedSites ?? [];
  const title = inspected?.title || site.host;
  panel.append(el("h2", "", title));

  const basic = detailCard(inspected ? "Bookmark" : "Site");
  const dates = el("div", "detail-metadata");
  if (inspected) {
    const address = valueRow("Bookmark URL", "");
    address.lastElementChild!.append(bookmarkLink(inspected.url));
    basic.append(address, valueRow("Saved in", inspected.path || "Bookmarks"));
  } else basic.append(valueRow("Domain", site.host));
  if (inspected)
    dates.append(valueRow(
      "Bookmark last opened",
      inspected.dateLastUsed ? dateText(inspected.dateLastUsed) : "Not recorded",
    ));
  dates.append(valueRow(
    "Website last visited",
    options.loadingDates ? "Loading visit dates…" : dateText(site.lastVisit),
  ));
  basic.append(dates);

  const rerenderAfterMutation = async (result: BookmarkMutation) => {
    const snapshot = await options.onMutation?.(result.id, result);
    if (!snapshot || !panel.isConnected) return;
    if (result.error) return; // Reconcile lists without discarding a failed or partially saved draft.
    const next = siteDetails(snapshot.site, {
        ...options,
        ...snapshot,
        inspectedBookmark: options.inspectedBookmark
          ? result.created
            ? options.inspectedBookmark
            : snapshot.inspectedBookmark
          : undefined,
      });
    panel.replaceWith(next);
    const heading = next.querySelector("h2")!;
    heading.tabIndex = -1; heading.focus({ preventScroll: true });
  };
  const bookmarkActions = savedBookmarkActions({
    folders,
    defaultTitle: title,
    defaultUrl: site.urls[0] ?? `${site.origins[0] ?? `https://${site.host}`}/`,
    newBookmarkKey: site.id,
    onSettled: rerenderAfterMutation,
  });

  // Saved bookmarks are their own section: site cleanup keeps them, so they are not website data.
  const bookmark = detailCard("Saved bookmarks");
  bookmark.classList.add("detail-bookmarks");
  if (inspected) {
    bookmarkActions.attach(basic, cardHeader(basic), inspected);
  } else if (site.bookmarks.length) {
    const list = bookmarkActions.list(site.bookmarks);
    if (site.bookmarks.length > 3) {
      const disclosure = el("details", "related-disclosure saved-pages-disclosure");
      disclosure.append(el("summary", "", `${site.bookmarks.length} saved pages — view and edit`), list);
      bookmark.append(disclosure);
    } else bookmark.append(list);
  } else {
    bookmark.append(el("p", "fine", "No bookmarks saved for this website. Use Save bookmark to add one."));
    bookmarkActions.attach(bookmark, cardHeader(bookmark));
  }

  const target = inspected
    ? { ...site, bookmarks: [inspected] }
    : { ...site, bookmarks: [] };
  const impact = analyzeImpact([target], allBookmarks, detectedSites);
  const websiteData = detailCard("Website data");
  websiteData.querySelector("h3")!.append(infoPopover("About website data", `${inspected
    ? "Website data is shared across pages of this site."
    : "Cleanup keeps your bookmarks saved."} Clearing website data may sign you out or remove offline and unsynced work. Only cookies can be counted here; other selected website data is cleared if present.`));
  websiteData.append(
    valueRow(
      "Detected cookies",
      site.cookiesAvailable === false
        ? "Not checked"
        : String(site.cookies.length),
    ),
  );
  // Without an inspected bookmark, saved bookmarks have their own section. Keep broader
  // cookie/origin effects visible here without listing the same ID twice.
  const shownIds = new Set(inspected ? [] : site.bookmarks.map(saved => saved.id));
  const related = {
    duplicates: [],
    relatedBookmarks: impact.relatedBookmarks.filter(saved => !shownIds.has(saved.id)),
    relatedSites: impact.relatedSites,
  };
  if (impact.duplicates.length || related.relatedBookmarks.length || related.relatedSites.length) {
    const shared = el("section", "detail-shared-data");
    shared.append(el("h4", "", "Other pages sharing this data"));
    if (impact.duplicates.length)
      shared.append(
        el("p", "fine", "Other bookmarks for this URL share its website data."),
        // Exact-URL copies omit the URL: it repeats the inspected bookmark's address above.
        duplicateDisclosure(impact.duplicates, (copies) => bookmarkActions.list(copies, false)),
      );
    if (related.relatedBookmarks.length || related.relatedSites.length)
      shared.append(affectedBookmarks(related, bookmarkActions.list));
    websiteData.append(shared);
  }
  if (options.onCleanup) {
    const label = inspected ? "Clean up this bookmark…" : "Clean up this site…";
    const clean = button("", () => {
      void requestLeave().then(allowed => { if (allowed) options.onCleanup?.(site, inspected); });
    }, "primary detail-cleanup");
    clean.append(icon("broom"), el("span", "", "Clean up"));
    clean.setAttribute("aria-label", label);
    clean.title = label;
    cardHeader(websiteData).append(clean);
  }
  panel.append(basic, websiteData);
  if (!inspected) panel.append(bookmark);
  return panel;
}
