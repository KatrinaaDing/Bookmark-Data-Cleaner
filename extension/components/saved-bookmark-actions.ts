import { PendingAction } from "./async-state.js";
import type { BookmarkFolder, BookmarkRef } from "../core/types.js";
import { el } from "./dom.js";
import { iconButton } from "./icons.js";
import { bookmarkLink, bookmarkSummary } from "./bookmark-summary.js";
import { requestLeave } from "./form-session.js";
import { confirmDestructive, toast } from "./feedback.js";
import { emit } from "./events.js";
import { removeBookmark } from "../browser/bookmarks.js";
import { errorMessage } from "../helpers/errors.js";
import { reveal } from "./motion.js";
import { bookmarkEditor, type BookmarkMutation } from "./bookmark-editor.js";

export interface SavedBookmarkContext {
  folders: BookmarkFolder[];
  /** Prefill for a new bookmark when no saved bookmark is the source. */
  defaultTitle: string;
  defaultUrl: string;
  /** Stable key for the "Save bookmark" control when there is no source bookmark. */
  newBookmarkKey: string;
  /** Reconcile after a write (or a failed write) settles. */
  onSettled: (result: BookmarkMutation) => Promise<void>;
}

export interface SavedBookmarkActions {
  /** Add edit/copy(/delete) controls to `heading`, opening the editor inside `container`. */
  attach(container: HTMLElement, heading: HTMLElement, saved?: BookmarkRef, deletable?: boolean): void;
  /** Every bookmark entry in details shares one layout: summary, optional URL, actions. */
  list(bookmarks: BookmarkRef[], showUrl?: boolean): HTMLElement;
}

/** Edit, copy and delete controls for bookmarks shown in one details panel. */
export function savedBookmarkActions(context: SavedBookmarkContext): SavedBookmarkActions {
  // One panel opens at most one editor and runs at most one delete at a time.
  const opening = new PendingAction();
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
      await context.onSettled({ id: saved.id, created: false });
    } catch (error) {
      toast(errorMessage(error), "error");
      if (trigger.isConnected) trigger.disabled = !!saved.unmodifiable;
    }
  });

  function attach(container: HTMLElement, heading: HTMLElement, saved?: BookmarkRef, deletable = false) {
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
        folders: context.folders,
        title: saved?.title ?? context.defaultTitle,
        url: saved?.url ?? context.defaultUrl,
        parentId: saved?.parentId,
        onSettled: context.onSettled,
        onClose: () => {
          if (opened !== editor) return;
          opened = undefined;
          trigger.setAttribute("aria-expanded", "false");
          if (trigger.isConnected) trigger.focus({ preventScroll: true });
          void reveal(editor, false).then(() => { editor.remove(); emit("editor-closed"); });
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
    copy.dataset.editorKey = `copy:${saved?.id ?? context.newBookmarkKey}`;
    copy.classList.add("bookmark-copy-action"); copy.setAttribute("aria-expanded", "false");
    actions.append(copy);
    if (saved && deletable) {
      const remove = iconButton("trash", `Delete ${saved.title || "bookmark"}`, () => void deleteBookmark(saved, remove));
      remove.title = "Delete bookmark";
      remove.classList.add("bookmark-delete-action"); remove.disabled = !!saved.unmodifiable;
      actions.append(remove);
    }
  }

  function list(bookmarks: BookmarkRef[], showUrl = true): HTMLElement {
    const list = el("ul", "saved-pages");
    for (const saved of bookmarks) {
      const item = el("li", "saved-page");
      const heading = el("div", "saved-page-heading");
      const description = el("div", "saved-page-description");
      description.append(bookmarkSummary(saved));
      if (showUrl) description.append(bookmarkLink(saved.url));
      heading.append(description);
      item.append(heading);
      attach(item, heading, saved, true);
      list.append(item);
    }
    return list;
  }

  return { attach, list };
}
