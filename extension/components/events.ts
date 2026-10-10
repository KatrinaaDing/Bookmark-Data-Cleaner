/** Document-level events that let independent views react without importing each other. */
export interface AppEvents {
  /** A workspace changed bookmarks; the detail names the source so it can skip itself. */
  "bookmarks-changed": "bookmarks" | "sites";
  /** An inline bookmark editor finished closing. */
  "editor-closed": undefined;
  /** The visible workspace route is about to change. */
  "workspace-route": undefined;
  /** The cleanup dialog opened. */
  "cleanup-review-opened": undefined;
  /** A bookmark was deleted through the extension; the detail is its ID. */
  "bookmark-deleted": string;
}

export function emit<K extends keyof AppEvents>(
  name: K,
  ...detail: AppEvents[K] extends undefined ? [] : [AppEvents[K]]
): void {
  document.dispatchEvent(new CustomEvent(name, { detail: detail[0] }));
}

export function on<K extends keyof AppEvents>(
  name: K,
  handler: (detail: AppEvents[K]) => void,
): void {
  document.addEventListener(name, (event) =>
    handler((event as CustomEvent<AppEvents[K]>).detail),
  );
}
