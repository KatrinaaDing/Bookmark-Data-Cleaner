import { execFileSync } from "node:child_process";
for (const test of [
  "permissions",
  "cleanup",
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
