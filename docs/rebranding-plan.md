# Rebranding — Stage 1 Plan

Status: implemented on `codex/rebrand-stage-1`; release checks and public naming remain. Updated: 2026-09-06.

## Product direction

**Choose the sites. Clear their data.** A local, selective website-data cleaner with two entry points: bookmarks and stored site data.

Use TypeScript compiled to native JavaScript modules, custom CSS, native HTML controls and locally packaged assets. Use `tsc` and small Node scripts; no WXT, UI framework or bundler. TypeScript and Chrome/Node type definitions are development-only dependencies. Keep the current product name during restructuring; select the public-facing name with the visual design, before release.

**Implemented discovery scope:** discover sites through cookies, including partitioned cookies, then enrich with history/bookmarks. This is verified but does not discover every storage-only site. Do not describe the inventory as complete. Cleanup can still target other supported data for known origins.

## Pages, features and journeys

| Page | Features | User story / journey |
|---|---|---|
| Dashboard | Two feature cards: **Bookmark cleanup** and **Site data cleanup**. Short privacy explanation; permissions requested when needed. | “I want to tidy bookmarks or review leftover site data.” Choose a card → open the relevant workspace. |
| Bookmark cleanup | Existing collapsible folder tree; item/folder selection; metadata panel; shared cleanup dialog. | Expand folder → select bookmarks → review site data and bookmark choices → confirm → see results. |
| Site data cleanup | Refresh, search, date ordering, bookmark filter, multi-select, metadata panel, coverage notice. | Review old sites → inspect metadata → choose sites/data → confirm → see results. |

Dashboard navigation must not trigger a full scan. Each workspace loads its own data. Use one extension tab with `#home`, `#bookmarks` and `#sites` routes; retain in-memory workspace state between routes.

### Bookmark workspace

- Keep folder hierarchy and collapse state; show selected counts and indeterminate parent checkboxes.
- Selecting a folder selects eligible descendants. Protected entries are disabled with an explanation.
- Clicking a title selects the metadata panel; it does not visit the site. Checkboxes control bulk selection independently.
- Bookmark removal and site-data removal are independent. Default bookmark removal is off.
- Later improvements: search that reveals matching branches, expand/collapse all, and large-tree optimization. Exclude duplicate/dead-link scanning from this stage.

### Site-data workspace

Use a **compact timeline list**, not a large decorative timeline: year headings, dates on the left, sites on the right. Group equal dates together. Default to oldest recorded visit first; allow newest first. On narrow windows, place the date above its group.

Dates represent the latest available visit across matching site records, never cookie creation or data age. Use local calendar dates. Place **No matching history** in a separate group; never rank it as oldest. If history access is declined, the inventory still works without date enrichment.

Show host, detected cookie count, bookmark status and last recorded visit. Preserve original origins, cookie-domain scope and partition keys underneath display grouping. A count of zero or an unavailable measurement must not imply no other storage exists.

The metadata panel shows URLs already available locally, bookmark paths, visit information, detected data and cleanup scope. Offer saving a specific known URL as a bookmark, with an editable URL/title. Use local fallback icons; do not fetch remote previews or favicons automatically.

## Shared cleanup and feedback

| Option | Underlying data |
|---|---|
| Cookies and sign-in data | Ordinary cookies and relevant partitioned cookies |
| Saved site data | Local Storage, IndexedDB, website file-system data |
| Cached resources | Cache and CacheStorage |
| Background workers | Service-worker registrations |
| Remove selected bookmarks | Separate bookmark operation |

Remove obsolete AppCache, WebSQL and plugin-data options. Exclude history, passwords and downloads from Stage 1 cleanup. Explain sign-outs, locally saved work and related-domain scope before confirmation.

- Freeze the selected targets/categories into a cleanup plan; show the same plan in confirmation and execution.
- Reject empty targets/categories; bookmark-only operations remain valid. Deduplicate targets without losing selected bookmarks.
- For combined cleanup, remove associated bookmarks only after their required data operations succeed. Await child deletion before eligible empty folders.
- Distinguish detected data from **remove if present** capabilities. Successful requests are not proof that every possible trace is gone.
- Loading/refresh: spinner + text + `aria-busy`; retain the previous list during refresh and mark it stale if refresh fails.
- Deleting: spinner + completed-site count, prevent duplicate submission, keep scope fixed. Do not invent percentage progress for opaque API calls.
- Results: persistent summary of completed, failed and unverified operations; retry failed sites/categories only after review (manual selection; no automatic replay). State that site-data deletion is irreversible.
- Separate first-use, permission-denied, empty inventory, no search matches and load-failed states. Preserve selections on errors; expose readable messages rather than raw exceptions.
- Use labeled controls, keyboard navigation, visible focus, native dialog focus behavior and an accessible status region.

## Target structure

```text
extension/                    # TypeScript source + static assets
  manifest.json
  popup.html / popup.ts       # Launch shortcut; rich popup is Stage 2
  background.ts              # Launcher and cleanup job coordination
  app.html / app.ts           # Shared shell and hash navigation
  pages/
    dashboard.ts
    bookmarks.ts
    sites.ts
  components/
    bookmark-tree.ts
    site-timeline.ts
    site-details.ts
    cleanup-dialog.ts
    operation-status.ts
  core/
    inventory.ts             # Data-first enrichment and grouping
    cleanup.ts               # Plan, sequence, collect outcomes
    state.ts                 # Selection/filter state
    types.ts                 # SiteRecord, CleanupPlan, operation results
  browser/
    site-data.ts             # Chrome discovery/deletion and permissions
    history.ts
    bookmarks.ts
  helpers/sites.ts           # URL normalization and scope identity
  styles/tokens.css / app.css
  assets/icons/
tests/*.test.ts
scripts/build.mjs             # Compile and copy allowed static assets
scripts/test.mjs              # Compile tests, run Node's built-in runner
dist/extension/               # Generated Chrome-loadable package; ignored
.test-build/                  # Generated test output; ignored
docs/
package.json / package-lock.json
tsconfig.json / tsconfig.test.json
```

Chrome loads `dist/extension/`, never the TypeScript source directory. Manifest/HTML references and relative module imports use emitted `.js` paths. Keep Node typings scoped to tests; separate DOM and worker compiler contexts when introducing the worker. Preserve necessary vendor assets as JavaScript until the UI replacement.

Components render records and emit actions; they do not call deletion APIs. Browser modules expose meaningful operations rather than wrapping every Chrome method. Core functions accept plain records and injected browser operations so they can be tested without a DOM.

Key contracts: `scanSites()` returns `{sites, coverage, warnings}`; `buildCleanupPlan(selection, options)` returns a fixed plan; `executeCleanup(plan, onProgress)` returns per-target outcomes. Keep cookie values out of persisted application state.

## Implementation order

### 1. TypeScript migration

- [x] Add locked development dependencies: `typescript`, `@types/chrome`, `@types/node`. Keep runtime dependencies empty.
- [x] Convert first-party `code/*.js` to `.ts` in place before moving folders. Type DOM references, Chrome callbacks and operation state; use explicit guards rather than blanket `any` or `@ts-ignore`. Keep third-party Bootstrap JavaScript unchanged, with narrow local declarations where needed.
- [x] Enable `strict`, `noEmitOnError`, ES2022 output and NodeNext module resolution with package `type: module`. Use explicit `.js` relative imports and module script tags; preserve dependency execution order.
- [x] Add `npm run typecheck` and `npm run build`. Build clears stale output, compiles into `dist/extension/`, then copies manifest, HTML, CSS and required local assets. Exclude TypeScript sources, tests and development dependencies from the package.
- [x] Load the compiled package and smoke-test launch, folders and selection. Keep current behavior while identifying existing defects for the architecture step.

**Exit:** the existing app builds from typed sources and runs from generated JavaScript; no page redesign yet.

### 2. File structure

- [x] Move typed `code/` sources to `extension/`; preserve current entry points and Bootstrap assets temporarily.
- [x] Update compiler inputs and asset-copy paths. The loaded package remains `dist/extension/`.
- [x] Verify typecheck/build, manifest/resources, launch and folder rendering in an isolated profile.

**Exit:** the typed app has the new source root with the same working build/load workflow.

### 3. Architecture

- [x] Extract browser adapters, site identity, selection state and cleanup planning from `page.ts`; keep the legacy UI connected until replacement.
- [x] Add typed regression tests compiled into `.test-build/` and executed by Node's built-in runner. Cover duplicate URLs, invalid/empty targets, scheme handling, failure sequencing and folder ordering before fixing those paths.
- [x] Implement capability-aware cookie discovery, partition identity and optional history/bookmark enrichment within the confirmed discovery scope.
- [x] Coordinate jobs outside view components. Store minimal session job metadata; reconcile interrupted jobs as unverified, never automatically repeat destructive operations after worker restart.
- [x] Test with real synthetic browser data, including partition isolation and unrelated-site preservation.

**Exit:** shared, tested operations; honest coverage/results; no new CSS framework.

### 4. UI foundation and pages

- [x] Replace Bootstrap with CSS tokens, native controls and selected local SVGs; remove unused vendor assets while preserving applicable licenses.
- [x] Build dashboard → bookmark workspace → timeline workspace; connect shared metadata, cleanup and feedback components.
- [x] Verify core journeys, dialog validation, narrow-window details/focus return, offline local features and responsive overflow in controlled browser tests.
- [ ] Complete the manual release matrix in `docs/development.md`, including actual permission prompts, minimum Chrome and worker interruption with DevTools closed.
- [ ] Finalize the public name and icon before release. Privacy copy, screenshots, manifest, README and release notes are updated; existing name/icon are retained for review.

**Exit:** all three journeys are implemented and pass controlled Chrome 152 checks. Minimum-version, real permission-prompt, policy and full browser-shutdown checks remain before release. Follow [Running and testing](development.md).

## Deferred

Stage 2: rich toolbar popup, current-site quick cleanup and optional reminders. Real-time previews and screenshots are excluded without a scheduled return. No automatic cleanup based on inactivity.

## Evidence

API behavior: [Chrome browsingData](https://developer.chrome.com/docs/extensions/reference/api/browsingData), [Chrome cookies](https://developer.chrome.com/docs/extensions/reference/api/cookies). Controlled Chrome 152 inventory experiments are documented in Obsidian's **04 - Data Inventory Feasibility Results**, including their coverage limits.
