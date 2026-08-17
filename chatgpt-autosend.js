(() => {
  if (window.__darkNewTabGptAutosendStarted) {
    return;
  }

  const query = String(
    window.__DARK_NEW_TAB_GPT_QUERY
    || new URLSearchParams(location.search).get("q")
    || new URLSearchParams(location.search).get("prompt")
    || ""
  ).trim();

  if (!query) {
    return;
  }

  window.__darkNewTabGptAutosendStarted = true;

  const startedAt = Date.now();
  let filled = false;

  function normalize(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function composer() {
    return document.querySelector(
      'form[data-type="unified-composer"] #prompt-textarea, #prompt-textarea.ProseMirror, #prompt-textarea'
    );
  }

  function composerText() {
    const node = composer();
    return node ? normalize(node.innerText || node.textContent || node.value) : "";
  }

  function sendButton() {
    const named = document.querySelector(
      'button[data-testid="send-button"], button[aria-label*="Send"], button[aria-label*="Отправ"], button[aria-label*="Submit"]'
    );

    if (named) {
      return named;
    }

    const form = composer()?.closest("form");

    if (!form) {
      return null;
    }

    const buttons = [...form.querySelectorAll("button")];
    const labeled = buttons.find((button) =>
      /send|отправ|submit/i.test(button.getAttribute("aria-label") || "")
    );

    if (labeled) {
      return labeled;
    }

    const withIcon = buttons.filter((button) => button.querySelector("svg"));
    return withIcon.at(-1) || null;
  }

  function fillComposer() {
    const node = composer();

    if (!node) {
      return;
    }

    node.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("insertText", false, query);
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

    const button = sendButton();

    if (!button || button.disabled) {
      setTimeout(tick, 100);
      return;
    }

    button.click();
  }

  setTimeout(tick, 200);
})();
