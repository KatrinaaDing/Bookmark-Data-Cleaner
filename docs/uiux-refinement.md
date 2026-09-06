# UI/UX refinement

Branch: `codex/uiux-refinement`.

User direction: less text, original blue/white theme, familiar icons, animated folders, and a wider right-sliding details card. Preserve the app skeleton and make one-intent commits.

Implemented:
- Restored the blue/white palette.
- Animated folder expansion, including rapid toggles and reduced motion.
- Replaced the narrow sidebar with a shared inspection card; one scroll surface and explicit dismissal/focus return.
- Moved URLs, storage information and bookmark forms behind disclosures.
- Shortened page and option copy; retained cleanup consequences and exact confirmation scope.
- Used accessible icon controls for familiar secondary actions.

The independent review found a save → refresh → close focus issue. A regression test reproduced it in Edge; the fix restores focus to the replacement row or main content. The reviewer verified the fix in Edge.

See [development](development.md) for test commands. Naming, the rich toolbar popup and unrelated new features remain outside this pass.
