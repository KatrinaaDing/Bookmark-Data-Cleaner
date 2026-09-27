import type { CleanupOptions } from "./types.js";

export type DataCategory = Exclude<keyof CleanupOptions, "bookmarks">;

export interface CategoryInfo<K extends keyof CleanupOptions> {
  key: K;
  label: string;
  /** Consequence shown when choosing this category. */
  description: string;
}

/** Website-data categories in execution and display order. */
export const DATA_CATEGORIES: readonly CategoryInfo<DataCategory>[] = [
  {
    key: "cookies",
    label: "Cookies and sign-in data",
    description: "May sign you out, including from related subdomains.",
  },
  {
    key: "savedData",
    label: "Saved site data",
    description: "Offline and unsynced work may be lost.",
  },
  {
    key: "cache",
    label: "Cached resources",
    description: "Cached files and offline copies, if present.",
  },
  {
    key: "workers",
    label: "Background workers",
    description: "Removes offline and background functionality until you revisit.",
  },
];

export const BOOKMARK_CATEGORY: CategoryInfo<"bookmarks"> = {
  key: "bookmarks",
  label: "Delete bookmarks",
  description: "Bookmarks are kept if their selected data cleanup fails.",
};

/** Any website-data category selected. */
export function hasData(options: CleanupOptions): boolean {
  return DATA_CATEGORIES.some(({ key }) => options[key]);
}
/** Categories cleared per origin through browsingData (everything except cookies). */
export function hasOriginData(options: CleanupOptions): boolean {
  return options.savedData || options.cache || options.workers;
}
