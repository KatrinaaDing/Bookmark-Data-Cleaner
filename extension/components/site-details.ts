import type {
  BookmarkFolder,
  BookmarkRef,
  SiteRecord,
} from "../core/types.js";
import { analyzeImpact } from "../core/impact.js";
import { dateText, el } from "./dom.js";
import { affectedBookmarks } from "./affected-bookmarks.js";
import { iconButton } from "./icons.js";
import { infoPopover } from "./feedback.js";
import { bookmarkLink, bookmarkSummary } from "./bookmark-summary.js";
import { requestLeave } from "./form-session.js";
import { reveal } from "./motion.js";
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

  const basic = detailCard("Basic information");
  basic.append(
    valueRow(inspected ? "Bookmark URL" : "Domain", inspected ? "" : site.host),
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
  if (inspected) basic.querySelector(".detail-value > :last-child")!.append(bookmarkLink(inspected.url));

  const bookmark = detailCard("Bookmark");
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
  const defaultUrl = site.urls[0] ?? `${site.origins[0] ?? `https://${site.host}`}/`;
  function addEditor(container: HTMLElement, heading: HTMLElement, saved?: BookmarkRef) {
    const actions = el("span", "bookmark-actions");
    heading.classList.add("bookmark-heading");
    heading.append(actions);
    let opened: HTMLElement | undefined;
    let openedTrigger: HTMLButtonElement | undefined;
    const openForm = async (copy: boolean, trigger: HTMLButtonElement) => {
      const wasOpen = !!opened && openedTrigger === trigger;
      if (!(await requestLeave())) return;
      if (wasOpen) return;
      const editor = el("div", copy ? "create-bookmark" : "edit-bookmark");
      editor.hidden = true;
      opened = editor;
      openedTrigger = trigger;
      const form = bookmarkEditor({
        bookmark: copy ? undefined : saved,
        folders, title: saved?.title ?? title, url: saved?.url ?? defaultUrl,
        parentId: saved?.parentId,
        onSettled: rerenderAfterMutation,
        onClose: () => {
          if (opened !== editor) return;
          opened = undefined;
          trigger.setAttribute("aria-expanded", "false");
          if (trigger.isConnected) trigger.focus({ preventScroll: true });
          void reveal(editor, false).then(() => { editor.remove(); document.dispatchEvent(new Event("editor-closed")); });
        },
      });
      editor.append(form.element); container.append(editor);
      trigger.setAttribute("aria-expanded", "true");
      void reveal(editor, true); form.open();
    };
    if (saved) {
      const edit = iconButton("edit", `Edit ${saved.title || "bookmark"}`, () => void openForm(false, edit));
      edit.classList.add("bookmark-edit-action"); edit.disabled = !!saved.unmodifiable;
      edit.setAttribute("aria-expanded", "false"); actions.append(edit);
    }
    const copy = iconButton(saved ? "copy" : "bookmark", saved ? `Create bookmark copy of ${saved.title || "bookmark"}` : "Save bookmark", () => void openForm(true, copy));
    copy.classList.add("bookmark-copy-action"); copy.setAttribute("aria-expanded", "false");
    actions.append(copy);
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
      description.append(bookmarkSummary(saved), bookmarkLink(saved.url));
      heading.append(description);
      item.append(heading);
      addEditor(item, heading, saved);
      list.append(item);
    }
    bookmark.append(list);
  } else {
    bookmark.append(el("p", "fine", "No bookmarks saved for this website. Use Save bookmark to add one."));
    addEditor(bookmark, bookmark.querySelector("h3")!);
  }

  const target = inspected
    ? { ...site, bookmarks: [inspected] }
    : { ...site, bookmarks: [] };
  const impact = analyzeImpact([target], allBookmarks, detectedSites);
  const websiteData = detailCard("Website data");
  websiteData.querySelector("h3")!.append(infoPopover("About website data cleanup", "Cleanup can sign you out or remove offline and unsynced website data. Other pages can share this data even when their bookmarks remain. You will review each category before anything is removed."));
  if (impact.duplicates.length) bookmark.append(affectedBookmarks({ ...impact, relatedBookmarks: [], relatedSites: [] }));
  websiteData.append(
    valueRow(
      "Detected cookies",
      site.cookiesAvailable === false
        ? "Not checked"
        : String(site.cookies.length),
    ),
    affectedBookmarks({ ...impact, duplicates: [] }),
  );
  if (options.onCleanup) {
    const clean = el("button", "primary detail-cleanup", "Clean up data");
    clean.type = "button";
    clean.addEventListener("click", () => { void requestLeave().then(allowed => { if (allowed) options.onCleanup?.(site, inspected); }); });
    websiteData.append(clean);
  }
  panel.append(basic, bookmark, websiteData);
  return panel;
}
