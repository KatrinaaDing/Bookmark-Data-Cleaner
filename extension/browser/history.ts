const access: chrome.permissions.Permissions = { permissions: ["history"] };
/** At most this many recent entries are read; dates beyond it are unavailable. */
const MAX_ENTRIES = 10000;
export async function readHistory(): Promise<{
  history: chrome.history.HistoryItem[];
  warning?: string;
}> {
  if (!(await hasHistoryAccess()))
    return {
      history: [],
      warning: "History access is off. Last-visit dates are unavailable.",
    };
  try {
    const history = await chrome.history.search({
      text: "",
      startTime: 0,
      maxResults: MAX_ENTRIES,
    });
    return {
      history,
      ...(history.length === MAX_ENTRIES
        ? {
            warning:
              "Dates use the most recent 10,000 retained history entries. Some sites may have no matching record.",
          }
        : {}),
    };
  } catch {
    return {
      history: [],
      warning: "History could not be read. Dates are unavailable.",
    };
  }
}
export function hasHistoryAccess(): Promise<boolean> {
  return chrome.permissions.contains(access);
}
export function requestHistory(): Promise<boolean> {
  return chrome.permissions.request(access);
}
