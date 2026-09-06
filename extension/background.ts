import { JobCoordinator } from "./core/jobs.js";
import { removeData } from "./browser/site-data.js";
import { removeBookmark, removeEmptyFolder } from "./browser/bookmarks.js";
import { errorMessage } from "./helpers/sites.js";
import type { CleanupPlan, Job } from "./core/types.js";
const jobs = new JobCoordinator(
  {
    read: async () => {
      const value = await chrome.storage.session.get("cleanupJob");
      return value.cleanupJob as Job | undefined;
    },
    write: async (job) => {
      await chrome.storage.session.set({ cleanupJob: job });
    },
  },
  { removeData, removeBookmark, removeFolder: removeEmptyFolder },
);
async function openManager(): Promise<void> {
  const url = chrome.runtime.getURL("page.html");
  const tabs = await chrome.tabs.query({ url: `${url}*` });
  if (tabs[0]?.id !== undefined) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else await chrome.tabs.create({ url });
}
chrome.runtime.onMessage.addListener(
  (message: { type?: string; plan?: CleanupPlan }, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    let operation: Promise<unknown>;
    if (message.type === "open-manager") operation = openManager();
    else if (message.type === "get-job") operation = jobs.get();
    else if (message.type === "start-cleanup" && message.plan)
      operation = jobs.start(message.plan);
    else return;
    void operation.then(
      (value) => respond({ ok: true, value }),
      (error) => respond({ ok: false, error: errorMessage(error) }),
    );
    return true;
  },
);
