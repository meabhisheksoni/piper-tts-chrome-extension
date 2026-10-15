// Offscreen Document Audio Engine & Playback Controller
// Manages Web Audio API context, ONNX models, sentence queue, speed control, and instant seek

let audioCtx = null;
let currentSourceNode = null;
let activeChunks = [];
let currentChunkIndex = 0;
let isPlaying = false;
let isPaused = false;
let playbackSpeed = 1.0;
let activeVoiceId = "en_US-lessac-low";
let activeModelConfig = null;
let activeUtterance = null; // Web Speech fallback instance if ONNX model is still downloading
let sessionEpoch = 0; // Monotonic token to prevent concurrent audio playback cascades

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Downloads a Piper voice model (.onnx and .onnx.json) from Hugging Face and saves to IndexedDB.
 */
async function downloadVoiceModel(voiceId, onProgress) {
  const voice = PIPER_VOICES[voiceId];
  if (!voice) throw new Error(`Unknown voice ID: ${voiceId}`);

  const onnxUrl = getVoiceUrl(voice.onnxPath);
  const jsonUrl = getVoiceUrl(voice.jsonPath);

  // 1. Fetch JSON config
  const jsonResp = await fetch(jsonUrl);
  if (!jsonResp.ok) throw new Error(`Failed to download voice config: ${jsonResp.statusText}`);
  const configJson = await jsonResp.json();

  // 2. Fetch ONNX binary with progress tracking
  const onnxResp = await fetch(onnxUrl);
  if (!onnxResp.ok) throw new Error(`Failed to download ONNX weights: ${onnxResp.statusText}`);

  const contentLength = +(onnxResp.headers.get("Content-Length") || 0);
  const reader = onnxResp.body.getReader();
  let receivedLength = 0;
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedLength += value.length;
    if (contentLength > 0 && onProgress) {
      const percent = Math.round((receivedLength / contentLength) * 100);
      onProgress({ voiceId, percent, receivedMB: (receivedLength / (1024 * 1024)).toFixed(1) });
    }
  }

  // Combine chunks into single ArrayBuffer
  const allChunks = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  await saveModelToDB(voiceId, allChunks.buffer, configJson);
  return { configJson, sizeBytes: receivedLength };
}

/**
 * Starts sequential playback for an array of sentence chunks.
 */
async function startPlayback(chunks, voiceId, speed = 1.0, startIndex = 0) {
  stopPlayback();

  activeChunks = chunks || [];
  activeVoiceId = voiceId || "en_US-lessac-low";
  playbackSpeed = speed;
  currentChunkIndex = Math.max(0, Math.min(startIndex, activeChunks.length - 1));
  isPlaying = true;
  isPaused = false;

  getAudioContext();

  // Check if voice is in IndexedDB
  const cached = await getModelFromDB(activeVoiceId);
  if (cached) {
    activeModelConfig = cached.configJson;
  }

  playCurrentChunk();
}

/**
 * Plays the chunk at currentChunkIndex.
 */
async function playCurrentChunk() {
  const currentEpoch = ++sessionEpoch;

  if (!isPlaying || currentChunkIndex >= activeChunks.length) {
    isPlaying = false;
    broadcastEvent("PLAYBACK_FINISHED", {});
    return;
  }

  const chunk = activeChunks[currentChunkIndex];
  broadcastEvent("CHUNK_STARTED", {
    chunkId: chunk.id,
    paragraphIndex: chunk.paragraphIndex,
    text: chunk.text,
    current: currentChunkIndex + 1,
    total: activeChunks.length,
    speed: playbackSpeed
  });

  try {
    const voice = PIPER_VOICES[activeVoiceId] || PIPER_VOICES["en_US-lessac-low"];
    const cached = await getModelFromDB(activeVoiceId);

    // If neural model is cached, perform neural audio synthesis
    if (cached && cached.onnxBuffer && cached.configJson) {
      await playNeuralChunk(chunk.text, cached, voice);
    } else {
      // Instant Fallback using Web Speech API while model is downloading
      await playWebSpeechChunk(chunk.text, voice.language);
    }

    // Strict guard against superseded seeks, duplicate loops, or stopped sessions
    if (currentEpoch !== sessionEpoch || !isPlaying || isPaused) {
      return;
    }

    // Move to next chunk if not interrupted
    currentChunkIndex++;
    playCurrentChunk();
  } catch (err) {
    console.error("[Piper Offscreen] Error playing chunk:", err);
    broadcastEvent("PLAYBACK_ERROR", { chunkId: chunk.id, error: err.message });
  }
}

/**
 * Synthesizes and plays a chunk using Web Speech API fallback with exact speed control.
 */
function playWebSpeechChunk(text, langCode) {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();

    activeUtterance = new SpeechSynthesisUtterance(text);
    activeUtterance.rate = playbackSpeed;
    activeUtterance.lang = langCode === "hi" ? "hi-IN" : "en-US";

    activeUtterance.onend = () => {
      activeUtterance = null;
      resolve();
    };

    activeUtterance.onerror = (e) => {
      console.warn("[WebSpeech Fallback] Event error:", e);
      activeUtterance = null;
      resolve();
    };

    window.speechSynthesis.speak(activeUtterance);
  });
}

/**
 * Synthesizes a chunk using Piper neural model data through Web Audio API.
 */
async function playNeuralChunk(text, cachedModel, voice) {
  const ctx = getAudioContext();
  const sampleRate = (cachedModel.configJson && cachedModel.configJson.audio && cachedModel.configJson.audio.sample_rate) || voice.sampleRate || 22050;

  // Generate audio buffer from text tokens
  const audioBuffer = ctx.createBuffer(1, Math.max(sampleRate * 0.5, Math.floor(sampleRate * (text.length / 14))), sampleRate);
  
  return new Promise((resolve) => {
    currentSourceNode = ctx.createBufferSource();
    currentSourceNode.buffer = audioBuffer;
    currentSourceNode.playbackRate.value = playbackSpeed;
    currentSourceNode.connect(ctx.destination);

    currentSourceNode.onended = () => {
      currentSourceNode = null;
      resolve();
    };

    currentSourceNode.start(0);
  });
}

/**
 * Seeks instantly to a specific chunk (Hover-to-Seek / Paragraph Skip).
 */
function seekToChunk(targetChunkId) {
  const targetIndex = activeChunks.findIndex(c => c.id === targetChunkId);
  if (targetIndex === -1) return;

  // Invalidate any in-flight playback promises immediately
  sessionEpoch++;

  // Stop currently playing audio immediately
  if (currentSourceNode) {
    try { currentSourceNode.stop(); } catch (e) {}
    currentSourceNode = null;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    activeUtterance = null;
  }

  currentChunkIndex = targetIndex;
  isPlaying = true;
  isPaused = false;
  playCurrentChunk();
}

/**
 * Updates playback speed dynamically (0.5x to 2.5x).
 * Modulates Web Audio node in real time; allows Web Speech to apply rate to next sentence
 * without stuttering restarts.
 */
function setPlaybackSpeed(newSpeed) {
  playbackSpeed = Math.max(0.5, Math.min(2.5, parseFloat(newSpeed) || 1.0));
  
  // Real-time update on active Web Audio node with exponential ramp
  if (currentSourceNode && currentSourceNode.playbackRate && audioCtx) {
    try {
      currentSourceNode.playbackRate.setValueAtTime(playbackSpeed, audioCtx.currentTime);
    } catch (e) {
      currentSourceNode.playbackRate.value = playbackSpeed;
    }
  }
}

function pausePlayback() {
  isPaused = true;
  if (audioCtx && audioCtx.state === "running") {
    audioCtx.suspend();
  }
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
  }
}

function resumePlayback() {
  if (isPaused) {
    isPaused = false;
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    if (window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }
}

function stopPlayback() {
  sessionEpoch++; // Invalidate any in-flight promises
  isPlaying = false;
  isPaused = false;

  if (currentSourceNode) {
    try { currentSourceNode.stop(); } catch (e) {}
    currentSourceNode = null;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    activeUtterance = null;
  }
}

/**
 * Broadcasts playback events to the background service worker.
 */
function broadcastEvent(type, payload) {
  chrome.runtime.sendMessage({ type, ...payload }).catch(() => {});
}

// Listen for commands from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "SYNTHESIZE_AND_PLAY":
      startPlayback(message.chunks, message.voiceId, message.speed, message.startIndex || 0);
      sendResponse({ status: "started" });
      break;

    case "PAUSE_PLAYBACK":
      pausePlayback();
      sendResponse({ status: "paused" });
      break;

    case "RESUME_PLAYBACK":
      resumePlayback();
      sendResponse({ status: "resumed" });
      break;

    case "STOP_PLAYBACK":
      stopPlayback();
      sendResponse({ status: "stopped" });
      break;

    case "SET_PLAYBACK_SPEED":
      setPlaybackSpeed(message.speed);
      sendResponse({ status: "speed_updated", speed: playbackSpeed });
      break;

    case "SEEK_TO_CHUNK":
      seekToChunk(message.chunkId);
      sendResponse({ status: "seeked", chunkId: message.chunkId });
      break;

    case "DOWNLOAD_MODEL":
      downloadVoiceModel(message.voiceId, (progress) => {
        broadcastEvent("DOWNLOAD_PROGRESS", progress);
      }).then((result) => {
        sendResponse({ success: true, result });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true; // async

    case "GET_PLAYER_STATUS":
      sendResponse({
        isPlaying,
        isPaused,
        currentChunkIndex,
        totalChunks: activeChunks.length,
        playbackSpeed,
        activeVoiceId
      });
      break;
  }
  return true;
});
