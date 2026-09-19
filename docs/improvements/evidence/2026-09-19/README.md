# Cookie deletion scope evidence — 19 September 2026

Observed against checkout `ad45d365d2924d1be79848a7ee8ff3730a4afd39`, version 3.0.0, in disposable Edge 153 profiles. These are recorded observations, not proof of behavior on every supported browser version.

- [Real scan snapshot followed by a new cookie](reviewed-cookie-race-evidence.json): a host-only cookie was reviewed; a same-name/path domain cookie appeared afterward; cleanup removed both and returned success.
- [Initial collision, absent-target, and direct API probes](cookie-scope-evidence.json): supporting observations. The initial manually constructed host-only selection is diagnostic; the real scan snapshot above establishes a reachable workflow.
- [Reproduction script](reproduce-cookie-scope.mjs): prints current observations without asserting the old bug must persist. Once fixed, retain these historical JSON files and add meaningful automated regression assertions separately.

Run from the repository root after building:

```sh
npm run build
CHROME_BIN='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' node docs/improvements/evidence/2026-09-19/reproduce-cookie-scope.mjs
```

The existing harness creates and removes a disposable profile. Optional permissions are granted in a copied test manifest, not the shipped manifest. All domains and cookie values are synthetic test fixtures. No normal browser profile is used.

Passing the existing eight browser suites did not cover these collisions. Selected-cookie absence is insufficient evidence that other cookies were preserved. A preflight check alone also cannot eliminate changes between checking and deletion.
