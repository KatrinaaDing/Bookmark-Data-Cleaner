import type { SiteRecord } from "../core/types.js";
import { saveBookmark } from "../browser/bookmarks.js";
import { webOrigin } from "../helpers/sites.js";
import { iconButton } from "./icons.js";
import { dateText, el, status } from "./dom.js";
let captionId = 0;
function sectionSummary(label: string, text?: string): HTMLElement {
  const summary = el("summary", "detail-summary");
  summary.append(el("span", "detail-section-label", label));
  if (!text) return summary;
  const info = el("span", "detail-info");
  const caption = el("span", "detail-tooltip", text);
  caption.id = `site-caption-${++captionId}`;
  caption.setAttribute("role", "tooltip");
  const infoButton = iconButton("info", `About ${label.toLowerCase()}`, () => {
    info.classList.remove("is-dismissed");
  });
  infoButton.removeAttribute("title");
  infoButton.setAttribute("aria-describedby", caption.id);
  info.addEventListener("pointerenter", () => info.classList.remove("is-dismissed"));
  info.addEventListener("focusin", () => info.classList.remove("is-dismissed"));
  info.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      info.classList.add("is-dismissed");
      event.preventDefault();
      event.stopPropagation();
    }
  });
  // The info control must not toggle its surrounding disclosure.
  info.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  info.append(infoButton, caption);
  summary.append(info);
  return summary;
}
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
  panel.append(el("h2", "", site.host));
  const list = el("dl");
  for (const [label, value] of [
    ["Last recorded visit", dateText(site.lastVisit)],
    ["Detected cookies", String(site.cookies.length)],
    ["Bookmarks", String(site.bookmarks.length)],
  ])
    list.append(el("dt", "", label), el("dd", "", value));
  panel.append(list);
  const storage = el("details", "detail-disclosure");
  const storageNote = "Cookie counts are detected data. Other storage is not measured." +
    (site.cookies.some((cookie) => cookie.partitionKey)
      ? " Includes third-party cookies under this site's partition. Other partitions stay separate."
      : "");
  storage.append(sectionSummary("Storage scope", storageNote));
  for (const origin of site.origins) storage.append(el("p", "url", origin));
  panel.append(storage);
  if (site.bookmarks.length) {
    const bookmarks = el("details", "detail-disclosure");
    bookmarks.append(sectionSummary("Bookmark locations"));
    for (const bookmark of site.bookmarks)
      bookmarks.append(
        el(
          "p",
          "wrap",
          `${bookmark.title || "Untitled"} · ${bookmark.path || "Bookmarks"}`,
        ),
      );
    panel.append(bookmarks);
  }
  if (site.urls.length) {
    const links = el("details", "detail-disclosure");
    links.append(
      sectionSummary(
        `Known URLs (${site.urls.length})`,
        "Opening a URL visits the site and can create browsing data.",
      ),
    );
    for (const url of site.urls) {
      const link = el("a", "url", url);
      if (webOrigin(url)) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      links.append(link);
    }
    panel.append(links);
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
  const save = el("details", "detail-disclosure");
  save.append(
    sectionSummary(site.bookmarks.length ? "Save another bookmark" : "Save bookmark"),
    form,
  );
  panel.append(save);
  return panel;
}
