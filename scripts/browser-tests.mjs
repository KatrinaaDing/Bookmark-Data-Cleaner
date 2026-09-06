import { execFileSync } from 'node:child_process';
for (const test of ['permissions', 'cleanup', 'storage', 'ui']) {
  execFileSync(process.execPath, [`scripts/${test}-smoke.mjs`], { stdio: 'inherit' });
}
