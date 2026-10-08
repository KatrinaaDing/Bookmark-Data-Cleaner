# Privacy policy — Bookmark Data Cleaner

_Last updated: 8 October 2026. Applies to version 3.0.0 and later._

Bookmark Data Cleaner is a browser extension that lets you choose websites, from your bookmarks or from cookies already stored in your browser, and delete the browser data those sites left behind. Everything it does happens inside your browser.

## What the extension reads

| Data | Why | Where it goes |
|---|---|---|
| Bookmarks (titles, URLs, folders, dates) | To list bookmarks, find the sites they point to and, only when you choose it, delete them | Stays in your browser |
| Cookie metadata (domain, name, path, partition) — **optional permission** | To list sites that stored cookies and remove exactly the cookies you review. Cookie **values** are never read into the extension's state | Stays in your browser |
| Browsing history (URL and last-visit time) — **optional permission** | To show when you last visited a site, so you can spot sites you no longer use. Purely informational; cleanup works without it | Stays in your browser |

The extension requests cookie and website access, and history access, only when you open the features that need them. You can decline them, and you can revoke them later from your browser's extension settings. Access to "all websites" is needed because cookies can belong to any site; the extension never loads, visits or contacts those websites.

## What the extension stores

- While a cleanup runs, a minimal job record (job ID, progress and per-item outcomes such as "completed", "failed" or "kept") is kept in the browser's session storage so the app can show results if you close and reopen it. It is cleared when the browser closes.
- The record contains site domains and bookmark titles for the items you confirmed. It never contains cookie values, full cleanup plans or anything from sites you did not select.
- No settings, preferences, bookmarks, cookies or history are copied anywhere else.

## What the extension never does

- It makes **no network requests**. There are no analytics, no crash reporting, no remote configuration, no previews or favicons fetched from websites, and no third-party services.
- It never sends, syncs, sells or shares any data with the developer or anyone else.
- It never deletes anything without showing you the exact list first and asking you to confirm.
- It does not run in incognito windows.
- It does not collect personal information, authentication details, financial or health information, location, or personal communications.

## Deletion is permanent

Cookies, site storage and bookmarks that you confirm for deletion are removed by the browser and cannot be restored by the extension. Clearing a site's cookies may sign you out of that site, and clearing saved site data may discard offline or unsynced work there. Export your bookmarks from your browser's bookmark manager first if you want a backup.

## Changes and contact

If this policy changes, the date above and the extension's release notes will say so. Questions or concerns can be raised through the project's issue tracker linked from the extension's footer and store listing.
