import { rm, mkdir, cp, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const source = "extension";
const target = "dist/extension";
await rm(target, { recursive: true, force: true });
try {
  execFileSync(process.execPath, ["node_modules/typescript/bin/tsc"], {
    stdio: "inherit",
  });
  execFileSync(
    process.execPath,
    ["node_modules/typescript/bin/tsc", "-p", "tsconfig.worker.json"],
    { stdio: "inherit" },
  );
  await mkdir(target, { recursive: true });
  await cp(source, target, {
    recursive: true,
    filter: (path) => !/\.ts$/.test(path),
  });
} catch (error) {
  await rm(target, { recursive: true, force: true });
  process.exitCode = 1;
}
