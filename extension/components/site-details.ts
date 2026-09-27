import { PendingAction } from "./async-state.js";
import type {
  BookmarkFolder,
  BookmarkRef,
  SiteRecord,
} from "../core/types.js";
import { analyzeImpact } from "../core/impact.js";
import { button, el } from "./dom.js";
import { dateText } from "../helpers/format.js";
import { affectedBookmarks } from "./affected-bookmarks.js";
import { icon, iconButton } from "./icons.js";
import { bookmarkLink, bookmarkSummary } from "./bookmark-summary.js";
import { requestLeave } from "./form-session.js";
import { confirmDestructive, infoPopover, toast } from "./feedback.js";
import { removeBookmark } from "../browser/bookmarks.js";
import { errorMessage } from "../helpers/errors.js";
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
  const header = el("div", "detail-card-header");
  header.append(el("h3", "", title));
  card.append(header);
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
  if (inspected) {
    const address = valueRow("Bookmark URL", "");
    address.lastElementChild!.append(bookmarkLink(inspected.url));
    basic.append(address, valueRow("Saved in", inspected.path || "Bookmarks"));
  } else basic.append(valueRow("Domain", site.host));
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
  basic.append(dates);

  // Saved bookmarks are their own section: site cleanup keeps them, so they are not website data.
  const bookmark = detailCard("Saved bookmarks");
  bookmark.classList.add("detail-bookmarks");
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
  const deleting = new PendingAction();
  const deleteBookmark = (saved: BookmarkRef, trigger: HTMLButtonElement) => deleting.run(async () => {
    if (!(await requestLeave())) return;
    const name = saved.title || "Untitled";
    if (!(await confirmDestructive("Delete this bookmark?", `“${name}” will be removed from ${saved.path || "Bookmarks"}. Website data is kept.`, "Delete bookmark"))) {
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
      return;
    }
    trigger.disabled = true;
    try {
      await removeBookmark(saved.id);
      toast("Bookmark deleted.");
      await rerenderAfterMutation({ id: saved.id, created: false });
    } catch (error) {
      toast(errorMessage(error), "error");
      if (trigger.isConnected) trigger.disabled = !!saved.unmodifiable;
    }
  });
  function addEditor(container: HTMLElement, heading: HTMLElement, saved?: BookmarkRef, deletable = false) {
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
      edit.title = "Edit";
      edit.dataset.editorKey = `edit:${saved.id}`;
      edit.classList.add("bookmark-edit-action"); edit.disabled = !!saved.unmodifiable;
      edit.setAttribute("aria-expanded", "false"); actions.append(edit);
    }
    const copy = iconButton(saved ? "copy" : "bookmark", saved ? `Create bookmark copy of ${saved.title || "bookmark"}` : "Save bookmark", () => void openForm(true, copy));
    // Tooltips stay short; the accessible name keeps the title to tell repeated rows apart.
    if (saved) copy.title = "Create copy";
    copy.dataset.editorKey = `copy:${saved?.id ?? siteKey}`;
    copy.classList.add("bookmark-copy-action"); copy.setAttribute("aria-expanded", "false");
    actions.append(copy);
    if (saved && deletable) {
      const remove = iconButton("trash", `Delete ${saved.title || "bookmark"}`, () => void deleteBookmark(saved, remove));
      remove.title = "Delete bookmark";
      remove.classList.add("bookmark-delete-action"); remove.disabled = !!saved.unmodifiable;
      actions.append(remove);
    }
  }
  // Every bookmark entry listed in details shares one layout: summary, URL, edit/copy/delete.
  // Exact-URL copies omit the URL: it repeats the inspected bookmark's address above.
  function savedPageList(bookmarks: BookmarkRef[], showUrl = true): HTMLElement {
    const list = el("ul", "saved-pages");
    for (const saved of bookmarks) {
      const item = el("li", "saved-page");
      const heading = el("div", "saved-page-heading");
      const description = el("div", "saved-page-description");
      description.append(bookmarkSummary(saved));
      if (showUrl) description.append(bookmarkLink(saved.url));
      heading.append(description);
      item.append(heading);
      addEditor(item, heading, saved, true);
      list.append(item);
    }
    return list;
  }
  if (inspected) {
    addEditor(basic, basic.querySelector<HTMLElement>(".detail-card-header")!, inspected);
  } else if (site.bookmarks.length) {
    const list = savedPageList(site.bookmarks);
    if (site.bookmarks.length > 3) {
      const disclosure = el("details", "related-disclosure saved-pages-disclosure");
      disclosure.append(el("summary", "", `${site.bookmarks.length} saved pages — view and edit`), list);
      bookmark.append(disclosure);
    } else bookmark.append(list);
  } else {
    bookmark.append(el("p", "fine", "No bookmarks saved for this website. Use Save bookmark to add one."));
    addEditor(bookmark, bookmark.querySelector<HTMLElement>(".detail-card-header")!);
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
  if (inspected) {
    if (impact.duplicates.length || impact.relatedBookmarks.length || impact.relatedSites.length) {
      const shared = el("section", "detail-shared-data");
      shared.append(el("h4", "", "Other pages sharing this data"));
      if (impact.duplicates.length) {
        shared.append(el("p", "fine", "Other bookmarks for this URL share its website data."));
        const count = impact.duplicates.length;
        const disclosure = el("details", "related-disclosure duplicate-disclosure");
        disclosure.append(el("summary", "", `${count} other ${count === 1 ? "bookmark" : "bookmarks"} for this exact URL`), savedPageList(impact.duplicates, false));
        shared.append(disclosure);
      }
      if (impact.relatedBookmarks.length || impact.relatedSites.length)
        shared.append(affectedBookmarks({ ...impact, duplicates: [] }, savedPageList));
      websiteData.append(shared);
    }
  } else {
    // Saved bookmarks already have their own section. Keep broader cookie/origin
    // effects visible here without listing the same ID twice.
    const shownIds = new Set(site.bookmarks.map(saved => saved.id));
    const additionalImpact = {
      ...impact,
      relatedBookmarks: impact.relatedBookmarks.filter(saved => !shownIds.has(saved.id)),
    };
    if (additionalImpact.relatedBookmarks.length || additionalImpact.relatedSites.length) {
      const shared = el("section", "detail-shared-data");
      shared.append(el("h4", "", "Other pages sharing this data"), affectedBookmarks(additionalImpact, savedPageList));
      websiteData.append(shared);
    }
  }
  if (options.onCleanup) {
    const label = inspected ? "Clean up this bookmark…" : "Clean up this site…";
    const clean = button("", () => {
      void requestLeave().then(allowed => { if (allowed) options.onCleanup?.(site, inspected); });
    }, "primary detail-cleanup");
    clean.append(icon("broom"), el("span", "", "Clean up"));
    clean.setAttribute("aria-label", label);
    clean.title = label;
    websiteData.querySelector(".detail-card-header")!.append(clean);
  }
  panel.append(basic, websiteData);
  if (!inspected) panel.append(bookmark);
  return panel;
}
