import { JobCoordinator } from "./core/jobs.js";
import { removeData } from "./browser/site-data.js";
import { removeBookmark, removeEmptyFolder } from "./browser/bookmarks.js";
import type { WorkerRequest, WorkerResponse } from "./browser/messages.js";
import { errorMessage } from "./helpers/errors.js";
import type { Job } from "./core/types.js";
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
function handle(message: WorkerRequest): Promise<unknown> | undefined {
  switch (message.type) {
    case "open-manager":
      return openManager();
    case "get-job":
      return jobs.get();
    case "start-cleanup":
      return message.plan ? jobs.start(message.plan, message.initiatingBookmarkIds) : undefined;
  }
}
chrome.runtime.onMessage.addListener(
  (message: WorkerRequest, sender, respond: (response: WorkerResponse<unknown>) => void) => {
    if (sender.id !== chrome.runtime.id) return;
    const operation = handle(message);
    if (!operation) return;
    void operation.then(
      (value) => respond({ ok: true, value }),
      (error) => respond({ ok: false, error: errorMessage(error) }),
    );
    return true;
  },
);
