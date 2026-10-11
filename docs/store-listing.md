# Chrome Web Store listing — version 3.0.0

Everything below is ready to paste into the developer dashboard. The footer links in `extension/links.ts` point at the repository's `master` branch, so merge before submitting.

## Checklist before upload

- [ ] Merge to `master` so <https://github.com/KatrinaaDing/Bookmark-Data-Cleaner/blob/master/docs/privacy.md> resolves; put that URL in the dashboard's **Privacy policy** field.
- [ ] Rebuild and confirm the footer shows Privacy and Report an issue.
- [ ] `npm run typecheck && npm test && npm run build`, then `CHROME_BIN=… npm run test:browser` on the browser you have, and load `dist/extension/` once in a clean profile.
- [ ] Zip the **contents** of `dist/extension/` so `manifest.json` sits at the archive root.
- [ ] Regenerate assets after any UI change: `CHROME_BIN=… node scripts/store-assets.mjs` writes `images/store/`.

## Name and summary

**Name:** Bookmark Data Cleaner

**Summary (132 chars max):** Choose sites from your bookmarks or stored cookies, review exactly what will be deleted, then clear their data.

## Description

Clean up the websites you no longer use, one site at a time, with a full review before anything is removed.

**Start from bookmarks.** See every bookmark with its domain, detected cookies and the last time you opened it or visited the site. Filter to bookmarks unused for 6 months, 1 year or 2 years, or with no recorded use, and select the ones you are done with.

**Or start from stored cookies.** The Site data page lists every site that left cookies in your browser, bookmarked or not, with the last visit date and a cookie count.

**Review, then confirm.** Choose which data types to clear: cookies and sign-in data, saved site data, cached resources and background workers. Optionally delete the bookmarks too. Step 2 lists the exact sites, cookie scope and bookmarks that will be affected, including other bookmarks that share the same site data, before you confirm.

**Honest results.** After cleanup you see what completed, what failed and what was kept. Bookmarks are never deleted if their site-data cleanup failed.

**Private by design.** Everything runs inside your browser. No network requests, no analytics, no accounts. Cookie and history access are optional and asked for only when you open the features that need them.

Notes:
- Sites are discovered through cookies; sites that stored only other kinds of data may not appear.
- Deletion is permanent and may sign you out of the affected sites.
- Not available in incognito windows.

## Category

Productivity → Tools (or Privacy & Security, whichever the dashboard offers).

## Permission justifications

| Permission | Justification |
|---|---|
| `bookmarks` | Lists bookmarks, matches them to sites, and deletes only the bookmarks the user confirms. |
| `browsingData` | Clears cookies, local/session storage, IndexedDB, cache and service workers for the origins the user confirms. |
| `storage` | Keeps a minimal in-session cleanup job record (progress and outcomes) so results survive closing the app tab. No user data is stored. |
| `cookies` (optional) | Lists sites by their stored cookies and removes exactly the reviewed cookies. Cookie values are never read into extension state. Requested on first use of Site data or cookie cleanup. |
| `history` (optional) | Shows when a site was last visited so users can spot sites they no longer use. Informational only; cleanup works without it. |
| Host permission `http://*/*`, `https://*/*` (optional) | Cookies can belong to any site, so listing and deleting them needs access to all hosts. The extension never loads or contacts any website. Requested together with `cookies`. |

**Single purpose:** selectively delete browser data (and optionally bookmarks) for websites the user chooses.

**Remote code:** none. All scripts are packaged; there are no `eval`, external scripts or network requests.

## Data usage disclosure (dashboard "Privacy practices" tab)

- Collects **Web history**: yes, read locally to show last-visit dates (optional permission). Not transmitted.
- Collects **Website content / cookies**: cookie metadata is read locally to list and delete cookies. Not transmitted.
- Collects personally identifiable information, authentication information, financial information, health information, personal communications, location, user activity: **no**.
- Certifications: data is not sold, not used for purposes unrelated to the single purpose, not used for creditworthiness or lending.

## Assets

| Asset | File | Size |
|---|---|---|
| Store icon | `extension/icons/icon-128.png` | 128×128 |
| Screenshot 1 — overview | `images/store/1-overview.png` | 1280×800 |
| Screenshot 2 — bookmarks with cookies and last use | `images/store/2-bookmarks.png` | 1280×800 |
| Screenshot 3 — review before confirming | `images/store/3-review.png` | 1280×800 |
| Screenshot 4 — site data discovery | `images/store/4-site-data.png` | 1280×800 |
| Small promo tile | `images/store/promo-440x280.png` | 440×280 |
| Marquee promo tile | `images/store/promo-1400x560.png` | 1400×560 |

All screenshots use synthetic bookmarks, cookies and history created in a disposable browser profile. No real browsing data appears in them.

## What changed since the published 2.2

Tell existing users in the "What's new" field; see [release notes](release-notes.md). The `history` permission moved from required to optional, so updating does not trigger a new-permissions warning.
