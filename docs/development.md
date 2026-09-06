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
- `storage-smoke`: known-origin Local Storage, IndexedDB, CacheStorage and workers removed; control origin preserved.
- `folder-motion-smoke`: animated collapse, rapid toggles and reduced-motion expansion.
- `ui-refinement-smoke`: sliding details card, one scroll surface, disclosures, dismissal/focus, focus after saving, stale requests and narrow windows. Captures go to `dist/refinement/`.
- `ui-smoke`: dashboard/routes, folders, indeterminate and duplicate selection, metadata, validation, bookmark-only and site-cookie cleanup, timeline, narrow layouts and offline reload. Screenshots go to ignored `dist/screenshots/`.

Cleanup/storage/UI tests copy the package into their temporary profile and grant optional permissions **in that test copy only** to seed fixtures without browser prompts. The permission test uses the real manifest. These are controlled integration tests, not complete browser compatibility coverage.

## Manual release checks

- Grant and decline real permission prompts; revoke access while the app is open.
- Keyboard-only navigation, dialog focus/return, long/deep trees and narrow-window details/return.
- Verify refreshed results after cleanup, partial failures and retries limited to failed categories.
- Close the app during cleanup; reopen and inspect status. Stop the worker mid-job; verify unverified status and no automatic replay.
- Repeat on minimum supported Chrome and current stable with DevTools closed.

Incognito is disabled. Enterprise policies, other operating systems, the minimum Chrome version, every HTTP-cache/file-system variant and all browser shutdown timings remain release checks.

## Package

Run all checks above, then zip the **contents** of `dist/extension/` with `manifest.json` at archive root. Load the extracted package once before submitting it. The public name/icon still need a branding decision; no store upload is part of this implementation.
