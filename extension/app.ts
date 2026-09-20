import { requestLeave } from "./components/form-session.js";
import { enter } from "./components/motion.js";
import { toast } from "./components/feedback.js";
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
let previousJobStatus = "";
function showJob(job: Job) {
  if (previousJobStatus === "running" && job.status !== "running") {
    const incomplete = job.status === "unverified" || job.outcomes.some(outcome => outcome.status !== "completed");
    toast(incomplete ? "Cleanup finished with items to review. See cleanup results." : "Selected cleanup requests completed.", incomplete ? "error" : "success");
  }
  previousJobStatus = job.status;
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
    toast("Cleanup status is unavailable. Reopen the app before starting another cleanup.", "error");
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
document.addEventListener("bookmarks-changed", (event) => {
  const source = (event as CustomEvent<string>).detail;
  if (source !== "bookmarks") bookmarks.invalidate();
  if (source !== "sites") sites.invalidate();
});
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
let activeHash = location.hash || "#home";
let routing = false;
async function navigate(hash: string) {
  if (routing || hash === activeHash) return;
  routing = true;
  try {
    if (!(await requestLeave())) { history.replaceState(null, "", activeHash); return; }
    document.dispatchEvent(new Event("workspace-route"));
    activeHash = hash;
    history.replaceState(null, "", hash);
    route();
    const visible = [...pages.children].find(node => node instanceof HTMLElement && !node.hidden) as HTMLElement | undefined;
    if (visible) enter(visible);
  } finally { routing = false; }
}
document.addEventListener("click", event => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('nav a, a.brand');
  if (link && !event.defaultPrevented && !(event as MouseEvent).metaKey && !(event as MouseEvent).ctrlKey) {
    event.preventDefault(); void navigate(link.hash);
  }
});
window.addEventListener("hashchange", () => {
  const target = location.hash || "#home";
  history.replaceState(null, "", activeHash);
  void navigate(target);
});
route();
void checkJob();

document.querySelector(".skip-link")?.addEventListener("click", (event) => {
  event.preventDefault();
  document.getElementById("content")?.focus();
});
