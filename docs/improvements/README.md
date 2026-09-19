# Evaluations and improvement history

The current goal is **public adoption first, portfolio value second**, confirmed on 19 September 2026. Prefer reliable selective cleanup, understandable scope, and low ongoing maintenance.

## Start here

- [Latest evaluation — 19 September 2026](evaluations/2026-09-19-extension-evaluation.md): findings, verification, product assessment, and value versus complexity.
- [Active implementation plan](plans/2026-09-19-public-release-plan.md): phased tasks, acceptance criteria, recommendation coverage, and release gates. Branch: `codex/public-release-improvements`.
- [First implementation tranche](history/2026-09-19-release-foundations.md): cookie-scope correction, review safety, selection reset, inventory performance, commits and verified limits.
- [Cookie-scope evidence and reproduction](evidence/2026-09-19/README.md): durable synthetic evidence for the unresolved release blocker.
- [Architecture](../architecture.md) and [development/release checks](../development.md): living implementation documentation.

## Chronology

| Date | Record | Interpretation |
|---|---|---|
| 2026-09-06 | [Stage 1 restructuring/rebranding plan](history/2026-09-06-rebranding-plan.md) | Historical migration and product direction; original unchecked release tasks are not current status |
| Date not recorded | [UI/UX refinement](history/uiux-refinement.md) | Blue/white identity, disclosures, folder motion, and earlier details interaction; some layout descriptions were superseded |
| 2026-09-07 | [UI hierarchy review](history/2026-09-07-ui-hierarchy-review.md) | Typography, inspected-row context, and toolbar refinement; score describes its own baseline |
| 2026-09-12 | [Extension evaluation](evaluations/2026-09-12-extension-evaluation.md) | Assessment of `a4f964e`; not a list of all currently open bugs |
| 2026-09-12 | [Bookmark-details specification](history/2026-09-12-bookmark-details-spec.md) / [implementation plan](history/2026-09-12-bookmark-details-plan.md) | Approved scope for management, details, immutable preparation, and inventory improvements |
| 2026-09-19 | [Current evaluation](evaluations/2026-09-19-extension-evaluation.md) | Reassessment of `ad45d365d2924d1be79848a7ee8ff3730a4afd39`; public growth and portfolio focus |
| 2026-09-19 | [Public-release implementation plan](plans/2026-09-19-public-release-plan.md) | Active work tracker; R02/R03/R05 implemented, R01 corrected on tested Edge with browser compatibility gate remaining |
| 2026-09-19 | [Release foundations](history/2026-09-19-release-foundations.md) | First implementation tranche, focused commits, 40 unit tests and 11 browser suites |
| 2026-09-19 | [Details form and help refinement](history/2026-09-19-details-refinement.md) | Constrained long editor fields and on-demand website-data explanations |

## Interpreting old findings

The latest review observed immutable preparation, truthful unavailable-cookie state, refreshed details, native narrow-window modals, shared-impact review, bookmark metadata, and indexed site-history enrichment. Do not reimplement these solely because an older assessment describes their absence.

The reproduced cookie-scope defect and bookmark-matching scaling problem were addressed in the first implementation tranche; broader browser compatibility remains a release gate. Historical checkbox-contrast concerns still need a current accessibility check; a previous approved scope explicitly retained that appearance. The latest design score is not directly comparable with the older technical audit's different rubric.

## Keeping this folder useful

- `evaluations/`: dated assessments with checkout, evidence, limitations, and priorities. Preserve historical conclusions rather than silently rewriting them as current facts.
- `history/`: completed or superseded refinement records. Add actual implementation outcomes here after work is verified; do not mark planned work complete in advance.
- `plans/`: the active plan and future dated plans. Record completion evidence beside task checkboxes, including any unresolved release checks.
- `evidence/`: compact, synthetic, reproducible findings worth retaining. Never include personal bookmarks, browsing history, real cookie values, or disposable browser profiles.

Update this index when adding a new assessment or closing a refinement phase. Keep architecture and everyday development commands in their existing living documents.
