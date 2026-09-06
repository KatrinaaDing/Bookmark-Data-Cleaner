import { Selection } from "../core/state.js";
import { button, checkbox, el } from "./dom.js";
import type { FolderRef } from "../core/types.js";
export interface TreeView {
  element: HTMLElement;
  folders: () => FolderRef[];
}
export function bookmarkTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  selection: Selection,
  expanded: Set<string>,
  inspect: (id: string, trigger: HTMLElement) => void,
  changed: () => void,
): TreeView {
  const root = el("div", "bookmark-tree");
  const checks: {
    input: HTMLInputElement;
    ids: string[];
    count?: HTMLElement;
    folder?: FolderRef;
  }[] = [];
  function eligible(
    node: chrome.bookmarks.BookmarkTreeNode,
    inherited = false,
  ): string[] {
    if (inherited || node.unmodifiable) return [];
    if (node.url) return [node.id];
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
    const protectedNode = protectedParent || !!node.unmodifiable;
    const ids = eligible(node, protectedParent);
    const item = el("div", node.url ? "bookmark-row" : "folder");
    const row = node.url ? item : el("div", "folder-row");
    const { label, input } = checkbox("", (value) => {
      for (const id of ids) selection.set(id, value);
      update();
    });
    input.setAttribute("aria-label", `Select ${node.title || "untitled"}`);
    input.disabled = protectedNode || !ids.length;
    if (protectedNode) label.title = "Managed by your browser or organization.";
    row.append(label);
    const folder: FolderRef | undefined =
      !node.url && node.parentId !== "0" ? { id: node.id, depth } : undefined;
    const counter = !node.url ? el("span", "count") : undefined;
    checks.push({ input, ids, folder, count: counter });
    if (node.url) {
      const title = button(
        node.title || "Untitled",
        () => inspect(node.id, title),
        "row-title",
      );
      title.dataset.focusKey = `bookmark:${node.id}`;
      row.append(title);
      const host = el("span", "row-host");
      try {
        host.textContent = new URL(node.url).hostname;
      } catch {
        host.textContent = "Bookmark";
      }
      row.append(host);
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
      item.append(row, children);
      for (const child of node.children ?? [])
        render(child, content, depth + 1, protectedNode);
    }
    parent.append(item);
  }
  for (const node of nodes) render(node, root, 0);
  update();
  return {
    element: root,
    folders: () =>
      checks
        .filter((c) => c.folder && c.input.checked && !c.input.disabled)
        .map((c) => c.folder!),
  };
}
