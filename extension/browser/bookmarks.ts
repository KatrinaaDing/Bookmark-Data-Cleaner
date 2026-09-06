import type { BookmarkRef } from '../core/types.js';
export async function readBookmarks(): Promise<{ tree: chrome.bookmarks.BookmarkTreeNode[]; bookmarks: BookmarkRef[] }> {
  const tree = await chrome.bookmarks.getTree(); const bookmarks: BookmarkRef[] = [];
  function visit(nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[]) {
    for (const node of nodes) { if(node.url) bookmarks.push({id:node.id,title:node.title,url:node.url,path:path.join(' / ')}); else visit(node.children ?? [],node.title ? [...path,node.title] : path); }
  }
  visit(tree,[]); return {tree,bookmarks};
}
export async function removeBookmark(id: string): Promise<void> { await chrome.bookmarks.remove(id); }
export async function removeEmptyFolder(id: string): Promise<void> {
  const [node] = await chrome.bookmarks.get(id);
  if (!node.parentId || node.parentId === '0' || node.unmodifiable) throw Error('Browser-managed folders cannot be removed.');
  if ((await chrome.bookmarks.getChildren(id)).length) throw Error('Folder kept because it still contains bookmarks.');
  await chrome.bookmarks.remove(id);
}
export async function saveBookmark(title: string, url: string): Promise<void> { await chrome.bookmarks.create({title,url}); }
