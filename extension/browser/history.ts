export async function readHistory(): Promise<{history: chrome.history.HistoryItem[]; warning?: string}> {
  if (!await chrome.permissions.contains({permissions:['history']})) return {history:[],warning:'History access is off. Last-visit dates are unavailable.'};
  try { const history = await chrome.history.search({text:'',startTime:0,maxResults:10000}); return {history,...(history.length===10000 ? {warning:'Dates use the most recent 10,000 retained history entries. Some sites may have no matching record.'}: {})}; }
  catch { return {history:[],warning:'History could not be read. Dates are unavailable.'}; }
}
export function requestHistory(): Promise<boolean> { return chrome.permissions.request({permissions:['history']}); }
