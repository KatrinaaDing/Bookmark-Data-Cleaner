import type { BookmarkFolder, BookmarkRef } from "../core/types.js";
import { webOrigin } from "../helpers/sites.js";
export async function readBookmarks(): Promise<{
  tree: chrome.bookmarks.BookmarkTreeNode[];
  bookmarks: BookmarkRef[];
  folders: BookmarkFolder[];
}> {
  const tree = await chrome.bookmarks.getTree();
  const bookmarks: BookmarkRef[] = [];
  const folders: BookmarkFolder[] = [];
  function visit(
    nodes: chrome.bookmarks.BookmarkTreeNode[],
    path: string[],
    inheritedUnmodifiable = false,
  ) {
    for (const node of nodes) {
      const unmodifiable = inheritedUnmodifiable || !!node.unmodifiable;
      if (node.url) {
        bookmarks.push({
          id: node.id,
          title: node.title,
          url: node.url,
          path: path.join(" / "),
          ...(node.parentId ? { parentId: node.parentId } : {}),
          ...(node.index !== undefined ? { index: node.index } : {}),
          ...(node.dateAdded !== undefined ? { dateAdded: node.dateAdded } : {}),
          ...(node.dateLastUsed !== undefined
            ? { dateLastUsed: node.dateLastUsed }
            : {}),
          ...(unmodifiable ? { unmodifiable: true } : {}),
        });
      } else {
        const folderPath = node.title ? [...path, node.title] : path;
        if (node.parentId)
          folders.push({
            id: node.id,
            title: node.title,
            path: folderPath.join(" / "),
            ...(unmodifiable ? { unmodifiable: true } : {}),
          });
        visit(node.children ?? [], folderPath, unmodifiable);
      }
    }
  }
  visit(tree, []);
  return { tree, bookmarks, folders };
}

function requireWebUrl(url: string): void {
  if (!webOrigin(url)) throw Error("Enter an HTTP or HTTPS URL.");
}

async function getNode(id: string): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const [node] = await chrome.bookmarks.get(id);
  if (!node) throw Error("The bookmark or folder could not be found.");
  return node;
}

async function requireWritable(
  id: string,
  expected: "bookmark" | "folder",
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  let node = await getNode(id);
  const selected = node;
  if (expected === "bookmark" ? !node.url : !!node.url)
    throw Error(`The selected ${expected} could not be found.`);
  if (expected === "folder" && node.id === "0")
    throw Error("Browser-managed folders cannot be changed.");
  while (true) {
    if (node.unmodifiable)
      throw Error("Browser-managed bookmarks and folders cannot be changed.");
    if (!node.parentId) break;
    node = await getNode(node.parentId);
  }
  return selected;
}
export async function removeBookmark(id: string): Promise<void> {
  await chrome.bookmarks.remove(id);
}
export async function removeEmptyFolder(id: string): Promise<void> {
  const [node] = await chrome.bookmarks.get(id);
  if (!node.parentId || node.parentId === "0" || node.unmodifiable)
    throw Error("Browser-managed folders cannot be removed.");
  if ((await chrome.bookmarks.getChildren(id)).length)
    throw Error("Folder kept because it still contains bookmarks.");
  await chrome.bookmarks.remove(id);
}
export async function saveBookmark(
  title: string,
  url: string,
  parentId?: string,
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  requireWebUrl(url);
  if (parentId !== undefined) await requireWritable(parentId, "folder");
  return chrome.bookmarks.create({
    title,
    url,
    ...(parentId !== undefined ? { parentId } : {}),
  });
}

export async function updateBookmark(
  id: string,
  changes: { title: string; url: string; parentId: string },
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  requireWebUrl(changes.url);
  const [source] = await Promise.all([
    requireWritable(id, "bookmark"),
    requireWritable(changes.parentId, "folder"),
  ]);
  let updated = await chrome.bookmarks.update(id, {
    title: changes.title,
    url: changes.url,
  });
  if (source.parentId !== changes.parentId)
    updated = await chrome.bookmarks.move(id, { parentId: changes.parentId });
  return updated;
}
