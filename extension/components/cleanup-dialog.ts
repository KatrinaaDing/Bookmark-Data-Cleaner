import { infoPopover } from "./feedback.js";
import { actionButton } from "./action-button.js";
import { bookmarkSummary } from "./bookmark-summary.js";
import { enter } from "./motion.js";
import { LatestRead } from "./async-state.js";
import { buildCleanupPlan, hasData } from "../core/cleanup.js";
import type { CleanupImpact } from "../core/impact.js";
import {
  type BookmarkRef,
  type CleanupOptions,
  type CleanupPlan,
  type FolderRef,
  type Job,
  type SiteRecord,
} from "../core/types.js";
import { hasSiteAccess, requestSiteAccess } from "../browser/site-data.js";
import { cookieIdentity, errorMessage } from "../helpers/sites.js";
import { button, checkbox, el, status } from "./dom.js";

export interface PreparedCleanup {
  sites: SiteRecord[];
  folders?: FolderRef[];
  impact?: CleanupImpact;
  /** Initial bookmarks retained when bookmark removal is off; presentation only. */
  contextualBookmarks?: BookmarkRef[];
}

export interface CleanupEntry {
  label: string;
  bookmark?: BookmarkRef;
}

export function cleanupDialog(
  prepare: (
    options: CleanupOptions,
    extraBookmarkIds: ReadonlySet<string>,
  ) => Promise<PreparedCleanup>,
  allowBookmarks: boolean,
  onStarted: (job: Job) => void,
  entry?: CleanupEntry,
): void {
  if (document.querySelector("dialog.cleanup-dialog[open]")) return;
  const dialog = el("dialog", "cleanup-dialog");
  dialog.setAttribute("aria-labelledby", "cleanup-title");
  const body = el("div", "cleanup-body");
  const footer = el("div", "cleanup-footer");
  const title = el("h2", "", "Step 1 — Choose what to remove");
  title.id = "cleanup-title";
  title.tabIndex = -1;
  const feedback = el("div", "cleanup-feedback");
  function entrySummary(): HTMLElement {
    const summary = el("div", "cleanup-entry");
    if (entry?.bookmark) summary.append(bookmarkSummary(entry.bookmark));
    else summary.textContent = entry?.label ?? "Review your choices before confirming.";
    return summary;
  }
  const options: CleanupOptions = { cookies: true, savedData: true, cache: true, workers: true, bookmarks: allowBookmarks };
  const extras = new Set<string>();
  const duplicateCandidates = new Map<string, BookmarkRef>();
  const extraDecisions = new Map<string, boolean>();
  const relatedCandidates = new Map<string, BookmarkRef>();
  let busy = false;
  let revision = 0;
  const reviews = new LatestRead();
  let validReview = false;
  let confirmAction: HTMLButtonElement | undefined;
  let nextButton: ReturnType<typeof actionButton> | undefined;
  let confirmButton: ReturnType<typeof actionButton> | undefined;
  let choiceInputs: HTMLInputElement[] = [];
  let activeControls: HTMLButtonElement[] = [];
  let reviewAction: HTMLButtonElement | undefined;
  const choices: [keyof CleanupOptions, string, string][] = [
    [
      "cookies",
      "Cookies and sign-in data",
      "May sign you out, including from related subdomains.",
    ],
    [
      "savedData",
      "Saved site data",
      "Offline and unsynced work may be lost.",
    ],
    [
      "cache",
      "Cached resources",
      "Cached files and offline copies, if present.",
    ],
    [
      "workers",
      "Background workers",
      "Removes offline and background functionality until you revisit.",
    ],
  ];
  if (allowBookmarks)
    choices.push([
      "bookmarks",
      "Delete bookmarks",
      "Bookmarks are kept if their selected data cleanup fails.",
    ]);

  function updateReviewAvailability() {
    if (reviewAction)
      reviewAction.disabled = busy || !choiceInputs.some(
        (input) => input.checked && input.dataset.permission !== "off",
      );
  }

  function setBusy(value: boolean) {
    busy = value;
    for (const input of choiceInputs) input.disabled = value || input.dataset.permission === "off";
    for (const control of activeControls) control.disabled = value;
    if (confirmAction) confirmAction.disabled = value || !validReview;
    updateReviewAvailability();
    nextButton?.update({ pending: value, disabled: reviewAction?.disabled, pendingLabel: "Preparing cleanup…" });
    confirmButton?.update({ pending: value, disabled: !validReview, pendingLabel: validReview ? "Starting cleanup…" : "Preparing cleanup…" });
    dialog.setAttribute("aria-busy", String(value));
  }

  function renderChoices() {
    const current = ++revision;
    reviews.invalidate();
    validReview = false;
    confirmAction = undefined;
    confirmButton = undefined;
    busy = false;
    dialog.setAttribute("aria-busy", "false");
    feedback.replaceChildren();
    title.textContent = "Step 1 — Choose what to remove";
    body.replaceChildren(
      title,
      entrySummary(),
    );
    choiceInputs = [];
    activeControls = [];
    reviewAction = undefined;
    let cookieInput: HTMLInputElement | undefined;
    const counts = new Map<keyof CleanupOptions, HTMLElement>();
    const previewNotice = el("p", "fine cleanup-preview-note", "Counts are a preview. The next step checks the current cleanup scope.");
    let previewRevision = 0;
    async function loadPreview(granted: boolean) {
      const request = ++previewRevision;
      for (const count of counts.values()) count.textContent = "Checking…";
      try {
        // Read all available categories so counts remain useful when a choice is off.
        const prepared = await prepare(Object.freeze({
          cookies: granted, savedData: true, cache: true, workers: true, bookmarks: allowBookmarks,
        }), new Set());
        if (current !== revision || request !== previewRevision || !dialog.open) return;
        const cookies = new Set(prepared.sites.flatMap(site => site.cookies.map(cookieIdentity))).size;
        const bookmarks = new Set(prepared.sites.flatMap(site => site.bookmarks.map(bookmark => bookmark.id))).size;
        const folders = new Set((prepared.folders ?? []).map(folder => folder.id)).size;
        counts.get("cookies")!.textContent = granted
          ? `${cookies} detected ${cookies === 1 ? "cookie" : "cookies"}` : "Access needed";
        for (const key of ["savedData", "cache", "workers"] as const)
          counts.get(key)!.textContent = "If present";
        if (allowBookmarks)
          counts.get("bookmarks")!.textContent = `${bookmarks} ${bookmarks === 1 ? "bookmark" : "bookmarks"}${folders ? ` · ${folders} ${folders === 1 ? "folder" : "folders"} if empty` : ""}`;
        previewNotice.textContent = "Website data can be shared with other pages. Next checks the targets and saved copies.";
      } catch {
        if (current !== revision || request !== previewRevision || !dialog.open) return;
        for (const count of counts.values()) count.textContent = "Count unavailable";
        if (!granted) counts.get("cookies")!.textContent = "Access needed";
        previewNotice.textContent = "Could not load preview counts. Next will retry before you can confirm.";
      }
    }
    const dataHeading = el("h3", "cleanup-section-heading", "Website data");
    dataHeading.append(infoPopover("About website data categories", "Cookies can be counted. Saved site data includes Local Storage, IndexedDB and files; background workers are service workers. The browser clears these and cached resources for the listed addresses if present, but does not report their counts or sizes."));
    body.append(dataHeading);
    for (const [key, label, description] of choices) {
      if (key === "bookmarks") body.append(el("h3", "", "Bookmarks"));
      const choice = checkbox(label, (value) => {
        options[key] = value;
        updateReviewAvailability();
      });
      choice.input.checked = options[key];
      if (key === "cookies") cookieInput = choice.input;
      choiceInputs.push(choice.input);
      const wrapper = el("div", "cleanup-choice");
      const count = el("span", "cleanup-count", "Checking…");
      count.setAttribute("aria-live", "polite");
      count.id = `cleanup-count-${key}`;
      choice.input.setAttribute("aria-describedby", count.id);
      counts.set(key, count);
      const row = el("div", "cleanup-choice-row");
      row.append(choice.label, count);
      wrapper.append(row, el("p", "fine", description));
      body.append(wrapper);
    }
    function setCookieAccess(granted: boolean) {
      cookieInput!.dataset.permission = granted ? "on" : "off";
      cookieInput!.disabled = !granted || busy;
      if (!granted) {
        options.cookies = false;
        cookieInput!.checked = false;
      }
      updateReviewAvailability();
    }
    const accessButton = button("Allow cookie access", () => {
      setBusy(true);
      void requestSiteAccess().then(
        (granted) => {
          if (current !== revision || !dialog.open) return;
          setCookieAccess(granted);
          if (granted) {
            options.cookies = true;
            cookieInput!.checked = true;
          }
          void loadPreview(granted);
          if (granted) {
            accessButton.hidden = true;
            feedback.replaceChildren();
          } else {
            feedback.replaceChildren(
              status(
                "Cookie access was declined. You can still use the other cleanup options.",
              ),
            );
          }
        },
        () => {
          if (current !== revision || !dialog.open) return;
          setCookieAccess(false);
          feedback.replaceChildren(
            status("Could not request cookie access. Try again."),
          );
        },
      ).finally(() => { if (current === revision && dialog.open) setBusy(false); });
    });
    accessButton.hidden = true;
    cookieInput!.dataset.permission = "off";
    cookieInput!.disabled = true;
    void hasSiteAccess().then(
      (granted) => {
        if (current !== revision || !body.contains(cookieInput!)) return;
        setCookieAccess(granted);
        accessButton.hidden = granted;
        void loadPreview(granted);
      },
      () => {
        if (current !== revision || !body.contains(cookieInput!)) return;
        setCookieAccess(false);
        void loadPreview(false);
        accessButton.hidden = false;
        feedback.replaceChildren(
          status("Could not check cookie access. Try allowing access again."),
        );
      },
    );
    const close = button("Cancel", () => dialog.close(), "quiet");
    nextButton = actionButton("Next", () => {
      void reviewPlan({ ...options, cookies: options.cookies && cookieInput!.dataset.permission === "on" });
    }, { tone: "primary" });
    const review = nextButton.element;
    reviewAction = review;
    activeControls = [close, review];
    updateReviewAvailability();
    const actions = el("div", "dialog-actions");
    actions.append(close, review);
    body.append(accessButton, previewNotice, feedback);
    footer.replaceChildren(actions);
    title.focus();
    enter(body, -1);
  }

  async function reviewPlan(snapshot: CleanupOptions) {
    if (busy) return;
    const focusedBookmark = (document.activeElement as HTMLElement | null)?.dataset.bookmarkId;
    const current = ++revision;
    const isCurrent = reviews.begin();
    validReview = false;
    setBusy(true);
    if (!body.contains(feedback)) body.append(feedback);
    feedback.replaceChildren(status("Preparing cleanup…", true));
    try {
      let prepared: PreparedCleanup | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        const requested = new Set(snapshot.bookmarks ? extras : []);
        prepared = await prepare(Object.freeze({ ...snapshot }), requested);
        if (current !== revision || !isCurrent() || !dialog.open) return;
        duplicateCandidates.clear();
        for (const duplicate of prepared.impact?.duplicates ?? []) {
          duplicateCandidates.set(duplicate.id, duplicate);
          if (snapshot.bookmarks && !extraDecisions.has(duplicate.id))
            extraDecisions.set(duplicate.id, !duplicate.unmodifiable);
        }
        relatedCandidates.clear();
        for (const bookmark of prepared.impact?.relatedBookmarks ?? [])
          relatedCandidates.set(bookmark.id, bookmark);
        for (const id of extraDecisions.keys())
          if (!relatedCandidates.has(id) && !duplicateCandidates.has(id)) extraDecisions.delete(id);
        extras.clear();
        if (snapshot.bookmarks) for (const duplicate of duplicateCandidates.values())
          if (!duplicate.unmodifiable && extraDecisions.get(duplicate.id)) extras.add(duplicate.id);
        if (snapshot.bookmarks) for (const bookmark of relatedCandidates.values())
          if (!bookmark.unmodifiable && extraDecisions.get(bookmark.id)) extras.add(bookmark.id);
        if (requested.size === extras.size && [...requested].every(id => extras.has(id))) break;
        if (attempt === 2) throw Error("Bookmarks changed while preparing. Retry to review the current list.");
      }
      if (!prepared) throw Error("Could not prepare cleanup.");
      validReview = true;
      feedback.replaceChildren();
      renderReview(
        buildCleanupPlan(prepared.sites, snapshot, prepared.folders),
        prepared.impact,
        snapshot,
        prepared.contextualBookmarks,
      );
      if (focusedBookmark) body.querySelector<HTMLInputElement>(`input[data-bookmark-id="${CSS.escape(focusedBookmark)}"]`)?.focus({ preventScroll: true });
    } catch (error) {
      if (current === revision) {
        validReview = false;
        feedback.replaceChildren(status(errorMessage(error)), button("Retry review", () => void reviewPlan(snapshot), "quiet"));
      }
    } finally {
      if (current === revision) setBusy(false);
    }
  }

  function renderReview(
    plan: CleanupPlan,
    impact: CleanupImpact | undefined,
    snapshot: CleanupOptions,
    contextualBookmarks: BookmarkRef[] = [],
  ) {
    const newStep = title.textContent !== "Step 2 — Review this cleanup";
    const scrollTop = newStep ? 0 : body.scrollTop;
    const openDisclosures = new Set(Array.from(body.querySelectorAll<HTMLDetailsElement>("details[open][data-review-disclosure]")).map(details => details.dataset.reviewDisclosure));
    title.textContent = "Step 2 — Review this cleanup";
    reviewAction = undefined;
    nextButton = undefined;
    body.replaceChildren(title, entrySummary());
    choiceInputs = [];
    activeControls = [];
    const selected = choices
      .filter(([key]) => key !== "bookmarks" && plan.options[key])
      .map(([, label]) => label);

    const dataSection = el("section", "review-section website-data-review");
    if (hasData(plan.options)) {
      dataSection.append(el("h3", "", "Website data to clear"));
      const categories = el("ul", "selected-categories");
      for (const label of selected) categories.append(el("li", "", label));
      dataSection.append(categories);
      const targets = el("ul", "cleanup-targets");
      for (const site of plan.sites) {
        const row = el("li");
        row.append(el("span", "affected-title", site.host));
        if (plan.options.cookies) row.append(el("span", "fine", `${site.cookies.length} detected ${site.cookies.length === 1 ? "cookie" : "cookies"}`));
        targets.append(row);
      }
      dataSection.append(targets, el("p", "fine review-consequence", "May sign you out or remove offline and unsynced work."));
    } else body.append(el("p", "fine", "No website data will be cleared."));

    if (hasData(plan.options)) body.append(dataSection);

    const bookmarks = new Map(plan.sites.flatMap(site => site.bookmarks.map(bookmark => [bookmark.id, bookmark] as const)));

    function extraBookmarkChoice(bookmark: BookmarkRef): HTMLLabelElement {
      const choice = checkbox("", checked => {
        extraDecisions.set(bookmark.id, checked);
        if (checked) extras.add(bookmark.id); else extras.delete(bookmark.id);
        void reviewPlan(snapshot);
      });
      choice.input.checked = extras.has(bookmark.id);
      choice.input.dataset.bookmarkId = bookmark.id;
      choice.input.dataset.permission = bookmark.unmodifiable ? "off" : "on";
      choice.input.disabled = !!bookmark.unmodifiable;
      choice.input.setAttribute("aria-label", `Also delete ${bookmark.title || "Untitled"} in ${bookmark.path || "Bookmarks"}`);
      const caption = choice.label.querySelector("span")!;
      caption.append(bookmarkSummary(bookmark, false, true));
      if (bookmark.unmodifiable) caption.append(el("span", "fine", "Managed bookmark — kept."));
      choiceInputs.push(choice.input);
      return choice.label;
    }

    if (allowBookmarks && plan.options.bookmarks && (bookmarks.size || plan.folders.length || duplicateCandidates.size)) {
      const section = el("section", "review-section bookmark-removals");
      section.append(el("h3", "", bookmarks.size ? `Bookmarks to delete (${bookmarks.size})` : "Folders to remove if empty"));
      for (const bookmark of bookmarks.values()) {
        if (duplicateCandidates.has(bookmark.id) || relatedCandidates.has(bookmark.id)) continue;
        const row = el("p", "selected-bookmark"); row.append(bookmarkSummary(bookmark, false, true)); section.append(row);
      }
      if (duplicateCandidates.size) {
        const added = [...duplicateCandidates.keys()].filter(id => bookmarks.has(id)).length;
        const copies = el("fieldset", "duplicate-choices");
        copies.append(el("legend", "", `Other copies of the same URL (${added} selected)`));
        for (const duplicate of duplicateCandidates.values()) {
          const choice = extraBookmarkChoice(duplicate);
          if (!extras.has(duplicate.id) && hasData(plan.options))
            choice.querySelector("span")!.append(el("span", "fine remaining-copies", "Kept — shared website data will still be cleared."));
          copies.append(choice);
        }
        if ([...duplicateCandidates.keys()].every(id => extras.has(id)))
          copies.append(el("p", "fine", "No saved copy of these URLs will remain."));
        section.append(copies);
      }
      if (plan.folders.length) section.append(el("p", "fine", `${plan.folders.length} selected folders will be removed only if empty.`));
      body.append(section);
    }

    if (!plan.options.bookmarks || !bookmarks.size) body.append(el("p", "fine", "No bookmarks will be deleted."));
    const deletedIds = new Set(plan.options.bookmarks ? bookmarks.keys() : []);
    const canChooseRelated = allowBookmarks && plan.options.bookmarks;
    const affectedBookmarks = [...new Map([
      ...contextualBookmarks, ...(impact?.relatedBookmarks ?? []), ...(impact?.duplicates ?? []),
    ].filter(bookmark => !(canChooseRelated && duplicateCandidates.has(bookmark.id)) && (!deletedIds.has(bookmark.id) || (canChooseRelated && relatedCandidates.has(bookmark.id)))).map(bookmark => [bookmark.id, bookmark])).values()];
    if (hasData(plan.options) && (affectedBookmarks.length || impact?.relatedSites.length)) {
      const warning = el("section", "review-section related-warning");
      let entries: HTMLElement = warning;
      if (affectedBookmarks.length) {
        warning.append(el("h3", "", "Other affected bookmarks"), el("p", "fine", canChooseRelated
          ? "These pages share the selected website data. Check any bookmarks you also want to delete; unchecked bookmarks stay saved."
          : "These bookmarks stay saved, but share the website data being cleared."));
        if (affectedBookmarks.length > 3) {
          const disclosure = el("details", "related-disclosure");
          disclosure.dataset.reviewDisclosure = "retained";
          disclosure.append(el("summary", "", `${affectedBookmarks.length} saved pages may be affected${canChooseRelated ? ` · ${[...relatedCandidates.keys()].filter(id => extras.has(id)).length} selected to delete` : ""}`));
          warning.append(disclosure);
          entries = disclosure;
        }
      }
      for (const bookmark of affectedBookmarks) {
        const row = el("div", "affected-entry");
        if (canChooseRelated && relatedCandidates.has(bookmark.id)) {
          row.append(extraBookmarkChoice(bookmark));
        } else row.append(bookmarkSummary(bookmark, false, true));
        entries.append(row);
      }
      if (impact?.relatedSites.length) warning.append(el("h3", "", "Other sites sharing selected data"));
      for (const site of impact?.relatedSites ?? [])
        warning.append(el("p", "affected-entry", site.host));
      body.append(warning);
    }

    const summary = el("div", "cleanup-scope");
    for (const site of plan.sites) {
      summary.append(el("h3", "", site.host));
      if (plan.options.cookies) {
        summary.append(
          el(
            "p",
            "fine",
            `${site.cookies.length} detected cookies selected for removal.`,
          ),
        );
        const scopes = [
          ...new Set(
            site.cookies.map(
              (cookie) =>
                `${cookie.domain} · ${cookie.hostOnly ? "host-only" : "domain cookie"} · ${cookie.name} · path ${cookie.path} · store ${cookie.storeId}${cookie.partitionKey ? ` · partition ${cookie.partitionKey.topLevelSite} · cross-site ancestor: ${cookie.partitionKey.hasCrossSiteAncestor ?? "unknown"}` : " · unpartitioned"}`,
            ),
          ),
        ];
        for (const scope of scopes) summary.append(el("p", "url", scope));
      }
      if (plan.options.savedData || plan.options.cache || plan.options.workers)
        for (const origin of site.origins)
          summary.append(el("p", "url", origin));
    }
    if (hasData(plan.options)) {
      const details = el("details", "technical-details");
      details.dataset.reviewDisclosure = "technical";
      details.append(el("summary", "", "Technical details"), summary, el("p", "fine", "These are the exact website addresses and cookie domains targeted. Only cookies can be counted; the presence of other website data cannot be checked here. Unknown ports and storage-only sites may not be discovered. History, passwords and downloads are kept."));
      dataSection.append(details);
    }
    const result = el("div", "cleanup-result");
    const back = button("Back", () => renderChoices(), "quiet");
    const cancel = button("Cancel", () => dialog.close(), "quiet");
    confirmButton = actionButton("Confirm cleanup", () => {
      if (busy || !validReview) return;
      setBusy(true);
      result.replaceChildren(status("Starting cleanup…", true));
      void chrome.runtime
        .sendMessage({ type: "start-cleanup", plan, initiatingBookmarkIds: contextualBookmarks.map(bookmark => bookmark.id) })
        .then((response: { ok: boolean; value?: Job; error?: string }) => {
          if (!response.ok || !response.value)
            throw Error(response.error ?? "Could not start cleanup.");
          onStarted(response.value);
          dialog.close();
        })
        .catch((error) => {
          setBusy(false);
          result.replaceChildren(status(errorMessage(error)));
        });
    }, { tone: "danger" });
    const confirm = confirmButton.element;
    confirmAction = confirm;
    activeControls = [back, cancel, confirm];
    const actions = el("div", "dialog-actions");
    actions.append(back, cancel, confirm);
    const removalCount = plan.options.bookmarks ? bookmarks.size : 0;
    footer.replaceChildren(el("p", "cleanup-final-warning", `${removalCount} ${removalCount === 1 ? "bookmark" : "bookmarks"} to delete. Deletion cannot be undone.`), actions);
    body.append(feedback, result);
    for (const disclosure of body.querySelectorAll<HTMLDetailsElement>("details[data-review-disclosure]"))
      disclosure.open = openDisclosures.has(disclosure.dataset.reviewDisclosure);
    if (newStep) title.focus();
    body.scrollTop = scrollTop;
    if (newStep) enter(body, 1);
  }

  dialog.append(body, footer);
  document.body.append(dialog);
  renderChoices();
  dialog.showModal();
  document.dispatchEvent(new Event("cleanup-review-opened"));
  title.focus();
  dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener("close", () => {
    revision++;
    reviews.invalidate();
    dialog.remove();
  });
}
