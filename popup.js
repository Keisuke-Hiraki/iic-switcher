const STORAGE_KEY = "iic_portals";

const portalForm = document.getElementById("portal-form");
const portalNameInput = document.getElementById("portal-name");
const portalUrlInput = document.getElementById("portal-url");
const formHelper = document.getElementById("form-helper");
const portalList = document.getElementById("portal-list");
const portalCount = document.getElementById("portal-count");
const emptyState = document.getElementById("empty-state");
const openAllButton = document.getElementById("open-all");

const getPortals = () =>
  new Promise((resolve, reject) => {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result[STORAGE_KEY] ?? []);
      }
    });
  });

const savePortals = (portals) =>
  new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: portals }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });

const validatePortal = (name, url) => {
  if (!name.trim()) {
    return "表示名を入力してください。";
  }
  if (!url.trim()) {
    return "アクセスポータルURLを入力してください。";
  }
  try {
    const parsed = new URL(url.trim());
    if (!parsed.protocol.startsWith("http")) {
      return "URLはhttpまたはhttpsで始まる必要があります。";
    }
  } catch (error) {
    return "URL形式が正しくありません。";
  }
  return "";
};

const renderPortals = (portals) => {
  portalList.innerHTML = "";
  portalCount.textContent = portals.length.toString();
  emptyState.hidden = portals.length > 0;

  portals.forEach((portal, index) => {
    const item = document.createElement("li");
    item.className = "portal-item";

    const meta = document.createElement("div");
    meta.className = "portal-meta";

    const name = document.createElement("span");
    name.className = "portal-name";
    name.textContent = portal.name;

    const actions = document.createElement("div");
    actions.className = "portal-actions";

    const loginButton = document.createElement("button");
    loginButton.textContent = "ログイン";
    loginButton.addEventListener("click", () => {
      chrome.tabs.create({ url: portal.url }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to create tab:', chrome.runtime.lastError.message);
          // Optionally show user-friendly error message
        }
      });
    });

    const removeButton = document.createElement("button");
    removeButton.textContent = "削除";
    removeButton.className = "danger";
    removeButton.addEventListener("click", async () => {
      const next = portals.filter((_, portalIndex) => portalIndex !== index);
      await savePortals(next);
      renderPortals(next);
    });

    actions.append(loginButton, removeButton);
    meta.append(name, actions);

    const url = document.createElement("div");
    url.className = "portal-url";
    url.textContent = portal.url;

    item.append(meta, url);
    portalList.append(item);
  });
};

portalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formHelper.textContent = "";

  const name = portalNameInput.value;
  const url = portalUrlInput.value;
  const errorMessage = validatePortal(name, url);

  if (errorMessage) {
    formHelper.textContent = errorMessage;
    return;
  }

  const portals = await getPortals();
  const next = [
    {
      name: name.trim(),
      url: url.trim(),
    },
    ...portals,
  ];

  await savePortals(next);
  portalNameInput.value = "";
  portalUrlInput.value = "";
  renderPortals(next);
});

openAllButton.addEventListener("click", async () => {
  const portals = await getPortals();
  portals.forEach((portal) => {
    chrome.tabs.create({ url: portal.url });
  });
});

getPortals().then(renderPortals);
