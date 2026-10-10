import type { CleanupPlan, Job } from "./types.js";
import {
  buildCleanupPlan,
  executeCleanup,
  type CleanupOperations,
} from "./cleanup.js";
export interface JobStorage {
  read(): Promise<Job | undefined>;
  write(job: Job): Promise<void>;
}
export class JobCoordinator {
  private current?: Job;
  private ready: Promise<void>;
  constructor(
    private storage: JobStorage,
    private operations: CleanupOperations,
  ) {
    this.ready = storage.read().then(async (saved) => {
      this.current = saved;
      if (saved?.status === "running") {
        saved.status = "unverified";
        saved.outcomes.push({
          target: "Interrupted cleanup",
          kind: "data",
          status: "unverified",
          message:
            "The browser stopped before completion was recorded. Review the sites before starting another cleanup.",
        });
        await storage.write(saved);
      }
    });
  }
  async get(): Promise<Job | undefined> {
    await this.ready;
    return this.current;
  }
  /** Remember that the user closed a finished job's results. */
  async dismiss(id: string): Promise<void> {
    await this.ready;
    if (!this.current || this.current.id !== id || this.current.status === "running") return;
    this.current.dismissed = true;
    await this.storage.write(this.current);
  }
  async start(input: CleanupPlan, initiatingBookmarkIds: string[] = []): Promise<Job> {
    await this.ready;
    if (this.current?.status === "running")
      throw Error("A cleanup is already running.");
    const plan = buildCleanupPlan(input.sites, input.options, input.folders);
    const job: Job = {
      id: crypto.randomUUID(),
      status: "running",
      completed: 0,
      total: plan.sites.length,
      outcomes: [],
      busyBookmarkIds: [...new Set([
        ...initiatingBookmarkIds,
        ...plan.sites.flatMap(site => site.bookmarks.map(bookmark => bookmark.id)),
      ])],
    };
    const previous = this.current;
    this.current = job;
    try {
      await this.storage.write(job);
    } catch (error) {
      this.current = previous;
      throw error;
    }
    void this.run(plan, job);
    return structuredClone(job);
  }
  private async run(plan: CleanupPlan, job: Job): Promise<void> {
    try {
      job.outcomes = await executeCleanup(
        plan,
        this.operations,
        async (completed, outcomes) => {
          job.completed = completed;
          job.outcomes = outcomes;
          await this.storage.write(job);
        },
      );
      job.status = "finished";
    } catch {
      job.status = "unverified";
      job.outcomes.push({
        target: "Cleanup",
        kind: "data",
        status: "unverified",
        message:
          "Completion could not be recorded. Refresh and review before retrying.",
      });
    }
    await this.storage.write(job).catch(() => {});
  }
}
