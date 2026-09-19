# Details form and help refinement — 19 September 2026

User screenshots showed overflowing bookmark inputs and folder selectors, plus excessive explanatory text in Website data.

- Constrained editor and label grid tracks with `minmax(0, 1fr)` and bounded native input/select widths. Long titles, addresses and folder options remain inside both edit and create forms.
- Moved general cleanup, exact-copy and shared-data explanations behind an accessible info button beside Website data. Click or keyboard activation toggles inline help; cookie counts and affected items remain visible. Final cleanup review is unchanged.
- Added long-content and keyboard regression coverage to `ui-refinement-smoke.mjs`, covering 1360, 800 and 390px viewports in disposable Edge profiles. Typecheck, build, UI refinement and bookmark-management browser suites passed. Screenshots are generated under ignored `dist/refinement/`.

This is a targeted R04 refinement, not completion of the full public-release plan or browser compatibility gate.
