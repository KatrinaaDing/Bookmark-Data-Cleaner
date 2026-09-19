# Extension evaluation — 19 September 2026

> Assessment snapshot before implementation. See the [subsequent refinement record](../history/2026-09-19-release-foundations.md) for fixes, measurements and remaining release gates; the findings below retain their original assessed checkout.

**Verdict:** Bookmark Data Cleaner has a credible niche and a solid foundation, but a confirmed deletion-scope bug blocks release of the reviewed version. After that, the best investments are bookmark search, large-library performance, clearer cleanup interactions, and stronger store presentation. A substantial visual redesign offers less value.

Goal confirmed by the owner: **public adoption first, portfolio value second**. This supersedes the earlier personal-use prioritization. Complexity includes ongoing maintenance and support, not just initial implementation time.

## Scope and evidence

- Reviewed checkout `ad45d365d2924d1be79848a7ee8ff3730a4afd39`, local version 3.0.0. The existing public listing describes version 2.2; the published package was not executed and these defects should not be attributed to it without testing.
- Inspected source, manifest, architecture, build scripts, tests, fresh desktop and narrow-window screenshots, and current store listings.
- Method: parent code/runtime/product assessment plus independent design assessment (`design_review`) and browser/detector assessment (`ui_evidence`). Design judgment was recorded before detector output entered synthesis.
- Type checking, all **28 unit tests**, build, and all **eight browser suites** passed. Additional disposable-profile probes reproduced the cookie bug outside the passing suite.
- The Impeccable detector returned zero findings. It does not certify accessibility, usability, or deletion correctness.
- Visuals came from the repository's disposable-browser harness with synthetic data. No independent interactive native browser surface or injected overlay was available. Full screen-reader testing and the complete browser/OS compatibility matrix were not performed.
- No application source was changed during evaluation. Synthetic cookie evidence has now been preserved in [evidence](../evidence/2026-09-19/README.md); generated screenshots remain disposable artifacts under `dist/`.

## 1. Functionality and reliability

The strongest feature is the connection between bookmarks users no longer need and the website data left behind. Separate bookmark/site workflows, category selection, review, shared-effect warnings, dependent-bookmark retention after failures, and conservative interrupted-job behavior are worth preserving. Missing history is correctly distinguished from evidence of inactivity.

### Release blocker: deletion exceeds the reviewed cookie scope

A real `scanSites()` snapshot contained one host-only cookie. A domain cookie with the same name/path was then introduced. Cleanup using the original snapshot deleted **both** and reported success in Edge 153. Additional probes covered a previously expired target and direct browser API behavior.

`extension/browser/site-data.ts`, in `removeData()`, checks whether the selected cookie remains after `chrome.cookies.remove()`. It does not establish that unselected identities survived. [Evidence and reproduction](../evidence/2026-09-19/README.md).

Resolve and regression-test ambiguous scope before release. Investigate a deletion strategy that preserves reviewed identity; where that cannot be established, refuse the unsupported operation or explicitly review the broader supported scope. Skip absent targets. A preflight alone does not close the concurrent-change race, and post-deletion verification cannot undo collateral loss. Do not replace exact scope with an undocumented broader action.

**Value: release-critical. Complexity: medium–high**, including browser-specific validation.

### Functional improvements

| Improvement | Value | Complexity | Recommendation |
|---|---|---|---|
| Bookmark title/domain search with folder context | High | Medium | Next major usability feature |
| Clear selection in Bookmarks | High | Low | Add soon; Site data already has it |
| All / Bookmarked / Not bookmarked site filter | Medium–high | Low | Helps identify abandoned sites |
| Bookmark recorded-last-use filter | Medium | Medium | Later; keep unknown dates separate |
| Current-site toolbar cleanup | Potentially high | Medium | Validate demand after core release |
| Automatic or scheduled cleanup | Uncertain | High | Defer; increases destructive-operation risk and support |

Cookie discovery cannot enumerate every storage-only site or unknown origin/port. Make that visible enough that an empty list is not interpreted as proof of a clean browser. Exhaustive storage discovery would be a substantially larger project.

## 2. Usability and accessibility

Selection and inspection are deliberately separate; desktop details preserve useful context. The main gap is finding candidates in a large bookmark tree. Search brings more value than extending bookmark editing further.

Recommended focused improvements:

- Use blue **Review cleanup** consistently for both toolbar and detail entry points; reserve red for final deletion. Details currently says red **Clean up** despite opening the same review flow.
- Focus the review heading or summary instead of automatically focusing **Confirm cleanup**.
- Disable review until at least one available category is selected.
- Show a labeled **Enable visit dates** action while optional history access is off; its clock icon hides a useful capability.
- Put website-data information and the review action above secondary bookmark editing/copying controls.
- Use **Add bookmark** for an unbookmarked site, rather than **Create copy**.
- Report sites processed, bookmarks removed/kept, and failed/unverified work separately. Operation counts such as “2 completed” are ambiguous without units.
- Use a short first-use hint about opening rows versus ticking cleanup selections instead of a tutorial tour.
- Explain consequences before implementation terms such as IndexedDB and service workers. Group website-data choices separately from bookmark removal, keeping granular controls and technical scope available.
- Present review as what will be removed, other affected pages, and what stays. Keep exact scope visible; do not hide consequences in generic warnings.

Native controls, focus indicators, reduced-motion support, and narrow native modals are positive foundations. Before release, perform keyboard-only, VoiceOver, and 200% zoom checks on the primary journey. Recheck current checkbox contrast and forced-colors behavior; an earlier evaluation identified a concern, but this review did not perform a fresh contrast measurement.

### Interface heuristic assessment

Subjective interface scores, not a safety certification or product-market-fit measurement:

| Heuristic | /4 | Main opportunity |
|---|---:|---|
| System status | 3 | Understandable result counts |
| Familiar language | 2 | Consequences before storage terminology |
| User control | 3 | Clear bookmark selection |
| Consistency | 3 | Cleanup labels and colors |
| Error prevention | 3 | Review focus and category validation |
| Recognition | 3 | Discoverable visit-date enablement |
| Efficiency | 2 | Bookmark search |
| Visual simplicity | 3 | Cleanup priority within details |
| Error recovery | 3 | Readable failed targets and explicit recovery |
| Help | 2 | Help/privacy/support access |
| **Total** | **27/40** | Targeted improvements; no overhaul |

First-time users may mistake the product for a bookmark organizer and hesitate at permissions or technical choices. Power users encounter repeated folder expansion without search. Keyboard/assistive-technology users benefit from native controls but need a checked focus journey and manageable navigation. The emotional journey is reassuring at entry, uncertain at permissions, deliberate at review, then too technical in its completion summary.

## 3. Aesthetics and identity

The blue/white palette, system typography, restrained surfaces, selected-row state, and split layout suit this utility. Preserve that foundation.

The generic trash-can icon could be clearer at toolbar size. Details overemphasizes bookmark management; the completion panel can occupy substantial viewport height; widely separated bookmark titles/domains can slow scanning. Repeated explanations and metadata sometimes compete with the next action.

Prioritize information order, consistent actions, compact result summaries, and readable row association. Polish the small icon and use consistent store graphics. Defer a full rebrand, elaborate animation, custom illustration, and additional themes. Sparse overview space does not need dashboards or decorative statistics.

## 4. Performance and maintainability

The architecture is appropriately small: native TypeScript modules, no runtime framework dependencies, and approximately **196 KB of built files on disk**. A framework migration is not justified.

Synthetic local Node measurements of `sitesFromBookmarks()`:

| Bookmarks | Cookies | Calculation time |
|---:|---:|---:|
| 1,000 | 5,000 | ~809 ms |
| 5,000 | 5,000 | ~4,230 ms |

These are single-run diagnostic measurements, not browser latency or universal benchmarks. Fixtures used distinct `siteN.example.test` bookmark hosts and host-only session cookies. The separate cookie-driven inventory calculation took approximately 4 ms and 8 ms respectively on the same inputs; these figures measure different functions, not an implemented before/after fix.

The bookmark matching loop scans all cookies per bookmark and repeatedly parses URLs. As synchronous app-page work, it is a credible freezing risk. Parse each URL once, index relevant cookie domains/partitions, and reuse matches where scheme/host scope permits. Preserve all domain, partition, and origin semantics. Measure before considering workers or virtualization.

Add small CI coverage for type checking, unit tests, and build; targeted cookie-collision/concurrent-change regressions; and a realistic large-library fixture. Verify minimum-supported/current Chrome as well as tested Edge. Maintain separation between browser operations, core logic, and UI. Do not interpret the existing passing suite as complete safety coverage.

## 5. Privacy, trust, and release readiness

Local processing, packaged assets, optional history, no automatic target-page requests, and discarding cookie values from inventory are strengths. Explain the purpose of broad cookie/site access at the point of request and distinguish it from optional history enrichment.

Add unobtrusive Help, Privacy, Report issue, version, and release-note access. Match store disclosures to actual released behavior. Explain bookmark backup before large removals; begin with accurate browser-export guidance before building a custom exporter. Never imply that cookies or website storage can be restored.

Job status uses session storage and disappears on full browser restart. A minimal persistent interruption marker could improve recovery without persisting full browsing records or replaying deletion. This is secondary to scope correctness; define retention and failure behavior before implementing it.

## 6. Popularity, positioning, and growth

On the review date the [public listing](https://chromewebstore.google.com/detail/bookmark-data-cleaner/fgbajdlddblimpajlokkmkdngpnmmaja?hl=en) displayed **103 users, two ratings, 5.0**, version **2.2**, last updated April 2023. These are dated public observations, not daily active users or validation of version 3.0. Two ratings do not establish broad satisfaction.

Adjacent listings displayed approximately **100,000 users** for [Cookie Remover](https://chromewebstore.google.com/detail/cookie-remover-clear-remo/kcgpggonjhmeaejebeoeomdlohicfhce), **10,000** for [Cookie AutoDelete V3](https://chromewebstore.google.com/detail/cookie-autodelete-v3/jofioghmpdcgiiobkhmdojhjbjiejfbd), and **2 million** for [Cookie-Editor](https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm). Different jobs and audiences mean those counts do not predict this extension's growth. Refresh before reuse in public materials.

Position around deliberate cleanup of sites users are finished with, helped by bookmarks and recorded visits:

> Review old bookmarks and clear the website data you no longer need—with a preview before you delete.

Update the older technical store description. Prepare screenshots showing candidate discovery, shared effects, and reviewed cleanup. Explain local processing and permission choices. Recruit 5–10 people with substantial collections to attempt a real cleanup and observe comprehension, candidate discovery, completion, and uncertainty. These are proposed research activities, not completed validation.

This can be an occasional utility; low daily usage alone would not establish failure. Start with store metrics and direct feedback rather than adding runtime analytics. Defer subscriptions or paid infrastructure until recurring demand is demonstrated.

## 7. Portfolio value

A trustworthy shipped release can demonstrate Manifest V3 lifecycle handling, permission boundaries, partial failures, immutable plans, partitioned cookies, accessible interaction, and real-browser testing.

Create a concise case study covering the problem, safety model, cookie bug and verified resolution, before/after performance, and actual user feedback. Include a short demonstration and reproducible development instructions. Distinguish released work from planned features and public listing counts from usage research.

Adding AI classification, cloud accounts, or a framework solely to broaden the technology list would weaken the value/maintenance balance.

## Recommended sequence

1. Resolve cookie-scope correctness with focused regression evidence.
2. Fix cleanup labels, focus, selection reset, and empty-choice validation.
3. Optimize bookmark/cookie matching and add bookmark search.
4. Improve permissions, results, help, accessibility, and modest visual hierarchy.
5. Refresh store presentation; validate with users and complete release checks.
6. Ship, then document the case study and decide on conditional features from evidence.

The [implementation plan](../plans/2026-09-19-public-release-plan.md) tracks every recommendation, including intentional deferrals. No further product clarification was needed to write this evaluation.
