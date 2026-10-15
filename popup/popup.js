// Popup Settings & Model Management Script

document.addEventListener("DOMContentLoaded", async () => {
  const languageModeSelect = document.getElementById("language-mode");
  const hindiVoiceSelect = document.getElementById("hindi-voice-select");
  const englishVoiceSelect = document.getElementById("english-voice-select");
  const defaultSpeedSlider = document.getElementById("default-speed");
  const speedLabel = document.getElementById("speed-label");
  const hoverSeekToggle = document.getElementById("hover-seek-toggle");
  const testVoiceBtn = document.getElementById("test-voice-btn");
  const modelsListContainer = document.getElementById("models-list");
  const storageUsageLabel = document.getElementById("storage-usage");

  // Gemini AI Controls
  const geminiApiKeyInput = document.getElementById("gemini-api-key");
  const toggleKeyVisibilityBtn = document.getElementById("toggle-key-visibility");
  const geminiModelSelect = document.getElementById("gemini-model-select");
  const geminiVoiceSelect = document.getElementById("gemini-voice-select");
  const geminiStatusBadge = document.getElementById("gemini-status-badge");

  // Load existing settings
  const settings = await getSettings();
  if (settings.preferredLanguage) languageModeSelect.value = settings.preferredLanguage;
  if (settings.defaultSpeed) {
    defaultSpeedSlider.value = settings.defaultSpeed;
    speedLabel.textContent = `${parseFloat(settings.defaultSpeed).toFixed(1)}x`;
  }
  if (typeof settings.hoverToSeekEnabled === "boolean") {
    hoverSeekToggle.checked = settings.hoverToSeekEnabled;
  }
  if (settings.preferredHindiVoice) hindiVoiceSelect.value = settings.preferredHindiVoice;
  if (settings.preferredEnglishVoice) englishVoiceSelect.value = settings.preferredEnglishVoice;

  // Load Gemini settings
  if (settings.geminiApiKey) {
    geminiApiKeyInput.value = settings.geminiApiKey;
    updateGeminiStatusBadge(true);
  } else {
    updateGeminiStatusBadge(false);
  }
  if (settings.geminiModel) geminiModelSelect.value = settings.geminiModel;
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

  hindiVoiceSelect.addEventListener("change", () => {
    updateSettings({ preferredHindiVoice: hindiVoiceSelect.value });
  });

  englishVoiceSelect.addEventListener("change", () => {
    updateSettings({ preferredEnglishVoice: englishVoiceSelect.value });
  });

  defaultSpeedSlider.addEventListener("input", () => {
    const speed = parseFloat(defaultSpeedSlider.value);
    speedLabel.textContent = `${speed.toFixed(1)}x`;
    updateSettings({ defaultSpeed: speed });
  });

  hoverSeekToggle.addEventListener("change", () => {
    updateSettings({ hoverToSeekEnabled: hoverSeekToggle.checked });
  });

  // Test Voice Sample (Supports Gemini Human Voice OR Piper Studio Sample)
  let activeTestAudio = null;

  testVoiceBtn.addEventListener("click", async () => {
    const currentSettings = await getSettings();
    const hasGeminiKey = !!currentSettings.geminiApiKey;

    if (activeTestAudio) {
      activeTestAudio.pause();
      activeTestAudio = null;
    }

    if (hasGeminiKey && typeof generateGeminiAudio === "function") {
      // Test using Gemini 2.0 / 3.8 Human AI Voice
      testVoiceBtn.innerHTML = `<span>✨</span><span>Generating Gemini AI Voice (${currentSettings.geminiVoice || "Puck"})...</span>`;
      testVoiceBtn.style.background = "#6366f1";

      const isHindi = currentSettings.preferredLanguage === "hi";
      const sampleText = isHindi
        ? "नमस्ते! मैं गूगल जेमिनी का नेचुरल ह्यूमन वॉयस मॉडल हूँ। मैं पॉज, इमोशन और इंटरव्यू स्टाइल में बात कर सकता हूँ।"
        : "Hello! I am Google Gemini's natural human AI voice model. I speak with natural cadence, pauses, and expressive interviewer tone.";

      try {
        const { audioBlobUrl } = await generateGeminiAudio(
          sampleText,
          currentSettings.geminiApiKey,
          currentSettings.geminiVoice || "Puck",
          currentSettings.geminiModel || "gemini-2.0-flash"
        );

        testVoiceBtn.innerHTML = `<span>🔊</span><span>Playing Gemini Human Audio...</span>`;
        testVoiceBtn.style.background = "#10b981";

        const audio = new Audio(audioBlobUrl);
        audio.playbackRate = parseFloat(defaultSpeedSlider.value) || 1.0;
        activeTestAudio = audio;

        audio.onended = () => {
          testVoiceBtn.innerHTML = `<span>▶</span><span>Test Active Voice Sample</span>`;
          testVoiceBtn.style.background = "#38bdf8";
          activeTestAudio = null;
        };

        await audio.play();
        return;
      } catch (err) {
        console.warn("[Gemini Audio Test Failed, falling back]", err);
        testVoiceBtn.innerHTML = `<span>⚠️</span><span>API Error: Playing Piper Sample</span>`;
      }
    }

    // Fallback: Test with Piper Studio Quality Sample
    const lang = languageModeSelect.value;
    const isHindi = lang === "hi";
    const voiceId = isHindi ? hindiVoiceSelect.value : englishVoiceSelect.value;
    const voice = PIPER_VOICES[voiceId];

    if (voice && voice.sampleUrl) {
      testVoiceBtn.innerHTML = `<span>🔊</span><span>Playing ${voice.name} (${voice.gender === "female" ? "Female" : "Male"}, ${voice.quality})...</span>`;
      testVoiceBtn.style.background = "#818cf8";

      const audio = new Audio(voice.sampleUrl);
      audio.playbackRate = parseFloat(defaultSpeedSlider.value) || 1.0;
      activeTestAudio = audio;

      audio.onended = () => {
        testVoiceBtn.innerHTML = `<span>▶</span><span>Test Active Voice Sample</span>`;
        testVoiceBtn.style.background = "#38bdf8";
        activeTestAudio = null;
      };

      audio.onerror = () => {
        fallbackTestSynthesis(isHindi, voiceId);
      };

      audio.play().catch(() => {
        fallbackTestSynthesis(isHindi, voiceId);
      });
    } else {
      fallbackTestSynthesis(isHindi, voiceId);
    }
  });

  function fallbackTestSynthesis(isHindi, voiceId) {
    const sampleText = isHindi
      ? "नमस्ते! पाइपर न्यूरल टेक्स्ट-टू-स्पीच में आपका स्वागत है।"
      : "Hello! Welcome to Piper Neural Text-to-Speech running offline in your browser.";

    chrome.runtime.sendMessage({
      type: "SYNTHESIZE_AND_PLAY",
      chunks: [{ id: 0, text: sampleText, paragraphIndex: 0 }],
      voiceId: voiceId,
      speed: parseFloat(defaultSpeedSlider.value)
    });
  }

  // Load Cached Models from IndexedDB
  async function refreshCachedModels() {
    try {
      const cached = await listCachedModels();
      if (!cached || cached.length === 0) {
        modelsListContainer.innerHTML = '<div class="empty-state">No offline Piper models cached yet. Models cache automatically upon first playback.</div>';
        storageUsageLabel.textContent = "0.0 MB";
        return;
      }

      let totalMB = 0;
      modelsListContainer.innerHTML = "";

      cached.forEach((item) => {
        totalMB += parseFloat(item.sizeMB);
        const voiceInfo = PIPER_VOICES[item.voiceId] || { name: item.voiceId };

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

      storageUsageLabel.textContent = `${totalMB.toFixed(1)} MB`;

      // Attach delete handlers
      modelsListContainer.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.target.getAttribute("data-id");
          await deleteModelFromDB(id);
          refreshCachedModels();
        });
      });
    } catch (err) {
      modelsListContainer.innerHTML = `<div class="empty-state">IndexedDB unavailable or empty</div>`;
    }
  }

  refreshCachedModels();
});
