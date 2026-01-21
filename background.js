chrome.action.onClicked.addListener(() => {
  chrome.action.setPopup({ popup: "popup.html" }, () => {
    const setPopupError = chrome.runtime.lastError;
    if (setPopupError) {
      chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to create tab:', chrome.runtime.lastError.message);
        }
      });
      return;
    }
    chrome.action.openPopup(() => {
      if (chrome.runtime.lastError) {
        chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") }, (tab) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to create tab:', chrome.runtime.lastError.message);
          }
        });
      }
    });
  });
});
