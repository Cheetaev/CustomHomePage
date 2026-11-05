const webSearches = document.querySelector(".web-searches");
const searchInputs = [...webSearches.querySelectorAll(".search__input")];
let activeSearchInput = searchInputs[0];
const shortcutGrid = document.querySelector(".shortcut-grid");
const weatherWidget = shortcutGrid.querySelector(".weather-widget");
const shortcutDialog = document.querySelector(".shortcut-dialog");
const shortcutForm = document.querySelector(".shortcut-form");
const shortcutUrlInput = shortcutForm.elements.url;
const shortcutTitleInput = shortcutForm.elements.title;
const shortcutUrlSuggestionsBox = document.querySelector("#shortcut-suggestions");
const shortcutTitleSuggestionsBox = document.querySelector("#shortcut-title-suggestions");
const shortcutCancel = document.querySelector(".shortcut-dialog__cancel");
const shortcutDialogTitle = document.querySelector("#shortcut-dialog-title");
const shortcutSubmit = shortcutForm.querySelector(".shortcut-dialog__submit");
const shortcutIconPreview = shortcutForm.querySelector(".shortcut-icon-preview__image");
const shortcutIconLock = shortcutForm.querySelector(".shortcut-icon-preview__lock");
let editingShortcut = null;
let lockedShortcutIcon = null;
const defaultShortcuts = [
  { title: "Яндекс Почта", url: "https://mail.yandex.ru/", iconId: "yandex-mail" },
  { title: "Яндекс Карты", url: "https://yandex.ru/maps/", iconId: "yandex-maps" },
  { title: "Гугл Почта", url: "https://mail.google.com/", iconId: "gmail" },
  { title: "Яндекс Диск", url: "https://disk.yandex.ru/", iconId: "yandex-disk" }
];
const SEARCH_HISTORY_LIMIT = 10;
const SHORTCUT_LIMIT = 18;
const SITE_ICON_ID = "favicon";
const SUGGESTION_LIMIT = 5;
const shortcutSuggestions = [
  { title: "Instagram", url: "https://www.instagram.com/", aliases: ["ins", "insta", "instagram"] },
  { title: "YouTube", url: "https://www.youtube.com/", aliases: ["yt", "you", "youtube"] },
  { title: "Telegram", url: "https://web.telegram.org/", aliases: ["tg", "tele", "telegram"] },
  { title: "ВКонтакте", url: "https://vk.com/", aliases: ["vk", "вк", "вконтакте"] },
  { title: "TikTok", url: "https://www.tiktok.com/", aliases: ["tt", "tik", "tiktok"] },
  { title: "GitHub", url: "https://github.com/", aliases: ["gh", "git", "github"] },
  { title: "ChatGPT", url: "https://chatgpt.com/", aliases: ["gpt", "chat", "chatgpt"] },
  { title: "WhatsApp", url: "https://web.whatsapp.com/", aliases: ["wa", "whats", "whatsapp"] },
  { title: "Discord", url: "https://discord.com/app", aliases: ["ds", "disc", "discord"] },
  { title: "X", url: "https://x.com/", aliases: ["x", "twitter", "tw"] },
  { title: "Reddit", url: "https://www.reddit.com/", aliases: ["rd", "reddit"] },
  { title: "Twitch", url: "https://www.twitch.tv/", aliases: ["twitch"] },
  { title: "Spotify", url: "https://open.spotify.com/", aliases: ["spot", "spotify"] },
  { title: "Netflix", url: "https://www.netflix.com/", aliases: ["netflix"] },
  { title: "Wikipedia", url: "https://ru.wikipedia.org/", aliases: ["wiki", "wikipedia"] },
  { title: "Google", url: "https://www.google.com/", aliases: ["google"] },
  { title: "Яндекс", url: "https://ya.ru/", aliases: ["ya", "яндекс", "yandex"] },
  { title: "Ozon", url: "https://www.ozon.ru/", aliases: ["ozon"] },
  { title: "Wildberries", url: "https://www.wildberries.ru/", aliases: ["wb", "wild", "wildberries"] },
  { title: "Кинопоиск", url: "https://www.kinopoisk.ru/", aliases: ["kp", "кино", "kinopoisk"] },
  { title: "Pinterest", url: "https://www.pinterest.com/", aliases: ["pin", "pinterest"] },
  { title: "Пикабу", url: "https://pikabu.ru/", aliases: ["pika", "pikabu", "пикабу"] },
  { title: "Pika", url: "https://pika.art/", aliases: ["pikalabs", "pika art", "pika ai"] },
  { title: "LinkedIn", url: "https://www.linkedin.com/", aliases: ["linkedin"] },
  { title: "Facebook", url: "https://www.facebook.com/", aliases: ["fb", "facebook"] }
];

let searchHistoryRequest = 0;
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

function completeShortcutUrl(value) {
  const trimmed = value.trim();
  const direct = normalizeShortcutUrl(trimmed);

  if (direct) {
    return direct;
  }

  if (!trimmed || /\s/.test(trimmed) || !trimmed.includes(".")) {
    return "";
  }

  return normalizeShortcutUrl(`https://${trimmed}`);
}

function suggestionHost(site) {
  try {
    return new URL(site.url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function matchingShortcutSuggestions(value) {
  const query = value.trim().toLowerCase();
  if (!query) {
    return shortcutSuggestions.slice(0, SUGGESTION_LIMIT);
  }

  if (query.length < 2 && query !== "x") {
    return [];
  }

  return shortcutSuggestions.filter((site) => {
    const title = site.title.toLowerCase();
    const host = suggestionHost(site);

    return site.aliases.some((alias) => alias.startsWith(query) || alias === query)
      || title.startsWith(query)
      || site.url.toLowerCase().startsWith(query)
      || host.startsWith(query)
      || host.includes(query);
  }).slice(0, SUGGESTION_LIMIT);
}

let visibleShortcutSuggestions = [];
let activeShortcutSuggestion = -1;
let suggestionSource = "url";
let siteMetaTimer = 0;
let siteMetaRequest = 0;
let suggestionTimer = 0;
let suggestionFetchId = 0;
let autoFilledTitle = "";

const SITE_FETCH_ORIGINS = ["https://*/*", "http://*/*"];

function suggestionBoxFor(source) {
  return source === "title" ? shortcutTitleSuggestionsBox : shortcutUrlSuggestionsBox;
}

function suggestionInputFor(source) {
  return source === "title" ? shortcutTitleInput : shortcutUrlInput;
}

function hideShortcutSuggestions() {
  suggestionFetchId += 1;
  clearTimeout(suggestionTimer);
  visibleShortcutSuggestions = [];
  activeShortcutSuggestion = -1;
  shortcutUrlSuggestionsBox.inert = true;
  shortcutTitleSuggestionsBox.inert = true;
  shortcutUrlInput.setAttribute("aria-expanded", "false");
  shortcutTitleInput.setAttribute("aria-expanded", "false");
}

function applyShortcutSuggestion(site) {
  clearTimeout(siteMetaTimer);
  siteMetaRequest += 1;
  shortcutUrlInput.value = site.url;
  updateShortcutIconPreview();
  shortcutTitleInput.value = site.title.slice(0, 24);
  autoFilledTitle = shortcutTitleInput.value;
  shortcutUrlInput.setCustomValidity("");
  hideShortcutSuggestions();
}

function mergeShortcutSuggestions(...lists) {
  const seen = new Set();
  const result = [];

  for (const site of lists.flat()) {
    if (!site?.title || !site.url) {
      continue;
    }

    const key = (suggestionHost(site) || site.url).toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(site);

    if (result.length === SUGGESTION_LIMIT) {
      break;
    }
  }

  return result;
}

function catalogTitleForUrl(pageUrl) {
  const host = suggestionHost({ url: pageUrl });

  if (!host) {
    return "";
  }

  return shortcutSuggestions.find((site) => suggestionHost(site) === host)?.title || "";
}

function suggestionFromUrl(pageUrl, title) {
  const url = completeShortcutUrl(pageUrl);

  if (!url) {
    return null;
  }

  const label = (catalogTitleForUrl(url) || String(title || "").trim() || fallbackTitleFromUrl(url)).slice(0, 24);
  return label ? { title: label, url, aliases: [] } : null;
}

function suggestionFromPhrase(phrase) {
  const text = String(phrase || "").trim();
  const lower = text.toLowerCase();

  if (!text) {
    return null;
  }

  const domain = lower.match(/\b(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:\/\S*)?/i)?.[1];

  if (domain) {
    return suggestionFromUrl(domain, text);
  }

  const known = shortcutSuggestions.find((site) =>
    site.aliases.some((alias) => alias === lower || alias.startsWith(lower))
    || site.title.toLowerCase().startsWith(lower)
    || suggestionHost(site).includes(lower)
  );

  if (known) {
    return known;
  }

  if (!/^[a-z0-9-]{2,}$/i.test(lower)) {
    return null;
  }

  return suggestionFromUrl(`${lower}.ru`) || suggestionFromUrl(`${lower}.com`);
}

function suggestionFromYandexNav(row) {
  if (!Array.isArray(row) || row[0] !== "nav") {
    return null;
  }

  return suggestionFromUrl(String(row[3] || ""), String(row[2] || row[1] || ""));
}

async function fetchJson(url) {
  const response = await fetch(url, { redirect: "follow" });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function remoteShortcutSuggestions(query) {
  if (query.length < 2) {
    return [];
  }

  const encoded = encodeURIComponent(query);

  try {
    const [google, duckduckgo, yandex] = await Promise.all([
      fetchJson(`https://suggestqueries.google.com/complete/search?client=firefox&hl=ru&q=${encoded}`).catch(() => null),
      fetchJson(`https://duckduckgo.com/ac/?q=${encoded}&kl=ru-ru`).catch(() => null),
      fetchJson(`https://yandex.ru/suggest/suggest-ya.cgi?part=${encoded}&v=4&n=10&uil=ru`).catch(() => null)
    ]);

    const fromYandex = Array.isArray(yandex?.[1])
      ? yandex[1].map((row) => Array.isArray(row) ? suggestionFromYandexNav(row) : suggestionFromPhrase(row))
      : [];
    const fromGoogle = Array.isArray(google?.[1])
      ? google[1].map((row) => suggestionFromPhrase(row))
      : [];
    const fromDuckDuckGo = Array.isArray(duckduckgo)
      ? duckduckgo.map((row) => suggestionFromPhrase(row?.phrase))
      : [];

    return mergeShortcutSuggestions(fromYandex, fromGoogle, fromDuckDuckGo);
  } catch {
    return [];
  }
}

function renderShortcutSuggestions(source, matches = visibleShortcutSuggestions) {
  suggestionSource = source;
  const field = suggestionInputFor(source);
  const box = suggestionBoxFor(source);
  const otherSource = source === "title" ? "url" : "title";
  const otherBox = suggestionBoxFor(otherSource);
  const otherField = suggestionInputFor(otherSource);

  otherBox.inert = true;
  otherField.setAttribute("aria-expanded", "false");
  visibleShortcutSuggestions = matches;

  if (!matches.length) {
    box.inert = true;
    field.setAttribute("aria-expanded", "false");
    return;
  }

  if (activeShortcutSuggestion >= matches.length) {
    activeShortcutSuggestion = -1;
  }

  const fragment = document.createDocumentFragment();

  matches.forEach((site, index) => {
    const item = document.createElement("button");
    const title = document.createElement("span");
    const url = document.createElement("span");

    item.className = "shortcut-suggestions__item";
    item.type = "button";

    if (index === activeShortcutSuggestion) {
      item.classList.add("is-active");
    }

    title.className = "shortcut-suggestions__title";
    title.textContent = site.title;
    url.className = "shortcut-suggestions__url";
    url.textContent = site.url;

    item.append(title, url);
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      applyShortcutSuggestion(site);
    });
    fragment.append(item);
  });

  box.firstElementChild.replaceChildren(fragment);
  box.inert = false;
  field.setAttribute("aria-expanded", "true");
}

function updateShortcutSuggestions(source) {
  const field = suggestionInputFor(source);
  const local = matchingShortcutSuggestions(field.value);
  const query = field.value.trim();
  const request = ++suggestionFetchId;

  activeShortcutSuggestion = -1;
  renderShortcutSuggestions(source, local);
  clearTimeout(suggestionTimer);

  if (query.length < 2 && query !== "x") {
    return;
  }

  suggestionTimer = setTimeout(() => {
    void remoteShortcutSuggestions(query).then((remote) => {
      if (request !== suggestionFetchId || suggestionSource !== source) {
        return;
      }

      if (suggestionInputFor(source).value.trim() !== query) {
        return;
      }

      renderShortcutSuggestions(source, mergeShortcutSuggestions(local, remote));
    });
  }, 200);
}

function handleSuggestionKeydown(event, source) {
  if (suggestionSource !== source || suggestionBoxFor(source).inert || !visibleShortcutSuggestions.length) {
    return false;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeShortcutSuggestion = (activeShortcutSuggestion + 1) % visibleShortcutSuggestions.length;
    renderShortcutSuggestions(source);
    return true;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    activeShortcutSuggestion = activeShortcutSuggestion <= 0
      ? visibleShortcutSuggestions.length - 1
      : activeShortcutSuggestion - 1;
    renderShortcutSuggestions(source);
    return true;
  }

  if (event.key === "Enter" && activeShortcutSuggestion >= 0) {
    event.preventDefault();
    applyShortcutSuggestion(visibleShortcutSuggestions[activeShortcutSuggestion]);
    return true;
  }

  if (event.key === "Escape") {
    hideShortcutSuggestions();
    return true;
  }

  return false;
}

function fallbackTitleFromUrl(pageUrl) {
  try {
    const host = new URL(pageUrl).hostname.replace(/^www\./, "");
    const name = host.split(".")[0];

    if (!name) {
      return "";
    }

    return (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, 24);
  } catch {
    return "";
  }
}

async function ensureSiteFetchPermission() {
  if (!chrome.permissions?.request) {
    return false;
  }

  try {
    const have = await chrome.permissions.contains({ origins: SITE_FETCH_ORIGINS });

    if (have) {
      return true;
    }

    return await chrome.permissions.request({ origins: SITE_FETCH_ORIGINS });
  } catch {
    return false;
  }
}

function looksBrokenText(value) {
  return !value || value.includes("\uFFFD") || /[ÐÑÃÂ]{3,}/.test(value);
}

function decodeHtmlBytes(buffer, charset) {
  const label = String(charset || "utf-8").trim().toLowerCase().replace(/_/g, "-");
  const encoding = {
    utf8: "utf-8",
    "utf-8": "utf-8",
    "windows-1251": "windows-1251",
    "cp1251": "windows-1251",
    "cp-1251": "windows-1251",
    "koi8-r": "koi8-r"
  }[label] || "utf-8";

  try {
    return new TextDecoder(encoding).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

async function fetchSiteTitle(pageUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(pageUrl, {
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      return "";
    }

    const buffer = await response.arrayBuffer();
    const headerCharset = /charset=([^;]+)/i.exec(response.headers.get("content-type") || "")?.[1] || "";
    let html = decodeHtmlBytes(buffer, headerCharset || "utf-8");
    const metaCharset = html.match(/charset=["']?([\w-]+)/i)?.[1] || "";

    if (metaCharset) {
      html = decodeHtmlBytes(buffer, metaCharset);
    }

    if (looksBrokenText(html)) {
      html = decodeHtmlBytes(buffer, "windows-1251");
    }

    const doc = new DOMParser().parseFromString(html, "text/html");
    const raw = [
      doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content"),
      doc.querySelector('meta[property="og:title"]')?.getAttribute("content"),
      doc.querySelector("title")?.textContent
    ].map((value) => String(value || "").trim().replace(/\s+/g, " "))
      .find((value) => value && !looksBrokenText(value)) || "";

    if (!raw) {
      return "";
    }

    const parts = raw.split("|").map((part) => part.trim()).filter(Boolean);
    const brand = parts.length > 1 ? parts[parts.length - 1] : raw;
    return (brand || raw).slice(0, 24);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function lookupSiteMeta() {
  const url = completeShortcutUrl(shortcutUrlInput.value);

  if (!url) {
    return;
  }

  const request = ++siteMetaRequest;
  let title = catalogTitleForUrl(url);

  if (!title) {
    title = await fetchSiteTitle(url);
  }

  if (looksBrokenText(title)) {
    title = "";
  }

  title = title || fallbackTitleFromUrl(url);

  if (request !== siteMetaRequest || !shortcutDialog.open) {
    return;
  }

  if (completeShortcutUrl(shortcutUrlInput.value) !== url) {
    return;
  }

  if (shortcutUrlInput.value.trim() !== url) {
    shortcutUrlInput.value = url;
  }

  const current = shortcutTitleInput.value.trim();

  if (!current || current === autoFilledTitle || looksBrokenText(current)) {
    shortcutTitleInput.value = title;
    autoFilledTitle = title;
  }
}

function scheduleSiteMetaLookup() {
  clearTimeout(siteMetaTimer);
  siteMetaTimer = setTimeout(() => {
    void lookupSiteMeta();
  }, 450);
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
    const url = shortcut.iconUrl || shortcut.url;
    return findSiteIcon(url)?.src || faviconSrc(url) || findIcon("link")?.src || "";
  }

  return (findIcon(shortcut.iconId) || findIcon("link"))?.src || "";
}

function findSiteIcon(pageUrl) {
  if (!URL.canParse(pageUrl)) {
    return undefined;
  }

  const url = new URL(pageUrl);
  const host = url.hostname.replace(/^www\./, "");
  const address = host + url.pathname;
  let match;
  let matchLength = 0;

  for (const icon of iconCatalog) {
    for (const site of icon.sites ?? []) {
      if (site.length > matchLength && (address === site || address.startsWith(site + "/"))) {
        match = icon;
        matchLength = site.length;
      }
    }
  }

  return match;
}

const pendingFavicons = new Map();
const shortcutStorageKeys = ["customShortcuts", "hiddenDefaultShortcuts", "shortcutOrder"];
let shortcutOrder = [];

function isStoredFavicon(value) {
  return typeof value === "string" && value.length <= 45000 &&
    /^data:image\/(png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function loadFavicon(src) {
  if (!pendingFavicons.has(src)) {
    const key = `favicon:${src}`;
    const pending = (async () => {
      const stored = (await chrome.storage.local.get(key))[key];
      if (isStoredFavicon(stored)) {
        return stored;
      }

      const response = await fetch(src, { credentials: "omit", signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        return "";
      }

      const blob = await response.blob();
      if (blob.size > 32768) {
        return "";
      }

      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      if (!isStoredFavicon(data)) {
        return "";
      }

      await chrome.storage.local.set({ [key]: data });
      return data;
    })().catch(() => "").finally(() => pendingFavicons.delete(src));
    pendingFavicons.set(src, pending);
  }

  return pendingFavicons.get(src);
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

function setShortcutImage(image, shortcut) {
  const src = shortcutIconSrc(shortcut);
  if (image.dataset.iconSrc === src) {
    return;
  }

  image.dataset.iconSrc = src;
  if (shortcut.iconId === SITE_ICON_ID && src.startsWith("https://")) {
    image.src = findIcon("link")?.src || "icons/link.svg";
    void loadFavicon(src).then((stored) => {
      if (image.dataset.iconSrc === src) {
        image.src = stored || src;
      }
    });
  } else {
    image.src = src || "icons/link.svg";
  }
}

function shortcutIconForUrl(url) {
  if (lockedShortcutIcon) {
    return lockedShortcutIcon;
  }
  const previous = editingShortcut?.shortcut;
  return { iconId: previous?.url === url ? previous.iconId : SITE_ICON_ID };
}

function updateShortcutIconPreview() {
  const url = completeShortcutUrl(shortcutUrlInput.value);
  const locked = Boolean(lockedShortcutIcon);
  setShortcutImage(shortcutIconPreview, { url, ...shortcutIconForUrl(url) });
  shortcutIconLock.disabled = !url && !locked;
  shortcutIconLock.setAttribute("aria-pressed", String(locked));
  shortcutIconLock.title = locked ? "Открепить иконку" : "Закрепить иконку";
  shortcutIconLock.querySelector("path").setAttribute("d", locked
    ? "M5 7V5a3 3 0 0 1 6 0v2"
    : "M5 7V5a3 3 0 0 1 6 0");
}

function isAllowedIconId(iconId) {
  return iconId === SITE_ICON_ID || Boolean(findIcon(iconId));
}

function isSameShortcut(left, right) {
  return left.title === right.title && left.url === right.url && left.iconId === right.iconId;
}

function shortcutKey(shortcut, source) {
  return JSON.stringify([source, shortcut.url, shortcut.title, shortcut.iconId]);
}

function createShortcutCard(shortcut, source) {
  const item = document.createElement("div");
  const link = document.createElement("a");
  const image = document.createElement("img");
  const label = document.createElement("span");
  const edit = document.createElement("button");
  const remove = document.createElement("button");
  const removeIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const removePath = document.createElementNS("http://www.w3.org/2000/svg", "path");

  item.className = "shortcut-item";

  link.className = "shortcut-card";
  link.href = shortcut.url;
  link.title = shortcut.title;
  link.draggable = false;

  image.className = "shortcut-card__icon";
  image.alt = "";
  image.draggable = false;
  applyIconFallback(image);
  setShortcutImage(image, shortcut);

  label.className = "shortcut-card__label";
  label.textContent = shortcut.title;

  edit.className = "shortcut-card__action shortcut-card__edit";
  edit.type = "button";
  edit.textContent = "✎";
  edit.setAttribute("aria-label", `Редактировать ${shortcut.title}`);
  edit.addEventListener("click", () => {
    editingShortcut = { shortcut, source };
    lockedShortcutIcon = shortcut.iconLocked
      ? { iconId: shortcut.iconId, iconLocked: true, iconUrl: shortcut.iconUrl }
      : null;
    shortcutDialogTitle.textContent = "Редактировать ссылку";
    shortcutSubmit.textContent = "Сохранить";
    shortcutTitleInput.value = shortcut.title;
    shortcutUrlInput.value = shortcut.url;
    updateShortcutIconPreview();
    shortcutDialog.showModal();
  });

  remove.className = "shortcut-card__action shortcut-card__remove";
  remove.type = "button";
  remove.title = `Удалить ${shortcut.title}`;
  remove.setAttribute("aria-label", `Удалить ${shortcut.title}`);

  removeIcon.setAttribute("viewBox", "0 0 12 12");
  removeIcon.setAttribute("aria-hidden", "true");
  removePath.setAttribute("d", "M2 6h8");
  removeIcon.append(removePath);

  remove.append(removeIcon);
  remove.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void removeShortcut(shortcut, source);
  });

  link.append(image, label);
  item.append(link, edit, remove);
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
  button.addEventListener("click", () => {
    void ensureSiteFetchPermission();
    updateShortcutIconPreview();
    shortcutDialog.showModal();
  });
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

  const positions = new Map(shortcutOrder.map((key, index) => [key, index]));
  return items.sort((left, right) =>
    (positions.get(shortcutKey(left.shortcut, left.source)) ?? shortcutOrder.length) -
    (positions.get(shortcutKey(right.shortcut, right.source)) ?? shortcutOrder.length)
  );
}

function renderShortcuts() {
  const items = listVisibleShortcuts();
  const shown = items.slice(0, SHORTCUT_LIMIT);
  const fragment = document.createDocumentFragment();

  for (const { shortcut, source } of shown) {
    fragment.append(createShortcutCard(shortcut, source));
  }

  if (items.length < SHORTCUT_LIMIT) {
    fragment.append(createAddShortcutButton());
  }

  if (!items.length) {
    const edit = document.createElement("button");
    edit.className = "shortcut-edit-start";
    edit.type = "button";
    edit.textContent = "Редактировать ярлыки";
    edit.addEventListener("click", () => setShortcutEditing(true));
    fragment.append(edit);
  }

  const done = document.createElement("button");
  done.className = "shortcut-edit-done";
  done.type = "button";
  done.textContent = "Готово";
  done.addEventListener("click", () => setShortcutEditing(false));
  fragment.append(done);

  shortcutGrid.replaceChildren(weatherWidget, fragment);
}

async function updateWeather() {
  const condition = weatherWidget.querySelector(".weather-widget__condition");
  try {
    const response = await fetch("https://wttr.in/Moscow?format=j2", { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      throw new Error("Weather request failed");
    }

    const result = await response.json();
    const data = result.data ?? result;
    const current = data.current_condition?.[0];
    const daily = data.weather?.[0];
    const temperature = parseInt(current?.temp_C, 10);
    const low = parseInt(daily?.mintempC, 10);
    const high = parseInt(daily?.maxtempC, 10);
    if (![temperature, low, high].every(Number.isFinite)) {
      throw new Error("Incomplete weather data");
    }

    const code = Number(current.weatherCode);
    const weather = [
      [[113], "Ясно", "☀︎"],
      [[116], "Переменная облачность", "☁︎"],
      [[119, 122], "Облачно", "☁︎"],
      [[143, 248, 260], "Туман", "≋"],
      [[185, 263, 266, 281, 284], "Морось", "☂︎"],
      [[176, 293, 296, 299, 302, 305, 308, 311, 314, 353, 356, 359], "Дождь", "☂︎"],
      [[179, 182, 227, 230, 317, 320, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377], "Снег", "❄︎"],
      [[200, 386, 389, 392, 395], "Гроза", "ϟ"]
    ].find(([codes]) => codes.includes(code));
    weatherWidget.querySelector(".weather-widget__temperature").textContent = `${Math.round(temperature)}°`;
    weatherWidget.querySelector(".weather-widget__icon").textContent = weather?.[2] ?? "";
    condition.textContent = weather?.[1] ?? "";
    weatherWidget.querySelector(".weather-widget__range").textContent = `↓ ${Math.round(low)}° ↑ ${Math.round(high)}°`;
  } catch {
    condition.textContent = "Погода недоступна";
  }
}

void updateWeather();

let shortcutDrag;
let suppressShortcutClick = false;

function setShortcutEditing(editing) {
  shortcutGrid.classList.toggle("is-editing", editing);
  if (!editing) {
    clearShortcutDrag();
  }
}

function clearShortcutDrag() {
  if (!shortcutDrag) {
    return;
  }

  clearTimeout(shortcutDrag.timer);
  shortcutDrag.item.classList.remove("is-dragging");
  shortcutDrag.item.style.transform = "";
  shortcutDrag.target?.classList.remove("is-drop-target");
  shortcutDrag = null;
}

shortcutGrid.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0) {
    return;
  }

  suppressShortcutClick = false;
  const item = event.target.closest(".shortcut-item .shortcut-card")?.parentElement;
  if (!item) {
    return;
  }

  clearShortcutDrag();
  const { pointerId, clientX, clientY } = event;
  shortcutDrag = {
    item, pointerId, clientX, clientY, active: false
  };
  if (shortcutGrid.classList.contains("is-editing")) {
    startShortcutDrag();
  } else {
    shortcutDrag.timer = setTimeout(startShortcutDrag, 400);
  }
});

function startShortcutDrag() {
  const { item, pointerId } = shortcutDrag;
  if (!item.isConnected) {
    clearShortcutDrag();
    return;
  }

  const previousTop = item.getBoundingClientRect().top;
  setShortcutEditing(true);
  const shiftY = previousTop - item.getBoundingClientRect().top;
  shortcutDrag.clientY -= shiftY;
  item.style.transform = `translateY(${shiftY}px)`;
  shortcutDrag.active = true;
  suppressShortcutClick = true;
  item.classList.add("is-dragging");
  shortcutGrid.setPointerCapture(pointerId);
}

window.addEventListener("pointermove", (event) => {
  if (shortcutDrag?.pointerId !== event.pointerId) {
    return;
  }

  const { item, clientX, clientY, active, target } = shortcutDrag;
  const x = event.clientX - clientX;
  const y = event.clientY - clientY;
  if (!active) {
    if (Math.hypot(x, y) > 8) {
      clearShortcutDrag();
    }
    return;
  }

  item.style.transform = `translate(${x}px, ${y}px)`;
  const nextTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest(".shortcut-item");
  if (target !== nextTarget) {
    target?.classList.remove("is-drop-target");
    nextTarget?.classList.add("is-drop-target");
    shortcutDrag.target = nextTarget;
  }
});

window.addEventListener("pointerup", async (event) => {
  if (shortcutDrag?.pointerId !== event.pointerId) {
    return;
  }

  const { item, active, target } = shortcutDrag;
  const items = [...shortcutGrid.querySelectorAll(".shortcut-item")];
  const from = items.indexOf(item);
  const to = items.indexOf(target);
  clearShortcutDrag();
  if (!active || from < 0 || to < 0 || from === to) {
    return;
  }

  const order = listVisibleShortcuts().map(({ shortcut, source }) => shortcutKey(shortcut, source));
  const [key] = order.splice(from, 1);
  order.splice(to, 0, key);
  try {
    await chrome.storage.local.set({ shortcutOrder: order });
  } catch {
    backupStatus.textContent = "Не удалось сохранить порядок ссылок.";
  }
});

window.addEventListener("pointercancel", (event) => {
  if (shortcutDrag?.pointerId === event.pointerId) {
    clearShortcutDrag();
  }
});
window.addEventListener("blur", clearShortcutDrag);
shortcutGrid.addEventListener("lostpointercapture", (event) => {
  if (event.target === shortcutGrid && shortcutDrag?.pointerId === event.pointerId) {
    clearShortcutDrag();
  }
});
shortcutGrid.addEventListener("contextmenu", (event) => {
  if (shortcutDrag?.active) {
    event.preventDefault();
  }
});
shortcutGrid.addEventListener("click", (event) => {
  const link = event.target.closest(".shortcut-item .shortcut-card");
  if ((suppressShortcutClick && event.detail > 0) ||
      (link && shortcutGrid.classList.contains("is-editing"))) {
    event.preventDefault();
    event.stopPropagation();
    suppressShortcutClick = false;
  }
}, true);

document.addEventListener("click", (event) => {
  if (!shortcutGrid.contains(event.target) && !shortcutDialog.contains(event.target)) {
    setShortcutEditing(false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !shortcutDialog.open) {
    setShortcutEditing(false);
  }
});

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

  const normalized = { title, url, iconId };
  if (shortcut.iconLocked === true) {
    normalized.iconLocked = true;
    if (iconId === SITE_ICON_ID) {
      normalized.iconUrl = (typeof shortcut.iconUrl === "string" && normalizeShortcutUrl(shortcut.iconUrl)) || url;
    }
  }
  return normalized;
}

async function initializeShortcuts() {
  const [catalogResponse, stored] = await Promise.all([
    fetch("icons/catalog.json"),
    chrome.storage.local.get(shortcutStorageKeys)
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
  shortcutOrder = Array.isArray(stored.shortcutOrder) ? stored.shortcutOrder : [];

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

function renderSearchHistory(field, queries) {
  const fragment = document.createDocumentFragment();

  for (const query of queries) {
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
      field.value = query;
      field.form.requestSubmit();
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
      void removeHistoryQuery(field, query);
    });

    item.append(button, remove);
    fragment.append(item);
  }

  field.form.nextElementSibling.firstElementChild.replaceChildren(fragment);
}

function searchHistoryKey(form) {
  return form.dataset.historyKey;
}

async function removeHistoryQuery(field, query) {
  const key = searchHistoryKey(field.form);
  const request = searchHistoryRequest;
  await navigator.locks.request(key, async () => {
    const stored = await chrome.storage.local.get(key);
    const queries = normalizeSearchHistory(stored[key]).filter((item) => item !== query);
    await chrome.storage.local.set({ [key]: queries });
  });

  if (request === searchHistoryRequest && activeSearchInput === field &&
      !field.form.nextElementSibling.inert) {
    field.focus();
    void showHistory();
  }
}

async function showHistory() {
  const field = activeSearchInput;
  hideHistory(field);
  const request = searchHistoryRequest;
  const key = searchHistoryKey(field.form);
  const stored = await chrome.storage.local.get(key);
  if (request !== searchHistoryRequest) {
    return;
  }

  const queries = normalizeSearchHistory(stored[key]);
  if (!queries.length) {
    hideHistory();
    return;
  }

  renderSearchHistory(field, queries);
  field.form.nextElementSibling.inert = false;
  field.setAttribute("aria-expanded", "true");
}

function hideHistory(keepOpen = null) {
  searchHistoryRequest += 1;
  for (const field of searchInputs) {
    if (field === keepOpen) {
      continue;
    }
    field.form.nextElementSibling.inert = true;
    field.setAttribute("aria-expanded", "false");
  }
}

for (const field of searchInputs) {
  for (const eventName of ["focus", "click"]) {
    field.addEventListener(eventName, () => {
      activeSearchInput = field;
      showHistory();
    });
  }

  field.addEventListener("input", hideHistory);
  field.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideHistory();
    }
  });
  field.form.addEventListener("submit", submitWebSearch);
}

document.addEventListener("pointerdown", (event) => {
  if (!webSearches.contains(event.target)) {
    hideHistory();
  }
});

webSearches.addEventListener("focusout", (event) => {
  if (!event.relatedTarget) {
    return;
  }

  if (!webSearches.contains(event.relatedTarget)) {
    hideHistory();
  }
});

async function submitWebSearch(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const input = form.querySelector(".search__input");
  const query = input.value.trim();

  if (!query) {
    input.focus();
    return;
  }

  input.value = query;

  try {
    const key = searchHistoryKey(form);
    await navigator.locks.request(key, async () => {
      const stored = await chrome.storage.local.get(key);
      const current = normalizeSearchHistory(stored[key]);
      const next = [query, ...current.filter((item) => item !== query)].slice(0, SEARCH_HISTORY_LIMIT);
      await chrome.storage.local.set({ [key]: next });
    });
  } finally {
    form.submit();
  }
}

async function closeShortcutDialog() {
  if (!shortcutDialog.open || shortcutDialog.classList.contains("is-closing")) {
    return;
  }

  shortcutDialog.classList.add("is-closing");
  shortcutForm.inert = true;
  setKeyboardOpen(false);
  await Promise.allSettled(shortcutDialog.getAnimations({ subtree: true }).map((animation) => animation.finished));
  shortcutDialog.close();
}

shortcutCancel.addEventListener("click", () => void closeShortcutDialog());
shortcutDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  void closeShortcutDialog();
});

applyIconFallback(shortcutIconPreview);
shortcutIconLock.addEventListener("click", () => {
  const url = completeShortcutUrl(shortcutUrlInput.value);
  if (lockedShortcutIcon) {
    lockedShortcutIcon = null;
  } else if (url) {
    const currentIcon = shortcutIconForUrl(url);
    const iconId = currentIcon.iconId === SITE_ICON_ID
      ? findSiteIcon(url)?.id ?? SITE_ICON_ID
      : currentIcon.iconId;
    lockedShortcutIcon = { iconId, iconLocked: true };
    if (iconId === SITE_ICON_ID) {
      lockedShortcutIcon.iconUrl = new URL(url).origin;
    }
  }
  updateShortcutIconPreview();
});

document.addEventListener("click", (event) => {
  if (shortcutDialog.open &&
      !event.target.closest(".shortcut-field input, .shortcut-suggestions, .keyboard")) {
    hideShortcutSuggestions();
  }
});

shortcutUrlInput.addEventListener("input", () => {
  updateShortcutIconPreview();
  shortcutUrlInput.setCustomValidity("");
  updateShortcutSuggestions("url");
  scheduleSiteMetaLookup();
});

shortcutUrlInput.addEventListener("keydown", (event) => {
  handleSuggestionKeydown(event, "url");
});

shortcutTitleInput.addEventListener("input", () => {
  updateShortcutSuggestions("title");
});

shortcutTitleInput.addEventListener("keydown", (event) => {
  handleSuggestionKeydown(event, "title");
});

shortcutDialog.addEventListener("close", () => {
  shortcutDialog.classList.remove("is-closing");
  shortcutForm.inert = false;
  if (keyboard.parentElement === shortcutDialog) {
    setKeyboardOpen(false);
    document.body.append(keyboard);
    keyboardTarget = searchInputs[0];
  }
  clearTimeout(siteMetaTimer);
  siteMetaRequest += 1;
  autoFilledTitle = "";
  shortcutForm.reset();
  editingShortcut = null;
  lockedShortcutIcon = null;
  shortcutDialogTitle.textContent = "Добавить ссылку";
  shortcutSubmit.textContent = "Добавить";
  shortcutUrlInput.setCustomValidity("");
  hideShortcutSuggestions();
});

shortcutForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(shortcutForm);
  const title = String(data.get("title")).trim();
  const url = completeShortcutUrl(String(data.get("url")).trim());

  if (!url) {
    shortcutUrlInput.setCustomValidity("Разрешены только ссылки http:// и https:// без логина и пароля.");
    shortcutUrlInput.reportValidity();
    return;
  }

  if (!title) {
    return;
  }

  if (!editingShortcut && listVisibleShortcuts().length >= SHORTCUT_LIMIT) {
    await closeShortcutDialog();
    return;
  }

  const previous = editingShortcut;
  const shortcut = { title, url, ...shortcutIconForUrl(url) };
  const stored = await chrome.storage.local.get(shortcutStorageKeys);
  const storedShortcuts = stored.customShortcuts;
  const nextShortcuts = (Array.isArray(storedShortcuts) ? storedShortcuts : [])
    .map(normalizeStoredShortcut)
    .filter(Boolean);
  if (previous?.source === "custom") {
    const index = nextShortcuts.findIndex((item) => isSameShortcut(item, previous.shortcut));
    if (index < 0) {
      await closeShortcutDialog();
      return;
    }
    nextShortcuts[index] = shortcut;
  } else {
    nextShortcuts.push(shortcut);
  }

  const changes = { customShortcuts: nextShortcuts };
  if (previous) {
    const previousKey = shortcutKey(previous.shortcut, previous.source);
    const currentOrder = Array.isArray(stored.shortcutOrder) ? stored.shortcutOrder : [];
    const visibleKeys = listVisibleShortcuts().map(({ shortcut, source }) => shortcutKey(shortcut, source));
    changes.shortcutOrder = [...new Set([...currentOrder, ...visibleKeys])]
      .map((key) => key === previousKey ? shortcutKey(shortcut, "custom") : key);
    if (previous.source === "default") {
      changes.hiddenDefaultShortcuts = normalizeHiddenDefaults([
        ...normalizeHiddenDefaults(stored.hiddenDefaultShortcuts), previous.shortcut.url
      ]);
    }
  }

  await chrome.storage.local.set(changes);
  customShortcuts = nextShortcuts;
  shortcutOrder = changes.shortcutOrder ?? shortcutOrder;
  hiddenDefaultShortcuts = changes.hiddenDefaultShortcuts ?? hiddenDefaultShortcuts;
  await closeShortcutDialog();
  renderShortcuts();
  shortcutGrid.querySelector(".shortcut-card--add")?.focus({ preventScroll: true });
});

const keyboard = document.querySelector(".keyboard");
const KEYBOARD_LAYOUTS = {
  ru: {
    label: "RU",
    rows: [
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      ["й", "ц", "у", "к", "е", "н", "г", "ш", "щ", "з", "х", "ъ"],
      ["ф", "ы", "в", "а", "п", "р", "о", "л", "д", "ж", "э", "ё"],
      ["я", "ч", "с", "м", "и", "т", "ь", "б", "ю"]
    ]
  },
  en: {
    label: "EN",
    rows: [
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
      ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
      ["z", "x", "c", "v", "b", "n", "m"]
    ]
  }
};
const KEYBOARD_ICON_PATHS = {
  shift: "M12 4l7 7.5h-4V19H9v-7.5H5z",
  backspace: "M9 5h11v14H9l-6-7zM12 9l6 6M18 9l-6 6",
  enter: "M20 5v6a2 2 0 0 1-2 2H5M8 9l-4 4 4 4",
  hide: "M6 9l6 6 6-6"
};
const KEYBOARD_REPEAT_DELAY = 400;
const KEYBOARD_REPEAT_INTERVAL = 60;
const KEYBOARD_DOUBLE_TAP = 350;

let keyboardLayout = "ru";
let keyboardShift = "off";
let keyboardTarget = searchInputs[0];
let keyboardShiftTappedAt = 0;
let keyboardRepeatTimer = 0;

function createKeyboardKey(options) {
  const key = document.createElement("button");

  key.className = ["keyboard__key", ...(options.classes ?? [])].join(" ");
  key.type = "button";
  key.tabIndex = -1;

  if (options.char) {
    key.dataset.char = options.char;
    key.textContent = keyboardShift === "off" ? options.char : options.char.toUpperCase();
  }

  if (options.action) {
    key.dataset.action = options.action;
  }

  if (options.label) {
    key.setAttribute("aria-label", options.label);
  }

  if (options.icon) {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    path.setAttribute("d", KEYBOARD_ICON_PATHS[options.icon]);
    icon.append(path);
    key.append(icon);
  } else if (options.text) {
    key.textContent = options.text;
  }

  return key;
}

function renderKeyboard() {
  const layout = KEYBOARD_LAYOUTS[keyboardLayout];
  const fragment = document.createDocumentFragment();
  const shiftClasses = ["keyboard__key--wide", "keyboard__key--shift"];

  if (keyboardShift !== "off") {
    shiftClasses.push("is-active");
  }

  if (keyboardShift === "locked") {
    shiftClasses.push("is-locked");
  }

  layout.rows.forEach((chars, index) => {
    const row = document.createElement("div");
    const isLastRow = index === layout.rows.length - 1;

    row.className = "keyboard__row";

    if (isLastRow) {
      row.append(createKeyboardKey({ action: "shift", icon: "shift", label: "Shift", classes: shiftClasses }));
    }

    row.append(...chars.map((char) => createKeyboardKey({ char })));

    if (index === 0) {
      row.classList.add("keyboard__row--numbers");
      row.append(createKeyboardKey({ action: "hide", icon: "hide", label: "Скрыть клавиатуру" }));
    }

    if (isLastRow) {
      row.append(
        createKeyboardKey({ action: "backspace", icon: "backspace", label: "Backspace", classes: ["keyboard__key--wide"] })
      );
    }

    fragment.append(row);
  });

  const bottomRow = document.createElement("div");

  bottomRow.className = "keyboard__row";
  bottomRow.append(
    createKeyboardKey({ action: "layout", text: layout.label, label: "Сменить язык", classes: ["keyboard__key--wide"] }),
    createKeyboardKey({ char: "," }),
    createKeyboardKey({ char: " ", label: "Пробел", classes: ["keyboard__key--space"] }),
    createKeyboardKey({ char: "." }),
    createKeyboardKey({ action: "enter", icon: "enter", label: "Ввод", classes: ["keyboard__key--wide", "keyboard__key--enter"] })
  );
  fragment.append(bottomRow);
  keyboard.replaceChildren(fragment);
}

function setKeyboardShift(state) {
  keyboardShift = state;
  renderKeyboard();
}

function setKeyboardLayout(layout) {
  keyboardLayout = layout;
  renderKeyboard();
  void chrome.storage.local.set({ keyboardLayout: layout });
}

function insertKeyboardText(text) {
  const start = keyboardTarget.selectionStart;
  const end = keyboardTarget.selectionEnd;

  keyboardTarget.focus({ preventScroll: true });
  keyboardTarget.setRangeText(text, start, end, "end");
  keyboardTarget.dispatchEvent(new Event("input", { bubbles: true }));
}

function deleteKeyboardText() {
  const end = keyboardTarget.selectionEnd;
  const start = keyboardTarget.selectionStart === end ? end - 1 : keyboardTarget.selectionStart;

  if (start < 0) {
    return;
  }

  keyboardTarget.focus({ preventScroll: true });
  keyboardTarget.setRangeText("", start, end, "end");
  keyboardTarget.dispatchEvent(new Event("input", { bubbles: true }));
}

function stopKeyboardRepeat() {
  clearTimeout(keyboardRepeatTimer);
  keyboardRepeatTimer = 0;
}

function pressKeyboardKey(key) {
  const { char, action } = key.dataset;

  if (char) {
    insertKeyboardText(keyboardShift === "off" ? char : char.toUpperCase());

    if (keyboardShift === "once") {
      setKeyboardShift("off");
    }

    return;
  }

  if (action === "backspace") {
    deleteKeyboardText();
    keyboardRepeatTimer = setTimeout(() => {
      keyboardRepeatTimer = setInterval(deleteKeyboardText, KEYBOARD_REPEAT_INTERVAL);
    }, KEYBOARD_REPEAT_DELAY);
  } else if (action === "shift") {
    const now = Date.now();
    const isDoubleTap = keyboardShift === "once" && now - keyboardShiftTappedAt < KEYBOARD_DOUBLE_TAP;

    keyboardShiftTappedAt = now;
    setKeyboardShift(isDoubleTap ? "locked" : keyboardShift === "off" ? "once" : "off");
  } else if (action === "layout") {
    setKeyboardLayout(keyboardLayout === "ru" ? "en" : "ru");
  } else if (action === "hide") {
    setKeyboardOpen(false);
  } else if (action === "enter" && keyboardTarget.value.trim()) {
    keyboardTarget.form.requestSubmit();
  }
}

function setKeyboardOpen(open) {
  if (open && !keyboard.classList.contains("is-open")) {
    document.body.style.setProperty("--keyboard-height", `${keyboard.offsetHeight}px`);
  }
  keyboard.classList.toggle("is-open", open);
  document.body.classList.toggle("keyboard-open", open);

  if (open) {
    const isGoogle = Boolean(keyboardTarget.closest(".search--google"));
    keyboard.classList.toggle("keyboard--google", isGoogle);
    keyboard.classList.toggle("keyboard--yandex", searchInputs.includes(keyboardTarget) && !isGoogle);
    keyboardTarget.focus({ preventScroll: true });
  }
}

keyboard.addEventListener("mousedown", (event) => event.preventDefault());
keyboard.addEventListener("pointerdown", (event) => {
  event.preventDefault();

  const key = event.target.closest(".keyboard__key");

  if (key && event.button === 0) {
    pressKeyboardKey(key);
  }
});
window.addEventListener("pointerup", stopKeyboardRepeat);
window.addEventListener("pointercancel", stopKeyboardRepeat);

const keyboardFields = [...searchInputs, shortcutTitleInput, shortcutUrlInput];

document.addEventListener("click", (event) => {
  if (!keyboard.classList.contains("is-open") ||
      keyboard.contains(event.target) ||
      keyboardFields.includes(event.target) ||
      shortcutForm.contains(event.target)) {
    return;
  }

  if (event.target === shortcutDialog) {
    const { left, right, top, bottom } = shortcutDialog.getBoundingClientRect();
    if (event.clientX >= left && event.clientX < right &&
        event.clientY >= top && event.clientY < bottom) {
      return;
    }
  }

  setKeyboardOpen(false);
}, true);

for (const field of keyboardFields) {
  field.addEventListener("focus", () => {
    keyboardTarget = field;
    if (keyboard.classList.contains("is-open") && keyboard.parentElement.contains(field)) {
      setKeyboardOpen(true);
    }
  });

  field.addEventListener("click", () => {
    keyboardTarget = field;
    if (shortcutDialog.contains(field)) {
      if (keyboard.parentElement !== shortcutDialog) {
        shortcutDialog.append(keyboard);
      }
      const source = field === shortcutTitleInput ? "title" : "url";
      if (suggestionBoxFor(source).inert) {
        updateShortcutSuggestions(source);
      }
    }
    setKeyboardOpen(true);
  });
}

new ResizeObserver(() => {
  document.body.style.setProperty("--keyboard-height", `${keyboard.offsetHeight}px`);
}).observe(keyboard);

renderKeyboard();
const stateReady = chrome.runtime.sendMessage({ type: "initialize-state-file" }).catch(() => {});
stateReady.then(() => chrome.storage.local.get("keyboardLayout")).then(({ keyboardLayout: savedLayout }) => {
  if (Object.hasOwn(KEYBOARD_LAYOUTS, savedLayout) && savedLayout !== keyboardLayout) {
    keyboardLayout = savedLayout;
    renderKeyboard();
  }
});

const shortcutsReady = stateReady.then(initializeShortcuts);
const backupStatus = document.querySelector("#shortcut-backup-status");

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "local" && changes.shortcutOrder) {
    await shortcutsReady;
    shortcutOrder = changes.shortcutOrder.newValue || [];
    clearShortcutDrag();
    renderShortcuts();
  }
});
