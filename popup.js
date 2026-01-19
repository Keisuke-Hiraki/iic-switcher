const STORAGE_KEY_PORTALS = "iic_portals";
const STORAGE_KEY_PERMISSION_SETS = "iic_permission_sets";
const portalForm = document.getElementById("portal-form");
const portalNameInput = document.getElementById("portal-name");
const portalUrlInput = document.getElementById("portal-url");
const formHelper = document.getElementById("form-helper");
const portalList = document.getElementById("portal-list");
const portalCount = document.getElementById("portal-count");
const emptyState = document.getElementById("empty-state");
const openAllButton = document.getElementById("open-all");
const tabList = document.getElementById("tab-list");
const tabAdd = document.getElementById("tab-add");
const tabPermission = document.getElementById("tab-permission");
const tabImport = document.getElementById("tab-import");
const panelList = document.getElementById("panel-list");
const panelForm = document.getElementById("panel-form");
const panelPermission = document.getElementById("panel-permission");
const panelImport = document.getElementById("panel-import");
const formTitle = document.getElementById("form-title");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit");
const permissionForm = document.getElementById("permission-form");
const permissionPortalSelect = document.getElementById("permission-portal");
const permissionAccountInput = document.getElementById("permission-account");
const permissionRoleInput = document.getElementById("permission-role");
const permissionSubmitButton = document.getElementById("permission-submit");
const permissionClearButton = document.getElementById("permission-clear");
const permissionHelper = document.getElementById("permission-helper");
const permissionList = document.getElementById("permission-list");
const permissionEmpty = document.getElementById("permission-empty");
const importTextArea = document.getElementById("import-json");
const importButton = document.getElementById("import-button");
const importHelper = document.getElementById("import-helper");
const exportTextArea = document.getElementById("export-json");
const exportButton = document.getElementById("export-button");
const copyExportButton = document.getElementById("copy-export");
const exportHelper = document.getElementById("export-helper");

let currentEditIndex = null;
let currentEditUrl = null;

const normalizePortals = (raw) =>
  (Array.isArray(raw) ? raw : []).map((portal) => ({
    name: String(portal?.name ?? "").trim(),
    url: String(portal?.url ?? "").trim(),
    accountId: String(portal?.accountId ?? "").trim(),
    roleName: String(portal?.roleName ?? "").trim(),
  }));

const normalizePermissionSets = (raw) =>
  (Array.isArray(raw) ? raw : []).map((entry) => ({
    portalUrl: String(entry?.portalUrl ?? "").trim(),
    accountId: String(entry?.accountId ?? "").trim(),
    roleName: String(entry?.roleName ?? "").trim(),
  }));

const getPortals = () =>
  new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY_PORTALS], (result) => {
      resolve(normalizePortals(result[STORAGE_KEY_PORTALS]));
    });
  });

const savePortals = (portals) =>
  new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [STORAGE_KEY_PORTALS]: portals }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });

const getPermissionSets = () =>
  new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY_PERMISSION_SETS], (result) => {
      resolve(normalizePermissionSets(result[STORAGE_KEY_PERMISSION_SETS]));
    });
  });

const savePermissionSets = (permissionSets) =>
  new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [STORAGE_KEY_PERMISSION_SETS]: permissionSets }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });

const validatePortalUrl = (url) => {
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
  return "";
};

const validatePortal = (name, url, accountId, roleName) => {
  if (!name.trim()) {
    return "表示名を入力してください。";
  }
  if (!url.trim()) {
    return "アクセスポータルURLを入力してください。";
  }
  const urlError = validatePortalUrl(url);
  if (urlError) {
    return urlError;
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

const validatePermissionSet = (portalUrl, accountId, roleName) => {
  if (!portalUrl.trim()) {
    return "ポータルを選択してください。";
  }
  const urlError = validatePortalUrl(portalUrl);
  if (urlError) {
    return urlError;
  }
  if (!/^\d{12}$/.test(accountId.trim())) {
    return "アカウントIDは12桁の数字で入力してください。";
  }
  if (!roleName.trim()) {
    return "許可セット名を入力してください。";
  }
  return "";
};

const buildConsoleUrl = (portalUrl, accountId, roleName) => {
  if (!portalUrl || !accountId || !roleName) {
    return "";
  }
  try {
    const url = new URL(portalUrl);
    url.pathname = "/start/";
    url.hash = `/console?account_id=${encodeURIComponent(accountId)}&role_name=${encodeURIComponent(roleName)}`;
    return url.toString();
  } catch (error) {
    return "";
  }
};

const parsePortals = (raw) => {
  const portals = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    const name = entry?.name ?? "";
    const url = entry?.url ?? "";
    const accountId = entry?.accountId ?? "";
    const roleName = entry?.roleName ?? "";
    const errorMessage = validatePortal(String(name), String(url));
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

const parsePermissionSets = (raw) => {
  const permissionSets = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    const portalUrl = entry?.portalUrl ?? "";
    const accountId = entry?.accountId ?? "";
    const roleName = entry?.roleName ?? "";
    const errorMessage = validatePermissionSet(
      String(portalUrl),
      String(accountId),
      String(roleName),
    );
    if (errorMessage) {
      return { error: errorMessage, permissionSets: [] };
    }
    permissionSets.push({
      portalUrl: String(portalUrl).trim(),
      accountId: String(accountId).trim(),
      roleName: String(roleName).trim(),
    });
  }
  return { error: "", permissionSets };
};

const parseImportPayload = (raw) => {
  if (Array.isArray(raw)) {
    const { error, portals } = parsePortals(raw);
    return { error, portals, permissionSets: [] };
  }
  if (!raw || typeof raw !== "object") {
    return { error: "JSONは配列またはオブジェクトで入力してください。", portals: [], permissionSets: [] };
  }
  const { error: portalError, portals } = parsePortals(raw.portals ?? []);
  if (portalError) {
    return { error: portalError, portals: [], permissionSets: [] };
  }
  const { error: permissionError, permissionSets } = parsePermissionSets(raw.permissionSets ?? []);
  if (permissionError) {
    return { error: permissionError, portals: [], permissionSets: [] };
  }
  return { error: "", portals, permissionSets };
};

const renderPortals = (portals, permissionSets) => {
  portalList.innerHTML = "";
  portalCount.textContent = portals.length.toString();
  emptyState.hidden = portals.length > 0;

  const permissionSetsByPortal = new Map();
  permissionSets.forEach((permission) => {
    const list = permissionSetsByPortal.get(permission.portalUrl) ?? [];
    list.push(permission);
    permissionSetsByPortal.set(permission.portalUrl, list);
  });

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
      chrome.tabs.create({ url: portal.url });
    });

    const consoleUrl = buildConsoleUrl(portal.url, portal.accountId, portal.roleName);
    const consoleButton = document.createElement("button");
    consoleButton.textContent = "コンソール";
    consoleButton.className = "ghost";
    consoleButton.hidden = !consoleUrl;
    consoleButton.addEventListener("click", () => {
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
      const currentPermissionSets = await getPermissionSets();
      const filteredPermissionSets = currentPermissionSets.filter(
        (permission) => permission.portalUrl !== portal.url,
      );
      if (filteredPermissionSets.length !== currentPermissionSets.length) {
        await savePermissionSets(filteredPermissionSets);
      }
      if (currentEditIndex === index) {
        resetForm();
      }
      renderPortals(next, filteredPermissionSets);
      renderPermissionSets(next, filteredPermissionSets);
      updatePortalSelect(next);
    });

    actions.append(loginButton, consoleButton, editButton, removeButton);
    meta.append(name, actions);

    const url = document.createElement("div");
    url.className = "portal-url";
    url.textContent = portal.url;

    const details = document.createElement("div");
    details.className = "portal-details";
    const portalPermissionSets = permissionSetsByPortal.get(portal.url) ?? [];
    if (portalPermissionSets.length === 0) {
      details.textContent = "許可セット未登録";
    } else {
      const label = document.createElement("div");
      label.textContent = "登録済み許可セット";
      const list = document.createElement("div");
      list.className = "portal-permissions";
      portalPermissionSets.forEach((permission) => {
        const permissionItem = document.createElement("div");
        permissionItem.className = "portal-permission-item";

        const text = document.createElement("span");
        text.textContent = `${permission.accountId} / ${permission.roleName}`;

        const consoleButton = document.createElement("button");
        consoleButton.textContent = "コンソール";
        consoleButton.className = "ghost";
        consoleButton.addEventListener("click", () => {
          chrome.tabs.create({
            url: buildConsoleUrl(permission.portalUrl, permission.accountId, permission.roleName),
          });
        });

        permissionItem.append(text, consoleButton);
        list.append(permissionItem);
      });
      details.append(label, list);
    }

    item.append(meta, url, details);
    portalList.append(item);
  });
};

const renderPermissionSets = (portals, permissionSets) => {
  permissionList.innerHTML = "";
  permissionEmpty.hidden = permissionSets.length > 0;

  const portalMap = new Map(portals.map((portal) => [portal.url, portal.name]));

  permissionSets.forEach((permission, index) => {
    const item = document.createElement("li");
    item.className = "permission-item";

    const meta = document.createElement("div");
    meta.className = "permission-meta";

    const title = document.createElement("span");
    title.className = "permission-title";
    title.textContent = portalMap.get(permission.portalUrl) ?? "未登録ポータル";

    const actions = document.createElement("div");
    actions.className = "permission-actions";

    const consoleButton = document.createElement("button");
    consoleButton.textContent = "コンソール";
    consoleButton.className = "ghost";
    consoleButton.addEventListener("click", () => {
      chrome.tabs.create({
        url: buildConsoleUrl(permission.portalUrl, permission.accountId, permission.roleName),
      });
    });

    const removeButton = document.createElement("button");
    removeButton.textContent = "削除";
    removeButton.className = "danger";
    removeButton.addEventListener("click", async () => {
      const currentPermissionSets = await getPermissionSets();
      const next = currentPermissionSets.filter((p) => 
        !(p.portalUrl === permission.portalUrl && 
          p.accountId === permission.accountId && 
          p.roleName === permission.roleName)
      );
      await savePermissionSets(next);
      renderPermissionSets(portals, next);
      renderPortals(portals, next);
    });

    actions.append(consoleButton, removeButton);
    meta.append(title, actions);

    const subtitle = document.createElement("div");
    subtitle.className = "permission-subtitle";
    subtitle.textContent = `アカウントID: ${permission.accountId} / 許可セット: ${permission.roleName}`;

    const portalInfo = document.createElement("div");
    portalInfo.className = "permission-subtitle";
    portalInfo.textContent = permission.portalUrl;

    item.append(meta, subtitle, portalInfo);
    permissionList.append(item);
  });
};

const updatePortalSelect = (portals) => {
  permissionPortalSelect.innerHTML = "";
  if (portals.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "先にポータルを登録してください";
    permissionPortalSelect.append(option);
    permissionPortalSelect.disabled = true;
    permissionSubmitButton.disabled = true;
    permissionAccountInput.disabled = true;
    permissionRoleInput.disabled = true;
    return;
  }
  portals.forEach((portal) => {
    const option = document.createElement("option");
    option.value = portal.url;
    option.textContent = portal.name;
    permissionPortalSelect.append(option);
  });
  permissionPortalSelect.disabled = false;
  permissionSubmitButton.disabled = false;
  permissionAccountInput.disabled = false;
  permissionRoleInput.disabled = false;
};

const switchTab = (target) => {
  const isList = target === "list";
  const isForm = target === "form";
  const isPermission = target === "permission";
  const isImport = target === "import";

  tabList.classList.toggle("is-active", isList);
  tabAdd.classList.toggle("is-active", isForm);
  tabPermission.classList.toggle("is-active", isPermission);
  tabImport.classList.toggle("is-active", isImport);

  tabList.setAttribute("aria-selected", isList.toString());
  tabAdd.setAttribute("aria-selected", isForm.toString());
  tabPermission.setAttribute("aria-selected", isPermission.toString());
  tabImport.setAttribute("aria-selected", isImport.toString());

  panelList.hidden = !isList;
  panelForm.hidden = !isForm;
  panelPermission.hidden = !isPermission;
  panelImport.hidden = !isImport;
};

const resetForm = () => {
  currentEditIndex = null;
  currentEditUrl = null;
  formTitle.textContent = "ポータルを追加";
  submitButton.textContent = "追加";
  cancelEditButton.hidden = true;
  portalNameInput.value = "";
  portalUrlInput.value = "";
  formHelper.textContent = "";
};

const resetPermissionForm = () => {
  permissionRoleInput.value = "";
  permissionAccountInput.value = "";
  permissionHelper.textContent = "";
  if (!permissionPortalSelect.disabled) {
    permissionPortalSelect.selectedIndex = 0;
  }
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
  formHelper.textContent = "";
  switchTab("form");
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
  const next = [...portals];
  const previousEntry = currentEditIndex === null ? null : portals[currentEditIndex] ?? null;
  const entry = {
    name: name.trim(),
    url: url.trim(),
    accountId: previousEntry?.accountId ?? "",
    roleName: previousEntry?.roleName ?? "",
  };

  if (currentEditIndex === null) {
    next.unshift(entry);
  } else {
    next[currentEditIndex] = entry;
  }

  await savePortals(next);

  if (currentEditUrl && currentEditUrl !== entry.url) {
    const permissionSets = await getPermissionSets();
    const updatedPermissionSets = permissionSets.map((permission) =>
      permission.portalUrl === currentEditUrl
        ? { ...permission, portalUrl: entry.url }
        : permission,
    );
    await savePermissionSets(updatedPermissionSets);
    renderPermissionSets(next, updatedPermissionSets);
    renderPortals(next, updatedPermissionSets);
  } else {
    const permissionSets = await getPermissionSets();
    renderPortals(next, permissionSets);
    renderPermissionSets(next, permissionSets);
  }

  resetForm();
  updatePortalSelect(next);
  switchTab("list");
});

openAllButton.addEventListener("click", async () => {
  const [portals, permissionSets] = await Promise.all([getPortals(), getPermissionSets()]);
  const permissionSetsByPortal = new Map();
  permissionSets.forEach((permission) => {
    const list = permissionSetsByPortal.get(permission.portalUrl) ?? [];
    list.push(permission);
    permissionSetsByPortal.set(permission.portalUrl, list);
  });

  portals.forEach((portal) => {
    const portalPermissionSets = permissionSetsByPortal.get(portal.url) ?? [];
    if (portalPermissionSets.length === 0) {
      chrome.tabs.create({ url: portal.url });
    } else {
      portalPermissionSets.forEach((permission) => {
        chrome.tabs.create({
          url: buildConsoleUrl(permission.portalUrl, permission.accountId, permission.roleName),
        });
      });
    }
  });
});

permissionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  permissionHelper.textContent = "";

  const portalUrl = permissionPortalSelect.value;
  const accountId = permissionAccountInput.value;
  const roleName = permissionRoleInput.value;
  const errorMessage = validatePermissionSet(portalUrl, accountId, roleName);

  if (errorMessage) {
    permissionHelper.textContent = errorMessage;
    return;
  }

  const permissionSets = await getPermissionSets();
  const trimmedPermission = {
    portalUrl: portalUrl.trim(),
    accountId: accountId.trim(),
    roleName: roleName.trim(),
  };
  const duplicate = permissionSets.some(
    (permission) =>
      permission.portalUrl === trimmedPermission.portalUrl &&
      permission.accountId === trimmedPermission.accountId &&
      permission.roleName === trimmedPermission.roleName,
  );

  if (duplicate) {
    permissionHelper.textContent = "同じ許可セットが既に登録されています。";
    return;
  }

  const nextPermissionSets = [trimmedPermission, ...permissionSets];
  await savePermissionSets(nextPermissionSets);

  const portals = await getPortals();
  renderPermissionSets(portals, nextPermissionSets);
  renderPortals(portals, nextPermissionSets);

  permissionRoleInput.value = "";
  permissionHelper.textContent = "追加しました。";
});

permissionClearButton.addEventListener("click", () => {
  resetPermissionForm();
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
    const { error, portals, permissionSets } = parseImportPayload(parsed);
    if (error) {
      importHelper.textContent = error;
      return;
    }
    const existingPortals = await getPortals();
    const mergedPortals = [...portals, ...existingPortals].filter(
      (portal, index, self) =>
        index === self.findIndex((item) => item.url === portal.url && item.name === portal.name),
    );

    const existingPermissionSets = await getPermissionSets();
    const mergedPermissionSets = [...permissionSets, ...existingPermissionSets].filter(
      (permission, index, self) =>
        index ===
        self.findIndex(
          (item) =>
            item.portalUrl === permission.portalUrl &&
            item.accountId === permission.accountId &&
            item.roleName === permission.roleName,
        ),
    );

    await savePortals(mergedPortals);
    await savePermissionSets(mergedPermissionSets);
    renderPortals(mergedPortals, mergedPermissionSets);
    renderPermissionSets(mergedPortals, mergedPermissionSets);
    updatePortalSelect(mergedPortals);
    importHelper.textContent = `${portals.length}件のポータルと${permissionSets.length}件の許可セットを追加しました。`;
    importTextArea.value = "";
  } catch (error) {
    importHelper.textContent = "JSON形式が正しくありません。";
  }
});

exportButton.addEventListener("click", async () => {
  const portals = await getPortals();
  const permissionSets = await getPermissionSets();
  exportTextArea.value = JSON.stringify({ portals, permissionSets }, null, 2);
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
tabPermission.addEventListener("click", () => {
  permissionHelper.textContent = "";
  switchTab("permission");
});
tabImport.addEventListener("click", () => {
  resetImport();
  switchTab("import");
});
cancelEditButton.addEventListener("click", () => {
  resetForm();
  switchTab("list");
});

Promise.all([getPortals(), getPermissionSets()]).then(([portals, permissionSets]) => {
  renderPortals(portals, permissionSets);
  renderPermissionSets(portals, permissionSets);
  updatePortalSelect(portals);
});
