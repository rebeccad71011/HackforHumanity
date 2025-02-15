let popupWindowId = null;
let latestResults = null;

function openPopup() {
  if (popupWindowId !== null) {
    // Check if the popup window still exists
    browser.windows.get(popupWindowId).catch(() => {
      // Window no longer exists – create a new one
      createPopup();
    });
  } else {
    createPopup();
  }
}

function createPopup() {
  browser.windows.create({
    url: browser.runtime.getURL("popup.html"),
    type: "popup",
    width: 400,
    height: 600
  }).then((windowInfo) => {
    popupWindowId = windowInfo.id;
  });
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === "start-scan") {
    // Open the popup automatically when scanning starts.
    openPopup();
  } else if (message.command === "scan-results") {
    latestResults = message.results;
    // Forward the scan results to any open extension view (e.g. the popup).
    browser.runtime.sendMessage({ command: "update-results", results: latestResults });
  } else if (message.command === "get-results") {
    sendResponse({ results: latestResults });
  }
});
