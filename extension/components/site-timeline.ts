import type { SiteRecord } from "../core/types.js";
import type { Selection } from "../core/state.js";
import { clickableRow, button, checkbox, el } from "./dom.js";
import { dateText } from "../helpers/format.js";
import { icon } from "./icons.js";
export function siteTimeline(
  sites: SiteRecord[],
  selection: Selection,
  inspect: (site: SiteRecord, trigger: HTMLElement) => void,
  changed: () => void,
): HTMLElement {
  const list = el("div", "timeline");
  let previousYear = "",
    previousDate = "";
  for (const site of sites) {
    const year = site.lastVisit
      ? String(new Date(site.lastVisit).getFullYear())
      : "No matching history";
    // Undated sites already sit under the "No matching history" heading.
    const date = site.lastVisit ? dateText(site.lastVisit) : "";
    if (year !== previousYear) {
      list.append(el("h2", "timeline-year", year));
      previousYear = year;
      previousDate = "";
    }
    const row = el("div", "site-row");
    row.append(el("span", "timeline-date", date === previousDate ? "" : date));
    previousDate = date;
    const { label, input } = checkbox("", (checked) => {
      selection.set(site.id, checked);
      changed();
    });
    input.checked = selection.ids.has(site.id);
    input.setAttribute("aria-label", `Select ${site.host}`);
    const main = el("div", "site-label");
    const title = button(site.host, () => inspect(site, title), "row-title");
    title.dataset.focusKey = `site:${site.id}`;
    main.append(title);
    if (site.bookmarks.length) main.append(el("span", "muted", "Bookmarked"));
    const cookies = el("span", "site-cookie-count");
    const cookieLabel = site.cookiesAvailable === false
      ? "Cookies not checked"
      : `Detected cookies: ${site.cookies.length}`;
    cookies.setAttribute("role", "img");
    cookies.setAttribute("aria-label", cookieLabel);
    cookies.title = cookieLabel;
    cookies.append(icon("cookie"), el("span", "", site.cookiesAvailable === false ? "—" : String(site.cookies.length)));
    row.append(label, main, cookies);
    clickableRow(row, title);
    list.append(row);
  }
  return list;
}
