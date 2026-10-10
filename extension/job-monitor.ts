import { toast, type ToastHandle } from "./components/feedback.js";
import { operationStatus } from "./components/operation-status.js";
import { status } from "./components/dom.js";
import { sendToWorker } from "./browser/messages.js";
import type { Job } from "./core/types.js";

/** A view that reflects the current cleanup job. */
export interface JobObserver {
  setCleanupJob(job?: Job, unavailable?: boolean): void;
  refresh(): Promise<void>;
}

/**
 * Polls the background cleanup job while it runs, shows progress and a result
 * toast once per job, and refreshes observers when it finishes.
 */
export class JobMonitor {
  private observers: JobObserver[] = [];
  private timer: number | undefined;
  private lastJob = "";
  private progressToast?: { jobId: string; handle: ToastHandle };
  private resultToast?: { jobId: string; handle: ToastHandle };

  /** @param operation Inline status area for a running job. */
  constructor(private readonly operation: HTMLElement) {}

  observe(...observers: JobObserver[]): void {
    this.observers.push(...observers);
  }

  /** Dismiss a finished job's result, e.g. when a new review starts. */
  dismissResult(): void {
    this.resultToast?.handle.dismiss();
  }

  readonly show = (job: Job): void => {
    for (const observer of this.observers) observer.setCleanupJob(job);
    this.updateToasts(job);
    const running = job.status === "running";
    if (running) this.operation.replaceChildren(operationStatus(job));
    else this.operation.replaceChildren();
    this.lastJob = JSON.stringify(job);
    if (running && !this.timer)
      this.timer = window.setInterval(() => {
        void this.check();
      }, 1000);
    else if (!running && this.timer) {
      this.stopPolling();
      for (const observer of this.observers) void observer.refresh();
    }
  };

  async check(): Promise<void> {
    try {
      const job = await sendToWorker({ type: "get-job" });
      if (job && JSON.stringify(job) !== this.lastJob) this.show(job);
      else if (!job) for (const observer of this.observers) observer.setCleanupJob();
    } catch {
      for (const observer of this.observers) observer.setCleanupJob(undefined, true);
      this.progressToast?.handle.dismiss();
      this.progressToast = undefined;
      toast("Cleanup status is unavailable. Reopen the app before starting another cleanup.", "error");
      this.operation.replaceChildren(
        status(
          "Cleanup status is unavailable. Reopen the app to check before starting another cleanup.",
        ),
      );
      this.stopPolling();
    }
  }

  private updateToasts(job: Job): void {
    if (job.status === "running") {
      if (this.resultToast) {
        this.resultToast.handle.dismiss();
        this.resultToast = undefined;
      }
      if (this.progressToast?.jobId !== job.id) {
        this.progressToast?.handle.dismiss();
        this.progressToast = {
          jobId: job.id,
          handle: toast("Cleanup in progress…", "info", { persistent: true, busy: true }),
        };
      }
      return;
    }
    if (this.progressToast?.jobId === job.id) {
      this.progressToast.handle.dismiss();
      this.progressToast = undefined;
    }
    if (job.dismissed) {
      this.resultToast?.handle.dismiss();
      this.resultToast = undefined;
      return;
    }
    if (this.resultToast?.jobId !== job.id) {
      const incomplete = job.status === "unverified" || job.outcomes.some(outcome => outcome.status !== "completed");
      this.resultToast?.handle.dismiss();
      let handle: ToastHandle;
      const report = operationStatus(job, () => {
        handle.dismiss();
        // Persist the dismissal so a reload does not show the same results again.
        void sendToWorker({ type: "dismiss-job", id: job.id }).catch(() => {});
      });
      handle = toast(report, incomplete ? "error" : "success", { persistent: true, className: "toast-operation" });
      this.resultToast = { jobId: job.id, handle };
    }
  }

  private stopPolling(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
