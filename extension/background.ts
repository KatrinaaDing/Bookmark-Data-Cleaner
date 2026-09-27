import { JobCoordinator } from "./core/jobs.js";
import { removeData } from "./browser/site-data.js";
import { removeBookmark, removeEmptyFolder } from "./browser/bookmarks.js";
import { errorMessage } from "./helpers/errors.js";
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
  const url = chrome.runtime.getURL("app.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.TAB],
  });
  const tab = contexts.find(
    (context) =>
      context.documentUrl?.split("#")[0] === url && context.tabId >= 0,
  );
  if (tab) {
    await chrome.tabs.update(tab.tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else await chrome.tabs.create({ url });
}
chrome.runtime.onMessage.addListener(
  (message: { type?: string; plan?: CleanupPlan; initiatingBookmarkIds?: string[] }, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    let operation: Promise<unknown>;
    if (message.type === "open-manager") operation = openManager();
    else if (message.type === "get-job") operation = jobs.get();
    else if (message.type === "start-cleanup" && message.plan)
      operation = jobs.start(message.plan, message.initiatingBookmarkIds);
    else return;
    void operation.then(
      (value) => respond({ ok: true, value }),
      (error) => respond({ ok: false, error: errorMessage(error) }),
    );
    return true;
  },
);
