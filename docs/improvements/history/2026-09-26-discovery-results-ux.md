# Discovery and results refinement — 26 September 2026

The user redirected the next iteration toward further product and UX/UI refinement. This pass addresses two observed journey gaps, without treating test completion as release readiness.

## Audit and changes

**Finding cleanup candidates:** Sites previously offered only “Bookmarked only.” Users could not isolate sites without saved bookmarks. The existing native filter now offers All sites, Bookmarked and Not bookmarked. Matching/detected counts and Reset filters explain and recover filtered results. Reset preserves selection, inspection and sort order; hidden selections remain included in cleanup review. Date ordering and the separate unknown-history group are preserved.

**Understanding cleanup outcomes:** the previous panel mixed all outcome types into “completed,” combined known-kept bookmarks with uncertainty, and repeated progress in a start toast. Completion occupied about 225 pixels in the synthetic desktop capture. The new panel uses about 155 pixels, gives each count a unit, and keeps completed operations in a disclosure. Failed/uncertain/kept items appear first and expand after completion. Full messages remain available, and dismissal returns keyboard focus to the workspace container.

Additive outcome metadata provides a bookmark label and a `retained` flag only when deletion was skipped following data-cleanup failure. It does not change status enums, deletion targets, sequencing or authorization. Legacy results without explicit retention evidence stay uncertain. Labels remain in the existing local session result record; titles fall back to URLs for untitled bookmarks. No additional persistent storage, telemetry, runtime package or remote asset was introduced.

## Focused commits

- `e1e6da0`: record explicit retention/readable labels, with failure-sequencing assertions.
- `08a1fed`: native bookmark-status filter and selection/reset regression suite.
- `7c72586`: compact results, precise outcome units, legacy handling and presentation regressions.

## Verification

- Typecheck and build passed; all **42 unit tests** passed, including strengthened known-retention assertions.
- Five focused disposable Edge browser suites passed: **site-discovery**, **results**, **cleanup-ux**, **ui**, and **cleanup-review**. The two new suites are registered in the full browser runner. The entire runner was not repeated for this scoped pass.
- Discovery checks cover combined filters, hidden selections, filtered select/unselect, initial review scope, reset focus, navigation retention and desktop/narrow layout.
- Results checks cover mixed success/failure, known retention, legacy uncertainty, interruption with no recorded outcomes, empty-folder completion/running states, disclosure defaults and dismissal focus. Existing UI tests execute synthetic bookmark-only/site cleanup and preserve scope/review behavior.
- One desktop/narrow visual inspection confirmed the changes. Synthetic baseline/after captures are under `dist/product-ux/before/` and `dist/product-ux/after/`: `sites.png`, `completed.png`, `incomplete.png`, `incomplete-narrow.png`; after captures also include `unbookmarked.png` and `unbookmarked-narrow.png`.
- An initial capture expected exactly three detected sites, which was invalid when Edge supplied a background site. The fixture now waits for a known synthetic ID and applies `.test` search, without changing actual inventory behavior.
- `git diff --check` passed. No deletion tests used a personal browser profile.

Category defaults, default-selected exact-URL copies, and cookie/origin deletion scope remain unchanged. This is product refinement evidence, not a release-readiness conclusion or a substitute for user usability feedback.
