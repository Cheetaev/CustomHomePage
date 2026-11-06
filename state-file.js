const stateHost = "com.homerep.dark_new_tab";
const platform = chrome.runtime.getPlatformInfo();

let initialization;

function initializeState() {
  initialization ??= (async () => {
    const local = await chrome.storage.local.get(null);
    if (!Object.keys(local).length) {
      let snapshot;
      if ((await platform).os === "win") {
        const chunks = [];
        let offset = 0;
        while (true) {
          const result = await chrome.runtime.sendNativeMessage(stateHost, { action: "read", offset });
          if (result.missing) {
            return;
          }
          if (!result.ok) {
            throw new Error("Unable to read state file");
          }

          const chunk = Uint8Array.from(atob(result.chunk), (character) => character.charCodeAt(0));
          chunks.push(chunk);
          offset += chunk.length;
          if (result.done) {
            break;
          }
        }

        snapshot = JSON.parse(await new Blob(chunks).text());
      } else {
        const response = await fetch(chrome.runtime.getURL("dark-new-tab-state.json"));
        if (!response.ok) {
          throw new Error("Unable to read state file");
        }
        snapshot = await response.json();
      }

      if (snapshot?.version !== 1 || !snapshot.state ||
          typeof snapshot.state !== "object" || Array.isArray(snapshot.state)) {
        throw new Error("Invalid state file");
      }

      await chrome.storage.local.set(snapshot.state);
    }
  })().catch((error) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

async function syncState() {
  await initializeState();
  if ((await platform).os !== "win") {
    return;
  }
  await navigator.locks.request("dark-new-tab-state-file", async () => {
    const state = await chrome.storage.local.get(null);
    const result = await chrome.runtime.sendNativeMessage(stateHost, { action: "write", state });
    if (!result.ok) {
      throw new Error("Unable to write state file");
    }
  });
}

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") {
    void syncState().catch(console.warn);
  }
});

chrome.runtime.onStartup.addListener(() => {
  void syncState().catch(console.warn);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.url !== chrome.runtime.getURL("newtab.html") || message.type !== "initialize-state-file") {
    return;
  }

  void syncState().then(() => sendResponse(true), (error) => {
    console.warn(error);
    sendResponse(false);
  });
  return true;
});
