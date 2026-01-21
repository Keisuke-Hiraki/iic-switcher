chrome.action.onClicked.addListener(() => {
  chrome.action.setPopup({ popup: "popup.html" }, () => {
    const setPopupError = chrome.runtime.lastError;
    if (openError) {
      chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
      return;
    }
    chrome.action.openPopup(() => {
      if (chrome.runtime.lastError) {
        chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
      }
    });
  });
});
