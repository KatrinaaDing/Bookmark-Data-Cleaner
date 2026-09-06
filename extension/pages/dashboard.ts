import { el, heading } from "../components/dom.js";
export function dashboard(): HTMLElement {
  const page = el("section", "dashboard");
  page.append(
    heading(
      "Choose the sites. Clear their data.",
      "A little less left behind. Review what you no longer need, one website at a time.",
    ),
  );
  const cards = el("div", "feature-cards");
  for (const [route, title, description, action] of [
    [
      "bookmarks",
      "Start with your bookmarks",
      "Retire an old bookmark and choose whether to remove the browser data its site left behind.",
      "Review bookmarks",
    ],
    [
      "sites",
      "Review stored site data",
      "Find websites with detected cookies, including ones you never bookmarked. Use retained visits to help decide what stays.",
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
  page.append(cards);
  const note = el("section", "privacy-note");
  note.append(
    el("h2", "", "A deliberate kind of clean"),
    el(
      "p",
      "",
      "You choose the targets and data types, then review the scope before anything is removed. Your browser data is processed locally. No live previews, remote favicons or analytics.",
    ),
    el(
      "p",
      "muted",
      "Site discovery uses cookies. Some websites with only other stored data will not appear.",
    ),
  );
  page.append(note);
  return page;
}
