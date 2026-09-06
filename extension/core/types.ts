export interface CookieRef {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  storeId: string;
  partitionKey?: chrome.cookies.CookiePartitionKey;
}
export interface BookmarkRef { id: string; title: string; url: string; path: string; }
export interface SiteRecord {
  id: string;
  host: string;
  origins: string[];
  urls: string[];
  cookies: CookieRef[];
  bookmarks: BookmarkRef[];
  lastVisit?: number;
}
export interface ScanResult { sites: SiteRecord[]; coverage: string; warnings: string[]; }
export interface CleanupOptions { cookies: boolean; savedData: boolean; cache: boolean; workers: boolean; bookmarks: boolean; }
export interface FolderRef { id: string; depth: number; }
export interface CleanupPlan { sites: SiteRecord[]; options: CleanupOptions; folders: FolderRef[]; }
export interface Outcome { target: string; kind: 'data' | 'bookmark' | 'folder'; status: 'completed' | 'failed' | 'unverified'; message: string; }
export interface Job { id: string; status: 'running' | 'finished' | 'unverified'; completed: number; total: number; outcomes: Outcome[]; }
export const noCleanup: CleanupOptions = { cookies: false, savedData: false, cache: false, workers: false, bookmarks: false };
