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
- Details: a shared, right-sliding card, up to 620px wide. It shows visit/cookie/bookmark summaries first; URLs, storage scope and forms expand on demand.
- The card uses a native modal dialog. The background is locked; the card has one scroll surface, with no scrollable panels inside it. Close by button, Escape or backdrop. Focus returns to the source row, including its replacement after a list refresh.

## Motion

Folder expansion: 220ms, with a rotating chevron. Drawer entrance: 240ms; exit: 160ms. Interrupted interactions must settle on the latest state. Reduced-motion preferences remove spatial transitions while retaining clear state changes.

## Validation

`folder-motion-smoke.mjs` checks collapse timing, rapid toggles and reduced motion. `ui-refinement-smoke.mjs` checks the drawer, progressive disclosure, dismissal/focus, save-refresh-focus recovery, stale requests, route cleanup and narrow windows. Captures live in ignored `dist/refinement/`.

This pass was reviewed independently and verified in disposable Edge 152 profiles. No real website previews or remote favicons are loaded.
