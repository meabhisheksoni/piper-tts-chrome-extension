// Background Service Worker (Manifest V3)
// Coordinates message relay between Content Script and Offscreen Audio Sandbox

const OFFSCREEN_DOCUMENT_PATH = "offscreen/offscreen.html";

// Ensure context menus on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "piper-speak-selection",
    title: "🔊 Read with Piper Neural TTS",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "piper-speak-selection" && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "TRIGGER_SPEAK_SELECTION",
      selectedText: info.selectionText
    });
  }
});

/**
 * Checks if the offscreen document is already created.
 */
async function hasOffscreenDocument() {
  if ("getContexts" in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
    });
    return contexts.length > 0;
  }
  return false;
}

let creatingOffscreenPromise = null;
let activePlaybackTabId = null;

/**
 * Creates the offscreen document if not already running.
 * Uses a singleton promise mutex to prevent concurrent creation collisions.
 */
async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    return;
  }

  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }

  creatingOffscreenPromise = chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ["AUDIO_PLAYBACK", "WORKERS"],
    justification: "Run Piper ONNX neural TTS inference and stream Web Audio API playback"
  }).finally(() => {
    creatingOffscreenPromise = null;
  });

  await creatingOffscreenPromise;
}

// Relay messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message._fromSW) {
    return false;
  }

  (async () => {
    try {
      // Track the originating tab so events route reliably even if user switches tabs or SW sleeps
      if (message.type === "SYNTHESIZE_AND_PLAY" && sender.tab && sender.tab.id) {
        activePlaybackTabId = sender.tab.id;
        if (chrome.storage && chrome.storage.session) {
          chrome.storage.session.set({ activePlaybackTabId: sender.tab.id }).catch(() => {});
        }
      }

      // Messages destined for the offscreen audio player
      const offscreenActionTypes = [
        "SYNTHESIZE_AND_PLAY",
        "PAUSE_PLAYBACK",
        "RESUME_PLAYBACK",
        "STOP_PLAYBACK",
        "SET_PLAYBACK_SPEED",
        "SEEK_TO_CHUNK",
        "DOWNLOAD_MODEL",
        "GET_PLAYER_STATUS",
        "PRELOAD_KOKORO"
      ];

      if (offscreenActionTypes.includes(message.type)) {
        await ensureOffscreenDocument();
        // Forward message to offscreen document with self-suppression flag
        chrome.runtime.sendMessage({ ...message, _fromSW: true }, (response) => {
          sendResponse(response || { success: true });
        });
        return;
      }

      // Messages originating from offscreen destined for the content script
      const contentEventTypes = [
        "CHUNK_STARTED",
        "CHUNK_COMPLETED",
        "PLAYBACK_FINISHED",
        "PLAYBACK_ERROR",
        "DOWNLOAD_PROGRESS",
        "KOKORO_STATUS"
      ];

      if (contentEventTypes.includes(message.type)) {
        let targetTabId = activePlaybackTabId;
        if (!targetTabId && chrome.storage && chrome.storage.session) {
          try {
            const sess = await chrome.storage.session.get("activePlaybackTabId");
            targetTabId = sess?.activePlaybackTabId || null;
          } catch {}
        }

        // Unicast event directly to the tab where reading is taking place
        if (targetTabId) {
          chrome.tabs.sendMessage(targetTabId, message).catch(() => {
            // Tab was closed or refreshed
            activePlaybackTabId = null;
            if (chrome.storage && chrome.storage.session) {
              chrome.storage.session.remove("activePlaybackTabId").catch(() => {});
            }
          });
        } else {
          // Fallback to active tab if initiated from popup
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab && activeTab.id) {
            chrome.tabs.sendMessage(activeTab.id, message).catch(() => {});
          }
        }
        sendResponse({ received: true });
        return;
      }

      sendResponse({ status: "acknowledged" });
    } catch (err) {
      console.error("[Piper Service Worker] Error handling message:", err);
      sendResponse({ error: err.message });
    }
  })();

  return true; // Keep message channel open for async response
});
