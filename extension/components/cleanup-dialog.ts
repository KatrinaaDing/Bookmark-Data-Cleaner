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
}

export function cleanupDialog(
  prepare: (
    options: CleanupOptions,
    extraBookmarkIds: ReadonlySet<string>,
  ) => Promise<PreparedCleanup>,
  allowBookmarks: boolean,
  onStarted: (job: Job) => void,
): void {
  const dialog = el("dialog", "cleanup-dialog");
  dialog.setAttribute("aria-labelledby", "cleanup-title");
  const body = el("div");
  const title = el("h2", "", "Choose what to remove");
  title.id = "cleanup-title";
  title.tabIndex = -1;
  const feedback = el("div", "cleanup-feedback");
  const options: CleanupOptions = { cookies: true, savedData: true, cache: true, workers: true, bookmarks: allowBookmarks };
  const extras = new Set<string>();
  const duplicateCandidates = new Map<string, BookmarkRef>();
  let busy = false;
  let revision = 0;
  const reviews = new LatestRead();
  let validReview = false;
  let confirmAction: HTMLButtonElement | undefined;
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
      "Local Storage, IndexedDB and files. Unsynced work may be lost.",
    ],
    [
      "cache",
      "Cached resources",
      "Cached files and offline copies, if present.",
    ],
    [
      "workers",
      "Background workers",
      "Service workers used for offline and background activity.",
    ],
  ];
  if (allowBookmarks)
    choices.push([
      "bookmarks",
      "Remove selected bookmarks",
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
    dialog.setAttribute("aria-busy", String(value));
  }

  function renderChoices() {
    const current = ++revision;
    reviews.invalidate();
    validReview = false;
    confirmAction = undefined;
    busy = false;
    dialog.setAttribute("aria-busy", "false");
    feedback.replaceChildren();
    title.textContent = "Choose what to remove";
    body.replaceChildren(
      title,
      el("p", "muted", "Review your choices before confirming."),
    );
    choiceInputs = [];
    activeControls = [];
    reviewAction = undefined;
    let cookieInput: HTMLInputElement | undefined;
    const counts = new Map<keyof CleanupOptions, HTMLElement>();
    const previewNotice = el("p", "fine", "Counts are a preview. The next step checks the current cleanup scope.");
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
        const origins = new Set(prepared.sites.flatMap(site => site.origins)).size;
        const folders = new Set((prepared.folders ?? []).map(folder => folder.id)).size;
        counts.get("cookies")!.textContent = granted
          ? `${cookies} detected ${cookies === 1 ? "cookie" : "cookies"}` : "Access needed";
        for (const key of ["savedData", "cache", "workers"] as const)
          counts.get(key)!.textContent = `${origins} ${origins === 1 ? "origin" : "origins"} in scope`;
        if (allowBookmarks)
          counts.get("bookmarks")!.textContent = `${bookmarks} ${bookmarks === 1 ? "bookmark" : "bookmarks"}${folders ? ` · ${folders} ${folders === 1 ? "folder" : "folders"} if empty` : ""}`;
        previewNotice.textContent = "Storage, cache and worker counts show website origins to check, not detected items or bytes. The next step refreshes the scope.";
      } catch {
        if (current !== revision || request !== previewRevision || !dialog.open) return;
        for (const count of counts.values()) count.textContent = "Count unavailable";
        if (!granted) counts.get("cookies")!.textContent = "Access needed";
        previewNotice.textContent = "Could not load preview counts. Review cleanup will retry before you can confirm.";
      }
    }
    for (const [key, label, description] of choices) {
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
    const review = button("Review cleanup", () => {
      void reviewPlan({ ...options, cookies: options.cookies && cookieInput!.dataset.permission === "on" });
    }, "primary");
    reviewAction = review;
    activeControls = [close, review];
    updateReviewAvailability();
    const actions = el("div", "dialog-actions");
    actions.append(close, review);
    body.append(previewNotice, accessButton, feedback, actions);
    title.focus();
  }

  async function reviewPlan(snapshot: CleanupOptions) {
    const current = ++revision;
    const isCurrent = reviews.begin();
    validReview = false;
    setBusy(true);
    if (!body.contains(feedback)) body.append(feedback);
    feedback.replaceChildren(status("Preparing cleanup…", true));
    try {
      const prepared = await prepare(
        Object.freeze({ ...snapshot }),
        new Set(extras),
      );
      if (current !== revision || !isCurrent() || !dialog.open) return;
      for (const duplicate of prepared.impact?.duplicates ?? [])
        duplicateCandidates.set(duplicate.id, duplicate);
      validReview = true;
      feedback.replaceChildren();
      renderReview(
        buildCleanupPlan(prepared.sites, snapshot, prepared.folders),
        prepared.impact,
        snapshot,
      );
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
  ) {
    title.textContent = "Review this cleanup";
    reviewAction = undefined;
    body.replaceChildren(title);
    choiceInputs = [];
    activeControls = [];
    body.append(
      el(
        "p",
        "warning",
        hasData(plan.options)
          ? "Deletion cannot be undone. Selected website data may include sign-ins, offline copies or unsynced work."
          : "Deletion cannot be undone. Only the reviewed bookmarks will be removed.",
      ),
    );
    const selected = choices
      .filter(([key]) => plan.options[key])
      .map(([, label]) => label);
    body.append(el("p", "selected-categories", selected.join(" · ")));

    if (allowBookmarks && plan.options.bookmarks && duplicateCandidates.size) {
      const copies = el("fieldset", "duplicate-choices");
      copies.append(
        el("legend", "", "Additional exact copies"),
        el(
          "p",
          "fine",
          hasData(plan.options)
            ? "Unchecked copies stay bookmarked but can still share the website data selected above."
            : "Copies are unchecked by default and stay bookmarked unless you add them.",
        ),
      );
      for (const duplicate of duplicateCandidates.values()) {
        const choice = checkbox(
          `${duplicate.title || "Untitled"} — ${duplicate.path || "Bookmarks"}`,
          (checked) => {
            if (checked) extras.add(duplicate.id);
            else extras.delete(duplicate.id);
            void reviewPlan(snapshot);
          },
        );
        choice.input.checked = extras.has(duplicate.id);
        choiceInputs.push(choice.input);
        copies.append(choice.label);
      }
      body.append(copies);
    }

    if (hasData(plan.options) && duplicateCandidates.size) {
      const remaining = [...duplicateCandidates.values()].filter(
        (bookmark) => !extras.has(bookmark.id),
      );
      if (remaining.length) {
        const warning = el("div", "related-warning remaining-copies");
        warning.append(
          el("h3", "", "Saved copies will remain"),
          el(
            "p",
            "fine",
            "These exact copies stay bookmarked, but they share the website data selected for cleanup.",
          ),
        );
        for (const bookmark of remaining)
          warning.append(
            el(
              "p",
              "affected-entry",
              `${bookmark.title || "Untitled"} — ${bookmark.path || "Bookmarks"}`,
            ),
          );
        body.append(warning);
      }
    }

    if (hasData(plan.options) && (impact?.relatedBookmarks.length || impact?.relatedSites.length)) {
      const warning = el("div", "related-warning");
      warning.append(
        el("h3", "", "Other saved pages may be affected"),
        el("p", "fine", "Their bookmarks stay, but the selected website data is shared."),
      );
      for (const bookmark of impact?.relatedBookmarks ?? [])
        warning.append(
          el(
            "p",
            "affected-entry",
            `${bookmark.title || "Untitled"} — ${bookmark.path || "Bookmarks"}`,
          ),
        );
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
                `${cookie.domain}${cookie.partitionKey ? ` (partition: ${cookie.partitionKey.topLevelSite})` : ""}`,
            ),
          ),
        ];
        for (const scope of scopes) summary.append(el("p", "url", scope));
      }
      if (plan.options.savedData || plan.options.cache || plan.options.workers)
        for (const origin of site.origins)
          summary.append(el("p", "url", origin));
      if (plan.options.bookmarks)
        for (const bookmark of site.bookmarks)
          summary.append(
            el(
              "p",
              "selected-bookmark",
              `${bookmark.title || "Untitled"} — ${bookmark.path || "Bookmarks"}`,
            ),
          );
    }
    if (plan.folders.length && plan.options.bookmarks)
      summary.append(
        el(
          "p",
          "fine",
          `${plan.folders.length} selected folders will be removed only if empty.`,
        ),
      );
    body.append(
      summary,
      el(
        "p",
        "fine",
        "HTTP/HTTPS defaults and locally known origins are listed above. Unknown ports and storage-only sites are not discovered. History, passwords and downloads are kept.",
      ),
    );
    const result = el("div", "cleanup-result");
    const back = button("Back", () => renderChoices(), "quiet");
    const cancel = button("Cancel", () => dialog.close(), "quiet");
    const confirm = button("Confirm cleanup", () => {
      if (busy || !validReview) return;
      setBusy(true);
      result.replaceChildren(status("Starting cleanup…", true));
      void chrome.runtime
        .sendMessage({ type: "start-cleanup", plan })
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
    }, "danger");
    confirmAction = confirm;
    activeControls = [back, cancel, confirm];
    const footer = el("div", "dialog-actions");
    footer.append(back, cancel, confirm);
    body.append(feedback, result, footer);
    title.focus();
  }

  dialog.append(body);
  document.body.append(dialog);
  renderChoices();
  dialog.showModal();
  dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener("close", () => {
    revision++;
    reviews.invalidate();
    dialog.remove();
  });
}
