# Main app design

Mode: operate. Preserve the original product name, blue/white identity, native controls and three-page structure. The [shared UI contract](docs/ui-contract.md) defines the component and lifecycle standards behind this implementation.

## Visual foundation

White surfaces, neutral text (`#212529`) and the original blue accent (`#0b5ed7`). Light blue marks inspection/navigation separately from cleanup selection. Final deletion uses a solid red action; form confirmation/cancellation use green/red tinted icon buttons. System fonts and locally authored SVGs keep the extension lightweight and offline.

Use 15px row titles, 14px supporting controls, 13px metadata, 24px details headings and 27–32px page headings. Inherit the root font on body to avoid Chromium extension default sizing. Use shared tokens for semantic colors, control sizes, focus and motion; `components.css` holds common interactive patterns.

## Workspaces

Both workspaces use short descriptions and optional info popovers. Refresh is first on the left, then search and applicable filters. The cleanup action group remains right-aligned with or without selection; narrow windows stack it on a consistent second row.

List-header checkboxes say Select all or Select all results. They select all eligible matching results, including rows below the viewport. Unchecking affects current results only; Clear selection clears all. Totals disclose selections outside the current results.

Bookmark search matches title, full URL and folder path case-insensitively. Results are flat bookmark rows with folder captions; clearing search restores the existing tree and expansion state. Search does not rebuild the entire tree for each keystroke. Managed entries remain protected. Empty-folder selection retains the normal tree semantics.

Folder and site rows remain clickable independently of their padded checkbox targets. Closed folders are inert and hidden from assistive technology. The site timeline retains date groups and a separate unknown-history group.

## Details and bookmark forms

A shared sticky details panel uses a 3:2 list-to-details split on desktop. At 760px and below it becomes a native modal. Resize preserves inspection. Stable row keys restore focus after mutation replaces a row. Unsaved changes are guarded before close, item changes, workspace navigation, refresh or cleanup entry.

Three softly tinted cards show Basic information, Bookmark and Website data. Bookmark details display the full saved URL as a wrapping link. Site-level details accurately label the Domain and show saved-page URLs with their bookmark entries. No separate Open page link is needed; visiting a URL remains an explicit user action.

Edit and copy are adjacent pencil/copy actions with accessible names and tooltips. Each saved bookmark has its own copy action; an unbookmarked site offers Save bookmark. Only one form is active. Both use the shared form session, bottom confirm/cancel icons, validation, pending exclusion and draft reset behavior.

The check button saves directly. Leaving a dirty form offers Save changes / Discard / Keep editing. Saving disables fields and conflicting actions, with a spinner in the submit button. Success reconciles actual state, closes the form and shows a toast. Failure retains the draft and inline error. A successful create followed by failed refresh retries reconciliation without creating another bookmark. Partial update/move failures remain explicit.

Other bookmarks for this URL appears in the Bookmark card and means identical full saved URLs, regardless of folder/title. Website data distinguishes affected pages from bookmark duplication. General help opens on hover, keyboard focus or tap without expanding the layout; Escape dismisses help before underlying dialogs.

## Cleanup review

Step 1 — Choose what to remove groups website data and bookmark removal. Available categories start checked, including bookmark removal in Bookmarks. Cookie and bookmark counts are deduplicated previews; other data says If present, without fabricated item/byte counts. Missing cookie permission stays unchecked and disabled. Next is unavailable when no available category is selected.

Step 2 — Review this cleanup names the selected data categories and target websites, lists bookmark deletions with folder captions, and separates effects on retained pages. Technical details contains cookie domains, partitions, exact origins and discovery limits. Consequences and the irreversible-operation warning stay visible outside that disclosure.

Eligible additional bookmarks for identical URLs start checked in one checklist. Managed duplicates remain unavailable. Explicit deselections survive Back/Next and refreshes, and carry a local website-data warning only when data cleanup is selected. If all copies are selected, review explicitly says none will remain. Site-data-only cleanup does not gain bookmark deletion.

Every scope change invalidates confirmation immediately and prepares a fresh immutable snapshot. Failed preparation has visible retry/back/cancel recovery and cannot authorize an earlier plan. Back clears completed loading feedback while retaining decisions. Step arrival focuses the heading, never Confirm cleanup; final confirmation uses exactly the current reviewed plan. Dependent bookmarks remain when selected data cleanup fails.

## Feedback and motion

Outcome toasts use a shared host that follows the active native modal. Newest messages appear first. Success/info notifications dismiss after a readable interval, paused on hover/focus; errors remain dismissible. Durable cleanup results retain details, failures and unverified work. Background polling does not repeatedly announce the same outcome.

Control feedback is about 120ms; form/disclosure reveals and step transitions use the shared 200ms duration; desktop drawer movement is 240ms. Existing folder expansion remains 220ms. Brief transitions explain state changes rather than animate every list row or job update. New requests cancel old motion; reduced motion removes spatial transitions/continuous rotation and settles active shared animations. Logical state, write completion and draft protection do not depend on animations succeeding.

## Validation

The 20 September implementation passed typecheck/build, 42 unit tests and all 13 browser suites on disposable Edge 153 profiles. Targeted checks after follow-up changes cover guarded save-then-switch navigation, reconciliation-only retries, current-plan confirmation, popovers, new-toast visibility and reduced motion. Desktop/narrow captures use synthetic data under ignored `dist/audit/`, `dist/refinement/`, `dist/review/` and `dist/contract/`.

See the [implementation record](docs/improvements/history/2026-09-20-interaction-system.md) for focused commits, diagnostics and limitations. These checks do not establish complete accessibility compliance or close the existing minimum/current Chrome and enterprise-policy release gates.
