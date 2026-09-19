import type {
  BookmarkFolder,
  BookmarkRef,
  SiteRecord,
} from "../core/types.js";
import { analyzeImpact } from "../core/impact.js";
import { button, dateText, el } from "./dom.js";
import { affectedBookmarks } from "./affected-bookmarks.js";
import { iconButton } from "./icons.js";
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
  function addEditor(container: HTMLElement, heading: HTMLElement, saved: BookmarkRef) {
    const editor = el("div", "edit-bookmark");
    editor.id = `bookmark-editor-${saved.id}`;
    editor.hidden = true;
    editor.append(bookmarkEditor({
      bookmark: saved, folders, title: saved.title, url: saved.url,
      onSettled: rerenderAfterMutation,
    }));
    const edit = button("Edit", () => {
      editor.hidden = !editor.hidden;
      edit.textContent = editor.hidden ? "Edit" : "Close edit";
      edit.setAttribute("aria-expanded", String(!editor.hidden));
      edit.setAttribute("aria-label", `${editor.hidden ? "Edit" : "Close editor for"} ${saved.title || "bookmark"}`);
      if (!editor.hidden) editor.querySelector("input")?.focus();
      editor.dispatchEvent(new Event("toggle"));
    }, "bookmark-edit-action");
    edit.setAttribute("aria-label", `Edit ${saved.title || "bookmark"}`);
    edit.setAttribute("aria-expanded", "false");
    edit.setAttribute("aria-controls", editor.id);
    heading.classList.add("bookmark-heading");
    heading.append(edit);
    container.append(editor);
  }
  if (inspected) {
    bookmark.append(valueRow("Saved in", inspected.path || "Bookmarks"));
    addEditor(bookmark, bookmark.querySelector("h3")!, inspected);
  } else if (site.bookmarks.length) {
    const list = el("ul", "saved-pages");
    for (const saved of site.bookmarks) {
      const item = el("li", "saved-page");
      const heading = el("div", "saved-page-heading");
      const description = el("div", "saved-page-description");
      description.append(
        el("span", "affected-title", saved.title || "Untitled"),
        el("span", "fine", saved.path || "Bookmarks"),
      );
      heading.append(description);
      item.append(heading);
      addEditor(item, heading, saved);
      list.append(item);
    }
    bookmark.append(list);
  } else {
    bookmark.append(el("p", "fine", "No bookmarks saved for this website. Use Save bookmark to add one."));
  }
  const create = el("details", "detail-disclosure create-bookmark");
  create.append(el("summary", "", site.bookmarks.length ? "Create copy" : "Save bookmark"));
  create.append(
    bookmarkEditor({
      folders,
      createLabel: site.bookmarks.length ? "Create copy" : "Save bookmark",
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
  const help = el("div", "website-data-help fine");
  help.id = "website-data-help";
  help.hidden = true;
  help.append(
    el("p", "", "Cleanup can sign you out or remove offline and unsynced website data. You will review each category before anything is removed."),
  );
  if (impact.duplicates.length)
    help.append(
      el("p", "", "Exact copies save the same complete address. They stay unless you add them during review."),
    );
  if (impact.relatedBookmarks.length || impact.relatedSites.length)
    help.append(
      el("p", "", "Removing website data can affect the saved pages or detected sites listed below even though their bookmarks stay."),
    );
  const info = iconButton("info", "About website data cleanup", () => {
    help.hidden = !help.hidden;
    info.setAttribute("aria-expanded", String(!help.hidden));
  });
  info.classList.add("detail-info");
  info.setAttribute("aria-expanded", "false");
  info.setAttribute("aria-controls", help.id);
  websiteData.querySelector("h3")!.append(info);
  websiteData.append(
    help,
    valueRow(
      "Detected cookies",
      site.cookiesAvailable === false
        ? "Not checked"
        : String(site.cookies.length),
    ),
    affectedBookmarks(impact),
  );
  if (options.onCleanup) {
    const clean = el("button", "primary detail-cleanup", "Clean up data");
    clean.type = "button";
    clean.addEventListener("click", () => options.onCleanup?.(site, inspected));
    websiteData.append(clean);
  }
  panel.append(basic, bookmark, websiteData);
  return panel;
}
