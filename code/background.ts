
function focusOrCreateTab(url: string) {
    chrome.windows.getAll({ "populate": true }, function (windows) {
        var existing_tab = null;
        for (var i in windows) {
            var tabs = windows[i].tabs;
            for (const tab of tabs ?? []) {
                if (tab.url == url) {
                    existing_tab = tab;
                    break;
                }
            }
        }
        if (existing_tab) {
            chrome.tabs.update(existing_tab.id!, { "active": true });
        } else {
            chrome.tabs.create({ "url": url, "active": true });
        }
    });
}

chrome.action.onClicked.addListener(function (tab) {
    var manager_url = chrome.runtime.getURL("page.html");
    focusOrCreateTab(manager_url);
});
