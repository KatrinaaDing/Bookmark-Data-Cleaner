import { PendingAction } from "./async-state.js";
import type {
  BookmarkFolder,
  BookmarkRef,
  SiteRecord,
} from "../core/types.js";
import { analyzeImpact } from "../core/impact.js";
import { dateText, el } from "./dom.js";
import { affectedBookmarks } from "./affected-bookmarks.js";
import { iconButton } from "./icons.js";
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

  const basic = detailCard(inspected ? "Bookmark" : "Site");
  const dates = el("div", "detail-metadata");
  basic.append(
    valueRow(inspected ? "Bookmark URL" : "Domain", inspected ? "" : site.host),
  );
  dates.append(
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
    dates.append(
      valueRow(
        "Website last visited",
        options.loadingDates ? "Loading visit dates…" : dateText(site.lastVisit),
      ),
    );
  if (inspected) {
    basic.querySelector(".detail-value")!.classList.add("bookmark-address");
    basic.querySelector(".detail-value > :last-child")!.append(bookmarkLink(inspected.url));
    basic.append(valueRow("Saved in", inspected.path || "Bookmarks"));
  }
  basic.append(dates);

  const bookmark = el("section", "detail-bookmarks");
  if (!inspected) bookmark.append(el("h4", "", "Saved bookmarks"));
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
  const opening = new PendingAction();
  const siteKey = site.id;
  const defaultUrl = site.urls[0] ?? `${site.origins[0] ?? `https://${site.host}`}/`;
  function addEditor(container: HTMLElement, heading: HTMLElement, saved?: BookmarkRef) {
    const actions = el("span", "bookmark-actions");
    heading.classList.add("bookmark-heading");
    heading.append(actions);
    const formHost = el("div", "bookmark-form-host");
    container.append(formHost);
    let opened: HTMLElement | undefined;
    let openedTrigger: HTMLButtonElement | undefined;
    const openForm = (copy: boolean, trigger: HTMLButtonElement) => opening.run(async () => {
      const wasOpen = !!opened && openedTrigger === trigger;
      if (!(await requestLeave())) return;
      if (wasOpen) return;
      // Saving may replace this panel. Continue on the new control, never an old DOM owner.
      if (!trigger.isConnected) {
        const key = trigger.dataset.editorKey;
        if (key) document.querySelector<HTMLButtonElement>(`.details-drawer [data-editor-key="${CSS.escape(key)}"]`)?.click();
        return;
      }
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
      editor.append(form.element); formHost.append(editor);
      trigger.setAttribute("aria-expanded", "true");
      void reveal(editor, true); form.open();
    });
    if (saved) {
      const edit = iconButton("edit", `Edit ${saved.title || "bookmark"}`, () => void openForm(false, edit));
      edit.dataset.editorKey = `edit:${saved.id}`;
      edit.classList.add("bookmark-edit-action"); edit.disabled = !!saved.unmodifiable;
      edit.setAttribute("aria-expanded", "false"); actions.append(edit);
    }
    const copy = iconButton(saved ? "copy" : "bookmark", saved ? `Create bookmark copy of ${saved.title || "bookmark"}` : "Save bookmark", () => void openForm(true, copy));
    copy.dataset.editorKey = `copy:${saved?.id ?? siteKey}`;
    copy.classList.add("bookmark-copy-action"); copy.setAttribute("aria-expanded", "false");
    actions.append(copy);
  }
  if (inspected) {
    addEditor(basic, basic.querySelector("h3")!, inspected);
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
    if (site.bookmarks.length > 3) {
      const disclosure = el("details", "related-disclosure saved-pages-disclosure");
      disclosure.append(el("summary", "", `${site.bookmarks.length} saved pages — view and edit`), list);
      bookmark.append(disclosure);
    } else bookmark.append(list);
  } else {
    bookmark.append(el("p", "fine", "No bookmarks saved for this website. Use Save bookmark to add one."));
    addEditor(bookmark, bookmark.querySelector("h4")!);
  }

  const target = inspected
    ? { ...site, bookmarks: [inspected] }
    : { ...site, bookmarks: [] };
  const impact = analyzeImpact([target], allBookmarks, detectedSites);
  const websiteData = detailCard("Website data");
  if (impact.duplicates.length) bookmark.append(affectedBookmarks({ ...impact, relatedBookmarks: [], relatedSites: [] }));
  websiteData.append(
    valueRow(
      "Detected cookies",
      site.cookiesAvailable === false
        ? "Not checked"
        : String(site.cookies.length),
    ),
  );
  websiteData.append(el("p", "detail-consequence", inspected
    ? "Website data is shared across pages. Clearing it may sign you out or remove offline and unsynced work."
    : "Cleanup keeps your bookmarks saved. Clearing website data may sign you out or remove offline and unsynced work."));
  if (options.onCleanup) {
    const clean = el("button", "primary detail-cleanup", inspected ? "Clean up this bookmark…" : "Clean up this site…");
    clean.type = "button";
    clean.addEventListener("click", () => { void requestLeave().then(allowed => { if (allowed) options.onCleanup?.(site, inspected); }); });
    websiteData.append(clean);
  }
  if (inspected) {
    websiteData.append(impact.duplicates.length && !impact.relatedBookmarks.length && !impact.relatedSites.length
      ? el("p", "fine", "Other bookmarks for this URL share its website data.")
      : affectedBookmarks({ ...impact, duplicates: [] }));
  } else {
    websiteData.append(bookmark);
    // These bookmarks already have their full details and actions above. Keep
    // broader cookie/origin effects visible without listing the same ID twice.
    const shownIds = new Set(site.bookmarks.map(saved => saved.id));
    const additionalImpact = {
      ...impact,
      relatedBookmarks: impact.relatedBookmarks.filter(saved => !shownIds.has(saved.id)),
    };
    if (additionalImpact.relatedBookmarks.length || additionalImpact.relatedSites.length)
      websiteData.append(affectedBookmarks(additionalImpact));
  }
  panel.append(basic, websiteData);
  if (inspected && bookmark.childElementCount) panel.append(bookmark);
  return panel;
}
