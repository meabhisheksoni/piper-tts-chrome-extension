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

  // Persist settings changes
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

  // Test Voice Sample
  testVoiceBtn.addEventListener("click", () => {
    const lang = languageModeSelect.value;
    const isHindi = lang === "hi";
    const voiceId = isHindi ? hindiVoiceSelect.value : englishVoiceSelect.value;
    const sampleText = isHindi
      ? "नमस्ते! पाइपर न्यूरल टेक्स्ट-टू-स्पीच में आपका स्वागत है।"
      : "Hello! Welcome to Piper Neural Text-to-Speech running offline in your browser.";

    chrome.runtime.sendMessage({
      type: "SYNTHESIZE_AND_PLAY",
      chunks: [{ id: 0, text: sampleText, paragraphIndex: 0 }],
      voiceId: voiceId,
      speed: parseFloat(defaultSpeedSlider.value)
    });
  });

  // Load Cached Models from IndexedDB
  async function refreshCachedModels() {
    try {
      const cached = await listCachedModels();
      if (!cached || cached.length === 0) {
        modelsListContainer.innerHTML = '<div class="empty-state">No models cached yet. Models cache automatically upon first playback.</div>';
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
