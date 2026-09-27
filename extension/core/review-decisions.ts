import type { CleanupImpact } from "./impact.js";
import type { BookmarkRef } from "./types.js";

/**
 * Which additional bookmarks (exact-URL copies and related pages) a review deletes.
 * Copies are selected by default; explicit choices persist while a bookmark stays a
 * candidate. Managed bookmarks can never be selected.
 */
export class ExtraBookmarkDecisions {
  readonly duplicates = new Map<string, BookmarkRef>();
  readonly related = new Map<string, BookmarkRef>();
  /** IDs to delete in addition to the reviewed targets. */
  readonly selected = new Set<string>();
  private readonly choices = new Map<string, boolean>();

  /** The IDs to request from a preparation; none when bookmarks are kept. */
  requested(deletingBookmarks: boolean): Set<string> {
    return new Set(deletingBookmarks ? this.selected : []);
  }

  /** Replace candidates with a fresh preparation's impact and recompute the selection. */
  reconcile(impact: CleanupImpact | undefined, deletingBookmarks: boolean): void {
    this.duplicates.clear();
    for (const duplicate of impact?.duplicates ?? []) {
      this.duplicates.set(duplicate.id, duplicate);
      if (deletingBookmarks && !this.choices.has(duplicate.id))
        this.choices.set(duplicate.id, !duplicate.unmodifiable);
    }
    this.related.clear();
    for (const bookmark of impact?.relatedBookmarks ?? [])
      this.related.set(bookmark.id, bookmark);
    for (const id of this.choices.keys())
      if (!this.isCandidate(id)) this.choices.delete(id);
    this.selected.clear();
    if (!deletingBookmarks) return;
    for (const bookmark of [...this.duplicates.values(), ...this.related.values()])
      if (!bookmark.unmodifiable && this.choices.get(bookmark.id)) this.selected.add(bookmark.id);
  }

  choose(id: string, selected: boolean): void {
    this.choices.set(id, selected);
    if (selected) this.selected.add(id);
    else this.selected.delete(id);
  }

  isCandidate(id: string): boolean {
    return this.duplicates.has(id) || this.related.has(id);
  }

  /** Whether the current selection is exactly what a preparation was asked for. */
  matches(requested: ReadonlySet<string>): boolean {
    return requested.size === this.selected.size && [...requested].every((id) => this.selected.has(id));
  }
}
