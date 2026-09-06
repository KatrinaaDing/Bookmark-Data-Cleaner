import assert from "node:assert/strict";
import { launch, pause } from "./browser-harness.mjs";
const browser = await launch();
try {
  const page = await browser.attach(
    `chrome-extension://${browser.id}/app.html#sites`,
  );
  const run = (expression) => browser.evaluate(page.sessionId, expression);
  await pause(100);
  assert.equal(
    await run(
      `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Allow site discovery').hidden`,
    ),
    false,
  );
  assert.equal(
    await run(
      `document.body.textContent.includes('Discovery needs cookie and website access')`,
    ),
    true,
  );
  assert.equal(
    await run(`chrome.permissions.contains({permissions:['history']})`),
    false,
  );
  await run(`chrome.runtime.sendMessage({type:'open-manager'})`);
  await run(`chrome.runtime.sendMessage({type:'open-manager'})`);
  assert.equal(
    await run(
      `chrome.runtime.getContexts({contextTypes:['TAB']}).then(contexts=>contexts.filter(c=>c.documentUrl?.split('#')[0]===chrome.runtime.getURL('app.html')).length)`,
    ),
    1,
  );
  console.log(
    "Unmodified manifest: discovery permission gate, optional history, and single manager tab passed.",
  );
} finally {
  await browser.close();
}
