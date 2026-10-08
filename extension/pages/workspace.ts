import { permissionAction } from "../components/permission-action.js";
import { infoPopover, toast } from "../components/feedback.js";
import { currentForm, requestLeave } from "../components/form-session.js";
import { iconButton } from "../components/icons.js";
import type { DetailsDrawer } from "../components/details-drawer.js";
import { on } from "../components/events.js";
import { el, heading, status } from "../components/dom.js";
import { hasHistoryAccess, requestHistory } from "../browser/history.js";
import type { Job } from "../core/types.js";

/** What the app shell needs from each workspace route. */
export interface WorkspacePage {
  element: HTMLElement;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  invalidate: () => void;
  setCleanupJob: (job?: Job, unavailable?: boolean) => void;
}

/** Page heading with an info popover, feedback area and list container. */
export function workspaceLayout(options: {
  title: string;
  description: string;
  infoLabel: string;
  info: string;
}) {
  const element = el("section");
  element.append(heading(options.title, options.description));
  element.querySelector("h1")!.append(infoPopover(options.infoLabel, options.info));
  const feedback = el("div");
  const list = el("div", "workspace-list");
  const workspace = el("div", "workspace");
  workspace.append(list);
  return {
    element,
    feedback,
    list,
    /** Add the toolbar (and anything above the list) and then the list itself. */
    mount(...above: HTMLElement[]) {
      element.append(...above, workspace);
    },
  };
}

/** "Enable visit dates" control, hidden while history access is granted. */
export function historyAccessAction(onGranted: () => Promise<void>) {
  const element = permissionAction({
    label: "Enable visit dates", icon: "history", request: requestHistory,
    granted: "Visit dates enabled.", declined: "History access declined. Cleanup still works.",
    onGranted,
  });
  element.title = "Optional. Asks for browsing-history access to show when each site was last visited.";
  return {
    element,
    sync() {
      void hasHistoryAccess().then(
        (allowed) => { element.hidden = allowed; },
        () => { element.hidden = false; },
      );
    },
  };
}

/** The running (or unknown) cleanup job that blocks starting another one. */
export class CleanupJobState {
  private job?: Job;
  private unavailable = true;
  get blocked(): boolean {
    return this.unavailable || this.job?.status === "running";
  }
  /** Bookmarks shown as busy while their cleanup runs. */
  busyBookmarkIds(): Set<string> {
    return new Set(this.job?.status === "running" ? this.job.busyBookmarkIds ?? [] : []);
  }
  /** Returns false when the job, its status and availability are all unchanged. */
  set(job: Job | undefined, unavailable: boolean): boolean {
    if (this.unavailable === unavailable && this.job?.id === job?.id && this.job?.status === job?.status)
      return false;
    this.job = job;
    this.unavailable = unavailable;
    return true;
  }
}

export interface LoadRun {
  /** False once a newer load or an invalidation superseded this one. */
  isCurrent(): boolean;
  announce: boolean;
}

/**
 * Load/refresh lifecycle shared by both workspaces: one load at a time, stale
 * results ignored, unsaved forms resolved before a forced refresh, and a
 * busy refresh button and list while reading.
 */
export class WorkspaceLoader {
  loaded = false;
  busy = false;
  private generation = 0;
  readonly refreshButton = iconButton("refresh", "Refresh", () => void this.load(true));

  constructor(private readonly options: {
    list: HTMLElement;
    feedback: HTMLElement;
    /** Noun for status text, e.g. "bookmarks" in "Loading bookmarks…". */
    subject: string;
    changed(): void;
    beforeLoad?(): void;
    run(load: LoadRun): Promise<void>;
    failed(): void;
  }) {}

  async load(force = false, announce = force): Promise<void> {
    if (this.busy || (this.loaded && !force)) return;
    if (force && !(await requestLeave())) return;
    if (this.busy) return;
    const current = ++this.generation;
    const isCurrent = () => current === this.generation;
    const { list, feedback, subject } = this.options;
    this.setBusy(true);
    feedback.replaceChildren(status(this.loaded ? `Refreshing ${subject}…` : `Loading ${subject}…`, true));
    list.setAttribute("aria-busy", "true");
    this.options.beforeLoad?.();
    try {
      await this.options.run({ isCurrent, announce });
    } catch {
      if (isCurrent()) this.options.failed();
    } finally {
      if (isCurrent()) {
        list.removeAttribute("aria-busy");
        this.setBusy(false);
      }
    }
  }

  /** Reload quietly after cleanup, unless the page was never loaded or a form is open. */
  refresh(): Promise<void> {
    return this.loaded && !currentForm() ? this.load(true, false) : Promise.resolve();
  }

  /** Another workspace changed shared data; reload on the next visit. */
  invalidate(): void {
    this.generation++;
    this.loaded = false;
    this.busy = false;
  }

  private setBusy(busy: boolean) {
    this.busy = busy;
    this.refreshButton.disabled = busy;
    this.refreshButton.setAttribute("aria-busy", String(busy));
    this.refreshButton.classList.toggle("refreshing", busy);
    this.options.changed();
  }
}

/** Report a failed load, keeping the previous list when there is one. */
export function reportLoadFailure(feedback: HTMLElement, toastMessage: string, message: string): void {
  toast(toastMessage, "error");
  feedback.replaceChildren(status(message));
}

/**
 * Which row the shared details drawer inspects for one workspace, and keeping its
 * content current. Updates wait while an inline form is open so drafts survive.
 */
export class Inspection {
  id?: string;
  private request = 0;
  private deferred = false;

  constructor(private readonly options: {
    drawer: DetailsDrawer;
    list: HTMLElement;
    /** Focus-key prefix of rows in this workspace, e.g. "site". */
    kind: "bookmark" | "site";
    render(id: string): HTMLElement;
    /** Called after content is shown or replaced. */
    afterRender?(id: string): void;
  }) {
    on("editor-closed", () => {
      if (!this.deferred) return;
      this.deferred = false;
      this.update();
    });
  }

  private key(id: string): string {
    return `${this.options.kind}:${id}`;
  }

  /** The drawer currently shows this workspace's inspected row. */
  isOpen(): this is { id: string } {
    return !!this.id && this.options.drawer.isOpen(this.key(this.id));
  }

  async open(id: string, trigger: HTMLElement): Promise<void> {
    if (!(await requestLeave())) return;
    this.id = id;
    // Prefer the current row: the list may have been rebuilt since the click.
    const source = this.options.list.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(this.key(id))}"]`) ?? trigger;
    this.request = this.options.drawer.open(this.options.render(id), source);
    this.options.afterRender?.(id);
  }

  /** Re-render open details from current data. */
  update(): void {
    if (!this.isOpen()) return;
    if (currentForm()) {
      this.deferred = true;
      return;
    }
    this.show(this.options.render(this.id));
    this.options.afterRender?.(this.id);
  }

  /** Replace open details with `content`, unless the inspection has since changed. */
  show(content: HTMLElement): void {
    this.options.drawer.update(content, this.request);
  }
}
