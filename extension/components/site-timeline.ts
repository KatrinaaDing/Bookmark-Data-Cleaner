import type { SiteRecord } from "../core/types.js";
import type { Selection } from "../core/state.js";
import { button, checkbox, dateText, el } from "./dom.js";
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
    const date = site.lastVisit ? dateText(site.lastVisit) : "Date unavailable";
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
    main.append(
      title,
      el(
        "span",
        "muted",
        `${site.cookies.length} detected ${site.cookies.length === 1 ? "cookie" : "cookies"}${site.bookmarks.length ? " · Bookmarked" : ""}`,
      ),
    );
    row.append(label, main);
    list.append(row);
  }
  return list;
}
