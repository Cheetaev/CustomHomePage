const form = document.querySelector(".search");
const input = document.querySelector(".search__input");
const shell = document.querySelector(".search-shell");
const history = document.querySelector(".search-history");
const shortcutGrid = document.querySelector(".shortcut-grid");
const shortcutDialog = document.querySelector(".shortcut-dialog");
const shortcutForm = document.querySelector(".shortcut-form");
const shortcutIconPicker = document.querySelector(".shortcut-icon-picker");
const shortcutUrlInput = shortcutForm.elements.url;
const shortcutCancel = document.querySelector(".shortcut-dialog__cancel");
const gptForm = document.querySelector(".gpt-search");
const gptInput = document.querySelector(".gpt-search__input");

const defaultShortcuts = [
  { title: "Яндекс Почта", url: "https://mail.yandex.ru/", iconId: "yandex-mail" },
  { title: "Яндекс Карты", url: "https://yandex.ru/maps/", iconId: "yandex-maps" },
  { title: "Гугл Почта", url: "https://mail.google.com/", iconId: "gmail" },
  { title: "Яндекс Диск", url: "https://disk.yandex.ru/", iconId: "yandex-disk" }
];
const SEARCH_HISTORY_LIMIT = 10;
const SHORTCUT_COLUMNS_MAX = 6;
const SHORTCUT_ROWS_MAX = 3;
const SITE_ICON_ID = "favicon";

let searchHistory = [];
let iconCatalog = [];
let customShortcuts = [];
let hiddenDefaultShortcuts = [];

function normalizeShortcutUrl(value) {
  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function findIcon(iconId) {
  return iconCatalog.find((icon) => icon.id === iconId);
}

function faviconSrc(pageUrl) {
  try {
    const url = new URL(pageUrl);

    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
      return "";
    }

    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(url.hostname)}`;
  } catch {
    return "";
  }
}

function shortcutIconSrc(shortcut) {
  if (shortcut.iconId === SITE_ICON_ID) {
    return faviconSrc(shortcut.url) || findIcon("link")?.src || "";
  }

  return (findIcon(shortcut.iconId) || findIcon("link"))?.src || "";
}

function applyIconFallback(image) {
  const fallback = findIcon("link");

  if (!fallback) {
    return;
  }

  image.addEventListener("error", () => {
    if (image.getAttribute("src") !== fallback.src) {
      image.src = fallback.src;
    }
  });
}

function isAllowedIconId(iconId) {
  return iconId === SITE_ICON_ID || Boolean(findIcon(iconId));
}

function isSameShortcut(left, right) {
  return left.title === right.title && left.url === right.url && left.iconId === right.iconId;
}

function createShortcutCard(shortcut, source) {
  const item = document.createElement("div");
  const link = document.createElement("a");
  const image = document.createElement("img");
  const label = document.createElement("span");
  const remove = document.createElement("button");
  const removeIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const removePath = document.createElementNS("http://www.w3.org/2000/svg", "path");

  item.className = "shortcut-item";

  link.className = "shortcut-card";
  link.href = shortcut.url;
  link.title = shortcut.title;

  image.className = "shortcut-card__icon";
  image.src = shortcutIconSrc(shortcut);
  image.alt = "";
  image.draggable = false;
  applyIconFallback(image);

  label.className = "shortcut-card__label";
  label.textContent = shortcut.title;

  remove.className = "shortcut-card__remove";
  remove.type = "button";
  remove.title = `Удалить ${shortcut.title}`;
  remove.setAttribute("aria-label", `Удалить ${shortcut.title}`);

  removeIcon.setAttribute("viewBox", "0 0 12 12");
  removeIcon.setAttribute("aria-hidden", "true");
  removePath.setAttribute("d", "M1.5 1.5 10.5 10.5M10.5 1.5 1.5 10.5");
  removeIcon.append(removePath);

  remove.append(removeIcon);
  remove.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void removeShortcut(shortcut, source);
  });

  link.append(image, label);
  item.append(link, remove);
  return item;
}

function createAddShortcutButton() {
  const button = document.createElement("button");
  const icon = document.createElement("span");
  const label = document.createElement("span");

  button.className = "shortcut-card shortcut-card--add";
  button.type = "button";
  button.title = "Добавить ссылку";

  icon.className = "shortcut-card__add-icon";
  icon.setAttribute("aria-hidden", "true");

  label.className = "shortcut-card__label";
  label.textContent = "Добавить";

  button.append(icon, label);
  button.addEventListener("click", () => shortcutDialog.showModal());
  return button;
}

function listVisibleShortcuts() {
  const hiddenDefaults = new Set(hiddenDefaultShortcuts);
  const items = [];

  for (const shortcut of defaultShortcuts) {
    if (!hiddenDefaults.has(shortcut.url)) {
      items.push({ shortcut, source: "default" });
    }
  }

  for (const shortcut of customShortcuts) {
    items.push({ shortcut, source: "custom" });
  }

  return items;
}

function measureShortcutLayout() {
  const narrow = window.matchMedia("(max-width: 560px)").matches;
  const card = narrow ? 88 : 104;
  const gap = narrow ? 8 : 10;
  const columnsMax = Math.min(
    SHORTCUT_COLUMNS_MAX,
    Math.max(1, Math.floor((shell.clientWidth + gap) / (card + gap)))
  );

  return {
    columnsMax,
    cellsMax: columnsMax * SHORTCUT_ROWS_MAX
  };
}

function renderShortcuts() {
  const items = listVisibleShortcuts();
  const { columnsMax, cellsMax } = measureShortcutLayout();
  const canAdd = items.length < cellsMax;
  const shown = items.slice(0, cellsMax);
  const cellCount = shown.length + (canAdd ? 1 : 0);
  const fragment = document.createDocumentFragment();

  for (const { shortcut, source } of shown) {
    fragment.append(createShortcutCard(shortcut, source));
  }

  if (canAdd) {
    fragment.append(createAddShortcutButton());
  }

  shortcutGrid.style.setProperty("--shortcut-columns", String(Math.min(cellCount, columnsMax)));
  shortcutGrid.replaceChildren(fragment);
}

function normalizeHiddenDefaults(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const urls = [];

  for (const item of value) {
    if (typeof item !== "string" || !item || urls.includes(item)) {
      continue;
    }

    if (defaultShortcuts.some((shortcut) => shortcut.url === item)) {
      urls.push(item);
    }
  }

  return urls;
}

async function removeShortcut(shortcut, source) {
  if (source === "default") {
    const { hiddenDefaultShortcuts: storedHidden } = await chrome.storage.local.get("hiddenDefaultShortcuts");
    const nextHidden = normalizeHiddenDefaults(storedHidden);

    if (!nextHidden.includes(shortcut.url)) {
      nextHidden.push(shortcut.url);
    }

    await chrome.storage.local.set({ hiddenDefaultShortcuts: nextHidden });
    hiddenDefaultShortcuts = nextHidden;
  } else {
    const { customShortcuts: storedShortcuts } = await chrome.storage.local.get("customShortcuts");
    const nextShortcuts = (Array.isArray(storedShortcuts) ? storedShortcuts : [])
      .map(normalizeStoredShortcut)
      .filter(Boolean);
    const index = nextShortcuts.findIndex((item) => isSameShortcut(item, shortcut));

    if (index !== -1) {
      nextShortcuts.splice(index, 1);
    }

    await chrome.storage.local.set({ customShortcuts: nextShortcuts });
    customShortcuts = nextShortcuts;
  }

  renderShortcuts();
}

function createIconOption(icon, { checked = false } = {}) {
  const option = document.createElement("label");
  const radio = document.createElement("input");
  const image = document.createElement("img");
  const label = document.createElement("span");

  option.className = "shortcut-icon-option";
  option.dataset.iconId = icon.id;

  radio.className = "visually-hidden";
  radio.type = "radio";
  radio.name = "iconId";
  radio.value = icon.id;
  radio.required = true;
  radio.defaultChecked = checked;

  image.src = icon.src;
  image.alt = "";
  image.draggable = false;
  applyIconFallback(image);

  label.textContent = icon.label;

  option.append(radio, image, label);
  return option;
}

function renderIconPicker() {
  const fragment = document.createDocumentFragment();
  const siteFallback = findIcon("link");

  fragment.append(createIconOption({
    id: SITE_ICON_ID,
    label: "С сайта",
    src: siteFallback ? siteFallback.src : ""
  }, { checked: true }));

  for (const icon of iconCatalog) {
    if (icon.id !== "link") {
      fragment.append(createIconOption(icon));
    }
  }

  shortcutIconPicker.replaceChildren(fragment);
}

function updateSiteFaviconOption() {
  const option = shortcutIconPicker.querySelector(`[data-icon-id="${SITE_ICON_ID}"]`);

  if (!option) {
    return;
  }

  const image = option.querySelector("img");
  const radio = option.querySelector("input");
  const fallback = findIcon("link");
  const src = faviconSrc(normalizeShortcutUrl(shortcutUrlInput.value.trim()));

  image.src = src || (fallback ? fallback.src : "");

  if (src) {
    radio.checked = true;
  }
}

function normalizeStoredShortcut(shortcut) {
  if (!shortcut || typeof shortcut !== "object") {
    return null;
  }

  const title = typeof shortcut.title === "string" ? shortcut.title.trim().slice(0, 24) : "";
  const url = typeof shortcut.url === "string" ? normalizeShortcutUrl(shortcut.url) : "";
  const iconId = typeof shortcut.iconId === "string" ? shortcut.iconId : "";

  if (!title || !url || !isAllowedIconId(iconId)) {
    return null;
  }

  return { title, url, iconId };
}

async function initializeShortcuts() {
  const [catalogResponse, stored] = await Promise.all([
    fetch("icons/catalog.json"),
    chrome.storage.local.get(["customShortcuts", "hiddenDefaultShortcuts"])
  ]);
  const { customShortcuts: storedShortcuts } = stored;

  const catalog = await catalogResponse.json();

  iconCatalog = Array.isArray(catalog)
    ? catalog.filter((icon) =>
        icon &&
        typeof icon.id === "string" &&
        typeof icon.label === "string" &&
        typeof icon.src === "string" &&
        icon.src.startsWith("icons/") &&
        !icon.src.includes("..")
      )
    : [];

  customShortcuts = (Array.isArray(storedShortcuts) ? storedShortcuts : [])
    .map(normalizeStoredShortcut)
    .filter(Boolean);
  hiddenDefaultShortcuts = normalizeHiddenDefaults(stored.hiddenDefaultShortcuts);

  renderIconPicker();
  renderShortcuts();
}

function normalizeSearchHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const queries = [];

  for (const item of value) {
    const query = typeof item === "string" ? item.trim() : "";

    if (!query || queries.includes(query)) {
      continue;
    }

    queries.push(query);

    if (queries.length === SEARCH_HISTORY_LIMIT) {
      break;
    }
  }

  return queries;
}

function renderSearchHistory() {
  const fragment = document.createDocumentFragment();

  for (const query of searchHistory) {
    const item = document.createElement("div");
    const button = document.createElement("button");
    const remove = document.createElement("button");
    const removeIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const removePath = document.createElementNS("http://www.w3.org/2000/svg", "path");

    item.className = "search-history__item";

    button.className = "search-history__query";
    button.type = "button";
    button.textContent = query;
    button.addEventListener("click", () => {
      input.value = query;
      form.requestSubmit();
    });

    remove.className = "search-history__remove";
    remove.type = "button";
    remove.title = `Удалить ${query}`;
    remove.setAttribute("aria-label", `Удалить ${query}`);

    removeIcon.setAttribute("viewBox", "0 0 12 12");
    removeIcon.setAttribute("aria-hidden", "true");
    removePath.setAttribute("d", "M1.5 1.5 10.5 10.5M10.5 1.5 1.5 10.5");
    removeIcon.append(removePath);

    remove.append(removeIcon);
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void removeHistoryQuery(query);
    });

    item.append(button, remove);
    fragment.append(item);
  }

  history.replaceChildren(fragment);
}

async function removeHistoryQuery(query) {
  await searchHistoryReady;

  const { searchHistory: storedHistory } = await chrome.storage.local.get("searchHistory");
  const currentHistory = Array.isArray(storedHistory)
    ? normalizeSearchHistory(storedHistory)
    : searchHistory;
  const nextHistory = currentHistory.filter((item) => item !== query);

  await chrome.storage.local.set({ searchHistory: nextHistory });
  searchHistory = nextHistory;
  renderSearchHistory();

  if (!nextHistory.length) {
    hideHistory();
    input.focus();
    return;
  }

  showHistory();
}

function showHistory() {
  if (!searchHistory.length) {
    return;
  }

  history.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function hideHistory() {
  history.hidden = true;
  input.setAttribute("aria-expanded", "false");
}

const searchHistoryReady = chrome.storage.local
  .get(["searchHistory", "lastQuery"])
  .then(async ({ searchHistory: savedHistory, lastQuery: savedQuery }) => {
    searchHistory = normalizeSearchHistory(savedHistory);
    let shouldMigrate = false;

    if (!searchHistory.length && typeof savedQuery === "string" && savedQuery.trim()) {
      searchHistory = [savedQuery.trim()];
      shouldMigrate = true;
    }

    renderSearchHistory();

    if (document.activeElement === input) {
      showHistory();
    }

    if (shouldMigrate) {
      await chrome.storage.local.set({ searchHistory });
    }
  });

input.addEventListener("focus", showHistory);
input.addEventListener("click", showHistory);
input.addEventListener("input", hideHistory);
input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideHistory();
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!form.contains(event.target) && !history.contains(event.target)) {
    hideHistory();
  }
});

shell.addEventListener("focusout", (event) => {
  if (!event.relatedTarget) {
    return;
  }

  if (!form.contains(event.relatedTarget) && !history.contains(event.relatedTarget)) {
    hideHistory();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = input.value.trim();

  if (!query) {
    input.focus();
    return;
  }

  input.value = query;

  try {
    await searchHistoryReady;

    const { searchHistory: storedHistory } = await chrome.storage.local.get("searchHistory");
    const currentHistory = Array.isArray(storedHistory)
      ? normalizeSearchHistory(storedHistory)
      : searchHistory;
    const nextHistory = [
      query,
      ...currentHistory.filter((item) => item !== query)
    ].slice(0, SEARCH_HISTORY_LIMIT);

    await chrome.storage.local.set({ searchHistory: nextHistory });
    searchHistory = nextHistory;
    renderSearchHistory();
  } finally {
    form.submit();
  }
});

gptForm.addEventListener("submit", () => {
  const query = gptInput.value.trim();

  if (query) {
    void chrome.storage.session.set({ gptAutoSubmit: query });
  }
});

shortcutCancel.addEventListener("click", () => shortcutDialog.close());

shortcutUrlInput.addEventListener("input", () => {
  shortcutUrlInput.setCustomValidity("");
  updateSiteFaviconOption();
});

shortcutDialog.addEventListener("close", () => {
  shortcutForm.reset();
  shortcutUrlInput.setCustomValidity("");
  updateSiteFaviconOption();
});

shortcutForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(shortcutForm);
  const title = String(data.get("title")).trim();
  const url = normalizeShortcutUrl(String(data.get("url")).trim());
  const iconId = String(data.get("iconId"));

  if (!url) {
    shortcutUrlInput.setCustomValidity("Разрешены только ссылки http:// и https:// без логина и пароля.");
    shortcutUrlInput.reportValidity();
    return;
  }

  if (!title || !isAllowedIconId(iconId)) {
    return;
  }

  if (listVisibleShortcuts().length >= measureShortcutLayout().cellsMax) {
    shortcutDialog.close();
    return;
  }

  const shortcut = { title, url, iconId };
  const { customShortcuts: storedShortcuts } = await chrome.storage.local.get("customShortcuts");
  const nextShortcuts = (Array.isArray(storedShortcuts) ? storedShortcuts : [])
    .map(normalizeStoredShortcut)
    .filter(Boolean);
  nextShortcuts.push(shortcut);

  await chrome.storage.local.set({ customShortcuts: nextShortcuts });
  customShortcuts = nextShortcuts;
  shortcutDialog.close();
  renderShortcuts();
  shortcutGrid.querySelector(".shortcut-card--add")?.focus({ preventScroll: true });
});

window.addEventListener("resize", () => {
  if (!iconCatalog.length) {
    return;
  }

  renderShortcuts();
});

initializeShortcuts();
