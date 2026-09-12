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

Direct detail cleanup passes its own target IDs into the same preparation boundary, independent of batch selection. Cleanup choices are copied once per preparation. Exact-URL copies are optional explicit additions; every change rebuilds the reviewed snapshot from fresh browser reads. Data-only site plans carry contextual bookmarks only as impact information, not deletion targets.

Results are per site/category and bookmark/folder. Review failures and explicitly select a new cleanup; there is no automatic retry. Partial cookie cleanup is re-inventoried so already absent cookies are not newly selected.

## Data model and boundaries

- Cookie discovery is the primary source. Retained history (up to 10,000 recent entries) and bookmarks enrich those rows.
- Ordinary cookies group by cookie domain; partitioned cookies group by top-level site. Names, paths, stores and full partition keys preserve identity. Cookie **values** are discarded immediately.
- Bookmark cleanup also includes parent-domain cookies and relevant parent-site partitions. Confirmation shows these broader scopes before removal.
- Cookie deletion uses exact reviewed cookie identities via `cookies.remove`, not registrable-domain-wide `browsingData` cookie removal. New cookies created after review are not promised removed.
- Other cleanup uses `browsingData.remove` for listed HTTP/HTTPS origins. Those include known URLs/ports and default HTTP/HTTPS origins inferred from hosts. Unknown ports/storage-only sites are not discovered.
- Last visit means the latest available matching retained history entry. Missing history is separate, never treated as old data. Counts are detected cookies, not total stored data or bytes.

## Permissions and lifecycle

Required: bookmarks, browsingData and storage. Cookie/site access and history are requested separately when used. Incognito is disabled. The launcher finds its own tab through [runtime.getContexts](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-getContexts), avoiding a tabs permission.

Minimal job status/results live in `storage.session`; full plans and cookie values are not persisted. A restarted worker changes a saved running job to **unverified** and never resumes destructive work automatically. Browser-session storage does not survive a full browser restart. An API timeout/interruption cannot prove which internal browser work completed.

All assets are packaged locally. Metadata inspection performs no target-page requests. Explicitly opening a known URL visits the site and can create browsing data. Bookmark sync follows the user's browser configuration.

## Details and motion

Both workspaces share one details controller. Desktop uses a sticky, viewport-constrained modeless dialog beside the interactive list; narrow windows use the same native dialog modally. Resize switches modes without losing the inspected key, and cleanup confirmation can open above it. Request generations ignore results after dismissal or replacement. Stable row keys restore focus even when bookmark mutation rebuilds the list; cross-workspace invalidation refreshes the other mounted page on its next visit. Folder expansion uses CSS grid transitions and makes collapsed descendants inert. Reduced-motion preferences disable spatial transitions.
