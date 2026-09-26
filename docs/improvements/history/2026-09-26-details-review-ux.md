# Details and cleanup review — 26 September 2026

The user selected details and cleanup review as the least-finished area. This pass follows that direction while preserving the current category/duplicate defaults, plan preparation and deletion behavior.

## Changes

- Bookmark identity now groups the full-width URL, saved folder, edit/copy actions and optional history. The redundant separate Bookmark card is removed; exact-URL copies remain in their own supporting disclosure after Website data. Site details retain their saved-page controls.
- Full URLs accompany deletion entries, additional duplicate choices and affected bookmarks. They are plain text in review, so identifying an entry does not require visiting its website.
- The cleanup dialog has one scrolling content region and a separate action footer. Next/Back/Cancel/Confirm remain visible with long lists; the irreversible warning remains beside final confirmation. Existing native controls and red final action are retained.
- Duplicate changes still invalidate confirmation immediately and prepare a fresh immutable plan. Successful rebuilds now preserve technical/retained-list disclosures, scroll position and focused duplicate checkbox.
- Responsive mode changes in the underlying details panel are deferred while cleanup or unsaved-change confirmation is open. The deferred layout settles after the overlay closes, preventing the lower dialog from taking focus or appearing above review.

## Verification

Typecheck/build, **42 unit tests**, and five focused disposable Edge browser suites passed: cleanup-ux, cleanup-review, bookmark-management, ui-refinement and ui-contract. The review suites were rerun after the final narrow-spacing and initial-focus correction.

New assertions cover always-visible footer controls, one scroll region, full URL identification, retained disclosure/scroll/checkbox focus during duplicate rebuilds, and review focus while resizing between desktop and narrow layouts. Existing checks cover A/B selection with C inspection, cancellation, filtering, current-plan confirmation, managed entries, duplicate decisions, actual synthetic deletion, form guards, reduced motion and focus return.

The first resize assertion exposed focus moving away from the review heading when the underlying details dialog changed mode. The deferred transition fixes that path. Visual inspection then found a narrow-screen padding override applying padding to both the dialog and its new content region; moving padding ownership to the content/footer corrected it.

Synthetic captures are in `dist/cleanup-ux/after/`, including `bookmark-details.png`, `bookmark-details-narrow.png`, `choices-narrow.png`, `review.png` and `review-narrow.png`. No personal data or runtime screenshot feature is involved. `git diff --check` passed. This scoped verification is not exhaustive assistive-technology or browser compatibility coverage.
