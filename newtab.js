const form = document.querySelector(".search");
const input = document.querySelector(".search__input");
const shell = document.querySelector(".search-shell");
const history = document.querySelector(".search-history");
const shortcutGrid = document.querySelector(".shortcut-grid");
const shortcutDialog = document.querySelector(".shortcut-dialog");
const shortcutForm = document.querySelector(".shortcut-form");
const shortcutUrlInput = shortcutForm.elements.url;
const shortcutTitleInput = shortcutForm.elements.title;
const shortcutUrlSuggestionsBox = document.querySelector("#shortcut-suggestions");
const shortcutTitleSuggestionsBox = document.querySelector("#shortcut-title-suggestions");
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

  if (query.length < 2 && query !== "x") {
    return [];
  }

  return shortcutSuggestions.filter((site) => {
    const title = site.title.toLowerCase();
    const host = suggestionHost(site);

    return site.aliases.some((alias) => alias.startsWith(query) || alias === query)
      || title.startsWith(query)
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
  shortcutUrlSuggestionsBox.hidden = true;
  shortcutTitleSuggestionsBox.hidden = true;
  shortcutUrlInput.setAttribute("aria-expanded", "false");
  shortcutTitleInput.setAttribute("aria-expanded", "false");
  shortcutUrlSuggestionsBox.replaceChildren();
  shortcutTitleSuggestionsBox.replaceChildren();
}

function applyShortcutSuggestion(site) {
  clearTimeout(siteMetaTimer);
  siteMetaRequest += 1;
  shortcutUrlInput.value = site.url;
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

  otherBox.hidden = true;
  otherField.setAttribute("aria-expanded", "false");
  otherBox.replaceChildren();
  visibleShortcutSuggestions = matches;

  if (!matches.length) {
    box.hidden = true;
    field.setAttribute("aria-expanded", "false");
    box.replaceChildren();
    return;
  }

  if (activeShortcutSuggestion < 0 || activeShortcutSuggestion >= matches.length) {
    activeShortcutSuggestion = 0;
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

  box.replaceChildren(fragment);
  box.hidden = false;
  field.setAttribute("aria-expanded", "true");
}

function updateShortcutSuggestions(source) {
  const field = suggestionInputFor(source);
  const local = matchingShortcutSuggestions(field.value);
  const query = field.value.trim();
  const request = ++suggestionFetchId;

  activeShortcutSuggestion = 0;
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
  if (suggestionSource !== source || suggestionBoxFor(source).hidden || !visibleShortcutSuggestions.length) {
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
    activeShortcutSuggestion = (activeShortcutSuggestion - 1 + visibleShortcutSuggestions.length)
      % visibleShortcutSuggestions.length;
    renderShortcutSuggestions(source);
    return true;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    applyShortcutSuggestion(visibleShortcutSuggestions[Math.max(0, activeShortcutSuggestion)]);
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
  button.addEventListener("click", () => {
    void ensureSiteFetchPermission();
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

gptForm.addEventListener("submit", (event) => {
  const query = gptInput.value.trim();

  if (!query) {
    return;
  }

  event.preventDefault();

  const url = new URL("https://chatgpt.com/");
  url.searchParams.set("temporary-chat", "true");
  url.searchParams.set("q", query);

  const inject = async (tabId) => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (nextQuery) => {
          window.__DARK_NEW_TAB_GPT_QUERY = nextQuery;
        },
        args: [query]
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        files: ["chatgpt-autosend.js"]
      });
    } catch {
      return false;
    }

    return true;
  };

  const openChat = async () => {
    const tab = await chrome.tabs.create({ url: url.href });
    const listener = (tabId, info) => {
      if (tabId === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        void inject(tab.id);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => chrome.tabs.onUpdated.removeListener(listener), 25000);
  };

  const request = chrome.permissions?.request
    ? chrome.permissions.request({
        origins: ["https://chatgpt.com/*", "https://chat.openai.com/*"]
      })
    : Promise.resolve(true);

  void request.catch(() => false).then(openChat);
});

shortcutCancel.addEventListener("click", () => shortcutDialog.close());

shortcutUrlInput.addEventListener("input", () => {
  shortcutUrlInput.setCustomValidity("");
  updateShortcutSuggestions("url");
  scheduleSiteMetaLookup();
});

shortcutUrlInput.addEventListener("focus", () => {
  updateShortcutSuggestions("url");
});

shortcutUrlInput.addEventListener("keydown", (event) => {
  handleSuggestionKeydown(event, "url");
});

shortcutTitleInput.addEventListener("input", () => {
  updateShortcutSuggestions("title");
});

shortcutTitleInput.addEventListener("focus", () => {
  updateShortcutSuggestions("title");
});

shortcutTitleInput.addEventListener("keydown", (event) => {
  handleSuggestionKeydown(event, "title");
});

shortcutDialog.addEventListener("close", () => {
  clearTimeout(siteMetaTimer);
  siteMetaRequest += 1;
  autoFilledTitle = "";
  shortcutForm.reset();
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

  if (listVisibleShortcuts().length >= measureShortcutLayout().cellsMax) {
    shortcutDialog.close();
    return;
  }

  const shortcut = { title, url, iconId: SITE_ICON_ID };
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
