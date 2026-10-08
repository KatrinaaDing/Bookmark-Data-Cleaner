// Rasterize extension/icons/icon.svg into the PNG sizes the manifest and store need.
// Uses the same disposable-profile browser harness as the smoke tests.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { launch } from "./browser-harness.mjs";

const sizes = [16, 32, 48, 128];
const out = "extension/icons";
const browser = await launch();
try {
  await mkdir(out, { recursive: true });
  // Inline the markup: a data: page cannot load file: resources.
  const svg = await readFile("extension/icons/icon.svg", "utf8");
  for (const size of sizes) {
    const page = await browser.attach(`data:text/html,<style>html,body{margin:0;background:transparent}#art svg{display:block;width:${size}px;height:${size}px}</style><div id="art">${svg}</div>`.replace(/#/g, "%23"));
    await browser.cmd("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await browser.cmd("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } }, page.sessionId);
    const shot = await browser.cmd("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: size, height: size, scale: 1 } }, page.sessionId);
    await writeFile(`${out}/icon-${size}.png`, Buffer.from(shot.data, "base64"));
    console.log(`Wrote ${out}/icon-${size}.png`);
  }
} finally {
  await browser.close();
}
