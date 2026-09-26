import type { BookmarkRef } from '../core/types.js';
import { el } from './dom.js';
export function bookmarkSummary(bookmark: BookmarkRef, includeUrl = false): HTMLElement {
  const summary = el('span', 'bookmark-summary');
  summary.append(el('span', 'affected-title', bookmark.title || 'Untitled'), el('span', 'fine', bookmark.path || 'Bookmarks'));
  if (includeUrl) summary.append(el('span', 'fine bookmark-address-text', bookmark.url));
  return summary;
}
export function bookmarkLink(url: string): HTMLElement {
  try {
    if (!['http:', 'https:'].includes(new URL(url).protocol)) return el('span', 'url', url);
  } catch { return el('span', 'url', url); }
  const link = el('a', 'bookmark-url', url);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}
