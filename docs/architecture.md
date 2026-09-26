# Architecture

A small TypeScript extension compiled to native ES modules. No runtime packages, UI framework or bundler.

| Layer | Responsibility |
|---|---|
| `app.ts`, `pages/` | Hash routes, retained workspace state, user journeys |
| `components/` | Native controls, tree/timeline, details, confirmation and results |
| `core/` | Plain-record inventory, selection, fixed cleanup plans, sequencing and jobs |
| `browser/` | Permissions and meaningful Chrome read/delete operations |
| `helpers/` | Origin/domain parsing, cookie identities and error messages |
| `background.ts` | Single-tab launcher and cleanup coordinator |

Views prepare a plan; the native dialog displays its exact targets/categories. The worker validates and snapshots it again, allows one active job, executes each data category and keeps dependent bookmarks if any category fails. Empty folders are removed deepest-first, using `bookmarks.remove` only after checking their current contents. Nothing calls `removeTree`.

Direct detail cleanup passes its own target IDs into the same preparation boundary, independent of batch selection. Cleanup choices are copied once per preparation. Eligible exact-URL copies are visible default-selected additions in bookmark cleanup. Explicit deselections persist, and every change rebuilds the reviewed snapshot from fresh browser reads. Managed copies remain unselectable. A failed rebuild invalidates confirmation rather than falling back to the previous plan. Data-only site plans carry contextual bookmarks only as impact information, not deletion targets.

Results are per site/category and bookmark/folder. Review failures and explicitly select a new cleanup; there is no automatic retry. Partial cookie cleanup is re-inventoried so already absent cookies are not newly selected.

## Data model and boundaries

- Cookie discovery is the primary source. Retained history (up to 10,000 recent entries) and bookmarks enrich those rows.
- Ordinary cookies group by cookie domain; partitioned cookies group by top-level site. Names, paths, stores and full partition keys preserve identity. Cookie **values** are discarded immediately.
- Bookmark cleanup also includes parent-domain cookies and relevant parent-site partitions. Confirmation shows these broader scopes before removal.
- Cookie deletion validates identity metadata, then expires the selected domain/host-only, name, path, store and full partition identity through `cookies.set`. It never falls back to URL/name `cookies.remove`, which can remove unselected neighbours. HTTP-only metadata is retained for prefix validation; cookie values remain excluded from inventory.
- Unsupported or noncanonical names/paths/domains, incomplete metadata and invalid prefix/partition attributes are refused before the site's cookie request mutates anything. Already-absent identities are skipped. A failed cookie category keeps dependent bookmarks; separately selected data categories can still complete under the existing per-category execution contract.
- This is an identity selection, not a frozen cookie-value snapshot. A replacement at the same identity can be removed, and a website can recreate data after verification. Standard Edge 153 scope regressions pass; minimum/current Chrome compatibility remains a release gate. Experimental scheme/port-bound cookie configurations expose metadata the extension API does not provide and are outside the verified scope.
- Other cleanup uses `browsingData.remove` for listed HTTP/HTTPS origins. Those include known URLs/ports and default HTTP/HTTPS origins inferred from hosts. Unknown ports/storage-only sites are not discovered.
- Last visit means the latest available matching retained history entry. Missing history is separate, never treated as old data. Counts are detected cookies, not total stored data or bytes.

## Permissions and lifecycle

Required: bookmarks, browsingData and storage. Cookie/site access and history are requested separately when used. Incognito is disabled. The launcher finds its own tab through [runtime.getContexts](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-getContexts), avoiding a tabs permission.

Bookmark outcomes optionally include a readable label (title, or URL for untitled bookmarks) and an explicit `retained` flag only when deletion was skipped after required data cleanup failed. Existing outcome statuses and execution order are unchanged; old results without the flag remain uncertain in the UI. These labels are part of the local session result record.

Minimal job status/results live in `storage.session`; full plans and cookie values are not persisted. A restarted worker changes a saved running job to **unverified** and never resumes destructive work automatically. Browser-session storage does not survive a full browser restart. An API timeout/interruption cannot prove which internal browser work completed.

All assets are packaged locally. Metadata inspection performs no target-page requests. Explicitly opening a known URL visits the site and can create browsing data. Bookmark sync follows the user's browser configuration.

## Details and motion

Both workspaces share one details controller. Desktop uses a sticky, viewport-constrained modeless dialog beside the interactive list; narrow windows use the same native dialog modally. Resize switches modes without losing the inspected key, and cleanup confirmation can open above it. Request generations ignore results after dismissal or replacement. Stable row keys restore focus even when bookmark mutation rebuilds the list; cross-workspace invalidation refreshes the other mounted page on its next visit. Folder expansion uses CSS grid transitions and makes collapsed descendants inert. Reduced-motion preferences disable spatial transitions.


## Shared UI ownership

The [UI contract](ui-contract.md) separates shared rendering/lifecycles from browser and cleanup semantics. Existing component and token directories remain the implementation home; no framework or runtime package was introduced.

- `action-button`, `workspace-controls` and `bookmark-summary` share action states, toolbar/selection presentation and title/folder rows.
- `form-session` owns baseline/draft comparison, submission exclusion, the one active form and save/discard/stay exits. `bookmark-editor` adapts that lifecycle to actual browser mutations. A committed write is remembered during reconciliation failures, so retrying refresh cannot replay create.
- `async-state` separates pending-write exclusion from latest-read invalidation. Cleanup owns its options/duplicate decisions and reviewed snapshot; presentation never grants deletion authority.
- `feedback` owns toast lifetime/modal placement and accessible info popovers. `permission-action` shares request/loading/outcome behavior while callers own permission-specific inventory changes.
- `motion` owns cancellation, shared duration lookup and reduced-motion settlement. DOM disclosure, details and form controllers retain logical state and disposal responsibilities.

Route, refresh and inspection transitions await the active form's leave decision. When save replaces DOM owners, continuation resolves stable row/editor keys against the new view. Optional enrichment waits while a form is active. Search preserves the tree and its expansion state, and shared set-based selection calculations expose hidden selections without altering deletion scope.
