import { dashboard } from "./pages/dashboard.js";
import { bookmarksPage } from "./pages/bookmarks.js";
import { sitesPage } from "./pages/sites.js";
import { operationStatus } from "./components/operation-status.js";
import { status } from "./components/dom.js";
import type { Job } from "./core/types.js";
const pages = document.getElementById("pages")!,
  operation = document.getElementById("operation")!;
let timer: number | undefined,
  lastJob = "";
function showJob(job: Job) {
  operation.replaceChildren(operationStatus(job));
  lastJob = JSON.stringify(job);
  if (job.status === "running" && !timer)
    timer = window.setInterval(() => {
      void checkJob();
    }, 1000);
  else if (job.status !== "running" && timer) {
    clearInterval(timer);
    timer = undefined;
    void bookmarks.refresh();
    void sites.refresh();
  }
}
async function checkJob() {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "get-job",
    })) as { ok: boolean; value?: Job; error?: string };
    if (!response.ok) throw Error(response.error);
    if (response.value && JSON.stringify(response.value) !== lastJob)
      showJob(response.value);
  } catch {
    operation.replaceChildren(
      status(
        "Cleanup status is unavailable. Reopen the app to check before starting another cleanup.",
      ),
    );
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }
}
const bookmarks = bookmarksPage(showJob),
  sites = sitesPage(showJob),
  home = dashboard();
pages.append(home, bookmarks.element, sites.element);
function route() {
  const current = location.hash.slice(1) || "home";
  home.hidden = current === "bookmarks" || current === "sites";
  bookmarks.element.hidden = current !== "bookmarks";
  sites.element.hidden = current !== "sites";
  for (const link of document.querySelectorAll<HTMLAnchorElement>("nav a")) {
    if (
      link.hash === `#${current}` ||
      (current === "" && link.hash === "#home")
    )
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (current === "bookmarks") void bookmarks.load();
  if (current === "sites") void sites.load();
}
window.addEventListener("hashchange", route);
route();
void checkJob();

document.querySelector(".skip-link")?.addEventListener("click", (event) => {
  event.preventDefault();
  document.getElementById("content")?.focus();
});
