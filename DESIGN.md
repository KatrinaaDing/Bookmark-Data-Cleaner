# Main app design

Mode: operate. Help users review exact website cleanup scope confidently. The public name and existing icon are retained until a naming decision.

## Visual foundation

The implemented interface uses a pale green-gray canvas (`#f5f6f2`), white surfaces, dark green text (`#203c35`) and green actions (`#24614d`). Destructive confirmation uses red; irreversible-action explanations use a warm amber surface. Tokens live in `extension/styles/tokens.css`.

System sans-serif typography keeps the package offline and small. Base text is 15px/1.55; headings use restrained weight and size contrast. Native inputs, selects, checkboxes and dialogs preserve familiar keyboard behavior. Borders, spacing and a single dialog shadow define regions.

## Composition

- Header: existing icon/name, Overview/Bookmarks/Site data navigation, local-processing label.
- Overview: two requested feature cards and a short privacy/coverage explanation.
- Workspaces: controls and selected count above a primary list, with local metadata alongside.
- Bookmarks: nested collapsible folders, indeterminate checkboxes, selected/total folder counts.
- Sites: compact year/date timeline; undated sites remain in a separate group.
- Cleanup: choice dialog → fixed review → explicit destructive confirmation → persistent category-level results.

Below 720px the workspaces stack. Inspecting a row focuses/reveals its details, with a Back to list button returning to that row. Desktop details remain sticky with their own bounded scroll area. Dashboard cards stack; dates move above site rows.

## Interaction and accessibility

Visible focus outlines, labeled controls, a skip link, native dialog behavior and text-backed status spinners. Reduced-motion settings stop spinner animation. No automatic target-page or favicon requests. URLs are only visited through explicit links that explain the browsing-data consequence.

UI behavior and responsive overflow are checked by `scripts/ui-smoke.mjs`; screenshots are generated under `dist/screenshots/`. An independent visual review found the offscreen-details issue; the final focus/return fix was verified locally after the reviewer hit its usage limit.
