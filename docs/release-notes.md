# Release notes

## 3.0.0 — October 2026

A rebuilt app with a review step before every deletion.

**New**

- Overview page with live bookmark and cookie-site counts.
- Bookmark rows show the domain, detected cookies and the last time the bookmark was opened or its site visited. A filter lists bookmarks unused for 6 months, 1 year or 2 years, or with no recorded use.
- Site data page lists every site that stored cookies, with search, last-visit ordering and an All / Bookmarked / Not bookmarked filter.
- Two-step cleanup: choose data types (cookies and sign-in data, saved site data, cached resources, background workers) and optional bookmark deletion, then review the exact sites, cookie scope and affected bookmarks before confirming.
- Results report what completed, failed or was kept. Bookmarks are kept when their site-data cleanup fails.
- Edit, copy, move and delete individual bookmarks from the details panel.
- Keyboard, screen-reader and reduced-motion support throughout; a narrow-window layout.

**Changed**

- History access is now optional and only adds last-visit dates; cookie and website access are requested on first use of Site data.
- Cookies are removed by exact identity (domain, name, path, store and partition), never by URL/name matching that could remove neighbouring cookies.
- The toolbar icon opens the app directly instead of a popup.
- New icon.

**Removed**

- Legacy AppCache, WebSQL and plugin-data options, and the Bootstrap stylesheet. The extension now has no runtime dependencies.

Deletion remains permanent; export your bookmarks first if you want a backup. See the [privacy policy](privacy.md) for exactly what the extension reads and stores.

## 2.2

Previous published version: delete browsing data when deleting a bookmark.
