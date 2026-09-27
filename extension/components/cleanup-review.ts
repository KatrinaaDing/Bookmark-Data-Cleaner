import { bookmarkSummary } from "./bookmark-summary.js";
import { el } from "./dom.js";
import { DATA_CATEGORIES, hasData, hasOriginData } from "../core/cleanup-options.js";
import type { CleanupImpact } from "../core/impact.js";
import type { ExtraBookmarkDecisions } from "../core/review-decisions.js";
import type { BookmarkRef, CleanupPlan } from "../core/types.js";
import { describeCookieScope } from "../helpers/cookies.js";
import { unique } from "../helpers/collections.js";
import { plural } from "../helpers/format.js";

/** Everything step 2 shows about one prepared, validated plan. */
export interface ReviewModel {
  plan: CleanupPlan;
  impact?: CleanupImpact;
  decisions: ExtraBookmarkDecisions;
  /** Initial bookmarks retained when bookmark removal is off; presentation only. */
  contextualBookmarks: BookmarkRef[];
  allowBookmarks: boolean;
  /** Checkbox deciding whether an extra bookmark is also deleted. */
  extraChoice: (bookmark: BookmarkRef) => HTMLLabelElement;
}

/** Bookmarks the plan deletes, keyed by ID. */
export function plannedBookmarks(plan: CleanupPlan): Map<string, BookmarkRef> {
  return new Map(plan.sites.flatMap(site => site.bookmarks.map(bookmark => [bookmark.id, bookmark] as const)));
}

/** Review body sections, in display order. */
export function reviewSections(model: ReviewModel): HTMLElement[] {
  const { plan } = model;
  const bookmarks = plannedBookmarks(plan);
  const sections: HTMLElement[] = [];
  sections.push(hasData(plan.options) ? websiteDataSection(plan) : el("p", "fine", "No website data will be cleared."));
  if (model.allowBookmarks && plan.options.bookmarks && (bookmarks.size || plan.folders.length || model.decisions.duplicates.size))
    sections.push(bookmarkRemovalSection(model, bookmarks));
  if (!plan.options.bookmarks || !bookmarks.size) sections.push(el("p", "fine", "No bookmarks will be deleted."));
  const affected = affectedSection(model, bookmarks);
  if (affected) sections.push(affected);
  return sections;
}

function websiteDataSection(plan: CleanupPlan): HTMLElement {
  const section = el("section", "review-section website-data-review");
  section.append(el("h3", "", "Website data to clear"));
  const categories = el("ul", "selected-categories");
  for (const { key, label } of DATA_CATEGORIES)
    if (plan.options[key]) categories.append(el("li", "", label));
  section.append(categories);
  const targets = el("ul", "cleanup-targets");
  for (const site of plan.sites) {
    const row = el("li");
    row.append(el("span", "affected-title", site.host));
    if (plan.options.cookies) row.append(el("span", "fine", plural(site.cookies.length, "detected cookie")));
    targets.append(row);
  }
  section.append(targets, el("p", "fine review-consequence", "May sign you out or remove offline and unsynced work."), technicalDetails(plan));
  return section;
}

/** Exact addresses and cookie identities targeted by the plan. */
function technicalDetails(plan: CleanupPlan): HTMLElement {
  const summary = el("div", "cleanup-scope");
  for (const site of plan.sites) {
    summary.append(el("h3", "", site.host));
    if (plan.options.cookies) {
      summary.append(el("p", "fine", `${site.cookies.length} detected cookies selected for removal.`));
      for (const scope of new Set(site.cookies.map(describeCookieScope)))
        summary.append(el("p", "url", scope));
    }
    if (hasOriginData(plan.options))
      for (const origin of site.origins) summary.append(el("p", "url", origin));
  }
  const details = el("details", "technical-details");
  details.dataset.reviewDisclosure = "technical";
  details.append(el("summary", "", "Technical details"), summary, el("p", "fine", "These are the exact website addresses and cookie domains targeted. Only cookies can be counted; the presence of other website data cannot be checked here. Unknown ports and storage-only sites may not be discovered. History, passwords and downloads are kept."));
  return details;
}

function bookmarkRemovalSection(model: ReviewModel, bookmarks: Map<string, BookmarkRef>): HTMLElement {
  const { plan, decisions } = model;
  const section = el("section", "review-section bookmark-removals");
  section.append(el("h3", "", bookmarks.size ? `Bookmarks to delete (${bookmarks.size})` : "Folders to remove if empty"));
  for (const bookmark of bookmarks.values()) {
    if (decisions.isCandidate(bookmark.id)) continue;
    const row = el("p", "selected-bookmark");
    row.append(bookmarkSummary(bookmark, false, true));
    section.append(row);
  }
  if (decisions.duplicates.size) {
    const added = [...decisions.duplicates.keys()].filter(id => bookmarks.has(id)).length;
    const copies = el("fieldset", "duplicate-choices");
    copies.append(el("legend", "", `Other copies of the same URL (${added} selected)`));
    for (const duplicate of decisions.duplicates.values()) {
      const choice = model.extraChoice(duplicate);
      if (!decisions.selected.has(duplicate.id) && hasData(plan.options))
        choice.querySelector("span")!.append(el("span", "fine remaining-copies", "Kept — shared website data will still be cleared."));
      copies.append(choice);
    }
    if ([...decisions.duplicates.keys()].every(id => decisions.selected.has(id)))
      copies.append(el("p", "fine", "No saved copy of these URLs will remain."));
    section.append(copies);
  }
  if (plan.folders.length) section.append(el("p", "fine", `${plan.folders.length} selected folders will be removed only if empty.`));
  return section;
}

/** Bookmarks and sites sharing the cleared data; related bookmarks can be opted into deletion. */
function affectedSection(model: ReviewModel, bookmarks: Map<string, BookmarkRef>): HTMLElement | undefined {
  const { plan, impact, decisions } = model;
  if (!hasData(plan.options)) return undefined;
  const deletedIds = new Set(plan.options.bookmarks ? bookmarks.keys() : []);
  const canChooseRelated = model.allowBookmarks && plan.options.bookmarks;
  const affected = unique([
    ...model.contextualBookmarks, ...(impact?.relatedBookmarks ?? []), ...(impact?.duplicates ?? []),
  ].filter(bookmark =>
    // Choosable copies are listed with the removals; deleted bookmarks only when still choosable.
    !(canChooseRelated && decisions.duplicates.has(bookmark.id)) &&
    (!deletedIds.has(bookmark.id) || (canChooseRelated && decisions.related.has(bookmark.id)))),
  bookmark => bookmark.id);
  const relatedSites = impact?.relatedSites ?? [];
  if (!affected.length && !relatedSites.length) return undefined;

  const warning = el("section", "review-section related-warning");
  let entries: HTMLElement = warning;
  if (affected.length) {
    warning.append(el("h3", "", "Other affected bookmarks"), el("p", "fine", canChooseRelated
      ? "These pages share the selected website data. Check any bookmarks you also want to delete; unchecked bookmarks stay saved."
      : "These bookmarks stay saved, but share the website data being cleared."));
    if (affected.length > 3) {
      const disclosure = el("details", "related-disclosure");
      disclosure.dataset.reviewDisclosure = "retained";
      const selected = [...decisions.related.keys()].filter(id => decisions.selected.has(id)).length;
      disclosure.append(el("summary", "", `${affected.length} saved pages may be affected${canChooseRelated ? ` · ${selected} selected to delete` : ""}`));
      warning.append(disclosure);
      entries = disclosure;
    }
  }
  for (const bookmark of affected) {
    const row = el("div", "affected-entry");
    row.append(canChooseRelated && decisions.related.has(bookmark.id)
      ? model.extraChoice(bookmark)
      : bookmarkSummary(bookmark, false, true));
    entries.append(row);
  }
  if (relatedSites.length) warning.append(el("h3", "", "Other sites sharing selected data"));
  for (const site of relatedSites) warning.append(el("p", "affected-entry", site.host));
  return warning;
}
