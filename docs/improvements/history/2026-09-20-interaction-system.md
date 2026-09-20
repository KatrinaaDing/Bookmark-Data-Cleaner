# Interaction system implementation — 20 September 2026

**Scope:** the accepted [interaction plan](../plans/2026-09-20-interaction-consistency-plan.md) and [shared UI contract](../../ui-contract.md). Local branch: `codex/public-release-improvements`. No publication or personal-data cleanup was performed.

## Outcome

Both workspaces now share stable toolbars, explicit result selection and hidden-selection counts. Bookmark search supports title, URL and folder path without rebuilding the whole tree per keystroke. Details use truthful URL/domain labels, adjacent edit/copy actions and distinct duplicate/affected-page wording.

Edit/copy use one form session, pending-action protection, bottom confirm/cancel controls and save/discard/stay exits. Save-before-navigation resolves refreshed DOM owners; optional enrichment cannot discard an active draft. Failed writes preserve entered values. Successful writes followed by failed refresh retry reconciliation rather than creating a second bookmark.

Cleanup has labelled steps, target websites, one bookmark deletion section, default-selected eligible duplicate choices, persistent deselections and local retained-copy warnings. Technical scope remains available. Back no longer revives an old spinner; failed re-preparation cannot authorize an older plan. Managed duplicates stay unavailable and site-data-only cleanup still keeps bookmarks.

Shared toasts follow the active native modal, show the newest outcome first and preserve detailed errors/results. Info controls use hover/focus/tap popovers. Forms, disclosures, details and review transitions use shared motion/cancellation with reduced-motion alternatives. Superseded disclosure/editor styles were removed.

## Focused commits

| Commit | Intent |
|---|---|
| `b74f668` | Commit the agreed UI contract and implementation plan |
| `8343783` | Establish reusable controls, async/form lifecycles, motion and feedback |
| `2e6db0a` | Unify bookmark forms and guard unsaved navigation |
| `3afb75b` | Invalidate stale cleanup reviews and clear completed loading state |
| `49a4054` | Share workspace controls and add bookmark search |
| `903b0e5` | Clarify review and preserve duplicate deletion decisions |
| `842a590` | Guard cleanup entry and verify shared form recovery |
| `25b01dc` | Consolidate motion/feedback behavior and remove old styling paths |
| `4299717` | Preserve UI ownership across async workspace transitions |
| `f925a70` | Keep target websites and retained-bookmark effects visible in review |
| `a0c84b9` | Extend the synthetic large-library diagnostic to search |
| `6b0b1c3` | Preserve button dimensions while the shared loading spinner is visible |
| `7444047` | Verify closed bookmark forms cannot submit again |

## Verification

- `npm run typecheck`, `npm run build` and all **42 unit tests** passed.
- All **13 browser suites** passed using disposable Edge **153.0.0.0** profiles. These include actual bookmark deletion/retention, all 26 cookie identity/refusal cases, selected-origin storage cleanup, selection/search, modal behavior, form recovery and motion.
- Targeted suites were rerun after follow-up corrections: cleanup review, shared UI/form contract and UI refinement. They verify that saving before switching uses the new row/panel, successful-create refresh failures do not replay create, closed sessions cannot re-submit, latest errors remain visible, and help/reduced-motion behavior remains usable.
- New tests wait for the relevant active/form-removal state instead of assuming animation completion from a short fixed delay. Earlier failures exposed obsolete hidden-form expectations and timing assumptions; no failed assertion was treated as a pass.
- Actual duplicate cleanup removed the original and checked duplicate, retained an explicitly unchecked duplicate, and preserved unrelated bookmarks and the duplicate's parent folder. Existing failed-data cleanup tests continue to retain dependent bookmarks.
- Desktop/narrow visual inspection covered workspaces, URL/details hierarchy, forms, toasts, choices and duplicate review. Captures use synthetic content in ignored `dist/` directories. No remote website previews or personal data appear in the evidence.
- One Impeccable detector pass over components/pages/styles/app returned `[]`. This is a mechanical result, not a claim of complete accessibility compliance.
- `git diff --check` passed; local documentation links were checked.

### Large-library diagnostic

On the tested machine, a disposable extension page with immediate synthetic API reads for **5,000 bookmarks and 5,000 cookies** measured:

| Operation | Observed duration |
|---|---:|
| Load/inventory/DOM construction | 50.4 ms |
| Single title match | 10.7 ms |
| Single URL match | 1.9 ms |
| Folder query matching all 5,000 | 171.7 ms |
| No matches | 10.2 ms |
| Clear search and restore tree | 92.5 ms |

These are single diagnostic observations, not performance guarantees. The broad query still creates 5,000 result rows; there is no new virtualization or worker complexity. Search results, inspected identity and settled overflow checks passed. Real-profile I/O and lower-powered devices were not measured.

## Remaining boundaries

This tranche does not close the existing minimum/current Chrome, enterprise-policy, real permission-prompt, browser shutdown/restart or experimental cookie-configuration release gates. Full browser zoom and assistive-technology assessment remain manual checks; automated focus/reduced-motion coverage is not exhaustive accessibility certification. Browser-native unload prompts remain subject to browser rules and cannot offer the custom asynchronous save flow used for internal navigation.

No new runtime dependencies, framework, remote assets or destructive replay behavior were introduced. Store publication, listing changes and unrelated roadmap features remain outside this implementation.
