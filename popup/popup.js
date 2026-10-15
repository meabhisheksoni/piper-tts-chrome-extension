// Popup Settings & Model Management Script

document.addEventListener("DOMContentLoaded", async () => {
  const languageModeSelect = document.getElementById("language-mode");
  const defaultSpeedSlider = document.getElementById("default-speed");
  const speedLabel = document.getElementById("speed-label");
  const hoverSeekToggle = document.getElementById("hover-seek-toggle");
  const testVoiceBtn = document.getElementById("test-voice-btn");
  const modelsListContainer = document.getElementById("models-list");
  const storageUsageLabel = document.getElementById("storage-usage");

  // Kokoro Controls
  const kokoroCard = document.getElementById("kokoro-card");
  const kokoroVoiceSelect = document.getElementById("kokoro-voice-select");
  const kokoroHindiVoiceSelect = document.getElementById("kokoro-hindi-voice-select");
  const kokoroStatusBadge = document.getElementById("kokoro-status-badge");

  // Gemini AI Controls
  const geminiCard = document.getElementById("gemini-card");
  const geminiApiKeyInput = document.getElementById("gemini-api-key");
  const toggleKeyVisibilityBtn = document.getElementById("toggle-key-visibility");
  const geminiModelSelect = document.getElementById("gemini-model-select");
  const geminiVoiceSelect = document.getElementById("gemini-voice-select");
  const geminiStatusBadge = document.getElementById("gemini-status-badge");

  // Engine Mode Control
  const speechEngineSelect = document.getElementById("speech-engine-select");

  // Load existing settings
  const settings = await getSettings();

  if (settings.speechEngine && speechEngineSelect) {
    speechEngineSelect.value = settings.speechEngine;
    updateEngineCardVisuals(settings.speechEngine);
  }

  if (speechEngineSelect) {
    speechEngineSelect.addEventListener("change", () => {
      const mode = speechEngineSelect.value;
      updateSettings({ speechEngine: mode });
      updateEngineCardVisuals(mode);
    });
  }

  function updateEngineCardVisuals(engine) {
    if (engine === "gemini") {
      if (geminiCard) {
        geminiCard.style.borderColor = "#38bdf8";
        geminiCard.style.boxShadow = "0 0 10px rgba(56, 189, 248, 0.25)";
        geminiCard.style.opacity = "1";
      }
      if (kokoroCard) {
        kokoroCard.style.borderColor = "#334155";
        kokoroCard.style.boxShadow = "none";
        kokoroCard.style.opacity = "0.75";
      }
    } else {
      if (kokoroCard) {
        kokoroCard.style.borderColor = "#10b981";
        kokoroCard.style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.25)";
        kokoroCard.style.opacity = "1";
      }
      if (geminiCard) {
        geminiCard.style.borderColor = "#334155";
        geminiCard.style.boxShadow = "none";
        geminiCard.style.opacity = "0.75";
      }
    }
  }

  // Load Kokoro Settings
  if (settings.kokoroVoice && kokoroVoiceSelect) {
    kokoroVoiceSelect.value = settings.kokoroVoice;
  }
  if (settings.kokoroHindiVoice && kokoroHindiVoiceSelect) {
    kokoroHindiVoiceSelect.value = settings.kokoroHindiVoice;
  }

  if (kokoroVoiceSelect) {
    kokoroVoiceSelect.addEventListener("change", () => {
      updateSettings({ kokoroVoice: kokoroVoiceSelect.value });
    });
  }

  if (kokoroHindiVoiceSelect) {
    kokoroHindiVoiceSelect.addEventListener("change", () => {
      updateSettings({ kokoroHindiVoice: kokoroHindiVoiceSelect.value });
    });
  }

  if (settings.preferredLanguage) languageModeSelect.value = settings.preferredLanguage;
  if (settings.defaultSpeed) {
    defaultSpeedSlider.value = settings.defaultSpeed;
    speedLabel.textContent = `${parseFloat(settings.defaultSpeed).toFixed(1)}x`;
  }
  if (typeof settings.hoverToSeekEnabled === "boolean") {
    hoverSeekToggle.checked = settings.hoverToSeekEnabled;
  }

  // Load Gemini settings
  if (settings.geminiApiKey) {
    geminiApiKeyInput.value = settings.geminiApiKey;
    updateGeminiStatusBadge(true);
  } else {
    updateGeminiStatusBadge(false);
  }

  const activeModel = settings.geminiModel || "gemini-2.5-flash-preview-tts";
  geminiModelSelect.value = activeModel;
  if (settings.geminiVoice) geminiVoiceSelect.value = settings.geminiVoice;

  // Persist Gemini settings changes
  geminiApiKeyInput.addEventListener("input", () => {
    const key = geminiApiKeyInput.value.trim();
    updateSettings({ geminiApiKey: key });
    updateGeminiStatusBadge(!!key);
  });

  toggleKeyVisibilityBtn.addEventListener("click", () => {
    if (geminiApiKeyInput.type === "password") {
      geminiApiKeyInput.type = "text";
      toggleKeyVisibilityBtn.textContent = "Hide";
    } else {
      geminiApiKeyInput.type = "password";
      toggleKeyVisibilityBtn.textContent = "Show";
    }
  });

  geminiModelSelect.addEventListener("change", () => {
    updateSettings({ geminiModel: geminiModelSelect.value });
  });

  geminiVoiceSelect.addEventListener("change", () => {
    updateSettings({ geminiVoice: geminiVoiceSelect.value });
  });

  function updateGeminiStatusBadge(hasKey) {
    if (hasKey) {
      geminiStatusBadge.textContent = "✅ AI Connected";
      geminiStatusBadge.style.background = "#065f46";
      geminiStatusBadge.style.color = "#a7f3d0";
    } else {
      geminiStatusBadge.textContent = "🔑 Key Needed";
      geminiStatusBadge.style.background = "#854d0e";
      geminiStatusBadge.style.color = "#fef08a";
    }
  }

  // Persist general settings changes
  languageModeSelect.addEventListener("change", () => {
    updateSettings({ preferredLanguage: languageModeSelect.value });
  });

  defaultSpeedSlider.addEventListener("input", () => {
    const speed = parseFloat(defaultSpeedSlider.value);
    speedLabel.textContent = `${speed.toFixed(1)}x`;
    updateSettings({ defaultSpeed: speed });
  });

  hoverSeekToggle.addEventListener("change", () => {
    updateSettings({ hoverToSeekEnabled: hoverSeekToggle.checked });
  });

  // Test Voice Sample (Supports Gemini 3.8 Human Voice OR Kokoro-82M Offline Voice)
  let activeTestAudio = null;

  function resetTestBtn() {
    testVoiceBtn.innerHTML = `<span>▶</span><span>Test Active Voice Sample</span>`;
    testVoiceBtn.style.background = "#38bdf8";
  }

  // Listen for playback events from background/offscreen
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "CHUNK_STARTED") {
      testVoiceBtn.innerHTML = `<span>🔊</span><span>Playing Kokoro Studio Voice...</span>`;
      testVoiceBtn.style.background = "#10b981";
    } else if (msg.type === "PLAYBACK_FINISHED") {
      resetTestBtn();
    } else if (msg.type === "PLAYBACK_ERROR") {
      testVoiceBtn.innerHTML = `<span>❌</span><span>${(msg.error || "Synthesis Error").substring(0, 40)}</span>`;
      testVoiceBtn.style.background = "#ef4444";
      setTimeout(resetTestBtn, 4500);
    }
  });

  testVoiceBtn.addEventListener("click", async () => {
    const currentSettings = await getSettings();
    const currentEngine = currentSettings.speechEngine || "gemini";
    const isHindi = currentSettings.preferredLanguage === "hi";

    if (activeTestAudio) {
      activeTestAudio.pause();
      activeTestAudio = null;
    }

    // 1. Google Gemini AI Engine
    if (currentEngine === "gemini") {
      if (!currentSettings.geminiApiKey) {
        testVoiceBtn.innerHTML = `<span>🔑</span><span>Paste Gemini API Key Above</span>`;
        testVoiceBtn.style.background = "#d97706";
        geminiApiKeyInput.focus();
        setTimeout(resetTestBtn, 3500);
        return;
      }

      testVoiceBtn.innerHTML = `<span>✨</span><span>Connecting to Gemini AI (${currentSettings.geminiVoice || "Puck"})...</span>`;
      testVoiceBtn.style.background = "#6366f1";

      const sampleText = isHindi
        ? "नमस्ते! मैं गूगल जेमिनी का नेचुरल ह्यूमन वॉयस मॉडल हूँ। मैं पॉज, इमोशन और इंटरव्यू स्टाइल में बात कर सकता हूँ।"
        : "Hello! I am Google Gemini's natural human AI voice model. I speak with natural cadence, pauses, and expressive interviewer tone.";

      try {
        const { audioBlobUrl, modelUsed } = await generateGeminiAudio(
          sampleText,
          currentSettings.geminiApiKey,
          currentSettings.geminiVoice || "Puck",
          currentSettings.geminiModel || "gemini-2.5-flash-preview-tts"
        );

        testVoiceBtn.innerHTML = `<span>🔊</span><span>Playing Gemini Human Audio (${modelUsed || "AI"})...</span>`;
        testVoiceBtn.style.background = "#10b981";

        const audio = new Audio(audioBlobUrl);
        audio.playbackRate = parseFloat(defaultSpeedSlider.value) || 1.0;
        activeTestAudio = audio;

        audio.onended = () => {
          resetTestBtn();
          activeTestAudio = null;
        };

        await audio.play();
        return;
      } catch (err) {
        console.error("[Gemini Audio Test Failed]", err);
        testVoiceBtn.innerHTML = `<span>❌</span><span>${err.message.substring(0, 48)}</span>`;
        testVoiceBtn.style.background = "#ef4444";
        setTimeout(resetTestBtn, 4500);
        return; // Fail fast and inform user - do NOT fall through to robotic speech!
      }
    }

    // 2. Kokoro-82M Local Neural Engine
    const kokoroVoice = isHindi
      ? (currentSettings.kokoroHindiVoice || "hf_alpha")
      : (currentSettings.kokoroVoice || "af_heart");

    testVoiceBtn.innerHTML = `<span>⚡</span><span>Synthesizing Kokoro Neural (${kokoroVoice})...</span>`;
    testVoiceBtn.style.background = "#10b981";

    const sampleText = isHindi
      ? "नमस्ते! यह कोकोरो न्यूरल वॉइस मॉडल है, जो बिना किसी सर्वर के आपके कंप्यूटर पर नेचुरल साउंड में बोलता है।"
      : "Hello! This is Kokoro eighty-two M, running 100% locally in your browser with studio quality human voice.";

    chrome.runtime.sendMessage({
      type: "SYNTHESIZE_AND_PLAY",
      chunks: [{ id: 0, text: sampleText, paragraphIndex: 0 }],
      voiceId: kokoroVoice,
      speed: parseFloat(defaultSpeedSlider.value) || 1.0
    });
  });

  // Load Cached Models Status
  async function refreshCachedModels() {
    try {
      const cached = await listCachedModels();
      let totalMB = 0;
      modelsListContainer.innerHTML = "";

      // Kokoro-82M Status Entry
      const kokoroRow = document.createElement("div");
      kokoroRow.className = "model-item";
      kokoroRow.innerHTML = `
        <div>
          <span class="model-name" style="color:#34d399; font-weight:600;">Kokoro-82M Studio Engine</span>
          <span class="model-size">(Original 310 MB FP32 • 100% In-Browser)</span>
        </div>
        <span class="badge" style="background:#065f46; color:#a7f3d0; font-size:10px;">Master FP32</span>
      `;
      modelsListContainer.appendChild(kokoroRow);

      if (cached && cached.length > 0) {
        cached.forEach((item) => {
          totalMB += parseFloat(item.sizeMB);
          const voiceInfo = (typeof PIPER_VOICES !== "undefined" && PIPER_VOICES[item.voiceId]) || { name: item.voiceId };

          const row = document.createElement("div");
          row.className = "model-item";
          row.innerHTML = `
            <div>
              <span class="model-name">${voiceInfo.name || item.voiceId}</span>
              <span class="model-size">(${item.sizeMB} MB)</span>
            </div>
            <button class="delete-btn" data-id="${item.voiceId}">Delete</button>
          `;
          modelsListContainer.appendChild(row);
        });

        // Attach delete handlers
        modelsListContainer.querySelectorAll(".delete-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            await deleteModelFromDB(id);
            refreshCachedModels();
          });
        });
      }

      storageUsageLabel.textContent = totalMB > 0 ? `${totalMB.toFixed(1)} MB` : "Ready";
    } catch (err) {
      modelsListContainer.innerHTML = `<div class="empty-state">Kokoro-82M Ready • IndexedDB active</div>`;
    }
  }

  refreshCachedModels();
});
