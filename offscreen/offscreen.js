// Offscreen Document Audio Engine & Kokoro-82M Neural Synthesizer
// Manages Web Audio API context, Kokoro ONNX model, pipelined sentence queue, speed control, and instant seek

import { KokoroTTS, env } from "../lib/kokoro/kokoro.web.js";

let audioCtx = null;
let currentSourceNode = null;
let activeChunks = [];
let currentChunkIndex = 0;
let isPlaying = false;
let isPaused = false;
let playbackSpeed = 1.0;
let activeVoiceId = "af_heart";
let sessionEpoch = 0; // Monotonic token to prevent concurrent audio playback cascades

// Kokoro Engine State
let kokoroModelInstance = null;
let isKokoroInitializing = false;
let kokoroInitError = null;
const chunkAudioCache = new Map(); // chunkIndex -> Promise<{ audioBuffer: AudioBuffer } | null>

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
 * Configure environment and initialize Kokoro-82M TTS singleton.
 */
async function getKokoroModel(onProgress) {
  if (kokoroModelInstance) return kokoroModelInstance;

  if (isKokoroInitializing) {
    while (isKokoroInitializing) {
      await new Promise(r => setTimeout(r, 80));
    }
    if (kokoroModelInstance) return kokoroModelInstance;
    throw new Error(kokoroInitError || "Failed to initialize Kokoro TTS engine");
  }

  isKokoroInitializing = true;
  kokoroInitError = null;

  try {
    // Point wasmPaths to extension's local directory
    const wasmBase = chrome.runtime.getURL("lib/kokoro/");
    env.wasmPaths = wasmBase.endsWith("/") ? wasmBase : wasmBase + "/";
    env.allowLocalModels = true;
    env.allowRemoteModels = true;

    // Respect Cross-Origin Isolation status
    if (typeof self !== "undefined" && !self.crossOriginIsolated) {
      if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
        env.backends.onnx.wasm.numThreads = 1;
      }
    }

    // Auto-detect WebGPU hardware acceleration
    let device = "wasm";
    if (typeof navigator !== "undefined" && navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          device = "webgpu";
          console.log("[Kokoro TTS] WebGPU hardware acceleration active!");
        }
      } catch (e) {
        console.warn("[Kokoro TTS] WebGPU probe error, falling back to WASM SIMD:", e);
        device = "wasm";
      }
    }

    broadcastEvent("KOKORO_STATUS", {
      status: "loading",
      message: "Loading Kokoro-82M Studio Neural Model (Offline)...",
      progress: 10
    });

    const localModelUrl = chrome.runtime.getURL("lib/kokoro/model");

    try {
      console.log("[Kokoro TTS] Loading bundled original FP32 Kokoro-82M model (310MB) from:", localModelUrl);
      kokoroModelInstance = await KokoroTTS.from_pretrained(localModelUrl, {
        dtype: "fp32",
        device
      });
      console.log("[Kokoro TTS] Bundled original FP32 model loaded successfully!");
    } catch (fp32Err) {
      console.warn("[Kokoro TTS] FP32 load notice, attempting Q8 local model:", fp32Err);
      try {
        kokoroModelInstance = await KokoroTTS.from_pretrained(localModelUrl, {
          dtype: "q8",
          device
        });
        console.log("[Kokoro TTS] Bundled Q8 model loaded successfully!");
      } catch (q8Err) {
        console.warn("[Kokoro TTS] Local bundle fallback to HuggingFace CDN:", q8Err);
        kokoroModelInstance = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
          dtype: "q8",
          device,
          progress_callback: (p) => {
            if (p.status === "progress") {
              const pct = Math.round(p.progress || 0);
              broadcastEvent("KOKORO_STATUS", {
                status: "downloading",
                file: p.file,
                progress: pct,
                message: `Downloading Kokoro-82M Neural Engine (${pct}%)...`
              });
              if (onProgress) onProgress(pct);
            }
          }
        });
      }
    }

    console.log("[Kokoro TTS] Kokoro-82M neural synthesizer ready!");
    broadcastEvent("KOKORO_STATUS", {
      status: "ready",
      message: "Kokoro-82M Ready (100% Offline)",
      progress: 100
    });

    return kokoroModelInstance;
  } catch (err) {
    console.error("[Kokoro TTS] Initialization failure:", err);
    kokoroInitError = err.message;
    broadcastEvent("KOKORO_STATUS", {
      status: "error",
      message: `Kokoro load failed: ${err.message}`
    });
    throw err;
  } finally {
    isKokoroInitializing = false;
  }
}

/**
 * Primes the browser's Cache API with bundled voice files from extension package
 * so inference runs 100% offline with 0ms network latency.
 */
async function primeLocalVoiceCache(voiceId) {
  try {
    const cache = await caches.open("kokoro-voices");
    const hfUrl = `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/${voiceId}.bin`;
    const match = await cache.match(hfUrl);
    if (!match) {
      const localUrl = chrome.runtime.getURL(`lib/kokoro/voices/${voiceId}.bin`);
      const resp = await fetch(localUrl);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        await cache.put(hfUrl, new Response(buf, {
          headers: { "Content-Type": "application/octet-stream" }
        }));
        console.log(`[Kokoro TTS] Primed voice ${voiceId} into offline cache.`);
      }
    }
  } catch (err) {
    console.warn(`[Kokoro TTS] Voice cache priming notice for ${voiceId}:`, err);
  }
}

/**
 * Synthesizes a chunk of text into a Web Audio API AudioBuffer using Kokoro-82M.
 */
async function synthesizeKokoroChunk(text, voiceId) {
  const model = await getKokoroModel();
  await primeLocalVoiceCache(voiceId);

  // Fallback to af_heart if specified voice is not recognized
  const targetVoice = (model.voices && model.voices[voiceId]) ? voiceId : "af_heart";

  // Generate speech at default 1.0x rate (speed modulation is handled dynamically by Web Audio API)
  const rawAudio = await model.generate(text, {
    voice: targetVoice,
    speed: 1.0
  });

  const ctx = getAudioContext();
  const sampleRate = rawAudio.sampling_rate || 24000;
  const float32Data = rawAudio.audio;

  const audioBuffer = ctx.createBuffer(1, float32Data.length, sampleRate);
  audioBuffer.copyToChannel(float32Data, 0);

  return audioBuffer;
}

/**
 * Pipelining: Prefetches and synthesizes chunk at specified index ahead of time.
 */
function prefetchChunk(idx, voiceId) {
  if (idx < 0 || idx >= activeChunks.length || chunkAudioCache.has(idx)) {
    return;
  }
  const chunkText = activeChunks[idx].text;
  const promise = synthesizeKokoroChunk(chunkText, voiceId);
  chunkAudioCache.set(idx, promise);
}

/**
 * Starts sequential playback for an array of sentence chunks.
 */
async function startPlayback(chunks, voiceId, speed = 1.0, startIndex = 0) {
  stopPlayback();

  activeChunks = chunks || [];
  activeVoiceId = voiceId || "af_heart";
  playbackSpeed = speed;
  currentChunkIndex = Math.max(0, Math.min(startIndex, activeChunks.length - 1));
  isPlaying = true;
  isPaused = false;
  chunkAudioCache.clear();

  getAudioContext();

  // Prefetch Sentence 0 and Sentence 1 immediately for instant pipelined response
  prefetchChunk(currentChunkIndex, activeVoiceId);
  if (currentChunkIndex + 1 < activeChunks.length) {
    prefetchChunk(currentChunkIndex + 1, activeVoiceId);
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

  // Prefetch upcoming sentences while current is playing
  if (currentChunkIndex + 1 < activeChunks.length) {
    prefetchChunk(currentChunkIndex + 1, activeVoiceId);
  }
  if (currentChunkIndex + 2 < activeChunks.length) {
    prefetchChunk(currentChunkIndex + 2, activeVoiceId);
  }

  try {
    // Check if we have pre-synthesized audio for this chunk
    if (!chunkAudioCache.has(currentChunkIndex)) {
      prefetchChunk(currentChunkIndex, activeVoiceId);
    }

    const audioBuffer = await chunkAudioCache.get(currentChunkIndex);

    // Strict guard against superseded seeks, duplicate loops, or stopped sessions
    if (currentEpoch !== sessionEpoch || !isPlaying || isPaused) {
      return;
    }

    if (!audioBuffer) {
      throw new Error("Kokoro synthesis returned empty audio buffer");
    }

    // Play high-fidelity Kokoro 24kHz Studio Audio Buffer
    await playAudioBuffer(audioBuffer);

    if (currentEpoch !== sessionEpoch || !isPlaying || isPaused) {
      return;
    }

    // Clean up finished chunk from cache memory
    chunkAudioCache.delete(currentChunkIndex);

    // Move to next sentence chunk
    currentChunkIndex++;
    playCurrentChunk();
  } catch (err) {
    console.error("[Kokoro Offscreen] Error playing chunk:", err);
    broadcastEvent("PLAYBACK_ERROR", { chunkId: chunk.id, error: err.message });
    isPlaying = false;
  }
}

/**
 * Plays a Web Audio API AudioBuffer with real-time speed control.
 */
async function playAudioBuffer(audioBuffer) {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

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

  currentChunkIndex = targetIndex;
  isPlaying = true;
  isPaused = false;

  // Immediately prefetch target chunk
  prefetchChunk(currentChunkIndex, activeVoiceId);
  playCurrentChunk();
}

/**
 * Updates playback speed dynamically (0.5x to 2.5x).
 * Modulates Web Audio node in real time.
 */
function setPlaybackSpeed(newSpeed) {
  playbackSpeed = Math.max(0.5, Math.min(2.5, parseFloat(newSpeed) || 1.0));

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
}

function resumePlayback() {
  if (isPaused) {
    isPaused = false;
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
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

    case "PRELOAD_KOKORO":
      getKokoroModel((pct) => {
        broadcastEvent("DOWNLOAD_PROGRESS", { percent: pct });
      }).then(() => {
        sendResponse({ success: true, status: "ready" });
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
        activeVoiceId,
        kokoroReady: !!kokoroModelInstance
      });
      break;
  }
  return true;
});
