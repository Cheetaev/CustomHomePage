const WAIT_MS = 15000;
const POLL_MS = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function paramQuery() {
  const params = new URLSearchParams(location.search);
  return (params.get("q") || params.get("prompt") || "").trim();
}

function composerHasQuery(query) {
  const composer = document.querySelector("#prompt-textarea, [data-testid='prompt-textarea']");

  if (!composer) {
    return false;
  }

  const text = (composer.innerText || composer.value || "").replace(/\u00a0/g, " ").trim();
  return text === query;
}

function sendButton() {
  const button = document.querySelector('button[data-testid="send-button"]');

  if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") {
    return null;
  }

  return button;
}

async function hasPendingSubmit(query) {
  const deadline = Date.now() + 4000;

  while (Date.now() < deadline) {
    const { gptAutoSubmit } = await chrome.storage.session.get("gptAutoSubmit");

    if (typeof gptAutoSubmit === "string" && gptAutoSubmit.trim() === query) {
      return true;
    }

    await sleep(50);
  }

  return false;
}

async function waitAndSend(query) {
  const deadline = Date.now() + WAIT_MS;

  while (Date.now() < deadline) {
    if (composerHasQuery(query)) {
      const button = sendButton();

      if (button) {
        button.click();
        return;
      }
    }

    await sleep(POLL_MS);
  }
}

(async () => {
  const query = paramQuery();

  if (!query) {
    return;
  }

  if (!(await hasPendingSubmit(query))) {
    return;
  }

  await chrome.storage.session.remove("gptAutoSubmit");
  await waitAndSend(query);
})();
