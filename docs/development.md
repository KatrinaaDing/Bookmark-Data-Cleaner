# Running and testing

## Run locally

Use Node 24+ and a current desktop Edge or Chrome. The Chrome API baseline is 130; automated coverage includes Edge 152 and Chrome for Testing 152 on macOS arm64.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

1. Use a separate browser profile with disposable bookmarks and data; keep sync off.
2. Open `edge://extensions` (Edge) or `chrome://extensions` (Chrome), enable **Developer mode**, select **Load unpacked**.
3. Select **`dist/extension/`**, then click the extension toolbar icon.
4. Allow cookie/site access in Site data when needed. Visit dates request history separately.

After edits: rebuild, reload the extension card, then reload/reopen its app tab. Inspect the app with DevTools; inspect **service worker** on the extension card for background jobs. Also test with DevTools closed.

Chrome executes generated JavaScript. Do not load `extension/` directly or open `app.html` as a normal file. No development server, bundler or internet access is needed to use the built UI; initial dependency installation needs network access or a populated npm cache.

## Automated tests

`npm test` compiles `tests/*.test.ts` and imported modules into `.test-build/`, then uses Node's built-in test runner. It covers origin validation, duplicate selections, data-first inventory, partition identity, partial failures, bookmark/folder sequencing and interrupted job handling.

`npm run typecheck` checks the DOM and service-worker contexts separately. `npm run build` removes stale output, compiles both and copies allowed static assets. Failure removes the generated extension directory. Test output and development dependencies are never packaged.

## Real-browser tests

Install a compatible [Chrome for Testing](https://googlechromelabs.github.io/chrome-for-testing/) binary, then set its absolute executable path:

```sh
export CHROME_BIN='/absolute/path/to/Google Chrome for Testing'
npm run build
npm run test:browser
```

Each script creates and removes a fresh temporary profile. Never point these scripts at your normal profile. The harness requires unpacked-extension debugging support. It also works with the tested Edge 152 executable; set `CHROME_BIN='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'` on macOS.

- `permissions-smoke`: unmodified manifest, optional access gate, single app tab.
- `cleanup-smoke`: selected partition removed; another partition and unrelated cookies preserved; no cookie values in inventory state.
- `cookie-scope-smoke`: exact identity expiry, same-name domain/path neighbours, review/preflight races, partition ancestor bits, absent targets, prefixes and safely refused noncanonical HTTP cookie paths. Assertions inspect synthetic `.test`/loopback fixtures only, excluding browser-generated background cookies.
- `cleanup-review-smoke`: empty-choice gating, frozen preparation, heading focus, Enter safety, Back without stale spinners, permission loss, visible re-preparation errors, stale-plan blocking and Escape.
- `storage-smoke`: known-origin Local Storage, IndexedDB, CacheStorage and workers removed; control origin preserved.
- `folder-motion-smoke`: animated collapse, rapid toggles and reduced-motion expansion.
- `bookmark-mutation-smoke`: browser-backed bookmark create, update, move, delete and folder validation.
- `bookmark-selection-smoke`: clearing collapsed descendants, empty folders and mixed states without losing details inspection.
- `bookmark-management-smoke`: ID-preserving edit/move, cross-route refresh, isolated direct cleanup, default-selected duplicates, persistent deselection and actual retention/deletion, sticky desktop details, native narrow modal, resize/focus and unavailable-cookie copy. Audit captures go to `dist/audit/`.
- `ui-refinement-smoke`: sliding details, the three detail sections, editor disclosure, dismissal/focus, stale requests, reduced motion and narrow modal behavior. Captures go to `dist/refinement/`.
- `ui-contract-smoke`: shared edit/copy lifecycle, save/discard/stay navigation, refreshed DOM ownership, double-submit exclusion, failed-write drafts, reconciliation-only retry after successful create, modal toast visibility/order and reduced-motion forms. Synthetic captures go to `dist/contract/`.
- `bookmark-search-smoke`: title/URL/folder search, no results, hidden selections, filtered select/unselect, clear-all and stable cleanup placement.
- `cleanup-ux-smoke`: A/B selection with C inspection in both workspaces, cancellation, hidden selections, cached-tree inspection restoration, entry context, retained bookmark effects, keyboard disclosures, native narrow modal, duplicate decisions, actual deletion reconciliation, and failed/unverified result wording. Synthetic before/after captures go to `dist/cleanup-ux/`; `--capture-before` is for audit capture against the baseline build.
- `affected-cleanup-smoke`: explicit related-bookmark deletion, unchanged reviewed origins/cookies, actual deletion and unrelated-cookie retention, Back/Next decisions, managed protection and failed-rebuild gating. It also checks busy tree/search rows, the details overlay, closing details during cleanup, data-only bookmark restoration, and progress/completion toasts. Long-title desktop/narrow, overlay and toast captures go to `dist/affected-cleanup/`.
- `site-discovery-smoke`: All/Bookmarked/Not bookmarked filters, combined search, hidden-selection review scope, reset/focus, navigation retention and narrow layouts.
- `results-smoke`: outcome units, explicit retention versus legacy uncertainty, interrupted/empty-folder jobs, compact completion, dismissal/focus and narrow layouts. Both scripts capture synthetic screens under `dist/product-ux/`; `--capture-before` captures the baseline build.
- `ui-smoke`: dashboard/routes, folders, indeterminate and duplicate selection, metadata, validation, bookmark-only and site-cookie cleanup, timeline, narrow layouts and offline reload. Screenshots go to ignored `dist/screenshots/`.

Cleanup/storage/UI tests copy the package into their temporary profile and grant optional permissions **in that test copy only** to seed fixtures without browser prompts. The permission test uses the real manifest. These are controlled integration tests, not complete browser compatibility coverage.

## Inventory diagnostics

`node scripts/inventory-benchmark.mjs` compares the original matching algorithm with the indexed implementation using synthetic repeated/distinct-host fixtures, two warmups and five timed samples. It checks equivalent results and compiles into an automatically removed temporary directory. It is intentionally outside the unit suite; timings are diagnostic, not flaky assertions.

After building, run `CHROME_BIN='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' node scripts/inventory-browser-profile.mjs` to exercise the actual bookmark workspace with 5,000 synthetic bookmarks and cookies. This uses immediate mocked browser reads in a disposable extension page, measures load/DOM creation, interaction and matching/full-result search, and checks row count/inspection/settled overflow. It does not measure real-profile I/O, produce a CPU trace, or predict every machine's latency.

See the [improvement history](improvements/README.md) for dated results and remaining release checks.

## Manual release checks

- Grant and decline real permission prompts; revoke access while the app is open.
- Keyboard-only navigation, dialog focus/return, long/deep trees and narrow-window details/return.
- Verify refreshed results after cleanup, partial failures and retries limited to failed categories.
- Close the app during cleanup; reopen and inspect status. Stop the worker mid-job; verify unverified status and no automatic replay.
- Repeat on minimum supported Chrome and current stable with DevTools closed.

Incognito is disabled. Enterprise policies, other operating systems, the minimum Chrome version, every HTTP-cache/file-system variant and all browser shutdown timings remain release checks.

## Package

Run all checks above, then zip the **contents** of `dist/extension/` with `manifest.json` at archive root. Load the extracted package once before submitting it. The public name/icon still need a branding decision; no store upload is part of this implementation.
