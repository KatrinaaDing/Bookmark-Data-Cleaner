import {
  saveBookmark,
  updateBookmark,
} from "../browser/bookmarks.js";
import type { BookmarkFolder, BookmarkRef } from "../core/types.js";
import { errorMessage, webOrigin } from "../helpers/sites.js";
import { el, status } from "./dom.js";

export interface BookmarkMutation {
  id?: string;
  created: boolean;
  error?: string;
}

export function bookmarkEditor(options: {
  bookmark?: BookmarkRef;
  folders: BookmarkFolder[];
  title: string;
  createLabel?: string;
  url: string;
  onSettled: (result: BookmarkMutation) => Promise<void> | void;
}): HTMLFormElement {
  const form = el("form", "bookmark-editor");
  const title = el("input");
  title.name = "title";
  title.value = options.title;
  const url = el("input");
  url.name = "url";
  url.type = "url";
  url.required = true;
  url.value = options.url;
  const folder = el("select");
  folder.name = "parentId";
  folder.required = true;
  folder.setAttribute("aria-label", "Bookmark folder");
  for (const item of options.folders) {
    const choice = el("option", "", item.path || item.title || "Bookmarks");
    choice.value = item.id;
    choice.disabled = !!item.unmodifiable;
    choice.selected = item.id === options.bookmark?.parentId;
    folder.append(choice);
  }
  if (!folder.value) {
    const firstWritable = options.folders.find((item) => !item.unmodifiable);
    if (firstWritable) folder.value = firstWritable.id;
  }
  const titleLabel = el("label", "", "Bookmark title");
  titleLabel.append(title);
  const urlLabel = el("label", "", "Address");
  urlLabel.append(url);
  const folderLabel = el("label", "", "Save in");
  folderLabel.append(folder);
  const submit = el(
    "button",
    options.bookmark ? "primary" : "",
    options.bookmark ? "Save changes" : options.createLabel ?? "Create copy",
  );
  submit.type = "submit";
  submit.disabled = !!options.bookmark?.unmodifiable || !folder.value;
  const feedback = el("div", "editor-feedback");
  if (!folder.value)
    feedback.append(status("No writable bookmark folders available. Create a folder in your browser, then refresh."));
  form.append(titleLabel, urlLabel, folderLabel, feedback, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!webOrigin(url.value)) {
      feedback.replaceChildren(status("Enter an HTTP or HTTPS URL."));
      return;
    }
    submit.disabled = true;
    feedback.replaceChildren(
      status(options.bookmark ? "Saving changes…" : "Creating copy…", true),
    );
    void (async () => {
      let mutationError: string | undefined;
      let id = options.bookmark?.id;
      try {
        const saved = options.bookmark
          ? await updateBookmark(options.bookmark.id, {
              title: title.value,
              url: url.value,
              parentId: folder.value,
            })
          : await saveBookmark(title.value, url.value, folder.value);
        id = saved.id;
      } catch (error) {
        mutationError = errorMessage(error);
      }
      try {
        await options.onSettled({
          id,
          created: !options.bookmark && !mutationError,
          ...(mutationError ? { error: mutationError } : {}),
        });
      } catch {
        if (form.isConnected)
          feedback.replaceChildren(
            status(
              mutationError
                ? `${mutationError} Current browser state could not be refreshed; try Refresh.`
                : "The bookmark changed, but current browser state could not be refreshed. Try Refresh.",
            ),
          );
      } finally {
        if (form.isConnected)
          submit.disabled = !!options.bookmark?.unmodifiable || !folder.value;
      }
    })();
  });
  return form;
}
