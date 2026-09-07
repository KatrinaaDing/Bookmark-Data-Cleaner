# UI hierarchy review — 2026-09-07

Method: dual-agent (A: hierarchy_review · B: ui_evidence). A reviewed design independently; B measured the live interface and ran the detector. Both used disposable Edge profiles.

The blue/white identity, folder tree, data timeline and progressive disclosure fit the product. The main weakness was typography and contextual emphasis, rather than excess content.

## Baseline assessment

Scores describe the interface before this pass, not a fresh score of the finished changes.

| Heuristic | Score / 4 | Finding |
| --- | --- | --- |
| System status | 3 | Loading/results exist; inspected row lacked state |
| Real-world language | 3 | Clear verbs; some technical details |
| User control | 3 | Independent selection and explicit review |
| Consistency | 2 | Font inheritance inverted the type hierarchy |
| Error prevention | 3 | Exact scope and confirmation retained |
| Recognition | 2 | No row-to-details indication |
| Efficiency | 3 | Bulk selection and interactive split view |
| Minimalist design | 2 | Tiny task text and repetitive rules |
| Error recovery | 3 | Actionable scoped feedback |
| Help/documentation | 3 | Contextual disclosures |
| **Total** | **27 / 40** | **Sound foundation; hierarchy needed correction** |

Cognitive load: three weaknesses — title/metadata hierarchy, remembering the inspected row, and seven ungrouped toolbar controls. Low-vision users faced tiny task text; frequent users lacked inspection context; newcomers had to distinguish row inspection from cleanup selection.

Strengths: deliberate cleanup review, local metadata, restrained palette and interactive split view. The emotional journey is calm entry, uncertainty when a row lacks visible state, then reassurance from explicit scope and confirmation.

## Priorities addressed

1. **P1 · Typography:** Edge rendered row/folder labels at 11.25px despite a 15px root font; metadata was 11.7px and page headings approached 40px. Explicit body inheritance and shared type roles now establish 15px row titles, 13px metadata and 27–32px page headings.
2. **P2 · Inspection context:** The current row now has a persistent tint and accessible current-state indication. It survives list refreshes and clears on dismissal, independently of cleanup selection.
3. **P2 · Details clutter:** Close sits beside the heading. Tighter disclosures and one summary divider replace the ladder of separators. Card shadows are softer; timeline groups use separators instead of every row.
4. **P2 · Toolbar hierarchy:** Filters and cleanup actions are grouped. Clear selection is hidden until useful.

Suggested Impeccable follow-ups used here: typeset, polish, layout and distill. No framework, downloaded font, external website preview or cleanup behavior was added.

## Evidence and validation

- CLI detector: zero findings in `extension`; this did not detect the live font inheritance problem.
- Live samples: 1360px and 900px wide; existing narrow-window fixtures also reviewed.
- Detector overlay injection was blocked or failed on the extension's routes. No user-visible overlay is claimed; source inspection, computed styles and screenshots supplied the evidence.
- New regression assertions verify readable primary text, secondary metadata and inspected-row state across switching, refresh and dismissal.
- Typecheck, 11 unit tests, build and all six browser suites passed in Edge.
- Visual comparison confirmed the desktop list and details remain side by side with no overlap. Narrow-window overflow checks passed.

Known follow-up: in a narrow window, details is below a long list. Bringing newly opened details into view deserves a separate responsive interaction pass.

Questions skipped: the user's established preferences and request to continue authorize this bounded polish pass.
