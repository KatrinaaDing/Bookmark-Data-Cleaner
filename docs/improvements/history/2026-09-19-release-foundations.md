# Release foundations — 19 September 2026

Implemented the first tranche of the [public-release plan](../plans/2026-09-19-public-release-plan.md) on `codex/public-release-improvements`. R02, R03 and R05 are implemented. R01's reproduced scope defect is corrected and verified on Edge 153; its broader supported-browser release gate remains open. This is not a completed public release.

## Commits and scope

| Commit | Intent |
|---|---|
| `ec2ec95` | Organize historical evaluations and refinement records |
| `7720458` | Preserve current evaluation and synthetic cookie-scope evidence |
| `9954961` | Add the active public-release plan and index |
| `e1d510c` | Make detail cleanup a blue Review cleanup action |
| `c77493d` | Require available choices and deliberate confirmation focus |
| `ab84205` | Clear bookmark selections without dismissing inspection |
| `1b19f13` | Expire reviewed cookie identities without broad URL/name removal |
| `307a29d` | Index bookmark/cookie matching and add reproducible diagnostics |

Model routing followed task complexity: GPT-5.6 Luna handled bounded selection reset, GPT-5.6 Terra handled matching/index equivalence, GPT-6 Astra handled cookie safety, and the primary agent handled review interaction, integration review, browser profiling, and commits. Integration review corrected a test selector, removed redundant cache layers, strengthened fixture identity checks, and excluded browser-generated background cookies from diagnostic comparisons.

## Cookie scope: what changed

The removal adapter now validates the complete selected identity and expires it through `cookies.set`. It retains host-only/domain distinction, name, path, store, secure/HTTP-only attributes, and the complete partition key. It never falls back to `cookies.remove`'s broad URL/name filter.

Preflight validates the entire site's cookie selection before mutation. Already-absent identities are skipped. Unsupported names, paths, domains, incomplete metadata, invalid prefix attributes and indistinguishable identities are refused. This includes raw HTTP cookie paths whose canonicalization could otherwise target a different cookie. Failures remain visible, are not automatically retried, and retain dependent bookmarks. Separately requested origin-data categories can still run under the existing category-level execution contract.

The original host/domain collision and the real scan → new cookie → cleanup race now preserve the unreviewed neighbour. Tests also inject a new identity between preflight and write. Safety comes from the write's identity, not from treating preflight as a lock. Cookie values remain absent from the application inventory.

This contract selects an identity, not a frozen value or generation of a cookie. A replacement at the same identity can be removed; a website can recreate data after the final check. Experimental scheme/port-bound cookie configurations expose metadata missing from the extension API and are outside verified scope. Both corresponding Chromium features were disabled by default in the inspected source, but experimental or field-trial overrides are not certified here.

Sources inspected during implementation:

- [Chrome cookies API](https://developer.chrome.com/docs/extensions/reference/api/cookies)
- [Chromium extension cookie set/remove implementation](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/extensions/api/cookies/cookies_api.cc)
- [Cookie canonicalization and prefix validation](https://chromium.googlesource.com/chromium/src/+/main/net/cookies/canonical_cookie.cc)
- [Equivalent-cookie expiry](https://chromium.googlesource.com/chromium/src/+/main/net/cookies/cookie_monster.cc)
- [Cookie feature defaults](https://chromium.googlesource.com/chromium/src/+/main/net/base/features.cc)

## Interaction changes

Both detail and batch entry points use Review cleanup. The final review heading receives focus, so arriving at review and pressing Enter does not activate deletion. Review is unavailable until an available category is selected. Back retains valid choices; unavailable cookie access clears that inaccessible choice before a new plan is prepared.

Bookmarks now has Clear selection when needed. It clears collapsed descendants and empty-folder selections, resets checked/mixed parent states, disables batch review, and preserves the inspected row/details.

## Inventory performance

Matching now indexes host-only cookies, domain cookies, and partition sites, and evaluates each scheme/host once. Bookmark URLs are parsed once. Candidate order and full cookie-identity deduplication semantics are preserved and checked against the previous matcher. No workers, virtualization or runtime dependencies were added.

`scripts/inventory-benchmark.mjs` compares the original matching algorithm with the new one and asserts equivalent output. Measurements: Node **24.12.0**, V8 **13.6.233.17-node.37**, two warmups, five timed samples, median milliseconds, synthetic fixtures with 5,000 cookies and parent-domain/partition overlaps:

| Bookmarks / host distribution | Baseline | Indexed | Speedup |
|---|---:|---:|---:|
| 1,000 / repeated 80 hosts | 1,683.1 ms | 27.8 ms | 60.6× |
| 5,000 / repeated 80 hosts | 8,184.1 ms | 30.2 ms | 270.8× |
| 1,000 / distinct hosts | 1,558.6 ms | 167.7 ms | 9.3× |
| 5,000 / distinct hosts | 7,966.7 ms | 810.5 ms | 9.8× |

These are same-fixture before/after diagnostics, not predicted user latency. The original evaluation's simpler one-cookie-per-host fixture and single-run timings are not directly comparable with this overlapping-cookie benchmark.

A separate actual-workspace diagnostic on Edge **153.0.0.0**, with immediate synthetic browser API reads, 5,000 bookmarks and 5,000 one-per-host cookies measured:

- Load, inventory and DOM construction: **57.4 ms**.
- Folder expansion through layout and a paint opportunity: **109.9 ms** (not the full animation duration).
- Synchronous first-row inspection: **41.3 ms**.
- All 5,000 rows rendered, the expected detected-cookie count appeared, and the settled layout had no horizontal overflow.

This single browser sample excludes real-profile I/O and is not a CPU trace. It does not justify adding workers or virtualized lists at present. The heavier distinct-host benchmark still takes hundreds of milliseconds; retain diagnostics and revisit only if real collection evidence identifies a problem.

## Verification

- Typecheck and build passed.
- **40 unit tests passed**, including scope refusal, store/partition forwarding, absent targets, write/read failures, and matching equivalence.
- **All 11 browser suites passed** in disposable Edge 153 profiles: permissions, cleanup, cookie scope, cleanup review, storage, UI, folder motion, bookmark mutation, bookmark selection, bookmark management, and UI refinement.
- The cookie suite contains **26 real-browser scope/refusal cases**, including raw HTTP path fixtures, prefix/HTTP-only behavior, domain/host collisions, partition ancestor bits, repeated targets, and injected races.
- Desktop/narrow review captures and the refreshed workspace captures were inspected. The design detector returned no findings for the changed UI targets. These checks do not establish full screen-reader compliance.
- `git diff --check` passed. No personal browser profiles or production site data were intentionally used; destructive assertions and output are limited to synthetic `.test` and loopback fixtures.

One integration attempt initially compared the full disposable cookie store; Edge-generated background cookies appeared asynchronously and caused a false failure. The regression now compares every synthetic fixture identity while excluding unrelated browser-generated cookies before comparison/logging. The subsequent full suite passed.

## Remaining work

Chrome 130/current Chrome validation, real secondary-store coverage where supported, enterprise policies, full shutdown scenarios, and manual accessibility checks remain release work. Incognito remains disabled. R01 is therefore not marked fully release-verified, despite the corrected reproduced defect.

Next implementation work is R04's consequence-first presentation and R06's bookmark search, followed by the remaining discovery, trust, recovery and release tasks in the plan. User research, public publishing and the shipped-results portfolio case study are not complete. No store publishing or outreach occurred.
