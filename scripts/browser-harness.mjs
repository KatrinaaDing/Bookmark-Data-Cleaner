import { mkdtemp, readFile, rm, cp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
export const pause = ms => new Promise(r => setTimeout(r, ms));
export async function launch({ grantTestPermissions = false } = {}) {
  if (!process.env.CHROME_BIN) throw Error('Set CHROME_BIN to Chrome for Testing. Only disposable profiles are used.');
  const profile = await mkdtemp(join(tmpdir(), 'bookmark-cleaner-test-'));
  const proc = spawn(process.env.CHROME_BIN, [`--user-data-dir=${profile}`, '--headless=new', '--remote-debugging-port=0', '--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-background-networking', '--no-proxy-server', 'about:blank'], { stdio: 'ignore' });
  let ws, counter = 0; const pending = new Map();
  async function close() { if (ws?.readyState === WebSocket.OPEN) { await cmd('Browser.close').catch(() => {}); ws.close(); } proc.kill(); await pause(200); await rm(profile, { recursive: true, force: true }); }
  function cmd(method, params = {}, sessionId) { return new Promise((resolve, reject) => { const id = ++counter; const timer = setTimeout(() => { pending.delete(id); reject(Error(`Timeout: ${method}`)); }, 20000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); }
  async function evaluate(sessionId, expression) { const result = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
  async function attach(url) { const { targetId } = await cmd('Target.createTarget', { url }); const { sessionId } = await cmd('Target.attachToTarget', { targetId, flatten: true }); await cmd('Runtime.enable', {}, sessionId); for (let i = 0; i < 100; i++) { try { if (await evaluate(sessionId, 'document.readyState === "complete"') ) return { targetId, sessionId }; } catch {} await pause(50); } throw Error(`Page did not load: ${url}`); }
  try {
    let lines;
    for (let i = 0; i < 150; i++) { try { lines = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n'); break; } catch {} if (proc.exitCode !== null) throw Error('Chrome exited'); await pause(100); }
    if (!lines) throw Error('Chrome did not start');
    ws = new WebSocket(`ws://127.0.0.1:${lines[0]}${lines[1]}`);
    await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
    ws.addEventListener('message', event => { const message = JSON.parse(event.data); const task = pending.get(message.id); if (!task) return; pending.delete(message.id); clearTimeout(task.timer); message.error ? task.reject(Error(JSON.stringify(message.error))) : task.resolve(message.result); });
    let extensionPath = resolve('dist/extension');
    if (grantTestPermissions) {
      extensionPath = join(profile, 'test-extension');
      await cp(resolve('dist/extension'), extensionPath, { recursive: true });
      const manifestPath = join(extensionPath, 'manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      manifest.permissions = [...new Set([...manifest.permissions, ...(manifest.optional_permissions ?? [])])];
      manifest.host_permissions = manifest.optional_host_permissions;
      delete manifest.optional_permissions; delete manifest.optional_host_permissions;
      await writeFile(manifestPath, JSON.stringify(manifest));
    }
    const { id } = await cmd('Extensions.loadUnpacked', { path: extensionPath, enableInIncognito: false });
    return { cmd, evaluate, attach, close, id };
  } catch (error) { await close(); throw error; }
}
