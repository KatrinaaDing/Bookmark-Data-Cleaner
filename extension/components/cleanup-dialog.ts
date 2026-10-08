import { infoPopover } from "./feedback.js";
import { actionButton } from "./action-button.js";
import { bookmarkSummary } from "./bookmark-summary.js";
import { enter } from "./motion.js";
import { LatestRead } from "./async-state.js";
import { emit } from "./events.js";
import { plannedBookmarks, reviewSections } from "./cleanup-review.js";
import { buildCleanupPlan } from "../core/cleanup.js";
import { BOOKMARK_CATEGORY, DATA_CATEGORIES, type CategoryInfo } from "../core/cleanup-options.js";
import type { CleanupImpact } from "../core/impact.js";
import { ExtraBookmarkDecisions } from "../core/review-decisions.js";
import type {
  BookmarkRef,
  CleanupOptions,
  CleanupPlan,
  FolderRef,
  Job,
  SiteRecord,
} from "../core/types.js";
import { sendToWorker } from "../browser/messages.js";
import { hasSiteAccess, requestSiteAccess } from "../browser/site-data.js";
import { cookieIdentity } from "../helpers/cookies.js";
import { errorMessage } from "../helpers/errors.js";
import { plural } from "../helpers/format.js";
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
  const decisions = new ExtraBookmarkDecisions();
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
  const choices: CategoryInfo<keyof CleanupOptions>[] = allowBookmarks
    ? [...DATA_CATEGORIES, BOOKMARK_CATEGORY]
    : [...DATA_CATEGORIES];

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
        counts.get("cookies")!.textContent = granted ? plural(cookies, "detected cookie") : "Access needed";
        if (allowBookmarks)
          counts.get("bookmarks")!.textContent = `${plural(bookmarks, "bookmark")}${folders ? ` · ${plural(folders, "folder")} if empty` : ""}`;
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
    for (const { key, label, description } of choices) {
      if (key === "bookmarks") body.append(el("h3", "", "Bookmarks"));
      const choice = checkbox(label, (value) => {
        options[key] = value;
        updateReviewAvailability();
      });
      choice.input.checked = options[key];
      if (key === "cookies") cookieInput = choice.input;
      choiceInputs.push(choice.input);
      const wrapper = el("div", "cleanup-choice");
      const row = el("div", "cleanup-choice-row");
      row.append(choice.label);
      // Only cookies and bookmarks can be counted; the browser reports nothing for the rest.
      if (key === "cookies" || key === "bookmarks") {
        const count = el("span", "cleanup-count", "Checking…");
        count.setAttribute("aria-live", "polite");
        count.id = `cleanup-count-${key}`;
        choice.input.setAttribute("aria-describedby", count.id);
        counts.set(key, count);
        row.append(count);
      }
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
      // Candidates can change the selection (e.g. default-selected copies), which changes
      // the plan. Re-prepare until the plan was built from the selection it produced.
      for (let attempt = 0; attempt < 3; attempt++) {
        const requested = decisions.requested(snapshot.bookmarks);
        prepared = await prepare(Object.freeze({ ...snapshot }), requested);
        if (current !== revision || !isCurrent() || !dialog.open) return;
        decisions.reconcile(prepared.impact, snapshot.bookmarks);
        if (decisions.matches(requested)) break;
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
    function extraChoice(bookmark: BookmarkRef): HTMLLabelElement {
      const choice = checkbox("", checked => {
        decisions.choose(bookmark.id, checked);
        void reviewPlan(snapshot);
      });
      choice.input.checked = decisions.selected.has(bookmark.id);
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
    body.append(...reviewSections({ plan, impact, decisions, contextualBookmarks, allowBookmarks, extraChoice }));

    const result = el("div", "cleanup-result");
    const back = button("Back", () => renderChoices(), "quiet");
    const cancel = button("Cancel", () => dialog.close(), "quiet");
    confirmButton = actionButton("Confirm cleanup", () => {
      if (busy || !validReview) return;
      setBusy(true);
      result.replaceChildren(status("Starting cleanup…", true));
      void sendToWorker({ type: "start-cleanup", plan, initiatingBookmarkIds: contextualBookmarks.map(bookmark => bookmark.id) })
        .then((job) => {
          if (!job) throw Error("Could not start cleanup.");
          onStarted(job);
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
    const removalCount = plan.options.bookmarks ? plannedBookmarks(plan).size : 0;
    footer.replaceChildren(el("p", "cleanup-final-warning", `${plural(removalCount, "bookmark")} to delete. Deletion cannot be undone.`), actions);
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
  emit("cleanup-review-opened");
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
