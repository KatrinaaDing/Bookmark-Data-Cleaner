# Main app design

Mode: operate. Keep the interface clean, familiar and easy to scan. Preserve the three-page structure and the original product name/icon.

## Visual foundation

White surfaces, neutral text (`#212529`) and the original blue accent (`#0b5ed7`). Light blue marks active navigation; red is reserved for destructive confirmation. System fonts and locally authored SVG icons keep the extension lightweight and offline.

Use short page instructions. Refresh, clear selection and other familiar secondary actions may use icons with accessible names and hover titles. Keep important actions such as reviewing and confirming cleanup labeled in text. Put explanatory material behind disclosures, while keeping deletion consequences and exact scope visible at confirmation.

## Layout and interaction

- Overview: two feature cards and a brief local-processing note.
- Workspaces: a full-width list with compact controls. The page owns scrolling.
- Bookmark folders: nested selection and animated expansion/collapse. Closed folders are inert and hidden from assistive technology.
- Site timeline: compact date groups; missing history stays separate.
- Details: a shared, right-sliding section that uses a 3:2 list-to-details split. Three softly tinted cards show Basic information, Bookmark and Website data. Bookmark editing opens from a right-aligned Edit button; create forms expand on demand. Basic information omits the redundant bookmark address list.
- The desktop list shrinks as the sticky, viewport-constrained section opens and remains interactive. At 760px and below, details becomes a native modal with its own scrolling. Close by button or Escape. Focus returns to the source row, including its replacement after a list refresh.

## Motion

Folder expansion: 220ms, with a rotating chevron. All native disclosures animate in both directions (220ms). Details entrance and exit: 240ms on desktop. Resizing preserves the inspected item while switching modes. Interrupted interactions must settle on the latest state. Reduced-motion preferences remove spatial transitions while retaining clear state changes.

## Validation

`folder-motion-smoke.mjs` checks collapse timing, rapid toggles and reduced motion. `bookmark-management-smoke.mjs` checks editing/moving identity, direct reviewed cleanup, duplicate opt-in, selection isolation, sticky details, native modal resizing and focus. `ui-refinement-smoke.mjs` retains motion, disclosure, dismissal/focus, stale request, route and narrow-window coverage. Captures live in ignored `dist/audit/` and `dist/refinement/`.

The original refinement was independently reviewed. Follow-up interactions are checked in disposable Edge profiles. No real website previews or remote favicons are loaded.

Entire bookmark, folder and site rows are clickable, with independent padded checkbox targets. Hover surfaces have inset spacing; unchecked checkboxes use a lighter neutral border, with native rendering retained in forced colors.

## Typography and visual hierarchy

Explicitly inherit the root font on `body`: Chromium extension defaults otherwise shrink task labels. Use 15px row titles, 14px supporting controls, 13px metadata, 24px details headings and 27–32px page headings. Folder labels are semibold; row labels are medium. Keep the existing system fonts and blue accent.

The inspected row uses a quiet blue tint and `aria-current`, separate from cleanup checkboxes. Preserve this context after list refreshes. Details places close beside its heading and uses one divider between summary values and expandable sections. Site filters and cleanup selection actions form separate toolbar groups; clear selection appears only when applicable.

Cleanup review lists actual selected bookmark paths and category-specific related effects. Exact URL copies are unchecked additions; changing one prepares a fresh immutable snapshot before confirmation. Bookmark-only cleanup omits website-data warnings. Both detail and batch entry points say Clean up data and use blue; Review cleanup appears after choosing categories, and only final confirmation is red. Available categories start checked, including selected-bookmark removal in the bookmark workspace. Review is disabled when no available category is selected. Cookie and bookmark counts are deduplicated previews; storage, cache and workers show origins in scope rather than invented item or byte counts. Missing cookie access is unchecked and disabled. The review heading receives focus so arriving or pressing Enter does not immediately activate deletion.

Both workspaces offer Clear selection only while a selection exists. Bookmark clearing includes collapsed descendants and empty folders, resets mixed parent checkboxes, and preserves the inspected row/details independently.

Create disclosures use thin animated chevrons and aligned content. Bookmark Edit buttons have hover and keyboard focus feedback; toggling an editor preserves its draft. Empty folders and unsaved websites explain their empty state. The close control stays visually quiet. The Open page action is explicit because visiting a page can create browsing data.

Bookmark editor grid tracks and native controls shrink within the details card, including long folder options. Website data puts general cleanup and shared-data explanations behind the info button beside its heading; the button exposes its expanded state to assistive technology. Affected items stay visible, and final cleanup review retains its scope warnings.
