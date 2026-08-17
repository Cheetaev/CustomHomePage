const form = document.querySelector(".search");
const input = document.querySelector(".search__input");
const shell = document.querySelector(".search-shell");
const history = document.querySelector(".search-history");
const historyItem = document.querySelector(".search-history__item");
const shortcutViewport = document.querySelector(".shortcut-viewport");
const shortcutTrack = document.querySelector(".shortcut-track");
const shortcutPrevious = document.querySelector(".shortcut-arrow--previous");
const shortcutNext = document.querySelector(".shortcut-arrow--next");
const shortcutDialog = document.querySelector(".shortcut-dialog");
const shortcutForm = document.querySelector(".shortcut-form");
const shortcutIconPicker = document.querySelector(".shortcut-icon-picker");
const shortcutUrlInput = shortcutForm.elements.url;
const shortcutCancel = document.querySelector(".shortcut-dialog__cancel");

const defaultShortcuts = [
  { title: "Яндекс Почта", url: "https://mail.yandex.ru/", iconId: "yandex-mail" },
  { title: "Яндекс Карты", url: "https://yandex.ru/maps/", iconId: "yandex-maps" },
  { title: "Гугл Почта", url: "https://mail.google.com/", iconId: "gmail" },
  { title: "Яндекс Диск", url: "https://disk.yandex.ru/", iconId: "yandex-disk" }
];

let lastQuery = "";
let iconCatalog = [];
let customShortcuts = [];

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

function createShortcutCard(shortcut) {
  const icon = findIcon(shortcut.iconId) || findIcon("link");
  const link = document.createElement("a");
  const image = document.createElement("img");
  const label = document.createElement("span");

  link.className = "shortcut-card";
  link.href = shortcut.url;
  link.title = shortcut.title;

  image.className = "shortcut-card__icon";
  image.src = icon.src;
  image.alt = "";
  image.draggable = false;

  label.className = "shortcut-card__label";
  label.textContent = shortcut.title;

  link.append(image, label);
  return link;
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

function updateCarouselControls() {
  const maxScroll = shortcutViewport.scrollWidth - shortcutViewport.clientWidth;

  shortcutPrevious.disabled = shortcutViewport.scrollLeft <= 1;
  shortcutNext.disabled = maxScroll <= 1 || shortcutViewport.scrollLeft >= maxScroll - 1;
}

function renderShortcuts() {
  const fragment = document.createDocumentFragment();

  for (const shortcut of [...defaultShortcuts, ...customShortcuts]) {
    fragment.append(createShortcutCard(shortcut));
  }

  fragment.append(createAddShortcutButton());
  shortcutTrack.replaceChildren(fragment);

  requestAnimationFrame(() => {
    shortcutViewport.scrollLeft = 0;
    updateCarouselControls();
  });
}

function renderIconPicker() {
  const fragment = document.createDocumentFragment();

  iconCatalog.forEach((icon, index) => {
    const option = document.createElement("label");
    const radio = document.createElement("input");
    const image = document.createElement("img");
    const label = document.createElement("span");

    option.className = "shortcut-icon-option";

    radio.className = "visually-hidden";
    radio.type = "radio";
    radio.name = "iconId";
    radio.value = icon.id;
    radio.required = true;
    radio.defaultChecked = index === 0;

    image.src = icon.src;
    image.alt = "";
    image.draggable = false;

    label.textContent = icon.label;

    option.append(radio, image, label);
    fragment.append(option);
  });

  shortcutIconPicker.replaceChildren(fragment);
}

function normalizeStoredShortcut(shortcut) {
  if (!shortcut || typeof shortcut !== "object") {
    return null;
  }

  const title = typeof shortcut.title === "string" ? shortcut.title.trim().slice(0, 24) : "";
  const url = typeof shortcut.url === "string" ? normalizeShortcutUrl(shortcut.url) : "";
  const iconId = typeof shortcut.iconId === "string" ? shortcut.iconId : "";

  if (!title || !url || !findIcon(iconId)) {
    return null;
  }

  return { title, url, iconId };
}

async function initializeShortcuts() {
  const [catalogResponse, { customShortcuts: storedShortcuts }] = await Promise.all([
    fetch("icons/catalog.json"),
    chrome.storage.local.get("customShortcuts")
  ]);

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

  renderIconPicker();
  renderShortcuts();
}

function showHistory() {
  if (!lastQuery) {
    return;
  }

  history.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function hideHistory() {
  history.hidden = true;
  input.setAttribute("aria-expanded", "false");
}

chrome.storage.local.get("lastQuery").then(({ lastQuery: savedQuery }) => {
  if (typeof savedQuery !== "string" || !savedQuery.trim()) {
    return;
  }

  lastQuery = savedQuery.trim();
  historyItem.textContent = lastQuery;

  if (document.activeElement === input) {
    showHistory();
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
  if (!form.contains(event.relatedTarget) && !history.contains(event.relatedTarget)) {
    hideHistory();
  }
});

historyItem.addEventListener("click", () => {
  input.value = lastQuery;
  form.requestSubmit();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = input.value.trim();

  if (!query) {
    input.focus();
    return;
  }

  input.value = query;
  lastQuery = query;
  historyItem.textContent = query;

  try {
    await chrome.storage.local.set({ lastQuery: query });
  } finally {
    form.submit();
  }
});

shortcutPrevious.addEventListener("click", () => {
  shortcutViewport.scrollBy({
    left: -Math.max(240, shortcutViewport.clientWidth * 0.8),
    behavior: "smooth"
  });
});

shortcutNext.addEventListener("click", () => {
  shortcutViewport.scrollBy({
    left: Math.max(240, shortcutViewport.clientWidth * 0.8),
    behavior: "smooth"
  });
});

shortcutViewport.addEventListener("scroll", updateCarouselControls, { passive: true });
window.addEventListener("resize", updateCarouselControls);

shortcutCancel.addEventListener("click", () => shortcutDialog.close());

shortcutUrlInput.addEventListener("input", () => shortcutUrlInput.setCustomValidity(""));

shortcutDialog.addEventListener("close", () => {
  shortcutForm.reset();
  shortcutUrlInput.setCustomValidity("");
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

  if (!title || !findIcon(iconId)) {
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
  shortcutTrack.querySelector(".shortcut-card--add").focus({ preventScroll: true });

  requestAnimationFrame(() => {
    shortcutViewport.scrollTo({ left: shortcutViewport.scrollWidth, behavior: "smooth" });
  });
});

initializeShortcuts();
