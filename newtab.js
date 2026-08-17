const form = document.querySelector(".search");
const input = document.querySelector(".search__input");
const shell = document.querySelector(".search-shell");
const history = document.querySelector(".search-history");
const historyItem = document.querySelector(".search-history__item");

let lastQuery = "";

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
