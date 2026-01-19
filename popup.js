const STORAGE_KEY_PORTALS = "iic_portals";
const STORAGE_KEY_PERMISSION_SETS = "iic_permission_sets";
const portalForm = document.getElementById("portal-form");
const portalNameInput = document.getElementById("portal-name");
const portalUrlInput = document.getElementById("portal-url");
const formHelper = document.getElementById("form-helper");
const portalList = document.getElementById("portal-list");
const portalCount = document.getElementById("portal-count");
const toggleReorderButton = document.getElementById("toggle-reorder");
const emptyState = document.getElementById("empty-state");
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
const permissionTitle = document.getElementById("permission-title");
const permissionPortalSelect = document.getElementById("permission-portal");
const permissionAccountInput = document.getElementById("permission-account");
const permissionAccountNameInput = document.getElementById("permission-account-name");
const permissionRoleInput = document.getElementById("permission-role");
const permissionNoteInput = document.getElementById("permission-note");
const permissionSubmitButton = document.getElementById("permission-submit");
const permissionClearButton = document.getElementById("permission-clear");
const permissionCancelButton = document.getElementById("permission-cancel");
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
const openSettingsButton = document.getElementById("open-settings");
const isOptionsView = document.body.classList.contains("options-view");
const isManagementView = isOptionsView;

let currentEditIndex = null;
let currentEditUrl = null;
let isReorderMode = false;
let currentPermissionEditKey = null;
let draggedPortalIndex = null;

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
    accountName: String(entry?.accountName ?? "").trim(),
    roleName: String(entry?.roleName ?? "").trim(),
    note: String(entry?.note ?? "").trim(),
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

const validatePermissionSet = (portalUrl, accountId, accountName, roleName) => {
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
  if (!accountName.trim()) {
    return "アカウント名を入力してください。";
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

const isSamePermission = (left, right) =>
  left.portalUrl === right.portalUrl &&
  left.accountId === right.accountId &&
  left.roleName === right.roleName;

const comparePermissionSets = (left, right) => {
  const leftDisplay = left.accountName || left.accountId || "";
  const rightDisplay = right.accountName || right.accountId || "";
  const displayComparison = leftDisplay.localeCompare(rightDisplay, "en", { sensitivity: "base" });
  if (displayComparison !== 0) {
    return displayComparison;
  }
  const roleComparison = (left.roleName || "").localeCompare(right.roleName || "", "en", { sensitivity: "base" });
  if (roleComparison !== 0) {
    return roleComparison;
  }
  return (left.accountId || "").localeCompare(right.accountId || "", "en", { sensitivity: "base" });
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
    const accountName = entry?.accountName ?? "";
    const roleName = entry?.roleName ?? "";
    const note = entry?.note ?? "";
    const errorMessage = validatePermissionSet(
      String(portalUrl),
      String(accountId),
      String(accountName),
      String(roleName),
    );
    if (errorMessage) {
      return { error: errorMessage, permissionSets: [] };
    }
    permissionSets.push({
      portalUrl: String(portalUrl).trim(),
      accountId: String(accountId).trim(),
      accountName: String(accountName).trim(),
      roleName: String(roleName).trim(),
      note: String(note).trim(),
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
  if (!portalList) {
    return;
  }
  portalList.innerHTML = "";
  if (portalCount) {
    portalCount.textContent = portals.length.toString();
  }
  if (emptyState) {
    emptyState.hidden = portals.length > 0;
  }

  const permissionSetsByPortal = new Map();
  permissionSets.forEach((permission) => {
    const list = permissionSetsByPortal.get(permission.portalUrl) ?? [];
    list.push(permission);
    permissionSetsByPortal.set(permission.portalUrl, list);
  });

  portals.forEach((portal, index) => {
    const item = document.createElement("li");
    item.className = "portal-item";
    if (isReorderMode && isManagementView) {
      item.classList.add("is-draggable");
      item.setAttribute("draggable", "true");
      item.addEventListener("dragstart", (event) => {
        draggedPortalIndex = index;
        item.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
      });
      item.addEventListener("dragend", () => {
        draggedPortalIndex = null;
        item.classList.remove("is-dragging");
      });
      item.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      item.addEventListener("drop", async (event) => {
        event.preventDefault();
        if (draggedPortalIndex === null || draggedPortalIndex === index) {
          return;
        }
        const next = [...portals];
        const [moved] = next.splice(draggedPortalIndex, 1);
        const targetIndex = draggedPortalIndex < index ? index - 1 : index;
        next.splice(targetIndex, 0, moved);
        await savePortals(next);
        renderPortals(next, permissionSets);
        renderPermissionSets(next, permissionSets);
        updatePortalSelect(next);
      });
    }

    const meta = document.createElement("div");
    meta.className = "portal-meta";

    const name = document.createElement("span");
    name.className = "portal-name";
    name.textContent = portal.name;

    const actions = document.createElement("div");
    actions.className = "portal-actions";

    if (!isOptionsView) {
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

      actions.append(loginButton, consoleButton);
    }

    if (isReorderMode && isManagementView) {
      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.textContent = "ドラッグで移動";
      dragHandle.className = "portal-drag-handle";
      dragHandle.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      dragHandle.addEventListener("touchstart", (event) => {
        event.preventDefault();
      });
      actions.append(dragHandle);
    }

    if (isManagementView) {
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
      actions.append(editButton, removeButton);
    }
    meta.append(name, actions);

    const url = document.createElement("div");
    url.className = "portal-url";
    url.textContent = portal.url;

    const details = document.createElement("div");
    details.className = "portal-details";
    const portalPermissionSets =
      permissionSetsByPortal.get(portal.url)?.slice().sort(comparePermissionSets) ?? [];
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

        const text = document.createElement("div");
        text.className = "portal-permission-text";
        const displayAccountName = permission.accountName || permission.accountId;
        text.textContent = `${displayAccountName} / ${permission.roleName}`;

        if (permission.note) {
          const note = document.createElement("div");
          note.className = "portal-permission-note";
          note.textContent = permission.note;
          text.append(note);
        }

        if (!isOptionsView) {
          const consoleButton = document.createElement("button");
          consoleButton.textContent = "コンソール";
          consoleButton.className = "ghost";
          consoleButton.addEventListener("click", () => {
            chrome.tabs.create({
              url: buildConsoleUrl(permission.portalUrl, permission.accountId, permission.roleName),
            });
          });

          permissionItem.append(text, consoleButton);
        } else {
          permissionItem.append(text);
        }
        list.append(permissionItem);
      });
      details.append(label, list);
    }

    item.append(meta, url, details);
    portalList.append(item);
  });
};

const renderPermissionSets = (portals, permissionSets) => {
  if (!permissionList) {
    return;
  }
  permissionList.innerHTML = "";
  if (permissionEmpty) {
    permissionEmpty.hidden = permissionSets.length > 0;
  }

  const portalMap = new Map(portals.map((portal) => [portal.url, portal.name]));

  const buildPermissionEditButton = (permission) => {
    const editButton = document.createElement("button");
    editButton.textContent = "編集";
    editButton.className = "ghost";
    editButton.addEventListener("click", () => {
      currentPermissionEditKey = {
        portalUrl: permission.portalUrl,
        accountId: permission.accountId,
        roleName: permission.roleName,
      };
      permissionTitle.textContent = "許可セットを編集";
      permissionSubmitButton.textContent = "更新";
      permissionCancelButton.hidden = false;
      permissionPortalSelect.value = permission.portalUrl;
      permissionAccountInput.value = permission.accountId;
      permissionAccountNameInput.value = permission.accountName ?? "";
      permissionRoleInput.value = permission.roleName;
      permissionNoteInput.value = permission.note ?? "";
      permissionHelper.textContent = "";
      switchTab("permission");
    });
    return editButton;
  };

  const buildPermissionRemoveButton = (permission) => {
    const removeButton = document.createElement("button");
    removeButton.textContent = "削除";
    removeButton.className = "danger";
    removeButton.addEventListener("click", async () => {
      const currentPermissionSets = await getPermissionSets();
      const next = currentPermissionSets.filter(
        (p) =>
          !(
            p.portalUrl === permission.portalUrl &&
            p.accountId === permission.accountId &&
            p.roleName === permission.roleName
          ),
      );
      await savePermissionSets(next);
      if (currentPermissionEditKey && isSamePermission(permission, currentPermissionEditKey)) {
        resetPermissionForm();
      }
      renderPermissionSets(portals, next);
      renderPortals(portals, next);
    });
    return removeButton;
  };

  if (isOptionsView) {
    const grouped = new Map();
    permissionSets.forEach((permission) => {
      const list = grouped.get(permission.portalUrl) ?? [];
      list.push(permission);
      grouped.set(permission.portalUrl, list);
    });

    const orderedPortalUrls = [
      ...portals.map((portal) => portal.url),
      ...Array.from(grouped.keys()).filter((url) => !portalMap.has(url)),
    ];

    orderedPortalUrls.forEach((portalUrl) => {
      const portalPermissions = grouped.get(portalUrl)?.slice().sort(comparePermissionSets);
      if (!portalPermissions || portalPermissions.length === 0) {
        return;
      }

      const item = document.createElement("li");
      item.className = "permission-group";

      const meta = document.createElement("div");
      meta.className = "permission-meta";

      const title = document.createElement("span");
      title.className = "permission-title";
      title.textContent = portalMap.get(portalUrl) ?? "未登録ポータル";

      meta.append(title);

      const list = document.createElement("div");
      list.className = "permission-group-list";

      portalPermissions.forEach((permission) => {
        const entry = document.createElement("div");
        entry.className = "permission-entry";

        const text = document.createElement("div");
        text.className = "permission-entry-text";
        const displayAccountName = permission.accountName || permission.accountId;

        const entryTitle = document.createElement("div");
        entryTitle.className = "permission-entry-title";
        entryTitle.textContent = `${displayAccountName} / ${permission.roleName}`;

        const entrySubtitle = document.createElement("div");
        entrySubtitle.className = "permission-entry-subtitle";
        entrySubtitle.textContent = `アカウントID: ${permission.accountId}`;

        text.append(entryTitle, entrySubtitle);

        if (permission.note) {
          const note = document.createElement("div");
          note.className = "permission-entry-note";
          note.textContent = permission.note;
          text.append(note);
        }

        const actions = document.createElement("div");
        actions.className = "permission-actions";
        actions.append(buildPermissionEditButton(permission), buildPermissionRemoveButton(permission));

        entry.append(text, actions);
        list.append(entry);
      });

      item.append(meta, list);
      permissionList.append(item);
    });
    return;
  }

  permissionSets.slice().sort(comparePermissionSets).forEach((permission) => {
    const item = document.createElement("li");
    item.className = "permission-item";

    const meta = document.createElement("div");
    meta.className = "permission-meta";

    const title = document.createElement("span");
    title.className = "permission-title";
    title.textContent = portalMap.get(permission.portalUrl) ?? "未登録ポータル";

    const actions = document.createElement("div");
    actions.className = "permission-actions";
    actions.append(buildPermissionEditButton(permission));

    const consoleButton = document.createElement("button");
    consoleButton.textContent = "コンソール";
    consoleButton.className = "ghost";
    consoleButton.addEventListener("click", () => {
      chrome.tabs.create({
        url: buildConsoleUrl(permission.portalUrl, permission.accountId, permission.roleName),
      });
    });
    actions.append(consoleButton, buildPermissionRemoveButton(permission));

    meta.append(title, actions);

    const subtitle = document.createElement("div");
    subtitle.className = "permission-subtitle";
    const displayAccountName = permission.accountName || permission.accountId;
    subtitle.textContent = `アカウント名: ${displayAccountName} / アカウントID: ${permission.accountId} / 許可セット: ${permission.roleName}`;

    const portalInfo = document.createElement("div");
    portalInfo.className = "permission-subtitle";
    portalInfo.textContent = permission.portalUrl;

    if (permission.note) {
      const note = document.createElement("div");
      note.className = "permission-note";
      note.textContent = permission.note;
      item.append(meta, subtitle, note, portalInfo);
    } else {
      item.append(meta, subtitle, portalInfo);
    }
    permissionList.append(item);
  });
};

const updatePortalSelect = (portals) => {
  if (!permissionPortalSelect) {
    return;
  }
  permissionPortalSelect.innerHTML = "";
  if (portals.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "先にポータルを登録してください";
    permissionPortalSelect.append(option);
    permissionPortalSelect.disabled = true;
    permissionSubmitButton.disabled = true;
    permissionAccountInput.disabled = true;
    permissionAccountNameInput.disabled = true;
    permissionRoleInput.disabled = true;
    permissionNoteInput.disabled = true;
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
  permissionAccountNameInput.disabled = false;
  permissionRoleInput.disabled = false;
  permissionNoteInput.disabled = false;
};

const switchTab = (target) => {
  const hasPanels = panelList || panelForm || panelPermission || panelImport;
  if (!hasPanels) {
    return;
  }
  let resolvedTarget = target;
  if (isOptionsView && resolvedTarget === "list") {
    resolvedTarget = "form";
  }
  const isList = resolvedTarget === "list";
  const isForm = resolvedTarget === "form";
  const isPermission = resolvedTarget === "permission";
  const isImport = resolvedTarget === "import";

  const setTabState = (tab, active) => {
    if (!tab) {
      return;
    }
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active.toString());
  };
  const setPanelState = (panel, active) => {
    if (!panel) {
      return;
    }
    panel.hidden = !active;
  };

  setTabState(tabList, isList);
  setTabState(tabAdd, isForm);
  setTabState(tabPermission, isPermission);
  setTabState(tabImport, isImport);

  setPanelState(panelList, isList);
  setPanelState(panelForm, isForm);
  setPanelState(panelPermission, isPermission);
  setPanelState(panelImport, isImport);

  if (!isList && isReorderMode) {
    isReorderMode = false;
    toggleReorderButton.classList.remove("is-active");
    toggleReorderButton.textContent = "並び替え";
    Promise.all([getPortals(), getPermissionSets()]).then(([portals, permissionSets]) => {
      renderPortals(portals, permissionSets);
    });
  }
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
  permissionAccountNameInput.value = "";
  permissionNoteInput.value = "";
  permissionHelper.textContent = "";
  permissionTitle.textContent = "許可セットを追加";
  permissionSubmitButton.textContent = "追加";
  permissionCancelButton.hidden = true;
  currentPermissionEditKey = null;
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

if (portalForm) {
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
}


if (permissionForm) {
  permissionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    permissionHelper.textContent = "";

    const portalUrl = permissionPortalSelect.value;
    const accountId = permissionAccountInput.value;
    const accountName = permissionAccountNameInput.value;
    const roleName = permissionRoleInput.value;
    const note = permissionNoteInput.value;
    const errorMessage = validatePermissionSet(portalUrl, accountId, accountName, roleName);

    if (errorMessage) {
      permissionHelper.textContent = errorMessage;
      return;
    }

    const permissionSets = await getPermissionSets();
    const trimmedPermission = {
      portalUrl: portalUrl.trim(),
      accountId: accountId.trim(),
      accountName: accountName.trim(),
      roleName: roleName.trim(),
      note: note.trim(),
    };
    const isEditing = currentPermissionEditKey !== null;
    const duplicate = permissionSets.some((permission) => {
      if (!isSamePermission(permission, trimmedPermission)) {
        return false;
      }
      return !isEditing || !isSamePermission(permission, currentPermissionEditKey);
    });

    if (duplicate) {
      permissionHelper.textContent = "同じ許可セットが既に登録されています。";
      return;
    }

    let nextPermissionSets = [];
    if (isEditing) {
      const index = permissionSets.findIndex((permission) =>
        isSamePermission(permission, currentPermissionEditKey),
      );
      if (index === -1) {
        nextPermissionSets = [trimmedPermission, ...permissionSets];
      } else {
        nextPermissionSets = [...permissionSets];
        nextPermissionSets[index] = trimmedPermission;
      }
    } else {
      nextPermissionSets = [trimmedPermission, ...permissionSets];
    }
    await savePermissionSets(nextPermissionSets);

    const portals = await getPortals();
    renderPermissionSets(portals, nextPermissionSets);
    renderPortals(portals, nextPermissionSets);

    resetPermissionForm();
    permissionHelper.textContent = isEditing ? "更新しました。" : "追加しました。";
  });
}

if (permissionClearButton) {
  permissionClearButton.addEventListener("click", () => {
    permissionRoleInput.value = "";
    permissionAccountInput.value = "";
    permissionAccountNameInput.value = "";
    permissionNoteInput.value = "";
    permissionHelper.textContent = "";
  });
}

if (permissionCancelButton) {
  permissionCancelButton.addEventListener("click", () => {
    resetPermissionForm();
  });
}

if (importButton) {
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
}

if (exportButton) {
  exportButton.addEventListener("click", async () => {
    const portals = await getPortals();
    const permissionSets = await getPermissionSets();
    exportTextArea.value = JSON.stringify({ portals, permissionSets }, null, 2);
    exportHelper.textContent = "最新のJSONを表示しました。";
  });
}

if (copyExportButton) {
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
}

if (tabList) {
  tabList.addEventListener("click", () => switchTab("list"));
}
if (tabAdd) {
  tabAdd.addEventListener("click", () => {
    resetForm();
    switchTab("form");
  });
}
if (tabPermission) {
  tabPermission.addEventListener("click", () => {
    permissionHelper.textContent = "";
    switchTab("permission");
  });
}
if (tabImport) {
  tabImport.addEventListener("click", () => {
    resetImport();
    switchTab("import");
  });
}
if (cancelEditButton) {
  cancelEditButton.addEventListener("click", () => {
    resetForm();
    switchTab("list");
  });
}
if (openSettingsButton) {
  openSettingsButton.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  });
}
if (toggleReorderButton) {
  toggleReorderButton.addEventListener("click", async () => {
    isReorderMode = !isReorderMode;
    toggleReorderButton.classList.toggle("is-active", isReorderMode);
    toggleReorderButton.textContent = isReorderMode ? "並び替え中" : "並び替え";
    const [portals, permissionSets] = await Promise.all([getPortals(), getPermissionSets()]);
    renderPortals(portals, permissionSets);
    renderPermissionSets(portals, permissionSets);
    updatePortalSelect(portals);
  });
}

Promise.all([getPortals(), getPermissionSets()]).then(([portals, permissionSets]) => {
  renderPortals(portals, permissionSets);
  renderPermissionSets(portals, permissionSets);
  updatePortalSelect(portals);
  switchTab(isOptionsView ? "form" : "list");
});
