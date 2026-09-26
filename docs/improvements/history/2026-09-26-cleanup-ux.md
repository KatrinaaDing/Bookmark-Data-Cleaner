# Cleanup scope and details refinement — 26 September 2026

## Audit before implementation

Read the UI contract, architecture, 6 September rebranding plan and 20 September interaction record. Inspected the actual extension with synthetic bookmarks/cookies in disposable Edge profiles before editing UI. The Impeccable assessment used separate source-review and detector agents; the primary agent inspected browser captures and implemented changes. Detector: zero findings. The requested outcomes were sufficiently specified; no further product questions were needed for this iteration.

| Assessment | Evidence and decision |
|---|---|
| Already implemented and clear — preserve | Row-title inspection and checkbox selection are separate. Direct cleanup captures its own ID; toolbar cleanup captures the selection. Hidden selections, stable toolbar actions, native narrow dialogs, form guards, unknown cookie state, blue review/red confirmation, immutable preparation and duplicate decisions already exist. |
| Implemented but unclear — refine | Both actions said “Clean up data”; neither review step carried entry context. Expanded duplicate/related lists buried cleanup. Bookmark consequences lived in optional help. Three tinted cards gave metadata too much weight. |
| Missing or incorrect — fix | Data-only bookmark review omitted its initial bookmarks from the retained effects list. Unchecked copies appeared only in the deletion checklist. Restoring a cached tree could revive an old inspection mark after inspecting a search result. |

## Implementation

- Scope labels distinguish `Clean up selected…` from `Clean up this bookmark…` / `Clean up this site…`. Zero selection remains visible beside the disabled toolbar action. Both review steps show the single item identity or bulk bookmark/folder/site counts.
- Details keep the URL visible, place cookie counts and shared-data/sign-out/offline-work consequences before cleanup, and disclose visit history, exact-URL copies and related-page lists. Site saved-page lists longer than three entries are disclosed with their complete edit/copy controls. Light section dividers replace nested colored cards; shared native controls, tokens and disclosure motion remain.
- Review separates website data, bookmark deletion and retained bookmarks potentially affected. Initial bookmarks retained by data-only cleanup and explicitly unchecked duplicates are included once by ID. A counted disclosure retains the full long list. Additional exact-URL deletion choices are explicitly counted outside the original selection. Empty data groups use a sentence instead of an empty section. Technical details retain origins, cookie identity/partition information and discovery limits.
- Preparation and execution semantics are unchanged. `contextualBookmarks` and entry labels are display context only; neither enters the cleanup plan. Confirmation still uses the current immutable snapshot, and any duplicate change immediately invalidates it. Browser reads reconcile actual remaining IDs after cleanup; failed/unverified outcomes are not treated as success.
- Reapplying inspection by stable key when restoring the list prevents stale highlighting without changing checkbox selection.

## Focused commits

- `419daad` — prioritize consequences and contextual actions in details, with layout assertions.
- `2ba4636` — expose entry scope and retained effects, preserve cached-list inspection, and add synthetic browser regressions.
- Documentation is committed separately from implementation.

## Verification

- `npm run typecheck`, `npm run build`, `npm test`: passed, **42 unit tests**.
- All **14 browser suites** passed on disposable **Edge 154.0.0.0** profiles across the full run and focused follow-ups. The full runner initially stopped at an obsolete expectation that the zero-selection count should be hidden; remaining suites passed after updating it. The layout assertion now permits forms to align with a section edge after removing card padding.
- New `cleanup-ux-smoke` checks A/B selected with C inspected in both workspaces, C-only initial scope, cancellation preservation, A/B bulk scope including hidden selection, current inspection after cached-tree restoration, retained/shared-data distinctions, native keyboard disclosures, complete saved-page editing, desktop/narrow layouts, duplicate deselection through Back/Next, and actual bookmark-only deletion reconciliation. Failed and unverified result fixtures retain their distinct reporting.
- Existing review tests verify permission loss, stale preparation failure, retry, immediate confirmation invalidation and safe heading focus. Management tests actually delete the reviewed originals/checked copies and retain unchecked/unrelated bookmarks. Cookie scope tests pass all **26** identity/refusal cases; storage tests preserve the control origin. Unit tests cover partial failure, dependent-bookmark retention and interrupted jobs without replay.
- Initial baseline `ui-refinement` stopped at an Escape assertion; the separate baseline capture succeeded. The final refinement suite passed, including Escape, focus, reduced motion and long forms. No claim is made that the baseline failure was an application defect.
- `git diff --check`: passed. No runtime dependency, framework, live preview or screenshot feature was added.

Synthetic captures (ignored generated artifacts):

| Surface | Before | After |
|---|---|---|
| Bookmark details | `dist/cleanup-ux/before/bookmark-details.png` | `dist/cleanup-ux/after/bookmark-details.png` |
| Narrow details | `dist/cleanup-ux/before/bookmark-details-narrow.png` | `dist/cleanup-ux/after/bookmark-details-narrow.png` |
| Choose categories | `dist/cleanup-ux/before/choices.png` | `dist/cleanup-ux/after/choices.png` |
| Combined review | `dist/cleanup-ux/before/review.png` | `dist/cleanup-ux/after/review.png` |

Additional after captures cover data-only review and collapsed/expanded site details. Browser tests create and remove their own profiles; deletion targets only synthetic fixtures.

## Separate product decisions — unchanged

1. **Category defaults:** all available categories start checked, including bookmark removal in the Bookmarks workflow; unavailable cookie access stays unchecked/disabled. Changing these defaults requires a separate product decision.
2. **Exact-URL copy defaults:** eligible additional copies start checked in review; explicit deselections persist and managed entries remain protected. Whether copies should instead start unchecked is a separate authorization-policy decision.
3. **Website-data scope:** a single bookmark is an entry point, not a URL-only deletion boundary. Existing cookie identity/domain/partition and origin preparation remain authoritative. No domain merging, subdomain-based inference or scope expansion was introduced.

Minimum/current Chrome compatibility, enterprise-managed browser policy, real permission prompts, full shutdown/restart timing, zoom and assistive-technology checks remain manual release gates. Synthetic Edge coverage does not close them.
