// Content Script - Piper Neural TTS
// Manages text selection, Shadow DOM overlay, mouse speed scrubbing, and cursor hover-to-seek

(() => {
  // Prevent duplicate injection
  if (window.__PIPER_TTS_INJECTED__) return;
  window.__PIPER_TTS_INJECTED__ = true;

  // Language & Voices helpers (inline fallback for content-script scope)
  const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

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

  // Create isolated Shadow DOM host
  const host = document.createElement("div");
  host.id = "piper-tts-shadow-host";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "closed" });

  // Inject styles
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("content/overlay.css");
  shadow.appendChild(styleLink);

  // UI Container
  const container = document.createElement("div");
  container.className = "piper-ui-container";
  shadow.appendChild(container);

  // State
  let currentSelectionText = "";
  let currentSelectionRange = null;
  let activeChunks = [];
  let activeChunkRanges = [];
  let currentActiveChunkId = -1;
  let isPlaying = false;
  let currentSpeed = 1.0;
  let activeLanguage = "en";
  let activeVoiceId = "en_US-lessac-low";
  let hoverSeekTimer = null;
  let hoveredChunkId = -1;

  // Render Trigger Pill
  const triggerPill = document.createElement("div");
  triggerPill.className = "piper-trigger-pill";
  triggerPill.style.display = "none";
  triggerPill.innerHTML = `
    <div class="piper-speak-btn">
      <span>▶</span>
      <span>Speak</span>
    </div>
    <span class="piper-lang-badge english">EN</span>
  `;
  container.appendChild(triggerPill);

  // Render Floating Player HUD
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

  // Render Hover Cue
  const hoverCue = document.createElement("div");
  hoverCue.className = "piper-hover-cue";
  hoverCue.innerHTML = `<span>⏭</span><span>Jump here</span>`;
  container.appendChild(hoverCue);

  // Elements
  const speakBtn = triggerPill.querySelector(".piper-speak-btn");
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

  // Selection Handler
  document.addEventListener("mouseup", (e) => {
    // Avoid reacting if clicking inside extension HUD
    if (e.target && e.target.closest && e.target.closest("#piper-tts-shadow-host")) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : "";

      if (text.length > 2) {
        currentSelectionText = text;
        currentSelectionRange = selection.getRangeAt(0).cloneRange();
        activeLanguage = detectScript(text);

        // Update Pill Badge
        if (activeLanguage === "hi") {
          langBadge.textContent = "HI";
          langBadge.className = "piper-lang-badge hindi";
          activeVoiceId = "hi_IN-pratham-medium";
        } else {
          langBadge.textContent = "EN";
          langBadge.className = "piper-lang-badge english";
          activeVoiceId = "en_US-lessac-low";
        }

        // Position Trigger Pill near selection
        const rect = currentSelectionRange.getBoundingClientRect();
        triggerPill.style.left = `${Math.max(10, rect.left + window.scrollX)}px`;
        triggerPill.style.top = `${Math.max(10, rect.top + window.scrollY - 44)}px`;
        triggerPill.style.display = "flex";
      } else {
        if (!isPlaying) {
          triggerPill.style.display = "none";
        }
      }
    }, 10);
  });

  // Start Speaking
  speakBtn.addEventListener("click", () => {
    triggerPill.style.display = "none";
    startReading(currentSelectionText, currentSelectionRange);
  });

  function startReading(text, range) {
    if (!text) return;

    // Segment text into sentence chunks
    activeChunks = [];
    activeChunkRanges = [];

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

    // Update HUD
    voiceDisplay.textContent = activeLanguage === "hi" ? "Piper Hindi (प्रार्थम)" : "Piper English (Lessac)";
    playerHUD.style.display = "block";
    playPauseBtn.textContent = "⏸";
    isPlaying = true;

    // Dispatch to background service worker
    chrome.runtime.sendMessage({
      type: "SYNTHESIZE_AND_PLAY",
      chunks: activeChunks,
      voiceId: activeVoiceId,
      speed: currentSpeed
    });
  }

  // Play / Pause Toggle
  playPauseBtn.addEventListener("click", () => {
    if (playPauseBtn.textContent === "⏸") {
      playPauseBtn.textContent = "▶";
      chrome.runtime.sendMessage({ type: "PAUSE_PLAYBACK" });
    } else {
      playPauseBtn.textContent = "⏸";
      chrome.runtime.sendMessage({ type: "RESUME_PLAYBACK" });
    }
  });

  // Stop Playback
  stopBtn.addEventListener("click", stopReading);
  closeHudBtn.addEventListener("click", stopReading);

  function stopReading() {
    isPlaying = false;
    playerHUD.style.display = "none";
    hoverCue.style.display = "none";
    clearSentenceHighlights();
    chrome.runtime.sendMessage({ type: "STOP_PLAYBACK" });
  }

  // Mouse Speed Scrubbing Controls
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
    chrome.runtime.sendMessage({
      type: "SET_PLAYBACK_SPEED",
      speed: currentSpeed
    });
  }

  // Cursor Hover-to-Seek & Paragraph Skip Feature (Throttled with Layout Guard)
  let lastHoverCheckTime = 0;
  let hoverRafPending = false;

  document.addEventListener("mousemove", (e) => {
    if (!isPlaying || activeChunks.length <= 1) return;

    // Fast-path: bail out if hovering over extension Shadow DOM or controls
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
      if (!isPlaying) return;

      const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
      if (!range || !range.startContainer) return;

      const hoveredText = range.startContainer.textContent || "";
      const matchedChunk = activeChunks.find(c => hoveredText.includes(c.text.substring(0, 20)));

      if (matchedChunk && matchedChunk.id !== currentActiveChunkId) {
        hoveredChunkId = matchedChunk.id;
        hoverCue.style.left = `${e.clientX + 14}px`;
        hoverCue.style.top = `${e.clientY - 20}px`;
        hoverCue.style.display = "flex";

        // Trigger jump after deliberate 350ms dwell
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

  // Also allow instant jump on click if hover cue is visible
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

  // Handle Playback Status Broadcasts from Offscreen
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "CHUNK_STARTED") {
      currentActiveChunkId = message.chunkId;
      readingText.textContent = `"${message.text}"`;
      progressText.textContent = `${message.current} / ${message.total}`;
      const percent = Math.round((message.current / message.total) * 100);
      progressFill.style.width = `${percent}%`;

      highlightActiveSentence(message.text);
    } else if (message.type === "PLAYBACK_FINISHED") {
      stopReading();
    } else if (message.type === "TRIGGER_SPEAK_SELECTION") {
      const selection = window.getSelection();
      const text = message.selectedText || (selection ? selection.toString() : "");
      if (text) {
        startReading(text, selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null);
      }
    }
  });

  // Non-destructive Highlighting scoped strictly to selection container
  function highlightActiveSentence(sentenceText) {
    if (typeof CSS === "undefined" || !CSS.highlights) return;

    try {
      // Scope search strictly to selection ancestor container instead of full document.body
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
    } catch (e) {
      // Fallback gracefully without breaking playback
    }
  }

  function clearSentenceHighlights() {
    if (typeof CSS !== "undefined" && CSS.highlights) {
      CSS.highlights.delete("piper-active-sentence");
      CSS.highlights.delete("piper-hover-sentence");
    }
  }
})();
