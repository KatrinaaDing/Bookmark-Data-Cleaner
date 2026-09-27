import { sendToWorker } from "./browser/messages.js";
try {
  await sendToWorker({ type: "open-manager" });
  window.close();
} catch {
  document.body.textContent =
    "Could not open the app. Reload the extension and try again.";
}
