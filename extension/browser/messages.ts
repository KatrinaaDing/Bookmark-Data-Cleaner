import type { CleanupPlan, Job } from "../core/types.js";

/** Requests handled by the background service worker. */
export type WorkerRequest =
  | { type: "open-manager" }
  | { type: "get-job" }
  | { type: "dismiss-job"; id: string }
  | { type: "start-cleanup"; plan: CleanupPlan; initiatingBookmarkIds?: string[] };

export interface WorkerResults {
  "open-manager": void;
  "get-job": Job | undefined;
  "dismiss-job": void;
  "start-cleanup": Job;
}

export type WorkerResponse<T> = { ok: true; value: T } | { ok: false; error: string };

export async function sendToWorker<R extends WorkerRequest>(
  message: R,
): Promise<WorkerResults[R["type"]]> {
  const response = (await chrome.runtime.sendMessage(message)) as WorkerResponse<
    WorkerResults[R["type"]]
  >;
  if (!response.ok) throw Error(response.error || "The extension could not complete this request.");
  return response.value;
}
