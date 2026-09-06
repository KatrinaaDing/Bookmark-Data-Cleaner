# Running and testing the extension

## Run the current app

1. Use a separate Chrome profile with disposable bookmarks/site data; keep sync off.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select this repository's **`code/`** folder, which contains `manifest.json`.
4. Click the extension toolbar icon. The current popup opens the bookmark manager in a tab.

No npm install, development server or internet connection is required for the packaged UI. Chrome APIs require an installed extension; opening `page.html` as a normal file is insufficient.

After edits, click **Reload** on the extension card, then close/reopen its manager tab. Inspect that tab with DevTools for UI errors; inspect the popup separately when troubleshooting launch behavior. The current manifest has no registered worker, so there is no worker console yet.

## After the TypeScript migration — planned workflow

These commands become available in implementation step 1; they do not exist in the current checkout.

Use Node 24+ and the committed dependency lockfile:

```sh
npm ci
npm run typecheck
npm run build
```

Load **`dist/extension/`** in Chrome. Chrome executes the generated JavaScript, not `.ts` source files. Initial sources remain in `code/`; step 2 moves them to `extension/` without changing the loaded output path.

The build clears stale output, compiles TypeScript and copies allowed static assets. A failed build must not leave a package presented as current. After edits, rebuild, reload the extension, then reopen/refresh its UI. No bundler or development server is required.

TypeScript and type declarations are development tools; they are not shipped. The compiled extension remains usable offline. Initial dependency installation requires network access unless dependencies are already cached.

Once architecture step 3 registers a worker, use its **service worker** inspection link on the extension card. Also test with DevTools closed to expose lifecycle issues.

## Checks available today

From the repository root:

```sh
node --check code/page.js
node --check code/popup.js
node --check code/background.js
python3 -m json.tool code/manifest.json > /dev/null
```

These check syntax only. The current repository has no automated behavioral test suite. Known cleanup bugs are documented in the audit; syntax success does not establish safe deletion.

## Planned automated tests — architecture step 3

Write tests in `tests/*.test.ts`. `tsconfig.test.json` compiles tests and imported application modules into `.test-build/`; Node typings belong to this test configuration. Use Node's built-in test runner, without a test-framework dependency.

```sh
npm run typecheck
npm test
npm run build
```

The test script compiles first and runs the emitted `.test-build/tests/*.test.js` files. Compilation failures fail the command; test output never enters `dist/extension/`. These scripts are planned, not available in the current checkout.

Required cases:

- Two selected bookmarks sharing a URL; deselecting one preserves the other target.
- HTTP/HTTPS parsing, ports and invalid schemes; no empty-origin deletion calls.
- Failed data cleanup cannot trigger dependent bookmark deletion; folders wait for children.
- Missing history preserves data rows; latest visit is aggregated correctly; year/date grouping and equal-date ties are deterministic.
- Permission denial and incomplete scans remain distinct from empty data.
- Cookie partitions and stores remain distinct; retry targets only reviewed failures.
- View changes and worker interruption cannot turn incomplete jobs into success.

## Real-browser acceptance tests

Use controlled local fixture pages/API-created cookies in the separate test profile. Inspect stored values before and after cleanup; a successful callback alone is insufficient.

| Test | Expected result |
|---|---|
| Cookie with no history | Appears in supported inventory; no fabricated visit date |
| Storage-only site | Discovery limitation is documented; no completeness claim |
| Partitioned cookies for two top-level sites | Targeted cleanup preserves the unrelated partition |
| Known origin with IndexedDB | Requested database data removed; control origin remains |
| No host/history permission | Clear explanation and usable allowed functionality |
| Duplicate selection / no selection | Correct target set / deletion disabled |
| API failure or worker interruption | Honest failure/unverified state; no dependent bookmark removal |
| Refresh and deletion | Labeled loading feedback; no duplicate submissions |
| Metadata selection | No target-page navigation or remote preview request |
| Offline, keyboard and narrow window | Local workflows usable; focus and feedback accessible |

Test the three product journeys in [the rebranding plan](rebranding-plan.md). Before release, repeat browser tests on the declared minimum Chrome version and current stable, in a normal window with DevTools closed.

## Package a release

After migration, run `npm ci`, `npm run typecheck`, `npm test` and `npm run build`, then package the contents of `dist/extension/`, with `manifest.json` at the archive root. Exclude TypeScript sources, type declarations, node_modules, tests, documentation, browser profiles, fixture data and unused vendor files. Load the extracted package once more before submitting it to the Web Store.

Reference: [Chrome extension development basics](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world), [Node test runner](https://nodejs.org/api/test.html), [TypeScript module configuration](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html), [Fail builds on type errors](https://www.typescriptlang.org/tsconfig/noEmitOnError.html).
