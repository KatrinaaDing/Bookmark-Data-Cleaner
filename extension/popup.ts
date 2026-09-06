try {
  const response = await chrome.runtime.sendMessage({type:'open-manager'}) as {ok:boolean;error?:string};
  if(!response.ok) throw Error(response.error);
  window.close();
} catch { document.body.textContent='Could not open the app. Reload the extension and try again.'; }
export {};
