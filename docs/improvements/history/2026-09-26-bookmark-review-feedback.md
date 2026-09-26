# Bookmark details and cleanup review feedback — 26 September 2026

Implemented the six issues identified in the user's screenshots. This remains product refinement, not release preparation.

After a user tried a real cleanup, the review dialog closed while the operation panel was above the scrolled workspace. A persistent spinner toast now appears immediately on job start and remains until the polled job finishes. It is then replaced with a success toast or an items-to-review error toast. Loss of job status removes the spinner and shows the existing recovery error. The durable operation panel remains the detailed record.

This follow-up passed typecheck, build, `git diff --check`, the affected-cleanup browser suite (including real synthetic deletion and settled toast captures), and the shared UI contract browser suite. The entire browser runner was not repeated for this feedback-only change.

The subsequent in-context progress pass adds a busy state to the existing bookmark tree, search results, and details drawer. A running job persists the initiating bookmark IDs together with the IDs selected for deletion as display-only targets. The row and drawer state follows the job status; the details content becomes inert while Close details stays available, and cleanup entry actions in both workspaces are disabled. Data-only bookmarks return to their normal state after completion. The new IDs do not affect the reviewed deletion plan. A focused unit test confirms they are persisted without becoming deletion targets, and the affected-cleanup browser suite exercises the busy state with synthetic bookmarks, including a data-only cleanup and narrow-to-desktop transition.

This final progress pass passed typecheck, build, 45 unit tests, `git diff --check`, and the complete 17-suite disposable Edge browser runner. Synthetic desktop and narrow overlay captures were inspected. These checks do not establish real-profile usability or the separate browser compatibility and assistive-technology release gates.

- Basic information always displays bookmark last opened and website last visited, including unknown/loading states.
- Details retains one visible website-data consequence and removes the redundant info popover.
- Related bookmarks and exact copies use linked titles plus folder paths, without a separate full-URL line. HTTP(S) links open explicitly in a new tab; unsupported schemes remain text.
- Both cleanup steps identify an initiating bookmark by title and folder path. Plain URL text no longer has hover background feedback.
- Step 1 places category help beside Website data. The preview/shared-data note sits below the choices with a separator and larger gap. Keyboard Escape dismisses help before review.
- Step 2 uses separated data, bookmark-removal and affected-bookmark sections, compact category lists, and technical scope within the data section. The fixed footer reports the total bookmarks to delete. Copies and affected bookmarks share the same choice renderer and decision state.

## Authorized scope and guarantees

The user explicitly chose **delete selected affected bookmarks while leaving website-data scope unchanged**. These new choices begin unchecked and appear when bookmark removal is enabled. Existing category and exact-copy defaults remain unchanged; site-data-only review still cannot delete bookmarks.

Core preparation checks fresh bookmark IDs against the initiating targets' exact-URL, cookie and origin relationships. Selected extra bookmarks are attached to existing target dependencies; they never introduce origins or cookies. Managed and unrelated entries are excluded. A bookmark shared by multiple targets waits until all its data dependencies finish and remains saved if any fails. Confirmation still submits only the current reviewed snapshot. Choices survive Back/Next; failed re-preparation disables confirmation.

## Verification

Typecheck, build, 44 unit tests and `git diff --check` pass. Six focused disposable Edge suites cover this pass: cleanup-ux, cleanup-review, affected-cleanup, bookmark-management, ui-refinement and ui-contract. The full 17-suite browser runner was not run.

The new affected-cleanup suite checks actual bookmark removal, retention of unchecked bookmarks and private cookies on a related subdomain, equality with the reviewed origins, managed entries, Back/Next and failed-rebuild gating. Unit coverage checks stale relationship exclusion and failures in either of multiple dependencies.

Updated obsolete tooltip tests to follow the relocated category help. Replaced one fixed drawer-animation delay with a settled-state wait after it failed under concurrent browser load. The first new scope assertion incorrectly assumed an HTTPS-only baseline; the test now compares against the actual reviewed origins, which can include HTTP.

Inspected synthetic desktop/narrow screenshots including long titles and expanded affected choices. Captures are ignored artifacts in `dist/cleanup-ux/after/` and `dist/affected-cleanup/`. The Impeccable detector reported no findings. These checks do not establish complete browser compatibility, assistive-technology coverage or real-world usability.
