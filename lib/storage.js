// Storage Manager: chrome.storage.local for settings + IndexedDB for Piper ONNX weights

const DB_NAME = "piper_tts_models_db";
const DB_VERSION = 1;
const STORE_MODELS = "models";

function openModelsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_MODELS)) {
        db.createObjectStore(STORE_MODELS, { keyPath: "voiceId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a Piper model ONNX buffer and JSON config to IndexedDB.
 */
async function saveModelToDB(voiceId, onnxBuffer, configJson) {
  const db = await openModelsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MODELS, "readwrite");
    const store = tx.objectStore(STORE_MODELS);
    const record = {
      voiceId,
      onnxBuffer,
      configJson,
      sizeBytes: onnxBuffer.byteLength,
      savedAt: Date.now()
    };
    const req = store.put(record);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves a Piper model from IndexedDB.
 */
async function getModelFromDB(voiceId) {
  const db = await openModelsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MODELS, "readonly");
    const store = tx.objectStore(STORE_MODELS);
    const req = store.get(voiceId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Checks if a model exists in IndexedDB.
 */
async function isModelCached(voiceId) {
  const model = await getModelFromDB(voiceId);
  return !!model && !!model.onnxBuffer;
}

/**
 * Lists all cached models.
 */
async function listCachedModels() {
  const db = await openModelsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MODELS, "readonly");
    const store = tx.objectStore(STORE_MODELS);
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []).map(r => ({
        voiceId: r.voiceId,
        sizeBytes: r.sizeBytes,
        sizeMB: (r.sizeBytes / (1024 * 1024)).toFixed(1),
        savedAt: r.savedAt
      }));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes a cached model from IndexedDB.
 */
async function deleteModelFromDB(voiceId) {
  const db = await openModelsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MODELS, "readwrite");
    const store = tx.objectStore(STORE_MODELS);
    const req = store.delete(voiceId);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Extension settings API using chrome.storage.local
 */
const DEFAULT_SETTINGS = {
  preferredLanguage: "auto",      // 'auto', 'hi', 'en'
  preferredQuality: "medium",    // 'low', 'medium', 'high'
  defaultSpeed: 1.0,             // 0.5 to 2.5
  hoverToSeekEnabled: true,       // Cursor hover skip feature
  hoverDwellMs: 250,              // Hover dwell trigger time
  karaokeHighlight: true,         // Sentence active reading highlight
  noiseScale: 0.667,             // Piper noise_scale
  noiseW: 0.8,                   // Piper noise_w
  geminiApiKey: "",              // Google AI Studio API key
  geminiModel: "gemini-3.8-flash", // gemini-3.8-flash, gemini-3.8-flash-tts
  geminiVoice: "Puck",           // Puck, Kore, Fenrir, Aoede, Charon
  speechEngine: "gemini",        // 'gemini' (Studio Voice) or 'local' (Instant Local Piper)
  useGeminiEngine: true          // Backward compatibility
};

async function getSettings() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    return new Promise(resolve => {
      chrome.storage.local.get(DEFAULT_SETTINGS, items => {
        // Auto-migrate sunset models (e.g. gemini-2.0-flash) to gemini-3.8-flash
        if (items.geminiModel && (items.geminiModel.includes("2.0") || items.geminiModel.includes("2.5"))) {
          items.geminiModel = "gemini-3.8-flash";
          chrome.storage.local.set({ geminiModel: "gemini-3.8-flash" });
        }
        resolve(items);
      });
    });
  }
  return { ...DEFAULT_SETTINGS };
}

async function updateSettings(partial) {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    return new Promise(resolve => {
      chrome.storage.local.set(partial, () => resolve(true));
    });
  }
  return true;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    saveModelToDB,
    getModelFromDB,
    isModelCached,
    listCachedModels,
    deleteModelFromDB,
    getSettings,
    updateSettings,
    DEFAULT_SETTINGS
  };
}
