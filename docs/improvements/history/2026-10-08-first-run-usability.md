# First-run usability and release packaging — 8 October 2026

The user reviewed a whole-product evaluation and asked for every listed weakness to be fixed before store submission, because a first-time user who finds the app hard to use will not return. The decisions taken with the user: keep bookmark deletion and exact-URL copies default-checked (Step 2 lists them explicitly), leave footer link targets as placeholders to fill before upload, and replace the icon with one in the app's blue.

## What changed

| Commit | Intent |
|---|---|
| `6013622` | Toolbar icon opens the app directly; the forwarding popup and its "Opening cleaner…" flash are gone |
| `bf8a21e` | Blue bookmark icon drawn as SVG and rendered to 16/32/48/128 PNGs (`scripts/render-icons.mjs`); `icons` entry added to the manifest |
| `32ae991` | Step 1 shows counts only for cookies and bookmarks; the three "If present" placeholders are removed |
| `7bec7ad` | Timeline no longer repeats "Date unavailable" under the "No matching history" heading |
| `5309a89` | Programmatically focused step/details headings no longer draw a focus ring |
| `54fe0a3` | Bookmark rows show the domain beside the title, detected cookies and last use (bookmark opened or site visited); a toolbar filter lists bookmarks unused for 6 months / 1 year / 2 years, oldest first, or with no recorded use. Missing dates are never classified as old. Filtered results show "N of M bookmarks", Reset filters, and a hint when history access is off |
| `1e3fb42` | Overview leads with the outcome, shows live bookmark and cookie-site counts, and a footer shows the version plus privacy/issue links once `extension/links.ts` is filled |
| `8d60041` | Site data explains the browser's all-sites prompt before showing it; the optional history button carries the same explanation |
| `15d9aa4` | Browser regression for the unused filter, hidden dates and inline domains |

Store assets are generated from synthetic data by `scripts/store-assets.mjs` into `images/store/`: four 1280×800 screenshots and both promo tiles. The old v2 promo tile and screenshots were removed. [docs/privacy.md](../../privacy.md) and [docs/store-listing.md](../../store-listing.md) hold the policy, listing text, permission justifications and data-usage answers.

## Design notes

- Row signals reuse the existing per-host site records; a bookmark-ID index replaces the previous linear lookup so 5,000-row trees stay cheap.
- The use filter renders the same flat result list as search, so hidden-selection counts, Select all results and Clear selection behave identically. Date filters are disabled while visit dates load.
- The access gate keeps the sentence the permissions regression asserts and adds three plain-language points; nothing about permission handling changed.

## Verification

Typecheck, build, 53 unit tests, `git diff --check` and the complete 17-suite disposable Edge browser runner passed after these changes (see the end of this record). Synthetic captures were inspected for overview, bookmarks, review, site data, the access gate and the promo tiles.

## Still open before upload

- Fill `LINKS.privacy` and `LINKS.issues` in `extension/links.ts`; publish the privacy policy.
- Run the browser suite on current Chrome for Testing (only Edge is installed on this machine); the cookie-scope evidence remains Edge-only.
- Manual release checks in [development.md](../../development.md): real permission prompts, worker interruption with DevTools closed, browser restart.
