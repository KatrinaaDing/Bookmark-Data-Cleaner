import type { SiteRecord } from "../core/types.js";
import { saveBookmark } from "../browser/bookmarks.js";
import { webOrigin } from "../helpers/sites.js";
import { button, dateText, el, status } from "./dom.js";
export function siteDetails(
  site?: SiteRecord,
  onSaved: () => void = () => {},
): HTMLElement {
  const panel = el("aside", "details");
  panel.setAttribute("aria-label", "Site details");
  if (!site) {
    panel.append(
      el("h2", "", "A closer look"),
      el(
        "p",
        "muted",
        "Select a title to see its local details. No website is loaded.",
      ),
    );
    return panel;
  }
  panel.append(
    el("h2", "", site.host),
    el("p", "muted", "Local details · no page requests"),
  );
  const list = el("dl");
  for (const [label, value] of [
    ["Last recorded visit", dateText(site.lastVisit)],
    ["Detected cookies", String(site.cookies.length)],
    ["Bookmarks", String(site.bookmarks.length)],
  ])
    list.append(el("dt", "", label), el("dd", "", value));
  panel.append(
    list,
    el(
      "p",
      "fine",
      "Other storage is not measured. Zero detected cookies does not mean there is no saved site data.",
    ),
  );
  if (site.bookmarks.length) {
    panel.append(el("h3", "", "Bookmark locations"));
    for (const b of site.bookmarks)
      panel.append(
        el("p", "wrap", `${b.title || "Untitled"} · ${b.path || "Bookmarks"}`),
      );
  }
  panel.append(el("h3", "", "Known origins"));
  for (const origin of site.origins) panel.append(el("p", "url", origin));
  if (site.cookies.some((c) => c.partitionKey))
    panel.append(
      el(
        "p",
        "fine",
        "Includes third-party cookies partitioned under this top-level site. Other partitions remain separate.",
      ),
    );
  if (site.urls.length) {
    panel.append(el("h3", "", "Known URLs"));
    for (const url of site.urls.slice(0, 8)) {
      const a = el("a", "url", url);
      if (webOrigin(url)) {
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.title = "Open website in a new tab (creates browsing data)";
      }
      panel.append(a);
    }
    panel.append(
      el(
        "p",
        "fine",
        "Opening a URL visits the site and can create new browsing data.",
      ),
    );
  }
  const form = el("form", "save-bookmark");
  const title = el("input"),
    url = el("input");
  title.value = site.host;
  url.type = "url";
  url.required = true;
  url.value =
    site.urls.find((value) => webOrigin(value)) ??
    `${site.origins.find((value) => value.startsWith("https:")) ?? site.origins[0] ?? ""}/`;
  const titleLabel = el("label", "", "Bookmark title");
  titleLabel.append(title);
  const urlLabel = el("label", "", "URL to save");
  urlLabel.append(url);
  const submit = el("button", "", "Save bookmark");
  submit.type = "submit";
  const feedback = el("div");
  form.append(titleLabel, urlLabel, submit, feedback);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!webOrigin(url.value)) {
      feedback.replaceChildren(status("Enter an HTTP or HTTPS URL."));
      return;
    }
    submit.disabled = true;
    void saveBookmark(title.value, url.value)
      .then(
        () => {
          feedback.replaceChildren(status("Bookmark saved."));
          onSaved();
        },
        () =>
          feedback.replaceChildren(
            status("Could not save the bookmark. Try again."),
          ),
      )
      .finally(() => {
        submit.disabled = false;
      });
  });
  panel.append(el("h3", "", "Keep this site"), form);
  return panel;
}

export function revealDetails(
  slot: HTMLElement,
  panel: HTMLElement,
  trigger: HTMLElement,
): void {
  slot.replaceChildren(panel);
  if (window.matchMedia("(max-width: 720px)").matches) {
    const back = button(
      "Back to list",
      () => {
        trigger.focus({ preventScroll: true });
        trigger.scrollIntoView({ block: "center" });
      },
      "quiet",
    );
    panel.prepend(back);
    panel.tabIndex = -1;
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({ block: "start" });
  }
}
