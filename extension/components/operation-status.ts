import type { Job, Outcome } from "../core/types.js";
import { el, status } from "./dom.js";
import { iconButton } from "./icons.js";

export function operationStatus(job: Job): HTMLElement {
  const panel = el("section", "operation");
  panel.setAttribute("aria-label", "Cleanup results");
  const completed = job.outcomes.filter(outcome => outcome.status === "completed");
  const attention = job.outcomes.filter(outcome => outcome.status !== "completed");
  const kept = attention.filter(outcome => outcome.kind === "bookmark" && outcome.retained === true);
  const failed = attention.filter(outcome => outcome.status === "failed");
  // Old session results without explicit retention evidence remain uncertain.
  const unverified = attention.filter(outcome => outcome.status === "unverified" && !kept.includes(outcome));
  const running = job.status === "running";
  const interrupted = job.status === "unverified";
  const header = el("div", "operation-header");
  header.append(status(running
    ? job.total ? `Cleaning… ${job.completed} of ${job.total} sites processed` : "Cleaning selected folders…"
    : interrupted ? "Cleanup interrupted — review before retrying"
      : attention.length ? "Cleanup finished with items to review" : "Selected cleanup requests completed", running));
  if (!running) header.append(iconButton("close", "Dismiss results", () => {
    panel.remove();
    document.getElementById("content")?.focus({preventScroll:true});
  }));
  panel.append(header);

  const counts: string[] = [];
  const count = (amount: number, singular: string, plural: string) => {
    if (amount) counts.push(`${amount} ${amount === 1 ? singular : plural}`);
  };
  count(completed.filter(outcome => outcome.kind === "data").length, "website-data request completed", "website-data requests completed");
  count(completed.filter(outcome => outcome.kind === "bookmark").length, "bookmark removed", "bookmarks removed");
  count(completed.filter(outcome => outcome.kind === "folder").length, "empty folder removed", "empty folders removed");
  count(kept.length, "bookmark kept", "bookmarks kept");
  count(failed.length, "operation failed", "operations failed");
  count(unverified.length, "outcome unverified", "outcomes unverified");
  if (counts.length || !running) panel.append(el("p", "fine operation-counts", counts.join(" · ") || "No completed operations recorded."));
  if (interrupted || attention.length) panel.append(el("p", "fine operation-guidance",
    "Review these results before selecting a new cleanup. Nothing is retried automatically."));

  function results(label: string, outcomes: Outcome[], open = false) {
    if (!outcomes.length) return;
    const details = el("details", "operation-details");
    details.open = open;
    details.append(el("summary", "", `${label} (${outcomes.length})`));
    const list = el("ul");
    for (const outcome of outcomes) {
      const row = el("li", outcome.status === "failed" ? "error" : "");
      const name = outcome.label || (outcome.kind === "data" ? outcome.target : `${outcome.kind === "bookmark" ? "Bookmark" : "Folder"} ${outcome.target}`);
      row.append(el("span", "result-target", name), el("span", "", outcome.message));
      list.append(row);
    }
    details.append(list);
    if (outcomes.some(outcome => outcome.kind === "data" && outcome.status === "completed"))
      details.append(el("p", "fine", "Completed data requests do not guarantee every browser trace is gone."));
    panel.append(details);
  }
  results("Items to review", [...failed, ...unverified, ...kept], !running);
  results("Completed operations", completed);
  return panel;
}
