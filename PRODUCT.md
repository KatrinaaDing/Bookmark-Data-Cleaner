# Product context

Bookmark Data Cleaner is becoming a selective website-data cleanup tool. The mechanism is deliberate site selection, reviewed browser-data categories, then explicit deletion; bookmarks are one entry point, cookie-discovered sites the other.

Audience: desktop Edge and Chrome users tidying abandoned websites and bookmarks, with privacy and control as the main value. Main app first; quick toolbar cleanup/status is Stage 2. Keep public name/icon until a naming decision.

Three journeys: overview cards → collapsible bookmark tree or last-visit site timeline → local metadata → select cleanup types → review exact scope → confirm → inspect results. Unknown history is separate. Site inventory is cookie-driven and incomplete for storage-only websites.

Constraints: offline local assets, TypeScript/native modules, native controls/custom CSS, no runtime dependencies or framework. No live previews, screenshots, remote favicons or analytics. History is optional enrichment. Deletion is irreversible; never infer success after interruption or replay automatically.

See docs/improvements/history/2026-09-06-rebranding-plan.md for scope and docs/architecture.md for tested boundaries.

UI preferences: reduce visible text, retain the original blue/white identity, use familiar labeled icons, animate folder transitions, and show details in a wide card sliding from the right. Avoid nested scrolling. Keep commits focused on one intent.

Current iteration: release preparation. The 8 October 2026 pass fixed every weakness from the whole-product evaluation; remaining work is filling public links, Chrome verification and manual release checks (see docs/store-listing.md).
