(() => {
  if (window.__darkNewTabClaudeAutosendStarted) {
    return;
  }

  const query = String(
    window.__DARK_NEW_TAB_CLAUDE_QUERY
    || new URLSearchParams(location.search).get("q")
    || ""
  ).trim();

  if (!query) {
    return;
  }

  window.__darkNewTabClaudeAutosendStarted = true;

  const COMPOSER_SELECTORS = [
    'div.ProseMirror[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][data-placeholder]',
    "textarea"
  ];
  const SEND_BUTTON_SELECTORS = [
    'button[aria-label="Send message" i]',
    'button[aria-label*="send message" i]',
    'button[aria-label*="Отправить"]',
    'button[data-testid*="send" i]',
    'button[aria-label*="send" i]'
  ];
  const startedAt = Date.now();
  let filled = false;
  let readySince = 0;

  function normalize(value) {
    return String(value || "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
  }

  function firstMatch(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);

      if (node) {
        return node;
      }
    }

    return null;
  }

  function composer() {
    return firstMatch(COMPOSER_SELECTORS);
  }

  function composerText() {
    const node = composer();
    return node ? normalize(node.innerText || node.textContent || node.value) : "";
  }

  function sendButton() {
    const named = firstMatch(SEND_BUTTON_SELECTORS);

    if (named) {
      return named;
    }

    const container = composer()?.closest("fieldset, form");

    if (!container) {
      return null;
    }

    const withIcon = [...container.querySelectorAll("button")].filter((button) =>
      button.querySelector("svg")
    );
    return withIcon.at(-1) || null;
  }

  function fillComposer() {
    const node = composer();

    if (!node) {
      return;
    }

    node.focus();

    if (typeof node.value === "string") {
      node.select();
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    document.execCommand("insertText", false, query);
  }

  function pressEnter() {
    const node = composer();

    if (!node) {
      return;
    }

    node.focus();
    node.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      })
    );
  }

  function tick() {
    if (Date.now() - startedAt > 20000) {
      return;
    }

    if (!composer()) {
      setTimeout(tick, 100);
      return;
    }

    const expected = normalize(query);
    const text = composerText();

    if (text !== expected && Date.now() - startedAt > 1200 && !filled) {
      fillComposer();
      filled = true;
      setTimeout(tick, 200);
      return;
    }

    if (!text) {
      setTimeout(tick, 100);
      return;
    }

    readySince = readySince || Date.now();

    const button = sendButton();

    if (button && !button.disabled) {
      button.click();
      return;
    }

    if (Date.now() - readySince > 2000) {
      pressEnter();
      return;
    }

    setTimeout(tick, 100);
  }

  setTimeout(tick, 200);
})();
