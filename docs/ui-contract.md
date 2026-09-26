# Shared UI and interaction contract

**Status:** shared foundations and scoped consumer migration implemented on 20 September 2026. Verified behavior and remaining manual release checks are recorded in the [implementation record](improvements/history/2026-09-20-interaction-system.md); the [interaction plan](improvements/plans/2026-09-20-interaction-consistency-plan.md) tracks completion. This remains the standard for subsequent UI work, not a claim of exhaustive browser/accessibility coverage.

## Purpose and boundaries

Make identical actions look and behave identically, and make async failures and interrupted transitions predictable. Build on the existing native TypeScript/HTML components and CSS tokens; retain the blue/white identity, local assets and no runtime dependencies.

This document owns shared visual/interaction rules. DESIGN.md describes the verified, implemented interface. The interaction plan owns feature-specific decisions, sequencing and completion evidence. Cleanup domain rules remain in core/browser modules; shared UI components must not decide which bookmarks or website data to remove.

## Responsibility layers

| Layer | Owns | Must not own |
|---|---|---|
| Tokens in `extension/styles/tokens.css` | Semantic colors, typography, control sizes, spacing, focus, radius and motion timings/easing | A token for every isolated pixel value |
| Shared controls in `extension/components/` | Buttons, feedback, popovers, form actions, bookmark summaries, toolbar layout, accessible names and local visual states | Chrome API calls, deletion rules, workspace-specific filtering |
| Small lifecycle helpers beside components | Pending-action exclusion, read-request freshness, dirty-exit handling, motion cancellation and disposal | A universal global store or one controller for unrelated workflows |
| Workspace/detail/cleanup controllers | Selection scope, draft values, current review phase, mutation reconciliation and composition | Independently reinvented spinner, toast, focus or form-exit behavior |
| Core/browser modules | Stable IDs, eligibility, exact duplicate matching, impact analysis, immutable plans and browser operations | DOM rendering, animation and toast delivery |

Keep DOM helpers simple and shared component APIs typed. Prefer explicit handles/callbacks over document-wide CSS queries to infer state. Stable IDs connect controllers and views; classes describe presentation. A DOM replacement is not a substitute for transitioning application state.

## Visual and component standards

| Pattern | Standard |
|---|---|
| Actions | Explicit primary, secondary, quiet, destructive, positive-icon and negative-icon variants. Final deletion uses destructive; entering cleanup uses primary. Name the entry scope: Clean up selected… in toolbars, Clean up this bookmark… / Clean up this site… in details. Editing cancel/discard does not inherit final-deletion wording. |
| Icon actions | Use the shared SVG set, accessible name and tooltip. Button hit area is independent of glyph size. Familiar secondary actions may be icon-only; Next and Confirm cleanup remain labelled. |
| Button state | Idle, disabled and pending use the same API. Pending preserves dimensions, prevents repeated invocation, exposes a meaningful loading label and restores the correct disabled state afterward. |
| Focus | Shared visible focus treatment; logical focus return after overlays/forms close. No automatic focus on destructive confirmation. Color/animation never replaces labels or focus indication. |
| Toolbars | Refresh/filter group left, cleanup group right; stable placement at zero selection. Consistent stacked behavior at narrow widths. List-wide selection belongs at the list header. |
| Forms | Consistent field labels, spacing, validation and bottom action row. Shared submit/cancel lifecycle for edit and copy. Errors identify the field or failed operation. |
| Bookmark summaries | Title first, folder path as a secondary line; optional full URL when useful. Reused in details, search and review. Rendering a row does not change selection or decide eligibility. |
| Help | Small non-layout-shifting popover on hover/focus and tap; Escape closes it. Native disclosure is reserved for substantial optional content such as technical cleanup details. |
| Feedback | Field errors local; operation loading next to the action; outcome toast for user actions; persistent cleanup-results toast with details for completed, partial or uncertain outcomes. |
| Text | Domain, full bookmark URL, affected page, selected bookmark and duplicate are distinct concepts. No unmeasured data counts or generic success when work is partial/unverified. |
| Typography | Reuse the system font and size tokens. Section and site row titles use medium weight, metadata regular weight. Bookmark list/search titles use regular (400); folder titles use bold (700). Blue may distinguish section headings; do not add bold to every level. |
| Inspection rows | Row titles are buttons opening local details, without link underlines. Actual URLs remain links. Trailing icon/count metadata needs a descriptive accessible name and an explicit unavailable state. |
| Site-level details | Combine saved bookmarks with website-data context; show each bookmark ID once and retain additional shared-data effects. Explain that site-data cleanup keeps bookmarks saved. This grouping never changes cleanup scope. |

Extend existing tokens with semantic success/danger foreground and subtle backgrounds, disabled/focus states, shared control sizing and the few spacing/motion values used repeatedly. Validate contrast in default, hover, focus and disabled treatments; translucent backgrounds must still make controls readable. Do not introduce a second competing token palette.

## State contracts

### Pending actions and request freshness

- A pending-action helper prevents re-entry before the first await, exposes pending state and settles through success, failure and disposal. Re-enabling an action re-evaluates its current validity; it does not blindly set disabled to false.
- Read-only loads may be superseded by a newer request. A request token/owner check prevents late results from rendering into the wrong view; abort supported reads when practical. One owner's cleanup cannot clear another request's busy state.
- Browser writes are different: cancelling a view or ignoring an old response does not cancel a bookmark mutation or cleanup job. Retain their outcome, reconcile browser state and prevent duplicate writes; never retry automatically after uncertain completion.
- Controllers distinguish pending, success, failure, partial completion and unknown outcome where applicable. A toast or spinner renders this state; it does not own it.
- Component disposal removes local event listeners, timers and animations. It does not silently cancel or forget a domain operation already started.

### Bookmark form lifecycle

- The shared form session owns baseline values, draft values, validity, dirty status and submission state. Bookmark-specific mutation adapters supply save/create behavior and reconciliation results.
- Edit/copy use explicit phases: closed, editing, submitting and failed. Success reconciles then closes; failed remains editable. Dirty/valid are properties of the draft, not inferred from whether the form is visible.
- Provide one leave operation returning proceed/stay after Save / Discard / Keep editing. Every close, form switch, item switch, refresh and internal route change uses it. Route/drawer owners must await that result before replacing content.
- Save from the leave prompt uses the same submission path as the check button; failed save means stay. A partial mutation or failed refresh remains visible and cannot be mistaken for a safe repeat of create.
- Freeze writes and conflicting navigation during submission. After success/discard, reset and restore focus. Keep uncommitted values on failure. Optional enrichment must update through the owner and cannot replace an active draft.
- Keep native unload protection separate from the internal leave prompt: browser shutdown cannot reliably await a custom async save.

### Cleanup review lifecycle

- The cleanup controller owns explicit choosing, preparing, reviewing, starting and error states. Shared primitives render them; a generic form helper must not own deletion authorization.
- Associate a reviewed snapshot with the exact options/duplicate decisions and the request revision that produced it. Confirm is enabled only for a successful current review with no preparation/start pending.
- Any scope change invalidates confirmation immediately. Rebuild success replaces the plan; failure keeps confirmation unavailable with visible recovery actions. There is no fallback to the previous plan.
- Back clears transient feedback, invalidates stale reads and retains user decisions. Defaults initialize eligible duplicate choices once; rerenders do not override an explicit deselection.
- Review has one scrolling content region with actions and the irreversible warning outside it. Rebuilding a copy or affected-bookmark decision preserves open supporting disclosures, scroll position and checkbox focus while invalidating confirmation. Underlying details must defer responsive modal transitions while a confirmation overlay is open.
- Additional affected bookmarks are opt-in deletions with unchanged website-data scope. Preparation rechecks eligibility from fresh bookmarks and selected data; managed entries remain protected. Bookmarks shared by several targets wait for all dependencies and remain if any data cleanup fails.
- Starting uses the reviewed snapshot exactly once. A disconnected view does not imply the background job stopped; durable job status is the source of truth for its outcome.
- The job carries presentation IDs for initiating and reviewed bookmarks. They never authorize deletion. While that job is running, list and details views derive their busy state from its ID and status; completion removes the busy state and reconciles the actual result. Closing details cannot hide the row-level progress state.

### Selection and navigation

- Keep the inspected item independent of selection. Review carries its entry title/folder or bulk object counts; shared website-data effects are prepared separately from that entry scope. Reapply inspection by stable key when restoring a cached list.
- One selection model owns IDs. Eligibility and matching belong to each workspace; shared helpers can derive result selection, mixed state and outside-results counts from sets of IDs.
- Header unselect-all affects eligible current results; Clear selection affects all. Inspection, tree expansion and search text are independent state. Filtering never silently changes deletion targets.
- Overlay ownership explicitly resolves Escape/focus: dismiss the topmost help/confirmation/modal first. Returning focus uses a connected visible trigger or a defined replacement/fallback.

## Reusable implementation candidates

Build or extend these in the existing folders; final file boundaries follow actual dependencies rather than a new framework directory.

| Component/helper | Initial consumers | Contract boundary |
|---|---|---|
| Typed action button and form action row | Both toolbars, edit/copy, cleanup dialog | Own rendering/accessibility/pending appearance; accept validity from owner |
| Workspace toolbar layout | Bookmarks and Site data | Own groups/responsive layout; accept search/filter controls as slots |
| Bookmark summary row | Details, flat search, deletion review, affected pages | Accept content/actions; no browser lookup or deletion decision |
| Toast host/service | Page actions, mutation outcomes, job transitions | Own lifetime/announcement/modal host; deduplicate by outcome event rather than message text alone |
| Info popover | Page introductions, website-data explanation and icon help where applicable | Own positioning/input/focus/disposal; no essential destructive warning hidden here |
| Form session plus leave guard | Edit and copy, drawer/route/refresh exits | Own draft/submission/leave lifecycle; domain mutation supplied as callback |
| Pending-action and latest-read helpers | Form writes, refresh, cleanup preparation | Separate write exclusion from read invalidation; no cancellation/retry assumption for writes |
| Motion helper/tokens | Form reveals, drawer, step transitions, popovers and toasts | Own cancellation/reduced motion/final visual state; never own logical success |
| Selection derivations | Both workspaces and bookmark search | Operate on explicit eligible/result/selected ID sets; keep folder semantics with bookmarks |

Extract repeated intent with concrete consumers. Edit/copy and the two workspaces deliberately share contracts even where there are only two consumers. Do not unify workflows merely because their markup looks similar. Prefer small functions and composition to option-heavy components or schema-driven forms.

## Motion and lifecycle standards

- Follow the [motion table in the interaction plan](improvements/plans/2026-09-20-interaction-consistency-plan.md#motion-contract). Shared tokens express immediate feedback, routine reveal and drawer durations; exits are generally faster.
- Every animated component supports interruption, replacement, disposal and reduced motion. Cancelled animations settle the final state; logical completion and focus never depend solely on animation callbacks.
- Animate the affected region. Do not animate every DOM update, replay entire screens after enrichment, stagger large lists or make search wait for motion.
- Preserve dimensions for pending buttons and toolbar actions. Outgoing hidden content becomes non-interactive immediately, including during visual exit.
- Reduced motion preserves readable state/pending feedback while eliminating spatial transitions and continuous rotation. Changes to the preference during motion settle safely.

## Migration and enforcement

1. Establish this contract, inventory current variants and identify real consumers. Keep any API sketches small and typed; do not build unused controls.
2. Implement the shared foundations with one vertical pilot: edit and copy share form actions, pending state, leave guard, feedback and motion. Separately exercise current-plan-only confirmation in the cleanup controller; it is a domain guarantee, not a property of a styled button.
3. Migrate consumers in focused units from the interaction plan. Each adopted pattern uses the shared implementation instead of a local copy. Remove the replaced path after its consumers migrate; avoid long-lived parallel APIs.
4. Test lifecycle invariants with meaningful interaction tests: repeated submission, stale reads, failed review, dirty navigation, focus, reduced motion and animation interruption. Avoid snapshot/label tests that only mirror implementation.
5. Review new UI against a short checklist: existing primitive used; owner/state transitions explicit; pending/error/empty cases defined; focus/keyboard and disposal covered; motion interruptible; domain authorization preserved. Use static tooling only for concrete recurring mistakes, not a new custom rules platform.

**Foundation acceptance:** edit and copy cannot drift in submit/cancel behavior; pending actions cannot double-submit; stale reads cannot overwrite a new owner; failed cleanup preparation cannot authorize an old plan; animated exits cannot lose unsaved work or strand focus. The shared layer is ready when these paths work through it, not when a component catalogue is complete.
