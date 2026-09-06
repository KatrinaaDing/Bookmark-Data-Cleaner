import { buildCleanupPlan } from "../core/cleanup.js";
import {
  noCleanup,
  type CleanupOptions,
  type CleanupPlan,
  type FolderRef,
  type Job,
  type SiteRecord,
} from "../core/types.js";
import { hasSiteAccess, requestSiteAccess } from "../browser/site-data.js";
import { errorMessage } from "../helpers/sites.js";
import { button, checkbox, el, status } from "./dom.js";
export function cleanupDialog(
  prepare: (
    options: CleanupOptions,
  ) => Promise<{ sites: SiteRecord[]; folders?: FolderRef[] }>,
  allowBookmarks: boolean,
  onStarted: (job: Job) => void,
): void {
  const dialog = el("dialog", "cleanup-dialog");
  dialog.setAttribute("aria-labelledby", "cleanup-title");
  const body = el("div");
  let busy = false;
  const close = button("Cancel", () => dialog.close(), "quiet");
  const feedback = el("div");
  const title = el("h2", "", "Choose what to remove");
  title.id = "cleanup-title";
  body.append(
    title,
    el(
      "p",
      "muted",
      "Your choices apply only to the selected targets. Nothing is removed until you review and confirm.",
    ),
  );
  const options = { ...noCleanup };
  const choices: [keyof CleanupOptions, string, string][] = [
    [
      "cookies",
      "Cookies and sign-in data",
      "Remove detected cookies. You may be signed out, including from related subdomains.",
    ],
    [
      "savedData",
      "Saved site data",
      "Remove Local Storage, IndexedDB and website file-system data, if present. Locally saved work can be lost.",
    ],
    [
      "cache",
      "Cached resources",
      "Remove cache and CacheStorage for the listed origins, if present.",
    ],
    [
      "workers",
      "Background workers",
      "Remove service-worker registrations for the listed origins, if present.",
    ],
  ];
  if (allowBookmarks)
    choices.push([
      "bookmarks",
      "Remove selected bookmarks",
      "Independent of site data. Combined cleanup keeps bookmarks when their data request fails.",
    ]);
  let cookieInput: HTMLInputElement | undefined;
  for (const [key, label, description] of choices) {
    const choice = checkbox(label, (value) => {
      options[key] = value;
    });
    if (key === "cookies") cookieInput = choice.input;
    const wrapper = el("div", "cleanup-choice");
    wrapper.append(choice.label, el("p", "fine", description));
    body.append(wrapper);
  }
  const accessButton = button("Allow cookie access", () => {
    void requestSiteAccess().then(
      (granted) => {
        if (granted) {
          cookieInput!.disabled = false;
          accessButton.remove();
        } else
          feedback.replaceChildren(
            status(
              "Cookie access was declined. You can still use the other cleanup options.",
            ),
          );
      },
      () =>
        feedback.replaceChildren(
          status("Could not request cookie access. Try again."),
        ),
    );
  });
  accessButton.hidden = true;
  body.append(accessButton);
  cookieInput!.disabled = true;
  void hasSiteAccess()
    .then((granted) => {
      cookieInput!.disabled = !granted;
      accessButton.hidden = granted;
    })
    .catch(() => {
      accessButton.hidden = false;
      feedback.replaceChildren(
        status("Could not check cookie access. Try allowing access again."),
      );
    });
  const review = button(
    "Review cleanup",
    () => {
      busy = true;
      review.disabled = true;
      close.disabled = true;
      feedback.replaceChildren(status("Preparing cleanup…", true));
      void prepare({ ...options })
        .then(({ sites, folders }) => {
          const plan = buildCleanupPlan(sites, options, folders);
          renderReview(plan);
        })
        .catch((error) => {
          feedback.replaceChildren(status(errorMessage(error)));
        })
        .finally(() => {
          busy = false;
          review.disabled = false;
          close.disabled = false;
        });
    },
    "primary",
  );
  const actions = el("div", "dialog-actions");
  actions.append(close, review);
  body.append(feedback, actions);
  dialog.append(body);
  document.body.append(dialog);
  dialog.showModal();
  dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener("close", () => dialog.remove());
  function renderReview(plan: CleanupPlan) {
    body.replaceChildren(title);
    title.textContent = "Review this cleanup";
    body.append(
      el(
        "p",
        "warning",
        "Deletion cannot be undone. Cookies can sign you out; saved site data can include unsynced work.",
      ),
    );
    const selected = choices
      .filter(([key]) => plan.options[key])
      .map(([, label]) => label);
    body.append(el("p", "", selected.join(" · ")));
    const summary = el("div", "cleanup-scope");
    for (const site of plan.sites) {
      summary.append(el("h3", "", site.host));
      if (plan.options.cookies) {
        summary.append(
          el(
            "p",
            "fine",
            `${site.cookies.length} detected cookies. Only the reviewed cookie identities will be removed.`,
          ),
        );
        const scopes = [
          ...new Set(
            site.cookies.map(
              (c) =>
                `${c.domain}${c.partitionKey ? ` (partition: ${c.partitionKey.topLevelSite})` : ""}`,
            ),
          ),
        ];
        for (const scope of scopes) summary.append(el("p", "url", scope));
      }
      if (plan.options.savedData || plan.options.cache || plan.options.workers)
        for (const origin of site.origins)
          summary.append(el("p", "url", origin));
      if (plan.options.bookmarks)
        summary.append(
          el("p", "fine", `${site.bookmarks.length} selected bookmarks`),
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
    const result = el("div");
    const cancel = button("Cancel", () => dialog.close(), "quiet");
    const confirm = button(
      "Confirm cleanup",
      () => {
        busy = true;
        confirm.disabled = true;
        cancel.disabled = true;
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
            busy = false;
            confirm.disabled = false;
            cancel.disabled = false;
            result.replaceChildren(status(errorMessage(error)));
          });
      },
      "danger",
    );
    const footer = el("div", "dialog-actions");
    footer.append(cancel, confirm);
    body.append(result, footer);
    confirm.focus();
  }
}
