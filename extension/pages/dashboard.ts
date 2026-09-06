import { el, heading, disclosure } from "../components/dom.js";
export function dashboard(): HTMLElement {
  const page = el("section", "dashboard");
  page.append(heading("Choose what to clean."));
  const cards = el("div", "feature-cards");
  for (const [route, title, description, action] of [
    [
      "bookmarks",
      "Bookmarks",
      "Review old bookmarks and the data their sites left behind.",
      "Review bookmarks",
    ],
    [
      "sites",
      "Site data",
      "Find and clean sites with detected cookies.",
      "Review site data",
    ],
  ]) {
    const card = el("a", "feature-card");
    card.href = `#${route}`;
    card.append(
      el("h2", "", title),
      el("p", "", description),
      el("span", "card-action", action),
    );
    cards.append(card);
  }
  page.append(
    cards,
    el("p", "local-note", "Processed locally. You choose what is removed."),
    disclosure(
      "How cleanup works",
      "Review the sites and data types before confirming. Site discovery uses cookies; sites with only other storage may be missing. No website previews or analytics.",
    ),
  );
  return page;
}
