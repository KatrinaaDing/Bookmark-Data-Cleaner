export interface CookieRef {
  name: string;
  domain: string;
  hostOnly?: boolean;
  path: string;
  secure: boolean;
  httpOnly?: boolean;
  storeId: string;
  partitionKey?: chrome.cookies.CookiePartitionKey;
}
export interface BookmarkRef {
  id: string;
  title: string;
  url: string;
  path: string;
  parentId?: string;
  index?: number;
  dateAdded?: number;
  dateLastUsed?: number;
  unmodifiable?: boolean;
}
export interface BookmarkFolder {
  id: string;
  title: string;
  path: string;
  unmodifiable?: boolean;
}
export interface SiteRecord {
  id: string;
  host: string;
  origins: string[];
  urls: string[];
  cookies: CookieRef[];
  bookmarks: BookmarkRef[];
  lastVisit?: number;
  cookiesAvailable?: boolean;
}
export interface ScanResult {
  sites: SiteRecord[];
  coverage: string;
  warnings: string[];
}
export interface CleanupOptions {
  cookies: boolean;
  savedData: boolean;
  cache: boolean;
  workers: boolean;
  bookmarks: boolean;
}
export interface FolderRef {
  id: string;
  depth: number;
}
export interface CleanupPlan {
  sites: SiteRecord[];
  options: CleanupOptions;
  folders: FolderRef[];
}
export interface Outcome {
  target: string;
  label?: string;
  /** Deletion was not attempted because required website-data cleanup failed. */
  retained?: boolean;
  kind: "data" | "bookmark" | "folder";
  status: "completed" | "failed" | "unverified";
  message: string;
}
export interface Job {
  id: string;
  status: "running" | "finished" | "unverified";
  completed: number;
  total: number;
  outcomes: Outcome[];
  /** Presentation targets, including initiating bookmarks kept during data-only cleanup. */
  busyBookmarkIds?: string[];
}
export const noCleanup: CleanupOptions = {
  cookies: false,
  savedData: false,
  cache: false,
  workers: false,
  bookmarks: false,
};
