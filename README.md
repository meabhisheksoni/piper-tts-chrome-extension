# 🔊 Piper Neural TTS + ✨ Google Gemini AI (v1.1.0)
### Chrome Extension (Manifest V3)

A privacy-first, next-generation Chrome extension that gives you **two powerful AI options** whenever you drag and select text on any webpage:

1. **✨ Read in Natural Human AI Speech:** Powered by **Google Gemini 2.0 Flash Audio**, delivering interview-level emotional cadence, natural conversational pauses, and expressive voice personas (Puck, Kore, Fenrir, Aoede, Charon) in Hindi & English.
2. **🧠 Smart Executive Summarization:** Instantly analyzes long or complex articles, documents, and news, extracting core takeaways in under 30 seconds with a 1-click **"Listen to Summary"** audio player.
3. **🛡️ 100% Offline Piper Fallback:** Seamlessly falls back to local **Rhasspy Piper ONNX** neural models when offline or without an API key.

---

## 🌟 Key Features

### 1. Dual-Action Drag & Select Floating Pill
- Whenever you drag and highlight text on **any webpage**, a sleek floating action pill appears:
  - **✨ Speak:** Generates human interviewer audio with realistic breath pauses and pitch dynamics.
  - **✨ Summarize:** Understands the entire context and displays key insights in a floating frosted card.
  - **🌐 Persona / Voice Badge:** Click directly on the badge to cycle through voices (`Puck`, `Kore`, `Fenrir`, `Aoede`, `Charon` or Piper offline voices) in real-time.

### 2. Google Gemini 2.0 / 3.8 Natural AI Voices (Free Tier Ready)
- Connects directly to Google AI Studio's **Gemini 2.0 Flash** multimodal audio engine.
- **100% Free Tier:** 15 Requests Per Minute, 1,500 Requests Per Day, and 1,000,000 Tokens Per Minute with **zero credit card required**.
- **Voice Personas:**
  - `Puck` (Male) — Conversational, warm, realistic natural pauses.
  - `Kore` (Female) — Empathetic, calm, clear interviewer.
  - `Fenrir` (Male) — Deep, authoritative, confident.
  - `Aoede` (Female) — Dynamic, melodic, expressive.
  - `Charon` (Male) — Steady, executive, professional.

### 3. Smart Executive Summarization Card
- When reading long pages, select the text and click **✨ Summarize**:
  - 🎯 **Key Insight:** 2 concise sentences capturing the core conclusion.
  - 📌 **Essential Takeaways:** 3–4 bullet points highlighting critical context and data points.
  - 🔊 **Listen to Summary:** 1-click button to hear the synthesized summary spoken aloud in human voice.
  - 📋 **Copy to Clipboard:** Instantly copy the summary for notes or sharing.

### 4. Interactive Mouse Speed Scrubbing (0.5x – 2.5x)
- **Horizontal Mouse Drag:** Click and drag left/right on the speed badge to scrub playback speed in real time.
- **Mouse Wheel Scroll:** Scroll up/down over the speed badge to increment or decrement speed by `0.1x`.

### 5. Cursor Hover-to-Seek / Paragraph Jump
- Move your cursor over any other paragraph while audio is playing.
- Dwelling for 350ms (or clicking) immediately jumps playback to that sentence or paragraph!

### 6. Isolated Shadow DOM & Privacy
- All injected UI elements live inside a closed **Shadow DOM** (`#piper-tts-shadow-host`), preventing CSS conflicts with host websites.
- API keys and preferences are kept strictly in `chrome.storage.local`.

---

## 🔑 How to Setup Free Google AI Studio API Key

1. Visit [Google AI Studio (aistudio.google.com/app/apikey)](https://aistudio.google.com/app/apikey).
2. Click **Create API Key** (100% free, no billing or credit card required).
3. Click the **Piper Neural TTS** extension icon in your Chrome toolbar.
4. Paste your API key into the **Google Gemini AI** input box.
5. Select your favorite AI voice persona (e.g. `Puck` or `Kore`) and click **Test Active Voice Sample** to verify!

---

## 🚀 How to Install in Google Chrome

1. Download the latest `piper-tts-extension-v1.1.0.zip` from [GitHub Releases](https://github.com/meabhisheksoni/piper-tts-chrome-extension/releases).
2. Unzip the file into a folder on your computer.
3. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
4. Enable the **Developer mode** toggle in the top-right corner.
5. Click **Load unpacked** and select the unzipped `piper-tts-extension` folder.
6. Done! Drag and select text on any website to experience human AI speech and instant summarization.

---

## 🧪 Testing with Built-in Demo Page

Open `test-demo.html` in Chrome:
```
file:///path/to/piper-tts-extension/test-demo.html
```
- Select text in the Hindi or English section.
- Click **✨ Summarize** to view the executive analysis.
- Click **▶ Speak** or **🔊 Listen to Summary** to hear Gemini's human interviewer voice.
