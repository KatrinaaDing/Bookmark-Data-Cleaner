# Browsing and cleanup choices — 19 September 2026

Follow-up to the details refinement, based on five user observations.

## Browsing

The site inventory is discovered through cookies. Its `urls` array contains matching bookmark URLs, not a complete history or list of pages holding data. Sites without matching bookmarks consequently showed an empty Addresses disclosure. Removed this redundant list; the saved URL remains editable in the bookmark form.

Empty folders now say they are empty. Websites with no bookmarks explain how to save one, using Save bookmark rather than Create copy. Editors without a writable destination explain how to create a folder. Existing empty-workspace and no-filter-match messages remain.

Replaced the Edit disclosure with an explicit right-aligned button, with hover feedback, an accessible expanded state and focus into the editor. Closing/reopening retains drafts. Optional history enrichment still defers replacing an open editor.

Browsing entry points now say **Clean up data**. The subsequent category-selection step retains **Review cleanup**, followed by explicit final confirmation.

## Cleanup defaults and preview

Per user request, all available categories start selected. In the bookmark workspace this includes removing selected bookmarks. Additional exact copies remain separate, unchecked additions. Missing cookie access leaves cookies unchecked and disabled; granting access selects cookies. Back retains the user's choices.

The selection dialog reads a preview and displays unique cookie identities, bookmark IDs and conditional folder counts. Storage, cache and workers show unique HTTP/HTTPS origins in scope; these are not detected item counts or bytes. The [Chrome browsingData API](https://developer.chrome.com/docs/extensions/reference/api/browsingData) exposes removal operations, not a cross-site inventory of those items. Zero, unavailable counts and missing access are distinct states.

Preview preparation is read-only. It does not start deletion, select extra duplicates, or become the final plan. Final review prepares a fresh snapshot. Late previews cannot overwrite a newer step or reopen a dismissed dialog.

## Verification

- Typecheck, build and 40 unit tests passed.
- All 11 browser suites passed across the initial run and focused reruns after updating obsolete UI expectations.
- New coverage checks default selection, deduplicated counts, unavailable previews, permission loss, late results after dismissal, empty details, draft retention and long inputs.
- Desktop and narrow screenshots inspected; form bounds also checked at 800px. Evidence is generated in ignored `dist/review/` and `dist/refinement/`.

See the repository history for the focused browsing, cleanup and documentation commits. This refinement does not complete the remaining release compatibility gate.
