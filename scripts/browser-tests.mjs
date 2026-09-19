import { execFileSync } from "node:child_process";
for (const test of [
  "permissions",
  "cleanup",
  "cleanup-review",
  "storage",
  "ui",
  "folder-motion",
  "bookmark-mutation",
  "bookmark-management",
  "ui-refinement",
]) {
  execFileSync(process.execPath, [`scripts/${test}-smoke.mjs`], {
    stdio: "inherit",
  });
}
