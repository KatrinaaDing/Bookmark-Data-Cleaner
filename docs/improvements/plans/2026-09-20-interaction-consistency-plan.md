# Interaction consistency and cleanup clarity — 20 September 2026

**Status:** planned; implementation has not started. The user accepted the proposed fixes and requested appropriate animation for UI changes, then requested this implementation plan.

**Outcome:** both workspaces use predictable controls; bookmark forms share one lifecycle; cleanup review clearly separates data removal, bookmark deletion and effects on retained pages. Motion communicates changes without delaying tasks.

**Foundation first:** following the user's request for a unified UI system, the [shared UI contract](../../ui-contract.md) now defines reusable controls, state ownership, async/form/overlay lifecycles and extraction boundaries. Establish and exercise these foundations before rolling the changes through both workspaces. This remains a plan, not a claim that the shared system is implemented.

**Relationship to existing work:** this is the next focused tranche of the [public-release plan](2026-09-19-public-release-plan.md), covering parts of R04, R06, R09, R10, R13 and R14. It does not complete unrelated release or compatibility gates. The accepted default-selected duplicate behavior explicitly supersedes the older duplicate opt-in requirement for bookmark cleanup. Update DESIGN.md to describe implemented behavior only after verification.

## Agreed behavior

### Workspaces and selection

- Use the same toolbar structure in Bookmarks and Site data: Refresh first on the left, then search and applicable filters; selection summary, Clear selection and Clean up data on the right. Reserve the action group's position even at zero selected. On narrow screens use a consistent second row with cleanup aligned right.
- Show Clean up data disabled at zero selection or while its prerequisite operation is busy. Never use a disappearing selection count as the layout spacer.
- Give both titles a short description. Remove About this list as a disclosure; place extended discovery guidance in an accessible info popover. Keep discovery limitations visible in relevant first-use and empty states.
- Replace Select visible with a list-header checkbox: Select all when unfiltered, Select all results when filtered. It selects all eligible results, including those below the viewport; it does not select only the current screen.
- The header checkbox has checked/mixed/unchecked states. Unchecking it clears the current result set only. Clear selection clears all selected IDs, including hidden and empty-folder selections.
- Add case-insensitive bookmark search across title, full URL and folder path. Show flat bookmark results with title and folder path; clearing search restores the normal tree and its expansion state. An empty query uses the tree; a query with no matches has a useful empty state.
- Preserve selection and inspection independently. Show total selected and how many are outside the current results in both workspaces. Folder selection during normal browsing retains its current descendant semantics; flat search has no ambiguous folder-wide selection.
- Preserve managed-bookmark restrictions. In the unfiltered tree, select-all operates on the same eligible IDs as tree selection, including eligible empty folders; do not change this into implicit removal of unrelated folders. Search selects matching bookmarks only.

### Details and bookmark forms

- Basic information for an inspected bookmark shows its full saved Bookmark URL as a wrapping link opening a new tab. Remove the redundant Open page link. Only HTTP/HTTPS addresses become launch links; unsupported bookmark URLs remain readable text.
- Site-level details retain an accurately labelled Domain, without presenting one arbitrary saved page as the website's definitive URL. Each saved bookmark exposes its own full URL in its details/form context.
- Use adjacent pencil and copy icon buttons with accessible names and tooltips. Each saved bookmark in Site data gets its own Edit and Create bookmark copy actions. An unbookmarked site retains an understandable Save bookmark action.
- Copy opens a form prefilled from the specific bookmark, including a sensible writable folder. It never means clipboard paste. One active form per details panel keeps editing context clear.
- Both edit and copy use the same reusable form lifecycle and bottom-aligned actions: green-tinted check to submit; red-tinted cross to cancel. Include icon names for assistive technology and sufficient contrast/target size; color alone never carries meaning.
- Edit submit stays unavailable without a change; a valid prefilled copy may be submitted immediately. Check validity before starting a mutation.
- Check submits directly. Cancelling, collapsing, switching form/item, closing details, changing tabs or refreshing with a dirty form asks Save changes / Discard / Keep editing. A clean form closes directly. An unsaved create form counts as dirty once its initial values have changed.
- Centralize the leave guard: Save must succeed before the requested navigation continues; Discard resets and continues; Keep editing cancels the navigation and restores focus. Intercept route changes before destroying the current draft. Use the browser's native unload protection where supported for closing/reloading the extension tab; do not promise custom button labels for native browser prompts.
- During save/create, freeze fields and form actions, prevent duplicate submission and show a spinner in the submit control. Prevent switching away while a write is unresolved.
- On success, reconcile actual browser state, close/reset the form, restore logical focus and show a toast. Optional enrichment must not overwrite drafts or reopen a closed form.
- On failure, preserve the form and values with an inline error and failure toast. Distinguish mutation failure, partial mutation and successful mutation with failed refresh. Reconcile partial edits without silently discarding the user's intended values; never retry a successful create merely because rendering/refresh failed.
- Clear form state only on successful completion or accepted discard; collapse animation must not become a separate hidden-draft cache.

### Shared feedback and help

- Add a reusable toast service for user-triggered success/failure outcomes: bookmark mutations, refresh completion/errors, permission outcomes, cleanup startup and completion/status failures.
- Keep loading indicators near the active action; avoid success toasts for background initial loads and repeated job polling. Announce a job outcome once per transition, not on every progress update.
- Success toasts auto-dismiss after a readable interval, pausing on hover/focus. Errors remain until dismissed. Toasts do not steal focus, obscure actions or disappear behind native dialogs; host them in the active modal layer when necessary and preserve announcements when that modal closes.
- Retain field validation next to its field and the persistent cleanup result panel with details/retry guidance. A completed API request must not become a claim that every browser trace was removed. Partial or unverified cleanup never receives a generic success message.
- Info controls open small anchored popovers on hover or keyboard focus, with touch/tap support and Escape dismissal. They do not expand page content. Keep pointer access to the popover, avoid clipping and remove stale popovers when owners unmount.
- Essential deletion consequences remain visible in cleanup review rather than only in help.

### Terminology and cleanup flow

- Replace Exact copies with Other bookmarks for this URL and move that group into Bookmark details. Match the complete saved URL exactly; do not broaden the definition to same domain, normalized path or similar title.
- Replace Shared website data with Other pages affected by this cleanup. Explain that different pages may share cookies/storage even though their bookmarks remain. Keep category-specific impact logic.
- Step 1 — Choose what to remove: group website-data choices separately from bookmark removal; retain consequences and measured cookie/bookmark counts. Replace technical origin-count badges with “Clears this data for the selected websites, if present. Stored item counts and sizes are unavailable.” Keep unavailable distinct from zero.
- Next prepares a fresh reviewed snapshot. Step 2 — Review this cleanup contains Data to remove, Bookmarks to delete (when applicable), Other pages affected (when applicable), and an optional Technical details disclosure.
- Give selected categories a visible Data to remove label. List each bookmark once with its title above the folder-path caption; reuse the bookmark-row presentation from details.
- Merge Additional exact copies and Saved copies will remain into Also delete other bookmarks for these URLs. Default all eligible additional duplicates checked when bookmark removal is enabled; browser-managed entries remain unselectable with an explanation.
- Show selected bookmarks and additional duplicate choices in the same deletion section without listing selected duplicates again elsewhere. The total includes both sets. State when all bookmarks for a URL are selected: this flow may delete every copy, unlike deduplication that retains one.
- An unchecked duplicate stays visible in the checklist with the local warning “This bookmark will remain. Its website data will still be included in this cleanup.” Only show website-data consequences when a data category is selected.
- Remember explicit duplicate deselections through Back/Next and review refreshes. Defaults apply once per newly discovered eligible candidate, never on every render. Prune vanished/ineligible candidates and prepare the final snapshot using the current decisions.
- When Remove selected bookmarks is off, omit deletion controls and exclude all duplicate IDs from the plan. Site-data-only cleanup remains site-data-only; it does not acquire bookmark deletion as a side effect of the new duplicate design.
- Other pages affected lists retained bookmarks/sites with relevant consequences. Technical details contains exact targeted origins, cookie domains/partition context and discovery limits. Preserve the irreversible-operation warning and the rule that dependent bookmarks remain if selected data cleanup fails.
- Back retains choices, clears previous pending/error feedback and invalidates old requests. A spinner exists only while its corresponding operation is pending.
- While preparing or refreshing the review, confirmation is disabled. If rebuilding a plan fails, show an attached, visible error with retry/back/cancel; the prior plan cannot remain confirmable. Final Confirm cleanup uses exactly the current reviewed snapshot.

## Motion contract

The main sequence is choose → review → start → result. Motion makes that progression and form opening/closing legible. Preserve the current blue/white identity and existing folder/drawer language. No page-load choreography, bounce, confetti or animation dependency.

| Surface/change | Planned motion | Constraints |
|---|---|---|
| Button hover, focus, enabled/disabled and selection | 100–150 ms color/border/opacity changes | Control placement and hit targets stay fixed; native state and focus remain immediate |
| Edit/copy opening and closing; inline warnings | 180–220 ms bounded reveal/collapse, with a short opacity change | Interruptible; closed content becomes inert immediately; no delayed dirty-state decisions |
| Details opening/closing and item changes | Retain roughly 240 ms drawer movement; short content crossfade for a new inspected item | Preserve desktop/narrow behavior, scroll and focus; no replay of the drawer entrance after every save/enrichment |
| Tooltip/popover | About 120 ms fade in, faster exit; brief hover intent delay | Keyboard feedback is prompt; Escape works immediately; no layout movement |
| Toast | 180–220 ms fade with a small edge translation; faster dismissal | Stable placement, readable dwell time, bounded queue; no overlap with confirmation controls |
| Step 1 ↔ Step 2 | 160–200 ms content transition with a small directional offset | Remove old interactive content from focus/accessibility immediately; focus the new heading, never auto-focus Confirm |
| Search/filter results and empty states | At most a 100–150 ms result-container transition when useful | Render latest matches immediately, retain input focus, cancel stale motion; no per-row stagger or delayed filtering on each keystroke |
| Selection count and remaining-copy warning | Short tint/opacity transition with reserved toolbar space | No button movement or repeated screen-reader announcements for cosmetic changes |
| Save/refresh/cleanup pending → outcome | Spinner only while pending, then a brief state/icon transition | State changes and error recovery never wait for animation completion |
| Tab changes and persistent cleanup results | Short content fade where it preserves continuity | Complete leave guards first; do not animate every background job poll |

- Use shared duration/easing tokens plus a small native CSS/Web Animations helper for interruption and dynamic reveals. Avoid a generic animation abstraction for every DOM mutation.
- Prefer opacity/transform. Use height measurement only for bounded expanding content where needed, batch reads before writes, and never animate thousands of search rows.
- New requests cancel or settle prior animation; rejected animation promises must not become errors. Clean up animations, timers and popover/toast ownership when a view is replaced.
- Reduced motion removes spatial movement, height animation and continuous spinner rotation; retain immediate state changes, readable pending text and minimal opacity/color feedback. Handle a preference change while a transition is active.
- UI logic cannot depend solely on animationend/onfinish: cancellation, reduced motion, route changes and detached elements must still settle correctly. Incoming content must not be blank if animation cannot run.

## Implementation sequence and commit boundaries

Each numbered item is a focused implementation unit; split further if a unit becomes difficult to review. Include meaningful related regression coverage with each behavior change. Do not make one omnibus UI commit.

0. **Shared contract and foundations.** Use `docs/ui-contract.md` as the normative target. Inventory existing controls/tokens, define small typed APIs, then implement the pending/read-freshness, form/leave, feedback/popover and motion foundations needed by actual consumers. Pilot edit/copy against the same lifecycle and verify cleanup's current-plan-only invariant. This phase may pull the minimum shared work and pilot wiring from units 3–4 forward; those units then migrate remaining consumers rather than build a second implementation. Keep the existing component/token folders, no runtime dependencies and no universal UI state machine. Pass the foundation acceptance criteria before the broad migration.

1. **Cleanup preparation lifecycle.** Fix stale Back feedback, detached review errors, stale-plan confirmation, request invalidation and choice persistence. Keep the current presentation initially so these fixes can be reviewed independently. Primary file: `extension/components/cleanup-dialog.ts`; regression suite: `scripts/cleanup-review-smoke.mjs`.
2. **Toolbar and search selection.** Normalize both toolbars/descriptions and list-header selection; add bookmark flat search, outside-results counts and expansion/focus preservation. Files: `pages/bookmarks.ts`, `pages/sites.ts`, `components/bookmark-tree.ts`, applicable selection helpers/styles. Split search from basic layout if independently reviewable.
3. **Feedback/help foundations.** Add shared toast and info-popover components, icons and motion tokens/helper; integrate page actions and operation-status transitions. Files include `components/dom.ts`, `components/icons.ts`, `components/operation-status.ts`, `app.ts`, styles, and small new focused components. Ensure modal-layer visibility before form integration.
4. **Bookmark form lifecycle.** Unify edit/copy opening and submit/cancel behavior; implement dirty guards across drawer, refresh and routing; integrate mutation reconciliation, local loading, toasts and reveal motion. Files: `components/bookmark-editor.ts`, `components/site-details.ts`, `components/details-drawer.ts`, workspace pages and `app.ts`. Preserve bookmark ID during edit/move.
5. **Details information hierarchy.** Replace redundant links, add truthful URL/domain labels, move/rename duplicate and affected-page sections, and reuse title/path rows. Files: `components/site-details.ts`, `components/affected-bookmarks.ts`, shared row rendering and styles.
6. **Duplicate deletion decisions.** Implement default-selected eligible additional bookmarks, persistent explicit deselections, managed/vanished handling and snapshot rebuilding. Keep site-only and bookmark-only boundaries. Verify actual resulting bookmark IDs in disposable fixtures before presentation polish.
7. **Two-step cleanup presentation.** Apply headings/Next, readable category summaries, unified deletion list/warnings and technical disclosure. Integrate step/loading/error motion using the existing lifecycle from unit 1. Avoid repeating bookmark rows or hiding consequences in tooltips.
8. **Integrated verification and documentation.** Resolve observed cross-flow issues, capture representative desktop/narrow states, update DESIGN.md and development/history documentation to the verified behavior, and record completion evidence here. Do not mark broader public-release tasks complete unless their own criteria are satisfied.

## Verification and acceptance

Use disposable browser profiles and synthetic bookmarks/cookies for every destructive check. Never run cleanup experiments against the user's library.

- **Cleanup lifecycle:** open → Next → Back repeatedly; preserve categories/duplicate choices; no orphan spinner; failed initial preparation and failed duplicate refresh expose errors; Confirm cannot execute a stale plan; late results after Back/close do not overwrite the current view; Enter on step arrival does not delete.
- **Deletion boundaries:** checked/default duplicate IDs are removed once; unchecked, managed and unrelated bookmarks survive; URL variants are not silently duplicates; multiple originally selected duplicates are not counted twice; bookmark-only review omits shared-data warnings; site-only cleanup never deletes bookmarks; selected data failure retains dependent bookmarks.
- **Forms:** editing/moving preserves ID, copy creates exactly one new ID, no-change edit cannot submit, double-click/Enter cannot repeat pending mutations; every dirty exit path offers save/discard/stay; save failure blocks navigation; successful/partial writes and failed refresh are distinguished; drafts survive optional enrichment; collapse/reset/focus behavior matches the contract.
- **Search/selection:** title/URL/path matching, no results, clear search and restore expansion, filtered select-all/unselect-all, hidden selection count, clear-all including empty folders, managed nodes, inspection independence and reconciliation after mutation. Check responsiveness with the existing realistic large-library fixture before considering new rendering complexity.
- **Feedback/accessibility:** toast visibility over native dialogs, keyboard info popovers, error persistence, non-repeating status announcements, long URLs/folder names, 200% zoom, keyboard focus/return and nested confirmation Escape behavior.
- **Motion:** rapid open/close and repeated step changes, cancelled transitions, route changes, pending writes, reduced motion (including mid-transition changes), no invisible focus targets, no stale spinners and no content left hidden after interruption.
- Extend the existing `cleanup-review`, `bookmark-management`, `bookmark-mutation`, `bookmark-selection`, `ui-refinement` and `folder-motion` suites for meaningful behavior. Update obsolete label selectors as needed; do not add tests that merely duplicate copy or CSS declarations.
- During implementation, run focused suites relevant to each behavior. At the integrated boundary run `npm run typecheck`, `npm test`, `npm run build`, `npm run test:browser`, and `git diff --check`. Record unavailable browser coverage rather than claiming it passed.
- Perform one batched desktop/narrow visual pass across populated/empty/error/form/review/toast states, fix observed issues together, and perform at most one visual confirmation pass. Run the Impeccable mechanical detector once over changed UI targets after implementation and inspect actual findings. Functional failures still require targeted retesting after correction.

## Completion tracking

- [x] Shared UI/interaction contract documented; responsibilities and extraction boundaries defined
- [ ] Shared foundations implemented and exercised through edit/copy and cleanup lifecycle pilots
- [ ] Cleanup preparation and Back/error lifecycle
- [ ] Consistent toolbars, selection and bookmark search
- [ ] Shared feedback, popovers and motion primitives
- [ ] Unified bookmark forms and dirty navigation protection
- [ ] Details URL/duplicate/affected-page hierarchy
- [ ] Duplicate selection and verified deletion boundaries
- [ ] Two-step review presentation and motion
- [ ] Integrated checks, visual evidence and implemented-design documentation

Planning validation: checked against current workspace code and existing browser suites; no runtime behavior has been changed or tested by this planning task.
