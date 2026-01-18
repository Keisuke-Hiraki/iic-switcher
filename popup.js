const STORAGE_KEY = "iic_portals";
const portalForm = document.getElementById("portal-form");
const portalNameInput = document.getElementById("portal-name");
const portalUrlInput = document.getElementById("portal-url");
const portalAccountInput = document.getElementById("portal-account");
const portalRoleInput = document.getElementById("portal-role");
const formHelper = document.getElementById("form-helper");
const portalList = document.getElementById("portal-list");
const portalCount = document.getElementById("portal-count");
const emptyState = document.getElementById("empty-state");
const openAllButton = document.getElementById("open-all");
const tabList = document.getElementById("tab-list");
const tabAdd = document.getElementById("tab-add");
const tabImport = document.getElementById("tab-import");
const panelList = document.getElementById("panel-list");
const panelForm = document.getElementById("panel-form");
const panelImport = document.getElementById("panel-import");
const formTitle = document.getElementById("form-title");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit");
const importTextArea = document.getElementById("import-json");
const importButton = document.getElementById("import-button");
const importHelper = document.getElementById("import-helper");
const exportTextArea = document.getElementById("export-json");
const exportButton = document.getElementById("export-button");
const copyExportButton = document.getElementById("copy-export");
const exportHelper = document.getElementById("export-helper");

let currentEditIndex = null;

const normalizePortals = (raw) =>
  (Array.isArray(raw) ? raw : []).map((portal) => ({
    name: String(portal?.name ?? "").trim(),
    url: String(portal?.url ?? "").trim(),
    accountId: String(portal?.accountId ?? "").trim(),
    roleName: String(portal?.roleName ?? "").trim(),
  }));

const getPortals = () =>
  new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      resolve(normalizePortals(result[STORAGE_KEY]));
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

const validatePortal = (name, url, accountId, roleName) => {
  if (!name.trim()) {
    return "表示名を入力してください。";
  }
  if (!url.trim()) {
    return "アクセスポータルURLを入力してください。";
  }
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") {
      return "URLはhttpsで始まる必要があります。";
    }
    const pattern = /^[a-z0-9-]+\.awsapps\.com$/;
    if (!pattern.test(parsed.hostname) || parsed.pathname !== "/start") {
      return "URLはhttps://*.awsapps.com/startの形式で入力してください。";
    }
  } catch (error) {
    return "URL形式が正しくありません。";
  }
  const trimmedAccountId = accountId.trim();
  const trimmedRoleName = roleName.trim();
  if (trimmedAccountId || trimmedRoleName) {
    if (!trimmedAccountId || !trimmedRoleName) {
      return "アカウントIDと許可セット名は両方入力してください。";
    }
    if (!/^\d{12}$/.test(trimmedAccountId)) {
      return "アカウントIDは12桁の数字で入力してください。";
    }
  }
  return "";
};

const buildConsoleUrl = (portal) => {
  if (!portal.accountId || !portal.roleName) {
    return "";
  }
  
  // Validate accountId is exactly 12 digits
  if (!/^\d{12}$/.test(portal.accountId)) {
    return "";
  }
  
  // Validate roleName contains only safe characters (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(portal.roleName)) {
    return "";
  }
  
  const url = new URL(portal.url);
  url.pathname = "/start/";
  url.hash = `/console?account_id=${encodeURIComponent(portal.accountId)}&role_name=${encodeURIComponent(
    portal.roleName,
  )}`;
  return url.toString();
};

const parsePortals = (raw) => {
  if (!Array.isArray(raw)) {
    return { error: "JSONは配列で入力してください。", portals: [] };
  }

  const portals = [];
  for (const entry of raw) {
    const name = entry?.name ?? "";
    const url = entry?.url ?? "";
    const accountId = entry?.accountId ?? "";
    const roleName = entry?.roleName ?? "";
    const errorMessage = validatePortal(
      String(name),
      String(url),
      String(accountId),
      String(roleName),
    );
    if (errorMessage) {
      return { error: errorMessage, portals: [] };
    }
    portals.push({
      name: String(name).trim(),
      url: String(url).trim(),
      accountId: String(accountId).trim(),
      roleName: String(roleName).trim(),
    });
  }

  return { error: "", portals };
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
    loginButton.addEventListener("click", async () => {
      chrome.tabs.create({ url: portal.url });
    });

    const consoleUrl = buildConsoleUrl(portal);
    const consoleButton = document.createElement("button");
    consoleButton.textContent = "コンソール";
    consoleButton.className = "ghost";
    consoleButton.hidden = !consoleUrl;
    consoleButton.addEventListener("click", async () => {
      chrome.tabs.create({ url: consoleUrl });
    });

    const editButton = document.createElement("button");
    editButton.textContent = "編集";
    editButton.className = "ghost";
    editButton.addEventListener("click", () => {
      startEdit(index, portal);
    });

    const removeButton = document.createElement("button");
    removeButton.textContent = "削除";
    removeButton.className = "danger";
    removeButton.addEventListener("click", async () => {
      const next = portals.filter((_, portalIndex) => portalIndex !== index);
      await savePortals(next);
      if (currentEditIndex === index) {
        resetForm();
      }
      renderPortals(next);
    });

    actions.append(loginButton, consoleButton, editButton, removeButton);
    meta.append(name, actions);

    const url = document.createElement("div");
    url.className = "portal-url";
    url.textContent = portal.url;

    const details = document.createElement("div");
    details.className = "portal-details";
    details.textContent = consoleUrl
      ? `アカウントID: ${portal.accountId} / 許可セット: ${portal.roleName}`
      : "アカウントID・許可セット未登録";

    item.append(meta, url, details);
    portalList.append(item);
  });
};

const switchTab = (target) => {
  const isList = target === "list";
  const isForm = target === "form";
  const isImport = target === "import";

  tabList.classList.toggle("is-active", isList);
  tabAdd.classList.toggle("is-active", isForm);
  tabImport.classList.toggle("is-active", isImport);

  tabList.setAttribute("aria-selected", isList.toString());
  tabAdd.setAttribute("aria-selected", isForm.toString());
  tabImport.setAttribute("aria-selected", isImport.toString());

  panelList.hidden = !isList;
  panelForm.hidden = !isForm;
  panelImport.hidden = !isImport;
};

const resetForm = () => {
  currentEditIndex = null;
  formTitle.textContent = "ポータルを追加";
  submitButton.textContent = "追加";
  cancelEditButton.hidden = true;
  portalNameInput.value = "";
  portalUrlInput.value = "";
  portalAccountInput.value = "";
  portalRoleInput.value = "";
  formHelper.textContent = "";
};

const resetImport = () => {
  importTextArea.value = "";
  importHelper.textContent = "";
  exportHelper.textContent = "";
};

const startEdit = (index, portal) => {
  currentEditIndex = index;
  formTitle.textContent = "ポータルを編集";
  submitButton.textContent = "更新";
  cancelEditButton.hidden = false;
  portalNameInput.value = portal.name;
  portalUrlInput.value = portal.url;
  portalAccountInput.value = portal.accountId ?? "";
  portalRoleInput.value = portal.roleName ?? "";
  formHelper.textContent = "";
  switchTab("form");
};

portalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formHelper.textContent = "";

  const name = portalNameInput.value;
  const url = portalUrlInput.value;
  const accountId = portalAccountInput.value;
  const roleName = portalRoleInput.value;
  const errorMessage = validatePortal(name, url, accountId, roleName);

  if (errorMessage) {
    formHelper.textContent = errorMessage;
    return;
  }

  const portals = await getPortals();
  const next = [...portals];
  const entry = {
    name: name.trim(),
    url: url.trim(),
    accountId: accountId.trim(),
    roleName: roleName.trim(),
  };

  if (currentEditIndex === null) {
    next.unshift(entry);
  } else {
    next[currentEditIndex] = entry;
  }

  await savePortals(next);
  resetForm();
  renderPortals(next);
  switchTab("list");
});

openAllButton.addEventListener("click", async () => {
  const portals = await getPortals();
  portals.forEach((portal) => {
    const consoleUrl = buildConsoleUrl(portal);
    chrome.tabs.create({ url: consoleUrl || portal.url });
  });
});

importButton.addEventListener("click", async () => {
  importHelper.textContent = "";
  const raw = importTextArea.value.trim();
  if (!raw) {
    importHelper.textContent = "JSONを入力してください。";
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const { error, portals } = parsePortals(parsed);
    if (error) {
      importHelper.textContent = error;
      return;
    }
    const existing = await getPortals();
    const merged = [...portals, ...existing].filter(
      (portal, index, self) =>
        index === self.findIndex((item) => item.url === portal.url && item.name === portal.name),
    );
    await savePortals(merged);
    renderPortals(merged);
    importHelper.textContent = `${portals.length}件を追加しました。`;
    importTextArea.value = "";
  } catch (error) {
    importHelper.textContent = "JSON形式が正しくありません。";
  }
});

exportButton.addEventListener("click", async () => {
  const portals = await getPortals();
  exportTextArea.value = JSON.stringify(portals, null, 2);
  exportHelper.textContent = "最新のJSONを表示しました。";
});

copyExportButton.addEventListener("click", async () => {
  const value = exportTextArea.value.trim();
  if (!value) {
    exportHelper.textContent = "先にJSONを表示してください。";
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    exportHelper.textContent = "コピーしました。";
  } catch (error) {
    exportHelper.textContent = "コピーに失敗しました。";
  }
});

tabList.addEventListener("click", () => switchTab("list"));
tabAdd.addEventListener("click", () => {
  resetForm();
  switchTab("form");
});
tabImport.addEventListener("click", () => {
  resetImport();
  switchTab("import");
});
cancelEditButton.addEventListener("click", () => {
  resetForm();
  switchTab("list");
});

getPortals().then(renderPortals);
