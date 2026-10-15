// Popup UI Script - Minimalist Action View + Settings Drawer

document.addEventListener("DOMContentLoaded", async () => {
  // Navigation elements
  const navActionBtn = document.getElementById("nav-action-btn");
  const navSettingsBtn = document.getElementById("nav-settings-btn");
  const viewAction = document.getElementById("view-action");
  const viewSettings = document.getElementById("view-settings");
  const btnBackToActions = document.getElementById("btn-back-to-actions");

  // Engine toggle buttons
  const btnEngineKokoro = document.getElementById("btn-engine-kokoro");
  const btnEngineGemini = document.getElementById("btn-engine-gemini");

  // Voice selectors & Badges
  const kokoroVoiceSelect = document.getElementById("kokoro-voice-select");
  const geminiVoiceSelect = document.getElementById("gemini-voice-select");
  const voiceBadge = document.getElementById("voice-badge");

  // Speed controls
  const defaultSpeedSlider = document.getElementById("default-speed");
  const speedLabel = document.getElementById("speed-label");

  // Test button
  const testVoiceBtn = document.getElementById("test-voice-btn");

  // Settings view elements
  const geminiApiKeyInput = document.getElementById("gemini-api-key");
  const toggleKeyVisibilityBtn = document.getElementById("toggle-key-visibility");
  const geminiModelSelect = document.getElementById("gemini-model-select");
  const geminiStatusBadge = document.getElementById("gemini-status-badge");
  const languageModeSelect = document.getElementById("language-mode");
  const hoverSeekToggle = document.getElementById("hover-seek-toggle");
  const storageUsageLabel = document.getElementById("storage-usage");
  const modelsListContainer = document.getElementById("models-list");

  // 1. Tab Switching Logic
  function showActionView() {
    viewAction.style.display = "flex";
    viewSettings.style.display = "none";
    navActionBtn.classList.add("active");
    navSettingsBtn.classList.remove("active");
  }

  function showSettingsView() {
    viewAction.style.display = "none";
    viewSettings.style.display = "block";
    navActionBtn.classList.remove("active");
    navSettingsBtn.classList.add("active");
  }

  navActionBtn.addEventListener("click", showActionView);
  navSettingsBtn.addEventListener("click", showSettingsView);
  if (btnBackToActions) {
    btnBackToActions.addEventListener("click", showActionView);
  }

  // 2. Load Stored Settings
  const settings = await getSettings();
  let currentEngine = settings.speechEngine || "local"; // Default to fast local Kokoro or user preference

  function setEngineUI(engine) {
    currentEngine = engine;
    if (engine === "gemini") {
      btnEngineGemini.classList.add("active");
      btnEngineKokoro.classList.remove("active");
      geminiVoiceSelect.style.display = "block";
      kokoroVoiceSelect.style.display = "none";
      voiceBadge.textContent = "Studio AI";
      voiceBadge.style.color = "#38bdf8";
      testVoiceBtn.style.background = "#38bdf8";
      testVoiceBtn.innerHTML = `<span>▶</span><span>Test Gemini AI Voice</span>`;
    } else {
      btnEngineKokoro.classList.add("active");
      btnEngineGemini.classList.remove("active");
      kokoroVoiceSelect.style.display = "block";
      geminiVoiceSelect.style.display = "none";
      voiceBadge.textContent = "100% Offline";
      voiceBadge.style.color = "#34d399";
      testVoiceBtn.style.background = "#10b981";
      testVoiceBtn.innerHTML = `<span>▶</span><span>Test Kokoro Studio Voice</span>`;
    }
  }

  setEngineUI(currentEngine);

  btnEngineKokoro.addEventListener("click", () => {
    setEngineUI("local");
    updateSettings({ speechEngine: "local" });
  });

  btnEngineGemini.addEventListener("click", () => {
    setEngineUI("gemini");
    updateSettings({ speechEngine: "gemini" });
  });

  // Voice Selections
  if (settings.kokoroVoice && kokoroVoiceSelect) {
    kokoroVoiceSelect.value = settings.kokoroVoice;
  }
  if (settings.geminiVoice && geminiVoiceSelect) {
    geminiVoiceSelect.value = settings.geminiVoice;
  }

  kokoroVoiceSelect.addEventListener("change", () => {
    updateSettings({ kokoroVoice: kokoroVoiceSelect.value });
  });

  geminiVoiceSelect.addEventListener("change", () => {
    updateSettings({ geminiVoice: geminiVoiceSelect.value });
  });

  // Speed
  if (settings.defaultSpeed) {
    defaultSpeedSlider.value = settings.defaultSpeed;
    speedLabel.textContent = `${parseFloat(settings.defaultSpeed).toFixed(1)}x`;
  }

  defaultSpeedSlider.addEventListener("input", () => {
    const speed = parseFloat(defaultSpeedSlider.value);
    speedLabel.textContent = `${speed.toFixed(1)}x`;
    updateSettings({ defaultSpeed: speed });
  });

  // Settings View: Gemini API Key & Model
  if (settings.geminiApiKey) {
    geminiApiKeyInput.value = settings.geminiApiKey;
    updateGeminiStatusBadge(true);
  } else {
    updateGeminiStatusBadge(false);
  }

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

  const activeModel = settings.geminiModel || "gemini-2.5-flash-preview-tts";
  geminiModelSelect.value = activeModel;
  geminiModelSelect.addEventListener("change", () => {
    updateSettings({ geminiModel: geminiModelSelect.value });
  });

  function updateGeminiStatusBadge(hasKey) {
    if (hasKey) {
      geminiStatusBadge.textContent = "✅ Connected";
      geminiStatusBadge.style.background = "#065f46";
      geminiStatusBadge.style.color = "#a7f3d0";
    } else {
      geminiStatusBadge.textContent = "Key Needed";
      geminiStatusBadge.style.background = "#854d0e";
      geminiStatusBadge.style.color = "#fef08a";
    }
  }

  // Language & Hover Seek
  if (settings.preferredLanguage) languageModeSelect.value = settings.preferredLanguage;
  languageModeSelect.addEventListener("change", () => {
    updateSettings({ preferredLanguage: languageModeSelect.value });
  });

  if (typeof settings.hoverToSeekEnabled === "boolean") {
    hoverSeekToggle.checked = settings.hoverToSeekEnabled;
  }
  hoverSeekToggle.addEventListener("change", () => {
    updateSettings({ hoverToSeekEnabled: hoverSeekToggle.checked });
  });

  // 3. Audio Test Functionality (Kokoro Studio vs Gemini AI)
  let activeTestAudio = null;

  function resetTestBtn() {
    setEngineUI(currentEngine);
  }

  // Chrome runtime listener for Kokoro playback events
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "CHUNK_STARTED") {
      testVoiceBtn.innerHTML = `<span>🔊</span><span>Playing Kokoro Studio Audio...</span>`;
    } else if (msg.type === "PLAYBACK_FINISHED") {
      resetTestBtn();
    } else if (msg.type === "PLAYBACK_ERROR") {
      testVoiceBtn.innerHTML = `<span>❌</span><span>${(msg.error || "Synthesis Error").substring(0, 36)}</span>`;
      testVoiceBtn.style.background = "#ef4444";
      setTimeout(resetTestBtn, 4500);
    }
  });

  testVoiceBtn.addEventListener("click", async () => {
    const cur = await getSettings();
    const isHindi = cur.preferredLanguage === "hi";

    if (activeTestAudio) {
      activeTestAudio.pause();
      activeTestAudio = null;
    }

    // A. Gemini Cloud Human Voice
    if (currentEngine === "gemini") {
      if (!cur.geminiApiKey) {
        testVoiceBtn.innerHTML = `<span>🔑</span><span>Paste API Key in Settings</span>`;
        testVoiceBtn.style.background = "#d97706";
        showSettingsView();
        geminiApiKeyInput.focus();
        setTimeout(resetTestBtn, 3500);
        return;
      }

      testVoiceBtn.innerHTML = `<span>✨</span><span>Connecting to Gemini AI (${cur.geminiVoice || "Puck"})...</span>`;
      testVoiceBtn.style.background = "#6366f1";

      const sampleText = isHindi
        ? "नमस्ते! मैं गूगल जेमिनी का नेचुरल ह्यूमन वॉयस मॉडल हूँ। मैं पॉज, इमोशन और इंटरव्यू स्टाइल में बात कर सकता हूँ।"
        : "Hello! I am Google Gemini's natural human AI voice model. I speak with natural cadence, pauses, and expressive interviewer tone.";

      try {
        const { audioBlobUrl, modelUsed } = await generateGeminiAudio(
          sampleText,
          cur.geminiApiKey,
          cur.geminiVoice || "Puck",
          cur.geminiModel || "gemini-2.5-flash-preview-tts"
        );

        testVoiceBtn.innerHTML = `<span>🔊</span><span>Playing Gemini Human Audio...</span>`;
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
        testVoiceBtn.innerHTML = `<span>❌</span><span>${err.message.substring(0, 40)}</span>`;
        testVoiceBtn.style.background = "#ef4444";
        setTimeout(resetTestBtn, 4500);
        return;
      }
    }

    // B. Kokoro-82M Local Studio Voice (100% Offline)
    const selectedKokoroVoice = kokoroVoiceSelect.value || "af_heart";

    testVoiceBtn.innerHTML = `<span>⚡</span><span>Synthesizing Studio Audio...</span>`;
    testVoiceBtn.style.background = "#10b981";

    const sampleText = isHindi
      ? "नमस्ते! यह कोकोरो न्यूरल वॉइस मॉडल है, जो बिना किसी सर्वर के आपके कंप्यूटर पर नेचुरल साउंड में बोलता है।"
      : "Hello! This is Kokoro eighty-two M, running 100% locally in your browser with studio quality human voice.";

    chrome.runtime.sendMessage({
      type: "SYNTHESIZE_AND_PLAY",
      chunks: [{ id: 0, text: sampleText, paragraphIndex: 0 }],
      voiceId: selectedKokoroVoice,
      speed: parseFloat(defaultSpeedSlider.value) || 1.0
    });
  });

  // 4. Cached Models Status in Settings
  async function refreshCachedModels() {
    try {
      const cached = await listCachedModels();
      modelsListContainer.innerHTML = "";

      const kokoroRow = document.createElement("div");
      kokoroRow.className = "model-item";
      kokoroRow.innerHTML = `
        <span style="color:#34d399; font-weight:600;">Kokoro-82M Studio Model</span>
        <span style="color:#8b949e;">310 MB FP32</span>
      `;
      modelsListContainer.appendChild(kokoroRow);

      if (cached && cached.length > 0) {
        cached.forEach((item) => {
          const row = document.createElement("div");
          row.className = "model-item";
          row.innerHTML = `
            <span>${item.voiceId}</span>
            <span style="color:#8b949e;">${item.sizeMB} MB</span>
          `;
          modelsListContainer.appendChild(row);
        });
      }
      storageUsageLabel.textContent = "FP32 Master Active";
    } catch {
      modelsListContainer.innerHTML = `<div class="model-item">Kokoro-82M Studio Active</div>`;
    }
  }

  refreshCachedModels();
});
