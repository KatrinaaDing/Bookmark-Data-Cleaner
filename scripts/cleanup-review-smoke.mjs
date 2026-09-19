import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launch, pause } from "./browser-harness.mjs";

const browser = await launch({ grantTestPermissions: true });
try {
  const page = await browser.attach(`chrome-extension://${browser.id}/app.html`);
  const run = (expression) => browser.evaluate(page.sessionId, expression);
  await run(`(async () => {
    const { cleanupDialog } = await import('./components/cleanup-dialog.js');
    window.prepared = [];
    window.started = 0;
    window.openReview = () => cleanupDialog(async (options) => {
      window.prepared.push(options);
      if (window.prepareGate) await window.prepareGate;
      return { sites: [{ id: 'review.test', host: 'review.test', origins: ['https://review.test'], urls: [], cookies: [],
        bookmarks: [{ id: 'review-fixture', title: 'Review fixture', url: 'https://review.test/', path: 'Saved' }] }] };
    }, true, () => { window.started++; });
    window.openReview();
  })()`);
  await pause(100);
  const review = `Array.from(document.querySelectorAll('.cleanup-dialog button')).find(button => button.textContent === 'Review cleanup')`;
  const category = (label) => `Array.from(document.querySelectorAll('.cleanup-dialog label')).find(label => label.textContent === ${JSON.stringify(label)}).querySelector('input')`;
  assert.equal(await run(`${review}.disabled`), true, "No category means no review action");
  await run(`${review}.click()`);
  assert.equal(await run(`window.prepared.length`), 0, "Disabled review does not prepare a plan");
  await run(`${category("Remove selected bookmarks")}.click()`);
  assert.equal(await run(`${review}.disabled`), false);
  await run(`${category("Remove selected bookmarks")}.click()`);
  assert.equal(await run(`${review}.disabled`), true, "Removing the last choice disables review again");
  await run(`${category("Remove selected bookmarks")}.click(); window.prepareGate = new Promise(resolve => { window.releasePrepare = resolve; }); ${review}.click()`);
  assert.equal(await run(`Array.from(document.querySelectorAll('.cleanup-dialog input, .cleanup-dialog .dialog-actions button')).every(control => control.disabled)`), true, "Preparation freezes choices and actions");
  await run(`window.releasePrepare(); window.prepareGate = undefined`);
  await pause(100);
  assert.equal(await run(`document.activeElement.id`), "cleanup-title", "Review starts on its summary heading, not Confirm");
  assert.equal(await run(`document.activeElement.textContent`), "Review this cleanup");
  await browser.cmd("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }, page.sessionId);
  await browser.cmd("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }, page.sessionId);
  assert.equal(await run(`window.started`), 0, "Enter at review arrival does not start cleanup");
  assert.equal(await run(`document.querySelector('.cleanup-dialog').open`), true);
  await run(`Array.from(document.querySelectorAll('.cleanup-dialog button')).find(button => button.textContent === 'Back').click()`);
  await pause(80);
  assert.equal(await run(`${category("Remove selected bookmarks")}.checked`), true, "Back retains explicit choices");
  assert.equal(await run(`${review}.disabled`), false);

  // An unavailable cookie choice must not leave a checked, disabled category in the next plan.
  await run(`${category("Remove selected bookmarks")}.click(); ${category("Cookies and sign-in data")}.click(); ${review}.click()`);
  await pause(80);
  await run(`chrome.permissions.contains = async () => false; Array.from(document.querySelectorAll('.cleanup-dialog button')).find(button => button.textContent === 'Back').click()`);
  await pause(80);
  assert.equal(await run(`${category("Cookies and sign-in data")}.disabled`), true);
  assert.equal(await run(`${category("Cookies and sign-in data")}.checked`), false);
  assert.equal(await run(`${review}.disabled`), true, "Unavailable cookie access cannot enable review");
  await run(`${category("Remove selected bookmarks")}.click(); ${review}.click()`);
  await pause(80);
  assert.equal(await run(`window.prepared.at(-1).cookies`), false, "The next plan excludes the unavailable, unchecked cookie category");
  assert.equal(await run(`window.prepared.at(-1).bookmarks`), true);

  await mkdir("dist/review", { recursive: true });
  for (const [name, width, height] of [["desktop", 1360, 900], ["narrow", 390, 844]]) {
    await browser.cmd("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    assert.equal(await run(`document.documentElement.scrollWidth > innerWidth`), false);
    const shot = await browser.cmd("Page.captureScreenshot", { format: "png" }, page.sessionId);
    await writeFile(`dist/review/${name}.png`, Buffer.from(shot.data, "base64"));
  }
  await browser.cmd("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }, page.sessionId);
  await pause(80);
  assert.equal(await run(`!!document.querySelector('.cleanup-dialog')`), false, "Escape dismisses review without cleanup");
  assert.equal(await run(`window.started`), 0);
  console.log("Cleanup review: category availability, frozen preparation, safe keyboard focus, Back, permission loss and Escape passed.");
} finally {
  await browser.close();
}
