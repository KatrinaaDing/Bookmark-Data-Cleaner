import type { BookmarkRef, SiteRecord } from "../core/types.js";
import { dateText } from "../helpers/format.js";
import { el } from "./dom.js";
import { icon } from "./icons.js";

/** What a bookmark row shows to help spot abandoned entries. */
export interface BookmarkSignals {
  /** Latest recorded use: the bookmark was opened or its site was visited. */
  lastActivity?: number;
  /** Detected cookies for the bookmark's site; undefined without cookie access. */
  cookies?: number;
  /** Visit dates and cookies are still loading. */
  loading: boolean;
}

export const NO_RECORDED_USE = "No recorded use";

/** Combine bookmark-open and site-visit dates; neither is required. */
export function bookmarkSignals(
  bookmark: BookmarkRef,
  site: SiteRecord | undefined,
  loading: boolean,
): BookmarkSignals {
  const dates = [bookmark.dateLastUsed, site?.lastVisit].filter((time): time is number => !!time);
  return {
    ...(dates.length ? { lastActivity: Math.max(...dates) } : {}),
    ...(site?.cookiesAvailable !== false && site ? { cookies: site.cookies.length } : {}),
    loading,
  };
}

/** Age filter for the bookmark workspace. Missing dates are never treated as old. */
export type UseFilter = "all" | "180" | "365" | "730" | "never";

export const USE_FILTER_OPTIONS: readonly (readonly [UseFilter, string])[] = [
  ["all", "Any recorded use"],
  ["180", "Unused for 6 months"],
  ["365", "Unused for 1 year"],
  ["730", "Unused for 2 years"],
  ["never", NO_RECORDED_USE],
];

export function matchesUseFilter(filter: UseFilter, signals: BookmarkSignals, now = Date.now()): boolean {
  if (filter === "all") return true;
  if (filter === "never") return signals.lastActivity === undefined;
  if (signals.lastActivity === undefined) return false;
  return now - signals.lastActivity > Number(filter) * 86_400_000;
}

/** Date and cookie badge for a bookmark row; rebuilt in place when signals change. */
export function renderSignals(target: HTMLElement, signals: BookmarkSignals): void {
  target.replaceChildren();
  if (signals.cookies) {
    const cookies = el("span", "row-cookies");
    const label = `Detected cookies: ${signals.cookies}`;
    cookies.setAttribute("role", "img");
    cookies.setAttribute("aria-label", label);
    cookies.title = label;
    cookies.append(icon("cookie"), el("span", "", String(signals.cookies)));
    target.append(cookies);
  }
  const activity = el("span", "row-activity");
  if (signals.lastActivity) {
    activity.textContent = dateText(signals.lastActivity);
    activity.title = "Last opened or visited";
  } else if (!signals.loading) {
    activity.textContent = "—";
    activity.title = NO_RECORDED_USE;
    activity.setAttribute("aria-label", NO_RECORDED_USE);
  }
  target.append(activity);
}
