import { rm, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await rm('.test-build', { recursive: true, force: true });
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json'], { stdio: 'inherit' });
  const files = (await readdir('.test-build/tests')).filter(name => name.endsWith('.test.js')).map(name => `.test-build/tests/${name}`);
  execFileSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
} catch { process.exitCode = 1; }
