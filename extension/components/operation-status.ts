import type { Job } from "../core/types.js";
import { button, el, status } from "./dom.js";
export function operationStatus(job: Job): HTMLElement {
  const panel = el("section", "operation");
  panel.setAttribute("aria-label", "Cleanup results");
  const failed = job.outcomes.filter((o) => o.status === "failed").length,
    unverified = job.outcomes.filter((o) => o.status === "unverified").length;
  panel.append(
    status(
      job.status === "running"
        ? `Cleaning… ${job.completed} of ${job.total} sites processed`
        : job.status === "unverified"
          ? "Cleanup interrupted — review before retrying"
          : failed || unverified
            ? "Cleanup finished with items to review"
            : "Selected cleanup requests completed",
      job.status === "running",
    ),
  );
  if (job.status !== "running")
    panel.append(
      el(
        "p",
        "fine",
        `${job.outcomes.filter((o) => o.status === "completed").length} completed · ${failed} failed · ${unverified} unverified or kept. Completion does not guarantee every browser trace is gone.`,
      ),
    );
  if (failed)
    panel.append(
      el(
        "p",
        "fine",
        "To retry, select the failed sites and categories above and review a new cleanup. Successful work is not repeated automatically.",
      ),
    );
  if (job.outcomes.length) {
    const details = el("details");
    details.open = failed > 0 || unverified > 0;
    details.append(el("summary", "", "Operation details"));
    const list = el("ul");
    for (const result of job.outcomes)
      list.append(
        el(
          "li",
          result.status === "failed" ? "error" : "",
          `${result.target}: ${result.message}`,
        ),
      );
    details.append(list);
    panel.append(details);
  }
  if (job.status !== "running")
    panel.append(button("Dismiss results", () => panel.remove(), "quiet"));
  return panel;
}
