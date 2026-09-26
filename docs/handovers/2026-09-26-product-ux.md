# Product UX handover — 26 September 2026

## Resume here

Continue refining **details and cleanup review**, the area the user identified as least finished. The user explicitly rejected moving to release preparation: “it's not yet ready for release. let's continue refining the product, and UX/UI.” Passing checks does not establish usability or release readiness.

The latest refinement is implemented and committed. There is no unfinished implementation or known failing check from this pass. Start by inspecting the current UI and latest records; do not assume historical findings remain open. Identify the next concrete UX issue before adding more controls or explanations.

Suggested new-session prompt:

> Read docs/handovers/2026-09-26-product-ux.md, inspect the current implementation and actual UI, and continue refining details and cleanup review. Preserve cleanup semantics and existing safety guarantees. Implement applicable improvements and verify proportionately; do not move into release preparation.

## Checkout and source of truth

- Repository: `/Users/katrinading/Code/projects/Bookmark-Data-Cleaner`
- Branch: `codex/public-release-improvements`
- Implementation/documentation HEAD before this handover: `0f5f5d0`
- Working tree was clean before adding these notes. No push or publication was performed.
- Start with [PRODUCT.md](../../PRODUCT.md), [DESIGN.md](../../DESIGN.md), the [UI contract](../ui-contract.md), [architecture](../architecture.md), and [development checks](../development.md).
- Latest record: [details and cleanup review](../improvements/history/2026-09-26-details-review-ux.md).
- Earlier passes: [cleanup scope/details audit](../improvements/history/2026-09-26-cleanup-ux.md) and [discovery/results refinement](../improvements/history/2026-09-26-discovery-results-ux.md).
- Original context: [rebranding plan](../improvements/history/2026-09-06-rebranding-plan.md) and [interaction system](../improvements/history/2026-09-20-interaction-system.md). Current code and living contracts supersede older layout descriptions and unchecked historical tasks.

## What is already implemented

### Independent selection and inspection

- Row titles inspect without selecting; checkboxes select without switching details.
- Toolbar **Clean up selected…** remains in a stable position, shows selection counts including hidden selections, and is disabled at zero.
- Details **Clean up this bookmark…** / **Clean up this site…** starts from the inspected item. With A/B selected and C inspected, initial entry scope is C; opening/cancelling preserves A/B and C.
- Prepared website-data scope can extend beyond the initiating URL. Eligible exact-URL copies can also be included by review choices. These are disclosed separately.
- Restoring the cached bookmark tree synchronizes inspection highlighting with the current inspected ID.

### Details: latest layout

- Bookmark details have lightly divided **Bookmark** and **Website data** sections. Identity groups title, full-width URL, saved folder, edit/copy controls and optional Visit history disclosure.
- Existing edit/copy/save forms retain draft protection, pending-write handling and reconciliation.
- Website data shows available cookie count, visible shared-data consequences and scoped cleanup action. Unknown counts remain distinct from zero.
- Long related-page lists are counted disclosures. Exact-URL copies have a separate supporting disclosure after Website data.
- Site details retain saved-page controls; lists longer than three entries collapse, and sites without saved bookmarks offer Save bookmark.
- Existing desktop details panel and narrow native modal remain, without extra nested scrolling.

### Two-step cleanup review

- Both steps carry single-item identity/full URL or correctly typed bulk counts.
- Step 1 separates bookmark removal from website-data categories; technical explanations are disclosed.
- Step 2 distinguishes website data, individual bookmarks to delete with folder context, and retained bookmarks potentially affected by shared data.
- Initial bookmarks are represented among retained affected entries when bookmark removal is off. Explicitly unchecked copies remain represented when applicable.
- Full URLs identify bookmark entries and duplicate choices. Exact origins, cookie domains/partitions and discovery limits stay in Technical details.
- One scrolling content body sits above a separate action footer. Back/Next/Cancel/Confirm remain visible; irreversible warning stays beside red final confirmation.
- Duplicate changes immediately invalidate confirmation and prepare a fresh immutable plan. Rebuilds preserve disclosure state, reading position and checkbox focus.
- Underlying details modal transitions are deferred while cleanup or unsaved-change review is open, preventing resize from stealing focus or covering review. The deferred layout settles when the overlay closes.

### Adjacent product improvements already completed

- Sites has a native All sites / Bookmarked / Not bookmarked filter, matching/detected counts and Reset filters. Reset preserves selection, inspection and sort; hidden selection still counts toward bulk cleanup.
- Results use precise units and compact completed-operation disclosures. Failures, known-kept bookmarks and unverified outcomes remain distinguishable.
- Additive outcome `label` and `retained` metadata describe actual results. `retained` is set only when bookmark deletion was skipped after required data cleanup failed. Legacy records without that evidence remain uncertain.
- No duplicate cleanup-start toast; the operation panel supplies progress. Result dismissal restores workspace focus.

## Preserve these boundaries

- Keep Homepage / Bookmarks / Sites, public name/icon, blue/white identity, native controls, TypeScript/native modules and current runtime dependency footprint.
- No task selector, navigation redesign, domain merging, runtime screenshot or live-preview feature.
- Shared presentation/lifecycle helpers must not decide deletion scope or authorization. Core preparation remains authoritative; domain/subdomain resemblance alone is insufficient.
- Final confirmation executes only the current reviewed immutable snapshot. Preserve managed-entry protection, explicit duplicate deselections, interruption handling, dependent-bookmark retention, and failed/unverified result handling.
- Reconcile lists, selection and inspection against actual results. Never equate attempted work with successful deletion or automatically replay writes after a refresh failure.
- Preserve native modal behavior, keyboard focus, reduced motion and form guards. Reuse shared tokens/components.
- Use synthetic data and disposable browser profiles for deletion tests; never the user's normal profile.
- Keep commits focused on one intent. Do not add tests that only mirror reversible cosmetic edits.

## Outstanding product decisions

No deletion/default policy was changed in these passes. Decide these explicitly in a separate product discussion before implementing changes:

1. **Category defaults:** available cleanup categories currently begin checked, including bookmark removal from Bookmarks. Unavailable cookies remain unchecked/disabled.
2. **Additional exact-URL copies:** eligible copies currently begin checked during review; explicit deselections persist and managed entries remain unavailable.

Further UX work should assess whether users can identify the item, distinguish saved-bookmark deletion from shared website-data effects, and predict the final action without reading technical details. This is an investigation direction, not a preapproved redesign or evidence that another feature is missing. The user has not yet evaluated the latest pass in a fresh session.

## Code and test map

| Area | Main files |
|---|---|
| Details content and shared bookmark summaries | `extension/components/site-details.ts` |
| Details presentation, focus and responsive transition | `extension/components/details-drawer.ts` |
| Review rendering and current-plan confirmation | `extension/components/cleanup-dialog.ts` |
| Workspace entry points and filtering | `extension/pages/bookmarks.ts`, `extension/pages/sites.ts` |
| Outcome evidence and presentation | `extension/core/types.ts`, `extension/core/cleanup.ts`, `extension/components/operation-status.ts` |
| Entry scope, disclosures, resize/focus and synthetic deletion | `scripts/cleanup-ux-smoke.mjs` |
| Back/Next, defaults, stale preparation and confirmation | `scripts/cleanup-review-smoke.mjs` |
| Forms, mutations and shared interaction contracts | `scripts/bookmark-management-smoke.mjs`, `scripts/ui-refinement-smoke.mjs`, `scripts/ui-contract-smoke.mjs` |
| Filters and outcome rendering | `scripts/site-discovery-smoke.mjs`, `scripts/results-smoke.mjs` |

## Verification and limits

Latest pass passed typecheck, build, **42 unit tests**, `git diff --check`, and five focused disposable Edge suites: **cleanup-ux, cleanup-review, bookmark-management, ui-refinement, ui-contract**. Cleanup-ux and cleanup-review were rerun after the final narrow-spacing and initial-heading-focus correction.

Coverage includes A/B selection versus C inspection, cancel, toolbar scope, hidden selections, duplicate choices/retention, full URLs, Back/Next, scope invalidation, immutable confirmation, actual synthetic deletion/reconciliation, fixed footer, desktop/narrow layouts, resize focus, keyboard disclosures, draft guards and reduced motion.

The preceding discovery/results pass passed **site-discovery, results, cleanup-ux, ui, cleanup-review** plus typecheck/build and 42 unit tests. The browser runner now contains **16 suites**; the entire current runner was **not** rerun after the latest changes. Earlier cookie/storage checks are historical evidence, not fresh full-suite coverage. Exhaustive assistive-technology, browser compatibility and real-world usability checks remain outside these scoped passes.

Commands (Node 24+):

```sh
npm run typecheck
npm run build
npm test
CHROME_BIN='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' node scripts/cleanup-ux-smoke.mjs
CHROME_BIN='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' node scripts/cleanup-review-smoke.mjs
# Broaden when required by the change or an unresolved concern:
CHROME_BIN='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' npm run test:browser
git diff --check
```

The harness creates/removes disposable profiles. Edge launch required execution outside the sandbox in this environment; sandboxed launch timed out. Git writes also required escalation because `.git` was read-only. Prior requests were approved by automatic review.

### Local synthetic screenshots

Generated captures are ignored build artifacts, available in this checkout rather than committed evidence:

- `dist/cleanup-ux/before/`: original bookmark details, narrow details, choices and review.
- `dist/cleanup-ux/after/`: current `bookmark-details.png`, `bookmark-details-narrow.png`, `choices.png`, `choices-narrow.png`, `review.png`, `review-narrow.png`, `data-only-review.png`, and site-details variants.
- `dist/product-ux/before/` and `dist/product-ux/after/`: discovery and completed/incomplete results captures.

Later smoke runs can overwrite captures. Inspect current screenshots/code together; earlier records may describe an intermediate layout.

## Focused commit history

| Commits | Intent |
|---|---|
| `419daad`, `2ba4636`, `5e27120` | Initial details density, explicit cleanup scope/retained effects, audit record |
| `e1e6da0`, `08a1fed`, `7c72586`, `e0d32d4` | Outcome retention evidence, site filtering, compact results, record |
| `2410140`, `c727ffb`, `0f5f5d0` | Grouped identity/actions, stable review controls/reading/focus, latest record |
