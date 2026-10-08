import { requestLeave } from "./components/form-session.js";
import { enter } from "./components/motion.js";
import { emit, on } from "./components/events.js";
import { dashboard } from "./pages/dashboard.js";
import { bookmarksPage } from "./pages/bookmarks.js";
import { sitesPage } from "./pages/sites.js";
import { JobMonitor } from "./job-monitor.js";
import { LINKS } from "./links.js";
const pages = document.getElementById("pages")!;
const jobs = new JobMonitor(document.getElementById("operation")!);
const bookmarks = bookmarksPage(jobs.show),
  sites = sitesPage(jobs.show),
  home = dashboard();
jobs.observe(bookmarks, sites);
on("bookmarks-changed", (source) => {
  if (source !== "bookmarks") bookmarks.invalidate();
  if (source !== "sites") sites.invalidate();
});
on("cleanup-review-opened", () => jobs.dismissResult());
pages.append(home.element, bookmarks.element, sites.element);
function route() {
  const current = location.hash.slice(1) || "home";
  home.element.hidden = current === "bookmarks" || current === "sites";
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
  if (!home.element.hidden) home.refresh();
}
let activeHash = location.hash || "#home";
let routing = false;
async function navigate(hash: string) {
  if (routing || hash === activeHash) return;
  routing = true;
  try {
    if (!(await requestLeave())) { history.replaceState(null, "", activeHash); return; }
    emit("workspace-route");
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
void jobs.check();

const footer = document.querySelector(".app-footer")!;
footer.querySelector(".app-version")!.textContent = `Version ${chrome.runtime.getManifest().version}`;
for (const [key, label] of [["privacy", "Privacy"], ["issues", "Report an issue"]] as const) {
  if (!LINKS[key]) continue;
  const link = document.createElement("a");
  link.href = LINKS[key];
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  footer.querySelector(".app-links")!.append(link);
}

document.querySelector(".skip-link")?.addEventListener("click", (event) => {
  event.preventDefault();
  document.getElementById("content")?.focus();
});
