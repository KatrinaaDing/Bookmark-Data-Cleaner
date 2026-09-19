# Public-release improvement plan — 19 September 2026

**Status:** planned; documentation organization complete, application implementation not started.

**Branch:** `codex/public-release-improvements`, created from `codex/rebrand-stage-1` at `ad45d365d2924d1be79848a7ee8ff3730a4afd39`.

**Goal:** release a trustworthy, usable version 3.0, validate its value with real users, and turn verified outcomes into a portfolio case study.

**Basis:** [current evaluation](../evaluations/2026-09-19-extension-evaluation.md). Historical plans are context, not instructions to rerun completed work. Every recommendation below is scheduled, conditional, preserved as a constraint, or explicitly deferred. Deferring a feature is part of following the evaluation, not an omitted implementation task.

## Working constraints

- Keep native TypeScript modules, packaged assets, no runtime dependencies, optional history, and local processing.
- Preserve the original blue/white identity. Prefer targeted hierarchy improvements to a redesign.
- Preserve reviewed immutable choices, explicit duplicate opt-in, independent batch selection, managed-bookmark protection, data-before-bookmark deletion, and no automatic destructive replay.
- Use disposable browser profiles for all destructive tests. Do not run experiments on personal bookmarks or site data.
- Make one focused intent per implementation commit, with its relevant tests. Separate data semantics, UI changes, performance, and documentation. The commit suggestions below describe future work; no application commits are implied by this plan.
- Test proportionately. Add regression tests for destructive boundaries and meaningful state behavior; do not add tests that merely mirror wording or styling. Run broader checks at phase/release boundaries, not after every cosmetic edit.
- Read applicable current UI skill guidance when actual interface implementation begins. This document creates no requirement for unavailable historical skills or old worktree paths.
- Prepare reviewable store assets and research materials locally. Publication, external outreach, or account changes occur only under explicit authorization; the current request authorizes documentation and planning, not those external actions.

## Phase 1 — Establish deletion correctness (release gate)

### R01. Cookie identity and concurrent-change safety

- [ ] Turn the preserved [probe](../evidence/2026-09-19/README.md) into meaningful browser regression cases with explicit target and unrelated-cookie assertions.
- [ ] Cover host-only/domain collisions, parent/child domains, overlapping paths, already-absent targets, cookies introduced after review, duplicate identities across selected sites, stores, and complete partition keys.
- [ ] Check actual behavior on available current Chrome and Edge. Consult current official API documentation/implementation before selecting a deletion strategy.
- [ ] Investigate identity-preserving removal/expiry, including all metadata it requires and any scope broadening. Do not assume `cookies.set` expiry is safe without testing domain, path, secure/HttpOnly, and partition behavior.
- [ ] Define supported scope explicitly. If exact removal cannot be established, conservatively block that case or present the supported broader scope for fresh review. Never silently widen scope or repeatedly remove URL/name matches until the target disappears.
- [ ] Skip absent targets without deleting a different matching cookie. Recheck plans when required, but do not claim that a check-then-delete sequence eliminates races.
- [ ] Ensure failures/unsupported cases produce actionable results and retain dependent bookmarks. Do not report exact-scope success based solely on selected-target absence.
- [ ] Update architecture/help wording to match proven guarantees and documented limits.

**Likely files:** `extension/browser/site-data.ts`, `extension/helpers/sites.ts`, `extension/core/types.ts`, `extension/core/cleanup.ts`, `tests/cleanup.test.ts`, `tests/site-data.test.ts`, `scripts/cleanup-smoke.mjs` or a dedicated scope suite.

**Acceptance:** all reproduced collisions have a safe, documented outcome; unreviewed cookie identities survive operations that promise exact removal; unsupported cases refuse before destructive work where feasible and keep dependent bookmarks; no replay after interruption. If concurrent mutation prevents the promised guarantee, this phase remains blocked until a supported product contract is chosen and verified. Passing the old suite alone does not close R01.

**Commit units:** scope regression fixtures → safe removal strategy with corresponding regressions → user-facing unsupported/changed-scope handling → documentation of verified guarantees. Do not leave an intentionally failing test commit as the final branch state.

## Phase 2 — Low-cost interaction improvements

### R02. Consistent cleanup entry and deliberate confirmation

- [ ] Change details to blue **Review cleanup**; reserve red for final confirmation.
- [ ] Focus the review heading/summary, with usable keyboard continuation and focus restoration; avoid automatic destructive-button focus.
- [ ] Disable review when no available category is selected, including while permission checks change availability.

**Files:** `components/site-details.ts`, `components/cleanup-dialog.ts`, relevant styles and browser interaction tests under `extension/` / `scripts/`.

**Acceptance:** direct and batch actions enter the same reviewed flow, no immediate deletion; Enter during review arrival does not accidentally confirm; Back/Cancel/Escape and nested narrow dialogs remain usable. Separate the action-label/style commit from focus/validation behavior.

### R03. Selection correction

- [ ] Add Clear selection to Bookmarks, visible only when useful.
- [ ] Reset all selected IDs, including collapsed/filtered descendants and empty-folder selections; update parent mixed states and review availability.

**Acceptance:** inspection remains independent; selections clear in one action; no stale selected folder can enter a later plan. Use a focused behavior check, not a label-only test.

### R04. Consequence-first choices and contextual detail order

- [ ] Group website-data categories separately from bookmark removal. Retain granular opt-in and explain sign-out/offline/unsynced-work consequences before API names.
- [ ] Make review sections distinguish removals, shared effects, and retained items, without concealing exact origins/cookie scope.
- [ ] Prioritize website data and Review cleanup over edit/create controls in details.
- [ ] Show Add bookmark for sites with no saved bookmark; retain Create copy when a copy is meaningful.
- [ ] Add concise first-use row/checkbox guidance where needed; avoid a multi-step tour.

**Acceptance:** a first-time user can identify what disappears and what remains; bookmark deletion is never silently enabled by a preset or remembered choice. Preserve category-specific related effects, duplicate opt-in, and draft protection. Verify desktop and narrow layouts in one batch, then one confirmation pass if corrections are needed.

## Phase 3 — Large-library performance and discovery

### R05. Indexed bookmark/cookie matching

- [ ] Add a reproducible diagnostic fixture for 1,000 and 5,000 bookmarks against 5,000 cookies, including repeated hosts, parent domains, mixed schemes, and partitions.
- [ ] Parse bookmark URLs once; index cookie candidates; reuse scheme/host matching where semantics permit. Keep history/origin enrichment and unknown dates correct.
- [ ] Benchmark baseline and implementation in the same environment after warmup. Record medians and browser/version; keep timing thresholds out of ordinary unit tests.
- [ ] Profile the actual large-library page after indexing; only introduce rendering complexity if measured stalls remain.

**Files:** `core/inventory.ts`, `helpers/sites.ts`, inventory/impact tests, a small diagnostic script.

**Acceptance:** record a material reduction from the same-machine baseline, aiming for at least 5× on the 5,000/5,000 fixture; browser profiling shows whether any remaining blocking task warrants work. Exact matching/partition/origin correctness is mandatory even if the performance target needs revision. No workers, virtualization, or framework migration without new evidence.

### R06. Bookmark search with safe selection

- [ ] Add case-insensitive title/domain search with clear folder-path context and a no-results state.
- [ ] Preserve normal folder expansion state when entering/leaving search; define filtered folder selection as selecting visible eligible matches, with explicit counts.
- [ ] Keep hidden selections visible in the total and clearly state how many are outside the current filter. Clear selection clears all; review still lists every selected target.
- [ ] Preserve managed-node protection, stable IDs, inspected-record state, and focus after filtering or mutation.

**Files:** `pages/bookmarks.ts`, `components/bookmark-tree.ts`, `core/state.ts` if necessary; focused selection/browser tests.

**Acceptance:** users can locate a bookmark without remembering its folder; filtering cannot silently add/remove deletion targets; realistic large fixtures remain responsive. Commit search/matching logic separately from interface integration when independently reviewable.

### R07. Site bookmark-status filter

- [ ] Replace Bookmarked only with All / Bookmarked / Not bookmarked.
- [ ] Preserve search/date ordering, unknown-history groups, selected counts, and review scope when filters change.

**Acceptance:** unbookmarked cookie-discovered sites are easy to find, and hidden selections remain explicit. One focused feature commit with meaningful filter/selection verification.

### R08. Recorded bookmark-use filter (after core discovery)

- [ ] Use existing optional `dateLastUsed` metadata; label it Bookmark last opened, distinct from website visits.
- [ ] Offer a small set of age ranges and a separate Not recorded option; never classify missing dates as old.
- [ ] Combine safely with title/domain search and preserve selected/hidden counts.

**Acceptance:** no extra history permission is required for bookmark-use metadata; boundary dates use documented local-date semantics; the filter never automatically selects or deletes items. Ship after R06 if it stays simple; document evidence and decision if usability research changes its priority.

## Phase 4 — Trust, accessibility, recovery, and polish

### R09. Permissions and honest inventory coverage

- [ ] Add labeled Enable visit dates while history access is off and explain the benefit at the point of request.
- [ ] Explain why cookie/site access is needed and that processing remains local. Keep history optional and separate.
- [ ] Make cookie-driven discovery and storage-only omissions visible in first-use/empty states; an empty list must not claim no stored data exists.
- [ ] Exercise grant, decline, revoke-while-open, delayed enrichment, and read failures.

**Acceptance:** users can continue supported cleanup without history; unread inventory never appears as measured zero; optional enrichment cannot overwrite open drafts.

### R10. Results and recovery clarity

- [ ] Present sites processed, bookmarks removed/kept, and category failures/unverified work with explicit units. Separate “kept” from “uncertain” when facts support the distinction.
- [ ] Keep readable target identifiers, expandable operation detail, explicit manual retry guidance, and honest API-completion language.
- [ ] Compact the completion panel so it does not dominate the next task; preserve accessible status announcements without repeated noise.

**Files:** `core/types.ts` / `core/cleanup.ts` if structured result fields are needed, `components/operation-status.ts`, job tests.

**Acceptance:** counts reconcile with outcomes for mixed success, bookmark-only, empty-folder, failure, and interrupted jobs. Never invent bytes saved or “all traces removed.” Separate result-model changes from presentation.

### R11. Durable minimal interruption marker

- [ ] Define a small local record: job identifier, start time, and incomplete-state marker; no cookies, URLs, bookmark titles, or full plans.
- [ ] Persist before destructive execution; refuse starting if required marker persistence fails. Reconcile conservatively after full restart and define terminal-write failure handling.
- [ ] Clear on recorded completion or explicit acknowledgment; allow at most one marker and explain its lifetime in privacy documentation.
- [ ] Keep detailed outcomes in session storage; do not replay or imply known results after browser restart.

**Acceptance:** worker restart and full browser restart surface uncertainty appropriately; successful completion does not leave a false warning; storage failures do not authorize unrecorded destruction. Requires focused job tests and disposable restart checks. This is a recovery aid, not rollback.

### R12. Help, privacy, support, and backup guidance

- [ ] Add unobtrusive Help / Privacy / Report issue / version / release-note access using real maintained destinations.
- [ ] Document required and optional permissions, local processing, retained marker data, inventory limits, sign-out/unsynced-work consequences, and browser bookmark-export guidance.
- [ ] Verify destination links and instructions before shipping. If no privacy destination exists, prepare a repository document and publication-ready URL; do not invent a deployed page.

**Acceptance:** help is reachable from the app and repository; copy matches shipped behavior; backup guidance does not promise recovery of cookies/site storage. A custom exporter remains conditional below.

### R13. Accessibility verification and targeted fixes

- [ ] Test the whole flow with keyboard, VoiceOver, 200% zoom, reduced motion, and forced colors on desktop/narrow windows.
- [ ] Measure current checkbox/control contrast on normal, hover, and selected backgrounds. If it fails, make the smallest contrast correction and document why this supersedes the historical appearance constraint.
- [ ] Verify modal focus/return, long/deep trees, live announcements, labels, and interactive target sizes. Fix observed failures; do not build a custom ARIA tree solely for theoretical completeness.

**Acceptance:** record checks and limitations in development documentation. Do not claim comprehensive accessibility compliance from a detector or screenshot alone.

### R14. Modest visual and brand polish

- [ ] Improve bookmark title/domain association at wide widths without losing full URLs in details.
- [ ] Remove repeated explanations and adjust detail/result hierarchy within the existing palette/type system.
- [ ] Polish the existing icon for actual toolbar/store sizes; retain brand recognition and avoid a naming project.
- [ ] Inspect representative populated/empty/error/review states at desktop and narrow widths in one batched pass. Run the design detector once after UI changes; fix real findings, then verify once.

**Acceptance:** task visibility and readability improve, no layout overflow or reduced-motion regressions, no added remote assets/dependencies. Separate icon assets from layout commits. Update `DESIGN.md` to describe final behavior, not proposed behavior.

## Phase 5 — Release engineering and public presentation

### R15. Small CI and release matrix

- [ ] Add a CI workflow using the project's supported Node version: locked install, typecheck, unit tests, build. Avoid a large platform matrix initially.
- [ ] Register new meaningful browser regressions in the existing runner; keep synthetic profiles and fixtures.
- [ ] Complete minimum Chrome 130, current stable Chrome, and available Edge checks, including real permission prompts, DevTools-closed worker interruption, browser restart, and the final extracted package.
- [ ] Record actual browser/OS versions, dates, failures, unavailable environments, and enterprise-policy coverage. Revisit the declared minimum only if evidence justifies it; do not silently treat untested support as verified.

**Acceptance:** CI passes and applicable manual release gates have evidence. Existing limitations remain explicit until resolved. Check `git diff --check`; source-only tests do not replace destructive browser regressions.

### R16. Store description, screenshots, and disclosure preparation

- [ ] Draft concise positioning around reviewing abandoned bookmarks/sites and selected leftover data.
- [ ] Replace outdated storage-category claims; accurately distinguish supported scope from complete trace removal.
- [ ] Produce three authentic screenshots with realistic synthetic data: find candidates → inspect shared effects → review deletion. Match final UI and icon.
- [ ] Reconcile manifest, README, privacy explanation, store declarations, version, and release notes with the package. Refresh public counts only if citing them; never present the 103-user snapshot as current indefinitely.
- [ ] Prepare the package and a concrete listing-change preview for review. Publish/update only when explicitly authorized.

**Acceptance:** no stale feature or privacy claims, no real browsing data in assets, installation instructions work, final package has manifest at archive root. Release remains blocked by R01 even if marketing materials are complete.

## Phase 6 — Validate adoption and document outcomes

### R17. Small user study and growth feedback

- [ ] Prepare a task script for 5–10 people with substantial bookmark collections: explain purpose, find unwanted candidates, understand shared effects, review a cleanup, and interpret results. Use disposable data for destructive usability sessions.
- [ ] Record task completion, confusion, perceived risk, and requested features without collecting personal histories/cookies. Prepare invitations, but send only with authorization.
- [ ] Obtain store-dashboard baseline/release-period metrics when access is available; separate impressions, installs, users, and retention where the dashboard supports them. Do not invent unavailable metrics.
- [ ] Review findings after an agreed post-release window (initially 2–4 weeks); select follow-ups based on recurring problems, not daily-usage targets for an occasional utility.

**Acceptance:** feedback is actual evidence with sample size/limitations. No runtime analytics or paid acquisition infrastructure is required for the first validation cycle.

### R18. Portfolio case study and demonstration

- [ ] Write a concise case study: user problem, safety contract, verified scope fix, performance measurements, accessibility/recovery decisions, and actual user findings.
- [ ] Produce a short demonstration and retain reproducible build/test instructions.
- [ ] Distinguish published capabilities from planned work; use verified metrics and dated public counts. Update after release rather than claiming a planned release has shipped.

**Acceptance:** a reviewer can understand the engineering decisions and reproduce the project without reading the chat. No added AI, account system, or framework solely to enlarge the technology list.

## Conditional and deliberately deferred recommendations

| ID | Recommendation | Decision and trigger | Scope if triggered |
|---|---|---|---|
| C01 | Current-site toolbar cleanup | Evaluate after safe release; build if repeated feedback demonstrates a frequent single-site task | Reuse preparation/review/results; handle unsupported tabs and required permission explicitly; never bypass final review or duplicate the cleanup engine |
| C02 | Custom bookmark backup/export | Start with R12 browser-export guidance; build if observed abandonment or recovery needs justify it | Explicit local browser-importable export, escaping/folder fidelity and import round-trip checks; no cookie/storage backup or full undo promise |
| C03 | Workers or list virtualization | Only if profiling after R05/R06 still shows material responsiveness problems | Fix the measured bottleneck; retain keyboard navigation, selected state, and focus |
| D01 | Scheduled/automatic deletion | Defer; uncertain value and high destructive-operation/support cost | Requires a separate safety/product proposal and evidence, not automatic progression from this plan |
| D02 | Exhaustive storage discovery or exact byte reporting | Defer; current browser capability/coverage limits outweigh immediate value | Revisit only after a supported API feasibility study; retain honest incomplete inventory now |
| D03 | Full redesign, rebrand, extra themes, elaborate motion/illustration | Defer; retain coherent identity and targeted R14 polish | Revisit only when user evidence identifies an adoption/accessibility problem these changes solve |
| D04 | AI classification, accounts/cloud sync, remote previews/favicons, general bookmark-manager expansion, framework migration | Defer; adds privacy/dependency/maintenance burden without demonstrated task value | Separate evidence-backed scope proposal required |
| D05 | Subscription, paid infrastructure, runtime analytics | Defer pending recurring demand and a clear measurement/business need | Prefer store metrics/direct feedback first; no monetization or tracking introduced by this plan |

## Coverage and completion tracking

| Evaluation area | Tasks covering recommendations |
|---|---|
| Functionality/reliability | R01, R03, R06–R09; C01; D01–D02 |
| Usability/accessibility | R02–R04, R06, R09–R10, R12–R14 |
| Aesthetics/identity | R04, R10, R14, R16; D03 |
| Performance/maintenance | R05, R15; C03; preserved architecture; D04 |
| Privacy/trust/recovery | R01, R09, R11–R12, R16; C02; D05 |
| Popularity/growth | R16–R17; C01; D05 |
| Portfolio | R18, verified evidence from R01/R05/R13/R15/R17 |

After each phase, add a dated refinement record under `history/` with focused commit IDs, what changed, why, verification, and remaining risks; link it from the index. Check off tasks only when their acceptance criteria are met. Record conditional decisions without labeling deferred features implemented.

**Ready for release:** R01 safety contract proven; core interaction/performance/search work verified; trust/accessibility and required compatibility checks recorded; package and public claims agree. R08 and conditional features may follow the core release without blocking it. Research results and the shipped-outcome case study necessarily continue after release. Publication itself requires the owner's explicit instruction.
