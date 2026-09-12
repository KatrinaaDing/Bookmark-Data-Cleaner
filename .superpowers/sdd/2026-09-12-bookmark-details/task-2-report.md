# Task 2 report: bookmark details, mutation and reviewed direct cleanup

## Status and implementation

Complete on `codex/bookmark-detail-management`.

- Replaced ordinary technical details with three softly tinted cards: Basic information, Bookmark and Website data. Bookmark titles are primary; folder paths, separate bookmark/website recency, truthful cookie availability, expandable addresses and an explicit Open page action are visible.
- Added disclosed edit/move and separate Create copy forms with required folder destinations. Existing edits use `updateBookmark`, preserve the ID, reconcile browser state after both success and failure, refresh the list, and invalidate the other mounted workspace.
- Added exact-copy and shared-data impact presentation. Direct cleanup uses the shared native review dialog without reading batch selection. Exact copies are unchecked additions, changing them prepares a fresh snapshot, and different pages remain contextual only.
- Cleanup options are frozen per preparation. Preparation controls and confirmation are disabled while scope is rebuilt; Back restores existing category choices. Bookmark-only review omits website-data warnings, while data-only review warns about exact copies that remain and related bookmarks/sites.
- Desktop details is a sticky, viewport-constrained modeless native dialog beside the interactive list. At 760px and below the same element becomes a native modal. Resize preserves the inspected key; Escape, cleanup stacking, reduced motion, refreshed-row focus return and late-request generations are retained.
- Site scan renders basic cookie/bookmark inventory before history enrichment and keeps date ordering disabled while dates load. Optional enrichment defers while edit/create disclosures are open, preserving drafts, then applies when they close. Explicit refresh and cleanup reconciliation still replace removed or changed records.

## TDD evidence

Initial focused RED against the old UI:

```text
AssertionError: Details expose the three approved sections
actual: []
expected: ['Basic information', 'Bookmark', 'Website data']
```

After implementation, `bookmark-management-smoke.mjs` passed browser-backed checks for:

- three cards, folder path and disclosed editor;
- preserved bookmark ID/count and actual destination after edit/move;
- refresh of a previously loaded Sites workspace;
- direct-cleanup isolation from an unrelated batch selection;
- unchecked exact-copy opt-in, disabled confirmation during re-preparation, and exclusion of a different page;
- deletion of only the reviewed bookmark/copy, retention of the unrelated bookmark, different-page bookmark and duplicate parent folder;
- sticky details for the final row of a 40-bookmark list;
- desktop to narrow-modal to desktop mode changes, cleanup above the narrow modal and focus return;
- `Not checked` when cookie permission is unavailable.

The first full browser run after implementation exposed an obsolete `ui-smoke` expectation (`design.test` versus the approved bookmark title `Design notes`). The old technical-disclosure/aside assertions in `ui-refinement-smoke` were replaced with the approved card, editor, modal and focus behavior. Other route, cleanup, motion and offline regressions were retained.

## Fresh verification

Final command:

```text
npm test && npm run typecheck && npm run build && \
CHROME_BIN='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' \
npm run test:browser && git diff --check
```

Results:

- Unit tests: 28 passed, 0 failed.
- Extension and worker TypeScript checks: passed.
- Production build: passed.
- Full browser runner: all eight scripts passed: permissions, cleanup, storage, UI, folder motion, bookmark mutation, bookmark management and UI refinement.
- `git diff --check`: passed.
- Impeccable detector, run once over changed UI sources: `[]` (no findings).

## Visual evidence

Disposable Edge captures:

- `dist/audit/details-desktop.png.png`
- `dist/audit/details-scrolled-desktop.png.png`
- `dist/audit/details-narrow-modal.png.png`

The controller inspected the set together and reported that the three quiet cards, readable Saved in path, visible scrolled detail and narrow modal/close control all passed without requested refinements.

## Concerns and limits

- `removeData`'s separately audited exact-cookie deletion issue remains outside Task 2 and was not changed or claimed fixed. Review copy therefore says cookies are selected for removal without promising exact successful removal.
- Live enterprise-managed bookmark mutation is not available in the disposable Edge profile; Task 1 covers managed ancestry at the browser API boundary.
- Browser automation uses current Microsoft Edge with disposable profiles; minimum-version Chrome and other operating systems remain release checks.
