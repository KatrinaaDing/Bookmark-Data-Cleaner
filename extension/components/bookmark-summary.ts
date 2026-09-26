import type { BookmarkRef } from '../core/types.js';
import { el } from './dom.js';
export function bookmarkSummary(bookmark: BookmarkRef, includeUrl = false, linkedTitle = false): HTMLElement {
  const summary = el('span', 'bookmark-summary');
  const title = linkedTitle ? bookmarkLink(bookmark.url, bookmark.title || 'Untitled') : el('span', '', bookmark.title || 'Untitled');
  title.classList.add('affected-title');
  summary.append(title, el('span', 'fine', bookmark.path || 'Bookmarks'));
  if (includeUrl) summary.append(el('span', 'fine bookmark-address-text', bookmark.url));
  return summary;
}
export function bookmarkLink(url: string, label = url): HTMLElement {
  try {
    if (!['http:', 'https:'].includes(new URL(url).protocol)) return el('span', 'bookmark-address-text', label);
  } catch { return el('span', 'bookmark-address-text', label); }
  const link = el('a', 'bookmark-url', label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}
