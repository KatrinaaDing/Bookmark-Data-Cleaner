# Main app design

Mode: operate. Preserve the original product name, blue/white identity, native controls and three-page structure. The [shared UI contract](docs/ui-contract.md) defines the component and lifecycle standards behind this implementation.

## Visual foundation

White surfaces, neutral text (`#212529`) and the original blue accent (`#0b5ed7`). Light blue marks inspection/navigation separately from cleanup selection. Final deletion uses a solid red action; form confirmation/cancellation use green/red tinted icon buttons. System fonts and locally authored SVGs keep the extension lightweight and offline.

Use 15px row titles, 14px supporting controls, 13px metadata, 24px details headings and 27–32px page headings. Inherit the root font on body to avoid Chromium extension default sizing. Use shared tokens for semantic colors, control sizes, focus and motion; `components.css` holds common interactive patterns.

Detail section headings use blue at medium weight; detail bookmark titles use medium-weight neutral text. In the bookmark list and search results, individual bookmark titles use regular weight (400), while folder titles use bold (700). Subheadings, dates, folder paths and URLs are quieter. Reserve semibold for page/detail titles rather than every line of content.

## Workspaces

Both workspaces use short descriptions and optional info popovers. Help icons are small, neutral and focusable; their light popovers open on hover or focus without button styling. Refresh is first on the left, then search and applicable filters. The cleanup action group remains right-aligned with or without selection; narrow windows stack it on a consistent second row. `Clean up selected…` sits beside the count, including zero, and remains disabled without a selection. Details use a primary broom button labelled `Clean up`, with the accessible name `Clean up this bookmark…` or `Clean up this site…`; both enter review.

List-header checkboxes say Select all or Select all results. They select all eligible matching results, including rows below the viewport. Unchecking affects current results only; Clear selection clears all. Totals disclose selections outside the current results.

Bookmark search matches title, full URL and folder path case-insensitively. Results are flat bookmark rows with folder captions; clearing search restores the existing tree and expansion state. Search does not rebuild the entire tree for each keystroke. Managed entries remain protected. Empty-folder selection retains the normal tree semantics.

Folder and site rows remain clickable independently of their padded checkbox targets. Closed folders are inert and hidden from assistive technology. The site timeline retains date groups and a separate unknown-history group. A native All sites / Bookmarked / Not bookmarked filter combines with search and date ordering. Result counts report matching versus detected sites; Reset filters clears search and bookmark status without clearing selection or changing sort order.

Row titles open details and never acquire link underlines on hover. Site rows place a cookie icon/count at the right, with a descriptive accessible name and tooltip. An unavailable count shows a dash rather than zero.

## Details and bookmark forms

A shared sticky details panel uses a 3:2 list-to-details split on desktop. At 760px and below it becomes a native modal. Resize preserves inspection. Stable row keys restore focus after mutation replaces a row. Unsaved changes are guarded before close, item changes, workspace navigation, refresh or cleanup entry.

While a job is running, initiating bookmarks and reviewed bookmark removals show a muted row with a trailing spinner in both the tree and search results. If one is inspected, the existing details panel covers its content with a centered progress state while keeping Close details available. Cleanup entry actions in both workspaces are disabled until the job settles. A data-only bookmark returns to its normal row and details state after completion; deletion results are reconciled from the browser instead of inferred from the spinner.

Bookmark details use Bookmark and Website data sections. Identity, saved URL, folder context and edit/copy controls stay together; the URL and dates use the same right-aligned label/value rows. Bookmark last opened and website last visited are always visible in basic information. Website data starts with the shared-data consequence as a caption, then the detected cookie count and a note that other data cannot be counted. Related pages are a spaced subsection; exact-URL copies remain visible there. Both bookmark and site details put the primary broom Clean up button in the Website data header. Site-level details combine cookie context, cleanup and saved-bookmark actions. Bookmarks are listed once by ID; additional pages sharing cookies/origins remain visible. A visible explanation states that site-data cleanup keeps bookmarks saved. Site-level details accurately label the Domain and show saved-page URLs with their bookmark entries. No separate Open page link is needed; visiting a URL remains an explicit user action.

Edit and copy are adjacent pencil/copy actions with accessible names and tooltips. Each saved bookmark has its own copy action; an unbookmarked site offers Save bookmark. Only one form is active. Both use the shared form session, bottom confirm/cancel icons, validation, pending exclusion and draft reset behavior.

The check button saves directly. Leaving a dirty form offers Save changes / Discard / Keep editing. Saving disables fields and conflicting actions, with a spinner in the submit button. Success reconciles actual state, closes the form and shows a toast. Failure retains the draft and inline error. A successful create followed by failed refresh retries reconciliation without creating another bookmark. Partial update/move failures remain explicit.

The exact-URL copy disclosure means identical full saved URLs, regardless of folder/title. Related-page lists use counted disclosure summaries, and site details disclose saved-page lists longer than three entries. Related entries use linked titles and folder paths rather than separate full URLs; editing actions in saved-page lists remain available when expanded, without another scrolling region. Website data distinguishes affected pages from bookmark duplication. General help opens on hover, keyboard focus or touch without expanding the layout; Escape dismisses help before underlying dialogs.

## Cleanup review

Step 1 — Choose what to remove groups website data and bookmark removal. Available categories start checked, including bookmark removal in Bookmarks. Cookie and bookmark counts are deduplicated previews; other data says If present because the browser does not provide presence or item counts for those categories. Missing cookie permission stays unchecked and disabled. Next is unavailable when no available category is selected.

Both review steps carry the initiating bookmark title and folder path, site domain, or bulk object counts. Step 1 puts category help in an info popover beside Website data and separates its preview note from the checkbox groups. The content is the dialog's single scrolling region; a separate footer keeps Back/Cancel/Next or Confirm visible. Step 2 keeps the irreversible warning beside its final action. Review bookmark entries and copies use linked titles and folder paths. Full URLs are available through their links. Duplicate-triggered review rebuilds retain disclosure state, reading position and checkbox focus. Step 2 — Review this cleanup names the selected data categories and target websites, lists bookmark deletions with folder captions, and separates effects on retained bookmarks, including the initiating bookmarks when removal is off and explicitly unchecked copies. Counted disclosures reduce long retained lists. Copy and affected-bookmark choices show selected counts; the fixed footer reports the total bookmarks to delete. Technical details sits inside Website data to clear, gains a light background when expanded, and contains cookie domains, partitions, exact origins and discovery limits. Consequences and the irreversible-operation warning stay visible outside that disclosure.

Eligible additional bookmarks for identical URLs start checked in one checklist. Managed duplicates remain unavailable. Explicit deselections survive Back/Next and refreshes, and carry a local website-data warning only when data cleanup is selected. If all copies are selected, review explicitly says none will remain. Other affected bookmarks offer unchecked, explicit deletion choices when bookmark removal is enabled. These choices never expand the website-data scope. Site-data-only cleanup does not gain bookmark deletion.

Every scope change invalidates confirmation immediately and prepares a fresh immutable snapshot. Failed preparation has visible retry/back/cancel recovery and cannot authorize an earlier plan. Back clears completed loading feedback while retaining decisions. Step arrival focuses the heading, never Confirm cleanup; final confirmation uses exactly the current reviewed plan. Dependent bookmarks remain when any of their selected data cleanup targets fails; shared bookmarks wait for every dependency before deletion.

## Feedback and motion

Outcome toasts use a shared host that follows the active native modal. Workspace toasts sit at the bottom-right; review-dialog toasts stay at the top-right to keep confirmation controls clear. Newest messages appear first. A cleanup job shows a persistent spinner toast while running, including after the review dialog closes; completion replaces it with a persistent, dismissible results toast at the current scroll position instead of a report above the workspace. While running, the progress panel retains durable status when the user scrolls back to it. Other success/info notifications dismiss after a readable interval, paused on hover/focus; errors remain dismissible. Cleanup results in the toast use a compact header and explicit units for completed data requests, removed bookmarks/folders, known-kept bookmarks, failures and uncertain outcomes. Items needing review expand by default after completion; completed operation details remain collapsed. A single close icon dismisses results and returns focus to the workspace container. Known retention requires explicit execution evidence; older ambiguous results remain uncertain. Background polling does not repeatedly announce the same outcome.

Control feedback is about 120ms; form/disclosure reveals and step transitions use the shared 200ms duration; desktop drawer movement is 240ms. Existing folder expansion remains 220ms. Brief transitions explain state changes rather than animate every list row or job update. New requests cancel old motion; reduced motion removes spatial transitions/continuous rotation and settles active shared animations. Logical state, write completion and draft protection do not depend on animations succeeding.

## Validation

The 20 September implementation passed typecheck/build, 42 unit tests and all 13 browser suites on disposable Edge 153 profiles. Targeted checks after follow-up changes cover guarded save-then-switch navigation, reconciliation-only retries, current-plan confirmation, popovers, new-toast visibility and reduced motion. Desktop/narrow captures use synthetic data under ignored `dist/audit/`, `dist/refinement/`, `dist/review/` and `dist/contract/`.

See the [implementation record](docs/improvements/history/2026-09-20-interaction-system.md) for focused commits, diagnostics and limitations. These checks do not establish complete accessibility compliance or close the existing minimum/current Chrome and enterprise-policy release gates.

The 26 September scope/hierarchy refinement passed typecheck/build, 42 unit tests and all 14 browser suites on disposable Edge 154 profiles. See [audit and verification](docs/improvements/history/2026-09-26-cleanup-ux.md), including before/after synthetic captures and unchanged defaults.

The follow-up discovery/results pass passed typecheck/build, 42 unit tests and five focused browser suites. See [product refinement evidence](docs/improvements/history/2026-09-26-discovery-results-ux.md).

A further details/review pass grouped identity actions, kept review controls visible and fixed responsive details transitions stealing focus from an open review. See [details/review evidence](docs/improvements/history/2026-09-26-details-review-ux.md).
