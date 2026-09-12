# Bookmark Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make bookmark details, single-item cleanup and management understandable, responsive and consistent with reviewed cleanup effects.

**Architecture:** Keep browser operations, pure inventory/impact helpers, and UI components separate. Add bookmark metadata and pure relationship analysis first; then consume those APIs in the existing workspaces and shared details/cleanup components. Use native controls and a responsive native dialog, retaining the coordinated cleanup engine.

**Tech Stack:** TypeScript/native ES modules, Chrome extension APIs (Chrome 130+), native HTML/CSS, Node test runner, existing disposable-browser CDP harness.

**Spec:** `docs/superpowers/specs/2026-09-12-bookmark-details.md`

## Global Constraints

- Keep the local, dependency-free TypeScript extension, existing name/icon and blue/white styling.
- Keep the unchecked-checkbox appearance unchanged.
- Deletion requires final review; preserve data-before-bookmarks execution and interruption handling.
- Never modify real browser profiles or publish to the store.
- Use fresh disposable Edge profiles for browser tests (`CHROME_BIN=/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`).
- No automatic duplicate selection or deletion; complete URL equality defines duplicate pages.
- Work in `/tmp/bookmark-detail-management-20260912` on the isolated feature branch.

## Task 1: Indexed inventory, bookmark management, and impact analysis

**Files:** Modify `extension/core/types.ts`, `extension/core/inventory.ts`, `extension/browser/bookmarks.ts`, `extension/browser/site-data.ts` (read/scan paths only), and `extension/helpers/sites.ts` if parsing needs a focused helper. Create `extension/core/impact.ts`. Modify/add `tests/inventory.test.ts`, `tests/impact.test.ts`, and a focused browser bookmark mutation script if needed.

**Interfaces:**
- Extend `BookmarkRef` with optional `parentId`, `index`, `dateAdded`, `dateLastUsed`, `unmodifiable`. Existing fixtures remain valid.
- Add `BookmarkFolder { id: string; title: string; path: string; unmodifiable?: boolean }`; `readBookmarks()` also returns `folders: BookmarkFolder[]`. Folder paths are human-readable breadcrumbs; managed ancestors propagate protection.
- `saveBookmark(title: string, url: string, parentId?: string): Promise<chrome.bookmarks.BookmarkTreeNode>` retains old callers and permits explicit destination.
- `updateBookmark(id: string, changes: {title: string; url: string; parentId: string}): Promise<chrome.bookmarks.BookmarkTreeNode>` validates web URLs and writable destination/source before editing/moving; rejected operations do not silently report success. Preserve existing bookmark ID.
- Optional `SiteRecord.cookiesAvailable?: boolean`: explicitly false for unread cookie inventories; scans set true after a successful read. Old call sites without the property remain supported.
- `scanSites(onBasic?: (result: ScanResult) => void): Promise<ScanResult>` can emit cookie/bookmark inventory before optional history reads finish, then returns enriched inventory. Preserve existing no-argument callers and warning behavior.
- Export `analyzeImpact(targets: SiteRecord[], allBookmarks: BookmarkRef[], detectedSites: SiteRecord[] = [], options?: CleanupOptions): {duplicates: BookmarkRef[]; relatedBookmarks: BookmarkRef[]; relatedSites: SiteRecord[]}`. Undefined options means preview all data categories; explicit options governs actual review. Exclude selected bookmark IDs and selected site IDs. Duplicates always describe unselected complete-URL copies of selected bookmarks. Related lists describe nonduplicate entries sharing selected origin scope or selected cookie domain/partition scope. No website effects when all data categories are off.

- [ ] Write meaningful failing tests: same-URL copies distinct from different paths/query strings; unselected duplicate with correct folder; different-page bookmark same origin affected by storage; unrelated/lookalike host unaffected; parent-domain cookie and partition effects; bookmark-only returns no related-data warnings; history repeated hosts latest-date and known-port origins preserved.

```ts
const targets = [{id:'example.test',host:'example.test',origins:['https://example.test'],urls:['https://example.test/a'],cookies:[],bookmarks:[{id:'a',title:'A',url:'https://example.test/a',path:'Work'}]}];
const all = [...targets[0].bookmarks,{id:'b',title:'Copy',url:'https://example.test/a',path:'Reading'},{id:'c',title:'Account',url:'https://example.test/account',path:'Personal'},{id:'d',title:'Other',url:'https://notexample.test/a',path:'Elsewhere'}];
// Expected duplicates ['b']; related bookmarks ['c'] for saved data; neither related collection for bookmark-only.
```

- [ ] Run the focused compiled tests and record the expected pre-implementation failure. Implement indexed inventory without looping over all history for each site. Accumulate latest dates and required origins; keep bookmarked URLs, avoid copying full history URL lists into every SiteRecord.
- [ ] Implement browser metadata/destination helpers and impact calculation using the exact contracts above. Avoid new dependencies. Validate writable folders including managed ancestry.
- [ ] Run typecheck/unit tests; measure synthetic 1,000-site/10,000-history/2,000-bookmark inventory after warmup and report elapsed time (diagnostic, not a flaky timing assertion). Browser-test create/update/move on disposable data if implementing mutation helpers.
- [ ] Self-review and commit Task 1 only. Write report with RED/GREEN evidence, interfaces and results.

## Task 2: Detail cards, responsive dialog, reviewed single cleanup and duplicate choices

**Files:** Modify `extension/components/site-details.ts`, `extension/components/details-drawer.ts`, `extension/components/cleanup-dialog.ts`, `extension/pages/bookmarks.ts`, `extension/pages/sites.ts`, `extension/styles/drawer.css`, and minimal `extension/styles/app.css`/`tokens.css` additions. May create focused `extension/components/bookmark-editor.ts`, `extension/components/affected-bookmarks.ts`, and `extension/browser/details.ts` to keep responsibilities small. Update `scripts/ui-smoke.mjs`, `scripts/ui-refinement-smoke.mjs`, `scripts/browser-tests.mjs`; add `scripts/bookmark-management-smoke.mjs` for new behavioral coverage. Update `DESIGN.md`, `docs/architecture.md`, `docs/development.md` after verification.

**Interfaces:** Consume Task 1 metadata, mutation, scan and impact APIs. Site details may gain an explicit context/options object containing the inspected bookmark, all bookmarks/folders/detected sites, on-cleanup and on-mutation callbacks; update all callers. Shared drawer must expose whether a particular inspected key is still open so asynchronous refreshes cannot revive dismissed/replaced content. Cleanup preparation should accept optional extra bookmark IDs for explicit duplicate inclusion, using a fresh plan and the same immutable options at every preparation. It must not read global batch selections for a single-item cleanup.

- [ ] Add browser regression coverage before UI edits for: the three meaningful sections; visible folder and mutation success destination; edit/move preserves ID/count; direct cleanup preserves other batch selections; duplicate extras unchecked by default and only included after user selection; different-page warnings; no data warning for bookmark-only; disabled preparation controls and coherent plan; no-permission Not checked; refreshed/removed inspected record; sticky panel when clicking a lower row; narrow native modal and focus return; resize between modes and cleanup above modal.

```js
// Seed two same-URL bookmarks in distinct folders, one different-page bookmark on that site,
// and an unrelated bookmark. Inspect the first, edit its title/folder, then assert its ID still
// exists, count is unchanged, and the actual parentId equals the chosen folder.
// Start direct cleanup while the unrelated row is batch-selected. Confirm only the inspected
// target is in review; opt into the duplicate explicitly and assert the unrelated ID remains.
```

- [ ] Run new focused browser coverage against the old UI and record expected failure. Implement three cards using existing typography and quiet tints. Keep folder paths and affected-entry names visible; use native expansion for lengthy lists/addresses. Omit technical storage scope and general history URL list from ordinary details. Initial edit fields are disclosed; explicit Create copy stays separate.
- [ ] Make desktop detail sticky and viewport-constrained; use native modal at <=760px. Handle open/update/close/resize generations, Escape, dialog stacking, reduced motion and focus return after list refresh. Do not treat the user's approved modal/tall-panel scrolling as a regression against the former single-scroll test.
- [ ] Integrate single-item actions, browser mutation callbacks, and record reconciliation. Basic site inventory appears before optional date enrichment; keep date ordering explicitly loading until complete and ignore stale loads. Avoid gathering all cookie/history data anew for every detail click when valid workspace context is available; refresh selected cleanup targets at review.
- [ ] Freeze options during prepare; Back returns to existing choices. Duplicate additions remain unchecked until selected and rebuild the reviewed snapshot with fresh reads, no accidental extra folder removal. Display category-appropriate related-bookmark/site effects and actual selected bookmark paths. Native final confirmation is always necessary.
- [ ] Run typecheck, unit tests, build, and complete browser suite. Replace obsolete UI assertions only where the approved design intentionally changed them; preserve regressions for motion, scope, focus, routes and offline behavior. Capture and inspect desktop, scrolled desktop, and narrow modal together; fix observed issues in one batch and confirm once. Run Impeccable detector once after edits.
- [ ] Update design/development/architecture documentation to reflect actual behavior. Self-review, commit, and report exact test evidence and any unresolved constraints.
