// Content Script - Piper Neural TTS & Google Gemini AI
// Dual-action: 1) Natural Human AI Speech & 2) Smart Executive Summarization
// Includes mouse speed scrubbing, paragraph hover-to-seek, and non-destructive highlights

(() => {
  // Prevent duplicate injection
  if (window.__PIPER_TTS_INJECTED__) return;
  window.__PIPER_TTS_INJECTED__ = true;

  // Language & script detection helper
  function detectScript(text) {
    let devanagariCount = 0;
    let latinCount = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 0x0900 && code <= 0x097F) devanagariCount++;
      else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) latinCount++;
    }
    const total = devanagariCount + latinCount;
    if (total === 0) return "en";
    return (devanagariCount / total >= 0.15) ? "hi" : "en";
  }

  // Create isolated Shadow DOM host to prevent page CSS interference
  const host = document.createElement("div");
  host.id = "piper-tts-shadow-host";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "closed" });

  // Inject styles into Shadow DOM
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("content/overlay.css");
  shadow.appendChild(styleLink);

  // UI Container
  const container = document.createElement("div");
  container.className = "piper-ui-container";
  shadow.appendChild(container);

  // Gemini Voice Personas
  const GEMINI_VOICE_LIST = [
    { id: "Puck", name: "Puck", gender: "Male", label: "✨ AI • Puck (M)" },
    { id: "Kore", name: "Kore", gender: "Female", label: "✨ AI • Kore (F)" },
    { id: "Aoede", name: "Aoede", gender: "Female", label: "✨ AI • Aoede (F)" },
    { id: "Fenrir", name: "Fenrir", gender: "Male", label: "✨ AI • Fenrir (M)" },
    { id: "Charon", name: "Charon", gender: "Male", label: "✨ AI • Charon (M)" }
  ];

  // Kokoro-82M Studio Neural Voice Catalogs
  const KOKORO_VOICES_LIST = [
    { id: "af_heart", name: "Heart", gender: "Female", lang: "en", label: "⚡ Heart (F • A)" },
    { id: "af_bella", name: "Bella", gender: "Female", lang: "en", label: "⚡ Bella (F • A-)" },
    { id: "af_nicole", name: "Nicole", gender: "Female", lang: "en", label: "⚡ Nicole (F • Audio)" },
    { id: "am_adam", name: "Adam", gender: "Male", lang: "en", label: "⚡ Adam (M • Deep)" },
    { id: "am_michael", name: "Michael", gender: "Male", lang: "en", label: "⚡ Michael (M • Clear)" },
    { id: "am_puck", name: "Puck", gender: "Male", lang: "en", label: "⚡ Puck (M • Casual)" },
    { id: "bf_emma", name: "Emma", gender: "Female", lang: "en", label: "⚡ Emma (UK F)" },
    { id: "bm_george", name: "George", gender: "Male", lang: "en", label: "⚡ George (UK M)" },
    { id: "hf_alpha", name: "Alpha", gender: "Female", lang: "hi", label: "⚡ Alpha (HI F)" },
    { id: "hm_omega", name: "Omega", gender: "Male", lang: "hi", label: "⚡ Omega (HI M)" }
  ];

  // Legacy Piper Offline Voice Catalogs
  const HINDI_VOICES = [
    { id: "hi_IN-pratham-medium", name: "Pratham", gender: "Male", label: "HI • Pratham (M)" },
    { id: "hi_IN-priyamvada-medium", name: "Priyamvada", gender: "Female", label: "HI • Priyamvada (F)" },
    { id: "hi_IN-rohan-medium", name: "Rohan", gender: "Male", label: "HI • Rohan (M)" }
  ];

  const ENGLISH_VOICES = [
    { id: "en_US-lessac-medium", name: "Lessac", gender: "Female", label: "EN • Lessac (F)" },
    { id: "en_US-amy-medium", name: "Amy", gender: "Female", label: "EN • Amy (F)" },
    { id: "en_US-danny-low", name: "Danny", gender: "Male", label: "EN • Danny (M)" },
    { id: "en_US-lessac-low", name: "Lessac Fast", gender: "Female", label: "EN • Lessac Fast" }
  ];

  // State
  let currentSelectionText = "";
  let currentSelectionRange = null;
  let activeChunks = [];
  let currentActiveChunkId = -1;
  let isPlaying = false;
  let currentSpeed = 1.0;
  let activeLanguage = "en";
  let activeVoiceId = "en_US-lessac-low";
  let hoverSeekTimer = null;
  let hoveredChunkId = -1;

  // Gemini State
  let userGeminiApiKey = "";
  let userGeminiModel = "gemini-3.8-flash";
  let userGeminiVoice = "Puck";
  let userSpeechEngine = "gemini";
  let geminiSessionToken = 0;
  let activeGeminiAudio = null;
  let isGeminiAudioMode = false;
  let lastSummaryResult = "";

  // 1. Dual-Action Trigger Pill (Speak + Summarize)
  const triggerPill = document.createElement("div");
  triggerPill.className = "piper-trigger-pill";
  triggerPill.style.display = "none";
  triggerPill.innerHTML = `
    <div class="piper-speak-btn" title="Speak selected text">
      <span class="piper-speak-icon">▶</span>
      <span class="piper-speak-text">Speak</span>
    </div>
    <div class="piper-btn-divider"></div>
    <div class="piper-summarize-btn" title="Summarize with Gemini AI">
      <span>✨</span>
      <span>Summarize</span>
    </div>
    <span class="piper-lang-badge english">EN</span>
  `;
  container.appendChild(triggerPill);

  // 2. Floating Player HUD
  const playerHUD = document.createElement("div");
  playerHUD.className = "piper-player-hud";
  playerHUD.style.display = "none";
  playerHUD.innerHTML = `
    <div class="piper-hud-header">
      <div class="piper-hud-title">
        <span>🔊</span>
        <span id="piper-voice-display">Piper Neural TTS</span>
      </div>
      <div class="piper-hud-actions">
        <button class="piper-icon-btn" id="piper-close-hud" title="Close">✕</button>
      </div>
    </div>
    <div class="piper-reading-text" id="piper-reading-text">Ready to read...</div>
    <div class="piper-progress-container">
      <div class="piper-progress-track">
        <div class="piper-progress-fill" id="piper-progress-fill"></div>
      </div>
      <div class="piper-progress-text" id="piper-progress-text">0 / 0</div>
    </div>
    <div class="piper-hud-controls">
      <div class="piper-playback-buttons">
        <button class="piper-play-pause-btn" id="piper-play-pause-btn" title="Play/Pause">⏸</button>
        <button class="piper-stop-btn" id="piper-stop-btn" title="Stop">⏹</button>
      </div>
      <div class="piper-speed-scrubber" id="piper-speed-scrubber" title="Drag or scroll to adjust speed">
        <span class="piper-speed-label">Speed</span>
        <span class="piper-speed-value" id="piper-speed-value">1.0x</span>
      </div>
    </div>
  `;
  container.appendChild(playerHUD);

  // 3. Smart Executive Summary Card
  const summaryCard = document.createElement("div");
  summaryCard.className = "piper-summary-card";
  summaryCard.style.display = "none";
  summaryCard.innerHTML = `
    <div class="piper-summary-header">
      <div class="piper-summary-title">
        <span>✨</span>
        <span>Gemini AI Summary</span>
      </div>
      <button class="piper-icon-btn" id="piper-close-summary" title="Close">✕</button>
    </div>
    <div class="piper-summary-content" id="piper-summary-text">Ready...</div>
    <div class="piper-summary-actions">
      <button class="piper-summary-listen-btn" id="piper-listen-summary-btn">
        <span>🔊</span>
        <span>Listen to Summary</span>
      </button>
      <button class="piper-summary-copy-btn" id="piper-copy-summary-btn">
        📋 Copy
      </button>
    </div>
  `;
  container.appendChild(summaryCard);

  // 4. Hover Cue Overlay
  const hoverCue = document.createElement("div");
  hoverCue.className = "piper-hover-cue";
  hoverCue.innerHTML = `<span>⏭</span><span>Jump here</span>`;
  container.appendChild(hoverCue);

  // DOM references
  const speakBtn = triggerPill.querySelector(".piper-speak-btn");
  const speakIcon = triggerPill.querySelector(".piper-speak-icon");
  const speakText = triggerPill.querySelector(".piper-speak-text");
  const summarizeBtn = triggerPill.querySelector(".piper-summarize-btn");
  const langBadge = triggerPill.querySelector(".piper-lang-badge");

  const playPauseBtn = playerHUD.querySelector("#piper-play-pause-btn");
  const stopBtn = playerHUD.querySelector("#piper-stop-btn");
  const closeHudBtn = playerHUD.querySelector("#piper-close-hud");
  const readingText = playerHUD.querySelector("#piper-reading-text");
  const progressFill = playerHUD.querySelector("#piper-progress-fill");
  const progressText = playerHUD.querySelector("#piper-progress-text");
  const speedScrubber = playerHUD.querySelector("#piper-speed-scrubber");
  const speedValue = playerHUD.querySelector("#piper-speed-value");
  const voiceDisplay = playerHUD.querySelector("#piper-voice-display");

  const summaryTextEl = summaryCard.querySelector("#piper-summary-text");
  const closeSummaryBtn = summaryCard.querySelector("#piper-close-summary");
  const listenSummaryBtn = summaryCard.querySelector("#piper-listen-summary-btn");
  const copySummaryBtn = summaryCard.querySelector("#piper-copy-summary-btn");

  // Selection Change Handler
  document.addEventListener("mouseup", (e) => {
    // Ignore clicks inside extension Shadow DOM host
    if (e.target && e.target.closest && e.target.closest("#piper-tts-shadow-host")) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : "";

      if (text.length > 2) {
        currentSelectionText = text;
        try {
          currentSelectionRange = selection.getRangeAt(0).cloneRange();
        } catch {
          currentSelectionRange = null;
        }
        activeLanguage = detectScript(text);

        // Fetch stored settings
        chrome.storage.local.get({
          geminiApiKey: "",
          geminiModel: "gemini-3.8-flash",
          geminiVoice: "Puck",
          speechEngine: "gemini",
          kokoroVoice: "af_heart",
          kokoroHindiVoice: "hf_alpha",
          preferredHindiVoice: "hi_IN-pratham-medium",
          preferredEnglishVoice: "en_US-lessac-medium",
          defaultSpeed: 1.0
        }, (settings) => {
          userGeminiApiKey = (settings.geminiApiKey || "").trim();
          const rawModel = settings.geminiModel || "gemini-3.8-flash";
          userGeminiModel = (rawModel.includes("2.0") || rawModel.includes("2.5")) ? "gemini-3.8-flash" : rawModel;
          userGeminiVoice = settings.geminiVoice || "Puck";
          userSpeechEngine = settings.speechEngine || "gemini";
          currentSpeed = settings.defaultSpeed || 1.0;
          speedValue.textContent = `${currentSpeed.toFixed(1)}x`;

          // If Gemini AI engine is chosen and API key is present
          if (userSpeechEngine === "gemini" && userGeminiApiKey) {
            speakIcon.textContent = "✨";
            speakText.textContent = "Human Speak";
            const voiceObj = GEMINI_VOICE_LIST.find(v => v.id === userGeminiVoice) || GEMINI_VOICE_LIST[0];
            langBadge.textContent = voiceObj.label;
            langBadge.className = "piper-lang-badge gemini";
            langBadge.title = `Google Gemini AI Active • Voice: ${voiceObj.name} (${voiceObj.gender}) • Click to cycle persona`;
          } else {
            speakIcon.textContent = "⚡";
            speakText.textContent = "Instant Local";
            if (activeLanguage === "hi") {
              activeVoiceId = settings.kokoroHindiVoice || "hf_alpha";
            } else {
              activeVoiceId = settings.kokoroVoice || "af_heart";
            }
            const voiceObj = KOKORO_VOICES_LIST.find(v => v.id === activeVoiceId) || KOKORO_VOICES_LIST[0];
            langBadge.textContent = voiceObj.label;
            langBadge.className = `piper-lang-badge ${activeLanguage === "hi" ? "hindi" : "english"}`;
            langBadge.title = `Kokoro-82M Neural (100% Offline) • Current: ${voiceObj.name} • Click to cycle voice`;
          }
        });

        // Position Trigger Pill near selection safely within viewport
        if (currentSelectionRange) {
          const rect = currentSelectionRange.getBoundingClientRect();
          const pillX = Math.max(12, Math.min(window.innerWidth - 300, rect.left + window.scrollX));
          const pillY = Math.max(12, rect.top + window.scrollY - 46);
          triggerPill.style.left = `${pillX}px`;
          triggerPill.style.top = `${pillY}px`;
          triggerPill.style.display = "flex";
        }
      } else {
        if (!isPlaying && summaryCard.style.display !== "block") {
          triggerPill.style.display = "none";
        }
      }
    }, 15);
  });

  // Cycle Persona / Voice on Badge Click
  langBadge.addEventListener("click", (e) => {
    e.stopPropagation();
    if (userSpeechEngine === "gemini" && userGeminiApiKey) {
      // Cycle through Gemini Voice Personas
      const currentIdx = GEMINI_VOICE_LIST.findIndex(v => v.id === userGeminiVoice);
      const nextIdx = (currentIdx + 1) % GEMINI_VOICE_LIST.length;
      const nextVoice = GEMINI_VOICE_LIST[nextIdx];
      userGeminiVoice = nextVoice.id;
      langBadge.textContent = nextVoice.label;
      langBadge.title = `Google Gemini AI Active • Voice: ${nextVoice.name} (${nextVoice.gender})`;
      chrome.storage.local.set({ geminiVoice: nextVoice.id });
    } else {
      // Cycle through Kokoro-82M Offline Voices
      const list = activeLanguage === "hi"
        ? KOKORO_VOICES_LIST.filter(v => v.lang === "hi")
        : KOKORO_VOICES_LIST.filter(v => v.lang === "en");
      const currentIdx = list.findIndex(v => v.id === activeVoiceId);
      const nextIdx = (currentIdx + 1) % list.length;
      const nextVoice = list[nextIdx];
      activeVoiceId = nextVoice.id;
      langBadge.textContent = nextVoice.label;
      langBadge.title = `Kokoro-82M Studio Neural • Current: ${nextVoice.name} (${nextVoice.gender})`;
      if (activeLanguage === "hi") {
        chrome.storage.local.set({ kokoroHindiVoice: nextVoice.id });
      } else {
        chrome.storage.local.set({ kokoroVoice: nextVoice.id });
      }
    }
  });

  // Action 1: Speak Button Clicked
  speakBtn.addEventListener("click", () => {
    triggerPill.style.display = "none";
    startReading(currentSelectionText, currentSelectionRange);
  });

  // Action 2: Summarize Button Clicked
  summarizeBtn.addEventListener("click", () => {
    triggerPill.style.display = "none";
    startSummarizing(currentSelectionText, currentSelectionRange);
  });

  /**
   * Reads text aloud using Google Gemini Natural AI Audio with sub-second pipelining,
   * or Instant Local Piper TTS.
   */
  async function startReading(text, range) {
    if (!text) return;
    stopAllAudio();

    const activeSession = ++geminiSessionToken;

    // Fast-path: Check if Gemini AI Engine is active
    if (userSpeechEngine === "gemini" && userGeminiApiKey && typeof generateGeminiAudio === "function") {
      isGeminiAudioMode = true;
      isPlaying = true;
      voiceDisplay.textContent = `Gemini AI: ${userGeminiVoice} (Studio Voice)`;
      readingText.textContent = `Connecting to Gemini 3.8 speech engine...`;
      progressFill.style.width = "5%";
      progressText.textContent = "Loading...";
      playerHUD.style.display = "block";
      playPauseBtn.textContent = "⏸";

      highlightSelection(range);

      // Split text into natural sentence chunks
      const sentenceRegex = /[^.!?।\n]+[.!?।\n]+|[^.!?।\n]+$/g;
      const rawSentences = text.match(sentenceRegex) || [text];
      const sentences = rawSentences.map(s => s.trim()).filter(s => s.length > 0);

      if (sentences.length === 0) return;

      // Prefetch pipeline map: index -> Promise<{ audioBlobUrl, mimeType }>
      const prefetchMap = new Map();

      function prefetchSentence(idx) {
        if (idx >= sentences.length || prefetchMap.has(idx)) return;
        prefetchMap.set(idx, generateGeminiAudio(
          sentences[idx],
          userGeminiApiKey,
          userGeminiVoice,
          userGeminiModel
        ));
      }

      // Immediately prefetch Sentence 0 (<500ms latency) and Sentence 1
      prefetchSentence(0);
      if (sentences.length > 1) {
        prefetchSentence(1);
      }

      async function playSentence(idx) {
        if (activeSession !== geminiSessionToken || !isPlaying || idx >= sentences.length) {
          if (idx >= sentences.length) stopAllAudio();
          return;
        }

        const sentenceText = sentences[idx];
        readingText.textContent = `"${sentenceText}"`;
        progressText.textContent = `${idx + 1} / ${sentences.length}`;
        progressFill.style.width = `${Math.round(((idx + 1) / sentences.length) * 100)}%`;
        highlightActiveSentence(sentenceText);

        // Prefetch next 2 sentences while current sentence is playing
        if (idx + 1 < sentences.length) prefetchSentence(idx + 1);
        if (idx + 2 < sentences.length) prefetchSentence(idx + 2);

        try {
          const { audioBlobUrl } = await prefetchMap.get(idx);
          if (activeSession !== geminiSessionToken || !isPlaying) return;

          const audio = new Audio(audioBlobUrl);
          audio.playbackRate = currentSpeed;
          activeGeminiAudio = audio;

          audio.onended = () => {
            try { URL.revokeObjectURL(audioBlobUrl); } catch {}
            if (activeSession === geminiSessionToken && isPlaying) {
              playSentence(idx + 1);
            }
          };

          audio.onerror = (e) => {
            console.warn(`[Gemini Audio Error on sentence ${idx}]`, e);
            if (activeSession === geminiSessionToken && isPlaying) {
              playSentence(idx + 1);
            }
          };

          await audio.play();
        } catch (err) {
          console.warn(`[Gemini Sentence ${idx} Failed]`, err);
          // If first sentence fails, immediately switch to instant local Piper
          if (idx === 0) {
            readingText.textContent = `⚡ Switching to Instant Local Engine...`;
            await new Promise(r => setTimeout(r, 600));
            if (activeSession === geminiSessionToken && isPlaying) {
              fallbackToKokoro(text);
            }
          } else {
            playSentence(idx + 1);
          }
        }
      }

      // Start playing Sentence 0 immediately!
      playSentence(0);
      return;
    }

    // Default: Instant Local Kokoro-82M Neural Engine
    fallbackToKokoro(text);
  }

  function fallbackToKokoro(text) {
    isGeminiAudioMode = false;
    activeChunks = [];
    const rawSentences = text.match(/[^.!?।\n]+[.!?।\n]+|[^.!?।\n]+$/g) || [text];
    let chunkId = 0;
    rawSentences.forEach((s) => {
      const trimmed = s.trim();
      if (trimmed.length > 0) {
        activeChunks.push({
          id: chunkId++,
          text: trimmed,
          paragraphIndex: 0
        });
      }
    });

    if (activeChunks.length === 0) return;

    const allVoices = [...KOKORO_VOICES_LIST, ...HINDI_VOICES, ...ENGLISH_VOICES];
    const activeVoiceObj = allVoices.find(v => v.id === activeVoiceId);
    const voiceDisplayName = activeVoiceObj ? `${activeVoiceObj.name} (${activeVoiceObj.gender})` : activeVoiceId;
    voiceDisplay.textContent = `⚡ Kokoro Neural: ${voiceDisplayName}`;
    playerHUD.style.display = "block";
    playPauseBtn.textContent = "⏸";
    isPlaying = true;

    chrome.runtime.sendMessage({
      type: "SYNTHESIZE_AND_PLAY",
      chunks: activeChunks,
      voiceId: activeVoiceId,
      speed: currentSpeed
    });
  }

  /**
   * Generates smart executive summary with Google Gemini 2.0 Flash.
   */
  async function startSummarizing(text, range) {
    if (!text) return;

    // Position summary card near selection
    if (range) {
      const rect = range.getBoundingClientRect();
      const cardX = Math.max(14, Math.min(window.innerWidth - 410, rect.left + window.scrollX));
      const cardY = Math.max(14, rect.top + window.scrollY - 10);
      summaryCard.style.left = `${cardX}px`;
      summaryCard.style.top = `${cardY}px`;
    } else {
      summaryCard.style.left = "40px";
      summaryCard.style.top = "40px";
    }

    summaryCard.style.display = "block";

    // Check if API key is present
    if (!userGeminiApiKey) {
      summaryTextEl.innerHTML = `
        <div style="padding: 4px;">
          <div style="font-weight: 700; color: #f87171; margin-bottom: 8px;">🔑 Google Gemini API Key Required</div>
          <div style="color: #cbd5e1; font-size: 12px; line-height: 1.5; margin-bottom: 12px;">
            To use Smart AI Summarization, please enter your free Google AI Studio key in the extension settings.
          </div>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" style="display:inline-block; background:#0284c7; color:#fff; padding:6px 12px; border-radius:6px; text-decoration:none; font-size:12px; font-weight:600;">
            Get Free API Key (1,500 req/day) ↗
          </a>
        </div>
      `;
      listenSummaryBtn.style.display = "none";
      copySummaryBtn.style.display = "none";
      return;
    }

    listenSummaryBtn.style.display = "flex";
    copySummaryBtn.style.display = "block";
    listenSummaryBtn.innerHTML = `<span>🔊</span><span>Listen to Summary</span>`;
    copySummaryBtn.textContent = "📋 Copy";

    summaryTextEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: #c084fc;">
        <span>🧠</span>
        <span>Understanding context & synthesizing insights with Gemini AI...</span>
      </div>
    `;

    try {
      const result = await generateGeminiSummary(text, userGeminiApiKey, userGeminiModel);
      lastSummaryResult = result.summary;
      summaryTextEl.textContent = result.summary;
    } catch (err) {
      summaryTextEl.innerHTML = `<span style="color: #f87171;">⚠️ Failed to generate summary: ${err.message}</span>`;
      lastSummaryResult = "";
    }
  }

  // Listen to Summary Button
  listenSummaryBtn.addEventListener("click", () => {
    if (!lastSummaryResult) return;
    startReading(lastSummaryResult, null);
  });

  // Copy Summary Button
  copySummaryBtn.addEventListener("click", async () => {
    if (!lastSummaryResult) return;
    try {
      await navigator.clipboard.writeText(lastSummaryResult);
      copySummaryBtn.textContent = "✅ Copied!";
      setTimeout(() => {
        copySummaryBtn.textContent = "📋 Copy";
      }, 2000);
    } catch {
      copySummaryBtn.textContent = "⚠️ Copy failed";
    }
  });

  // Close Summary Card
  closeSummaryBtn.addEventListener("click", () => {
    summaryCard.style.display = "none";
  });

  // Play / Pause Toggle
  playPauseBtn.addEventListener("click", () => {
    if (isGeminiAudioMode && activeGeminiAudio) {
      if (activeGeminiAudio.paused) {
        activeGeminiAudio.play();
        playPauseBtn.textContent = "⏸";
      } else {
        activeGeminiAudio.pause();
        playPauseBtn.textContent = "▶";
      }
      return;
    }

    // Piper playback toggle
    if (playPauseBtn.textContent === "⏸") {
      playPauseBtn.textContent = "▶";
      chrome.runtime.sendMessage({ type: "PAUSE_PLAYBACK" });
    } else {
      playPauseBtn.textContent = "⏸";
      chrome.runtime.sendMessage({ type: "RESUME_PLAYBACK" });
    }
  });

  // Stop Playback
  stopBtn.addEventListener("click", stopAllAudio);
  closeHudBtn.addEventListener("click", stopAllAudio);

  function stopAllAudio() {
    geminiSessionToken++;
    isPlaying = false;
    playerHUD.style.display = "none";
    hoverCue.style.display = "none";
    clearSentenceHighlights();

    if (activeGeminiAudio) {
      try {
        activeGeminiAudio.pause();
        activeGeminiAudio.currentTime = 0;
      } catch {}
      activeGeminiAudio = null;
    }

    chrome.runtime.sendMessage({ type: "STOP_PLAYBACK" });
  }

  // Interactive Mouse Speed Scrubbing Controls
  let isScrubbing = false;
  let startX = 0;
  let initialSpeed = 1.0;

  speedScrubber.addEventListener("mousedown", (e) => {
    isScrubbing = true;
    startX = e.clientX;
    initialSpeed = currentSpeed;
    speedScrubber.classList.add("active-scrub");
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isScrubbing) return;
    const deltaX = e.clientX - startX;
    // 100px drag = 0.5x speed shift
    const newSpeed = Math.max(0.5, Math.min(2.5, +(initialSpeed + deltaX * 0.005).toFixed(2)));
    applySpeedChange(newSpeed);
  });

  window.addEventListener("mouseup", () => {
    if (isScrubbing) {
      isScrubbing = false;
      speedScrubber.classList.remove("active-scrub");
    }
  });

  // Mouse wheel over speed pill
  speedScrubber.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const newSpeed = Math.max(0.5, Math.min(2.5, +(currentSpeed + delta).toFixed(2)));
    applySpeedChange(newSpeed);
  });

  function applySpeedChange(newSpeed) {
    currentSpeed = newSpeed;
    speedValue.textContent = `${currentSpeed.toFixed(1)}x`;

    if (isGeminiAudioMode && activeGeminiAudio) {
      activeGeminiAudio.playbackRate = currentSpeed;
    } else {
      chrome.runtime.sendMessage({
        type: "SET_PLAYBACK_SPEED",
        speed: currentSpeed
      });
    }
  }

  // Cursor Hover-to-Seek Feature (Piper chunk mode)
  let lastHoverCheckTime = 0;
  let hoverRafPending = false;

  document.addEventListener("mousemove", (e) => {
    if (!isPlaying || isGeminiAudioMode || activeChunks.length <= 1) return;

    // Fast-path bail out if hovering over extension host
    if (e.target && (e.target.id === "piper-tts-shadow-host" || (e.target.closest && e.target.closest("#piper-tts-shadow-host")))) {
      clearTimeout(hoverSeekTimer);
      hoverCue.style.display = "none";
      return;
    }

    const now = Date.now();
    if (now - lastHoverCheckTime < 50 || hoverRafPending) return;
    lastHoverCheckTime = now;
    hoverRafPending = true;

    requestAnimationFrame(() => {
      hoverRafPending = false;
      if (!isPlaying || isGeminiAudioMode) return;

      const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
      if (!range || !range.startContainer) return;

      const hoveredText = range.startContainer.textContent || "";
      const matchedChunk = activeChunks.find(c => hoveredText.includes(c.text.substring(0, 20)));

      if (matchedChunk && matchedChunk.id !== currentActiveChunkId) {
        hoveredChunkId = matchedChunk.id;
        hoverCue.style.left = `${e.clientX + 14}px`;
        hoverCue.style.top = `${e.clientY - 20}px`;
        hoverCue.style.display = "flex";

        clearTimeout(hoverSeekTimer);
        hoverSeekTimer = setTimeout(() => {
          executeHoverSeek(matchedChunk.id);
        }, 350);
      } else {
        clearTimeout(hoverSeekTimer);
        hoverCue.style.display = "none";
      }
    });
  });

  hoverCue.addEventListener("click", () => {
    if (hoveredChunkId !== -1) {
      executeHoverSeek(hoveredChunkId);
    }
  });

  function executeHoverSeek(chunkId) {
    clearTimeout(hoverSeekTimer);
    hoverCue.style.display = "none";
    chrome.runtime.sendMessage({
      type: "SEEK_TO_CHUNK",
      chunkId: chunkId
    });
  }

  // Handle Playback Status Broadcasts from Background/Offscreen (Piper mode)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "CHUNK_STARTED") {
      currentActiveChunkId = message.chunkId;
      readingText.textContent = `"${message.text}"`;
      progressText.textContent = `${message.current} / ${message.total}`;
      const percent = Math.round((message.current / message.total) * 100);
      progressFill.style.width = `${percent}%`;

      highlightActiveSentence(message.text);
    } else if (message.type === "KOKORO_STATUS") {
      if (message.status === "downloading" || message.status === "loading") {
        readingText.textContent = `⚡ ${message.message}`;
        if (message.progress) {
          progressText.textContent = `${message.progress}%`;
          progressFill.style.width = `${message.progress}%`;
        }
      } else if (message.status === "ready") {
        readingText.textContent = "⚡ Kokoro-82M Ready (100% Offline)";
      }
    } else if (message.type === "PLAYBACK_FINISHED") {
      stopAllAudio();
    } else if (message.type === "TRIGGER_SPEAK_SELECTION") {
      const selection = window.getSelection();
      const text = message.selectedText || (selection ? selection.toString() : "");
      if (text) {
        startReading(text, selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null);
      }
    }
  });

  // Non-destructive CSS Custom Highlight API
  function highlightSelection(range) {
    if (!range || typeof CSS === "undefined" || !CSS.highlights) return;
    try {
      const highlight = new Highlight(range);
      CSS.highlights.set("piper-active-sentence", highlight);
    } catch {}
  }

  function highlightActiveSentence(sentenceText) {
    if (typeof CSS === "undefined" || !CSS.highlights) return;
    try {
      const searchRoot = (currentSelectionRange && currentSelectionRange.commonAncestorContainer)
        ? (currentSelectionRange.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? currentSelectionRange.commonAncestorContainer
            : currentSelectionRange.commonAncestorContainer.parentElement)
        : document.body;

      const treeWalker = document.createTreeWalker(searchRoot || document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = treeWalker.nextNode())) {
        const index = node.textContent.indexOf(sentenceText.substring(0, 30));
        if (index !== -1) {
          const range = new Range();
          range.setStart(node, index);
          range.setEnd(node, Math.min(node.textContent.length, index + sentenceText.length));
          const highlight = new Highlight(range);
          CSS.highlights.set("piper-active-sentence", highlight);
          break;
        }
      }
    } catch {}
  }

  function clearSentenceHighlights() {
    if (typeof CSS !== "undefined" && CSS.highlights) {
      CSS.highlights.delete("piper-active-sentence");
      CSS.highlights.delete("piper-hover-sentence");
    }
  }

  function formatTime(sec) {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? "0" : ""}${rem}`;
  }
})();
