import { Selection } from "../core/state.js";
import { clickableRow, button, checkbox, el, spinner } from "./dom.js";
import { renderSignals, type BookmarkSignals } from "./bookmark-signals.js";
import type { FolderRef } from "../core/types.js";
export interface TreeView {
  element: HTMLElement;
  folders: () => FolderRef[];
  update: () => void;
  ids: () => Set<string>;
  setCleanupBusy: (ids: ReadonlySet<string>, blocked: boolean) => void;
  /** Re-read signals for every bookmark row, e.g. once visit dates and cookies load. */
  refreshSignals: () => void;
}
/** Title with its domain beside it, so the two read as one entry at any width. */
export function bookmarkRowLabel(title: HTMLElement, url: string): HTMLElement {
  const label = el("span", "row-label");
  const host = el("span", "row-host");
  try {
    host.textContent = new URL(url).hostname;
    host.title = "Bookmark domain";
  } catch {
    host.textContent = "Bookmark";
  }
  label.append(title, host);
  return label;
}
export function bookmarkRowSignals(signals: BookmarkSignals): HTMLElement {
  const meta = el("span", "row-signals");
  renderSignals(meta, signals);
  return meta;
}
export function setBookmarkRowBusy(row: HTMLElement, busy: boolean): void {
  row.classList.toggle("is-cleaning", busy);
  if (busy) row.setAttribute("aria-busy", "true");
  else row.removeAttribute("aria-busy");
  const title = row.querySelector<HTMLButtonElement>(".row-title");
  if (title) title.disabled = busy;
  row.querySelector(".row-cleanup-status")?.remove();
  if (busy) {
    const marker = el("span", "row-cleanup-status");
    marker.append(spinner(), el("span", "sr-only", "Cleanup in progress"));
    row.append(marker);
  }
}
export function bookmarkTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  selection: Selection,
  expanded: Set<string>,
  inspect: (id: string, trigger: HTMLElement) => void,
  changed: () => void,
  signals: (id: string) => BookmarkSignals,
  /** Bookmarks deleted this session, re-inserted at their old place; shown struck through, never counted. */
  ghostIds: ReadonlySet<string> = new Set(),
): TreeView {
  const root = el("div", "bookmark-tree");
  const bookmarkRows = new Map<string, HTMLElement>();
  const signalCells = new Map<string, HTMLElement>();
  let cleanupBlocked = false;
  const checks: {
    input: HTMLInputElement;
    ids: string[];
    baseDisabled: boolean;
    count?: HTMLElement;
    folder?: FolderRef;
  }[] = [];
  function eligible(
    node: chrome.bookmarks.BookmarkTreeNode,
    inherited = false,
  ): string[] {
    if (inherited || node.unmodifiable) return [];
    if (node.url) return ghostIds.has(node.id) ? [] : [node.id];
    const children = (node.children ?? []).flatMap((child) => eligible(child));
    return children.length
      ? children
      : node.parentId && node.parentId !== "0"
        ? [node.id]
        : [];
  }
  function update() {
    for (const { input, ids, count: counter } of checks) {
      const count = ids.filter((id) => selection.ids.has(id)).length;
      input.checked = ids.length > 0 && count === ids.length;
      input.indeterminate = count > 0 && count < ids.length;
      if (counter)
        counter.textContent = count
          ? `${count} / ${ids.length}`
          : String(ids.length);
    }
    changed();
  }
  function render(
    node: chrome.bookmarks.BookmarkTreeNode,
    parent: HTMLElement,
    depth: number,
    protectedParent = false,
  ) {
    if (node.id === "0") {
      for (const child of node.children ?? []) render(child, parent, 0);
      return;
    }
    if (node.url && ghostIds.has(node.id)) {
      parent.append(ghostRow(node));
      return;
    }
    const protectedNode = protectedParent || !!node.unmodifiable;
    const ids = eligible(node, protectedParent);
    const item = el("div", node.url ? "bookmark-row" : "folder");
    const row = node.url ? item : el("div", "folder-row");
    const { label, input } = checkbox("", (value) => {
      if (cleanupBlocked) return;
      for (const id of ids) selection.set(id, value);
      update();
    });
    input.setAttribute("aria-label", `Select ${node.title || "untitled"}`);
    input.disabled = protectedNode || !ids.length;
    const baseDisabled = input.disabled;
    if (protectedNode) label.title = "Managed by your browser or organization.";
    row.append(label);
    const folder: FolderRef | undefined =
      !node.url && node.parentId !== "0" ? { id: node.id, depth } : undefined;
    const counter = !node.url ? el("span", "count") : undefined;
    checks.push({ input, ids, baseDisabled, folder, count: counter });
    if (node.url) {
      bookmarkRows.set(node.id, row);
      const title = button(
        node.title || "Untitled",
        () => inspect(node.id, title),
        "row-title",
      );
      title.dataset.focusKey = `bookmark:${node.id}`;
      const meta = bookmarkRowSignals(signals(node.id));
      signalCells.set(node.id, meta);
      row.append(bookmarkRowLabel(title, node.url), meta);
      clickableRow(row, title);
    } else {
      const children = el("div", "folder-children");
      children.id = `folder-${node.id}`;
      const content = el("div", "folder-content");
      children.append(content);
      const setExpanded = (open: boolean) => {
        children.classList.toggle("is-expanded", open);
        children.inert = !open;
        children.setAttribute("aria-hidden", String(!open));
      };
      setExpanded(expanded.has(node.id));
      const toggle = button(
        node.title || "Untitled folder",
        () => {
          const open = !expanded.has(node.id);
          setExpanded(open);
          toggle.setAttribute("aria-expanded", String(open));
          if (open) expanded.add(node.id);
          else expanded.delete(node.id);
        },
        "folder-toggle",
      );
      toggle.setAttribute("aria-expanded", String(expanded.has(node.id)));
      toggle.setAttribute("aria-controls", children.id);
      row.append(toggle, counter!);
      clickableRow(row, toggle);
      item.append(row, children);
      for (const child of node.children ?? [])
        render(child, content, depth + 1, protectedNode);
      if (!node.children?.length)
        content.append(el("p", "fine empty-folder", "This folder is empty."));
    }
    parent.append(item);
  }
  function ghostRow(node: chrome.bookmarks.BookmarkTreeNode): HTMLElement {
    const row = el("div", "bookmark-row is-deleted");
    const { label, input } = checkbox("", () => {});
    input.disabled = true;
    input.setAttribute("aria-label", `${node.title || "Untitled"} was deleted`);
    const title = el("span", "row-title", node.title || "Untitled");
    const mark = el("span", "row-deleted", "Deleted");
    mark.title = "Deleted this session. Refresh to drop it from the list.";
    row.append(label, bookmarkRowLabel(title, node.url ?? ""), mark);
    return row;
  }
  for (const node of nodes) render(node, root, 0);
  update();
  return {
    element: root,
    update,
    ids: () => new Set(checks.flatMap(check => check.baseDisabled ? [] : check.ids)),
    setCleanupBusy: (ids, blocked) => {
      cleanupBlocked = blocked;
      for (const check of checks) check.input.disabled = check.baseDisabled || blocked;
      for (const [id, row] of bookmarkRows) setBookmarkRowBusy(row, ids.has(id));
    },
    refreshSignals: () => {
      for (const [id, cell] of signalCells) renderSignals(cell, signals(id));
    },
    folders: () =>
      checks
        .filter((c) => c.folder && c.input.checked && !c.input.disabled)
        .map((c) => c.folder!),
  };
}
