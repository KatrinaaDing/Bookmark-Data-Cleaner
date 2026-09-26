import { execFileSync } from "node:child_process";
for (const test of [
  "permissions",
  "cleanup",
  "cookie-scope",
  "cleanup-review",
  "storage",
  "ui",
  "folder-motion",
  "bookmark-mutation",
  "bookmark-selection",
  "bookmark-management",
  "ui-refinement",
  "ui-contract",
  "bookmark-search",
  "cleanup-ux",
  "site-discovery",
  "results",
]) {
  execFileSync(process.execPath, [`scripts/${test}-smoke.mjs`], {
    stdio: "inherit",
  });
}
