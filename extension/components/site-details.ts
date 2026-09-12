import type {
  BookmarkFolder,
  BookmarkRef,
  SiteRecord,
} from "../core/types.js";
import { analyzeImpact } from "../core/impact.js";
import { dateText, el } from "./dom.js";
import { affectedBookmarks } from "./affected-bookmarks.js";
import {
  bookmarkEditor,
  type BookmarkMutation,
} from "./bookmark-editor.js";

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
  notice?: string;
  onCleanup?: (site: SiteRecord, bookmark?: BookmarkRef) => void;
  onMutation?: (
    id: string | undefined,
    result: BookmarkMutation,
  ) => Promise<DetailsSnapshot | undefined>;
}

function detailCard(title: string): HTMLElement {
  const card = el("section", "detail-card");
  card.append(el("h3", "", title));
  return card;
}

function valueRow(label: string, value: string): HTMLElement {
  const row = el("div", "detail-value");
  row.append(el("span", "detail-label", label), el("span", "", value));
  return row;
}

function addressDisclosure(urls: string[]): HTMLElement {
  const details = el("details", "detail-disclosure address-disclosure");
  details.append(el("summary", "", urls.length === 1 ? "Address" : "Addresses"));
  for (const url of urls) details.append(el("p", "url", url));
  return details;
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
  if (options.notice) panel.append(el("p", "mutation-notice", options.notice));

  const basic = detailCard("Basic information");
  basic.append(
    valueRow("Website", site.host),
    inspected
      ? valueRow(
          "Bookmark last opened",
          inspected.dateLastUsed ? dateText(inspected.dateLastUsed) : "Not recorded",
        )
      : valueRow(
          "Website last visited",
          options.loadingDates ? "Loading visit dates…" : dateText(site.lastVisit),
        ),
  );
  if (inspected)
    basic.append(
      valueRow(
        "Website last visited",
        options.loadingDates ? "Loading visit dates…" : dateText(site.lastVisit),
      ),
    );
  basic.append(addressDisclosure(inspected ? [inspected.url] : site.urls));
  const openUrl = inspected?.url ?? site.urls[0];
  if (openUrl) {
    const open = el("a", "open-page", "Open page");
    open.href = openUrl;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    basic.append(open);
  }

  const bookmark = detailCard("Bookmark");
  const rerenderAfterMutation = async (result: BookmarkMutation) => {
    const snapshot = await options.onMutation?.(result.id, result);
    if (!snapshot || !panel.isConnected) return;
    const destination = snapshot.inspectedBookmark?.path;
    const notice = result.error
      ? `${result.error} Current browser state is shown.`
      : result.created
        ? `Copy created in ${destination || "the selected folder"}.`
        : `Saved in ${destination || "the selected folder"}.`;
    panel.replaceWith(
      siteDetails(snapshot.site, {
        ...options,
        ...snapshot,
        notice,
        inspectedBookmark: options.inspectedBookmark
          ? result.created
            ? options.inspectedBookmark
            : snapshot.inspectedBookmark
          : undefined,
      }),
    );
  };
  if (inspected) {
    bookmark.append(valueRow("Saved in", inspected.path || "Bookmarks"));
    const edit = el("details", "detail-disclosure edit-bookmark");
    edit.append(el("summary", "", "Edit or move"));
    edit.append(
      bookmarkEditor({
        bookmark: inspected,
        folders,
        title: inspected.title,
        url: inspected.url,
        onSettled: rerenderAfterMutation,
      }),
    );
    bookmark.append(edit);
  } else if (site.bookmarks.length) {
    const list = el("ul", "saved-pages");
    for (const saved of site.bookmarks) {
      const item = el("li", "saved-page");
      const heading = el("div", "saved-page-heading");
      heading.append(
        el("span", "affected-title", saved.title || "Untitled"),
        el("span", "fine", saved.path || "Bookmarks"),
      );
      const edit = el("details", "detail-disclosure edit-bookmark");
      edit.append(el("summary", "", "Edit"));
      edit.append(
        bookmarkEditor({
          bookmark: saved,
          folders,
          title: saved.title,
          url: saved.url,
          onSettled: rerenderAfterMutation,
        }),
      );
      item.append(heading, edit);
      list.append(item);
    }
    bookmark.append(list);
  } else {
    bookmark.append(el("p", "fine", "No saved pages for this website."));
  }
  const create = el("details", "detail-disclosure create-bookmark");
  create.append(el("summary", "", "Create copy"));
  create.append(
    bookmarkEditor({
      folders,
      title,
      url: inspected?.url ?? site.urls[0] ?? `${site.origins[0] ?? `https://${site.host}`}/`,
      onSettled: rerenderAfterMutation,
    }),
  );
  bookmark.append(create);

  const target = inspected
    ? { ...site, bookmarks: [inspected] }
    : { ...site, bookmarks: [] };
  const impact = analyzeImpact([target], allBookmarks, detectedSites);
  const websiteData = detailCard("Website data");
  websiteData.append(
    valueRow(
      "Detected cookies",
      site.cookiesAvailable === false
        ? "Not checked"
        : String(site.cookies.length),
    ),
    el(
      "p",
      "fine",
      "Cleanup can sign you out or remove offline and unsynced website data. You will review each category before anything is removed.",
    ),
    affectedBookmarks(impact),
  );
  if (options.onCleanup) {
    const clean = el("button", "danger detail-cleanup", "Clean up");
    clean.type = "button";
    clean.addEventListener("click", () => options.onCleanup?.(site, inspected));
    websiteData.append(clean);
  }
  panel.append(basic, bookmark, websiteData);
  return panel;
}
