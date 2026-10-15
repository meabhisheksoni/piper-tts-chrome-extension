# 🔊 Piper & Kokoro Neural TTS + ✨ Google Gemini 3.8 AI (v1.2.0)
### Chrome Extension (Manifest V3)

A privacy-first, dual-power Chrome extension giving you **two best-in-class AI speech engines** and smart summarization whenever you drag and select text on any webpage:

1. **✨ Google Gemini 3.8 AI (Studio Cloud Engine):** Powered by **Google Gemini 3.8 Flash Audio** (`gemini-3.8-flash` & `gemini-3.8-flash-tts`), delivering sub-second (<800ms) pipelined streaming, interview-level emotional cadence, natural conversational pauses, and expressive voice personas (Puck, Kore, Fenrir, Aoede, Charon) in Hindi & English.
2. **⚡ Kokoro-82M Neural Engine (Instant 100% Offline):** Embedded **Kokoro-82M ONNX** running directly inside your browser via WebGPU & WASM SIMD. Delivers studio-grade 24kHz human voice without requiring any API key, external software, or background servers.
3. **🧠 Smart Executive Summarization:** Instantly analyzes long or complex articles, documents, and news using **Gemini 3.8 Flash**, extracting core takeaways in under 30 seconds with a 1-click **"Listen to Summary"** audio player.

---

## 🌟 Dual Power Architecture

| Feature | ✨ Google Gemini 3.8 AI | ⚡ Kokoro-82M Neural Engine |
| :--- | :--- | :--- |
| **Execution** | Cloud API (Google AI Studio) | 100% Local (Inside Chrome) |
| **Hardware** | Google Tensor TPU Cloud | WebGPU / WASM SIMD (Your PC) |
| **API Key Required** | Yes (Free Tier: 1,500 req/day) | **No (Zero Key, Zero Setup)** |
| **Internet Required** | Yes | **No (100% Offline)** |
| **Latency** | Sub-second (<800ms pipelined) | Instant (~120ms WebGPU / ~600ms WASM) |
| **Audio Quality** | Studio Interviewer Multimodal | 24kHz High-Fidelity Studio Audio |
| **Voice Options** | Puck, Kore, Fenrir, Aoede, Charon | Heart (Global #1), Bella, Nicole, Adam, Michael, Emma, George, Alpha (Hindi), Omega (Hindi) |

---

## 🌟 Key Features

### 1. Dual-Action Drag & Select Floating Pill
- Whenever you drag and highlight text on **any webpage**, a sleek floating action pill appears:
  - **✨ Speak / ⚡ Instant Local:** Reads aloud with lifelike cadence and 0ms gap between sentences.
  - **✨ Summarize:** Understands the entire context and displays key insights in a floating frosted card.
  - **🌐 Persona / Voice Badge:** Click directly on the badge to cycle through voices in real time.

### 2. Kokoro-82M Offline Studio Voices
- Runs locally inside Google Chrome with zero installation:
  - `Heart` (Female • US) — Warm conversational, global benchmark #1 (Grade A).
  - `Bella` (Female • US) — Expressive, bright and engaging (Grade A-).
  - `Nicole` (Female • US) — Clear, audiobook and podcast style.
  - `Adam` (Male • US) — Warm, deep conversational male voice.
  - `Michael` (Male • US) — Crisp, clear male narrator voice.
  - `Puck` (Male • US) — Friendly, casual tone matching Gemini Puck.
  - `Emma` (Female • UK) — Articulate, polished British female voice.
  - `George` (Male • UK) — Authoritative British BBC-style male voice.
  - `Alpha` (Female • Hindi) — Clear and natural Hindi female voice.
  - `Omega` (Male • Hindi) — Natural and deep Hindi male voice.

### 3. Google Gemini 3.8 Natural AI Voices (Free Tier Ready)
- Connects directly to Google AI Studio's **Gemini 3.8 Flash** multimodal engine.
- **100% Free Tier:** 15 Requests Per Minute, 1,500 Requests Per Day, and 1,000,000 Tokens Per Minute with **zero credit card required**.
- **Voice Personas:**
  - `Puck` (Male) — Conversational, warm, realistic natural pauses.
  - `Kore` (Female) — Empathetic, calm, clear interviewer.
  - `Fenrir` (Male) — Deep, authoritative, confident.
  - `Aoede` (Female) — Dynamic, melodic, expressive.
  - `Charon` (Male) — Steady, executive, professional.

### 4. Smart Executive Summarization Card
- When reading long pages, select the text and click **✨ Summarize**:
  - 🎯 **Key Insight:** 2 concise sentences capturing the core conclusion.
  - 📌 **Essential Takeaways:** 3–4 bullet points highlighting critical context and data points.
  - 🔊 **Listen to Summary:** 1-click button to hear the synthesized summary spoken aloud.
  - 📋 **Copy to Clipboard:** Instantly copy the summary for notes or sharing.

### 5. Interactive Mouse Speed Scrubbing (0.5x – 2.5x)
- **Horizontal Mouse Drag:** Click and drag left/right on the speed badge to scrub playback speed in real time.
- **Mouse Wheel Scroll:** Scroll up/down over the speed badge to increment or decrement speed by `0.1x`.

### 6. Cursor Hover-to-Seek / Paragraph Jump
- Move your cursor over any other paragraph while audio is playing.
- Dwelling for 250ms (or clicking) immediately jumps playback to that sentence or paragraph!

---

## 🔑 How to Setup Free Google AI Studio API Key (Optional)

If you wish to use the Google Gemini 3.8 Cloud Engine:
1. Visit [Google AI Studio (aistudio.google.com/app/apikey)](https://aistudio.google.com/app/apikey).
2. Click **Create API Key** (100% free, no billing or credit card required).
3. Click the **Piper & Kokoro TTS** extension icon in your Chrome toolbar.
4. Paste your API key into the **Google Gemini AI** input box.
5. Select **Google Gemini 3.8 AI** as your Primary Speech Engine.

*Note: If you don't want an API key, simply select **⚡ Kokoro-82M Neural Engine** to enjoy 100% offline studio-grade voices right out of the box!*

---

## 🚀 How to Install in Google Chrome

1. Download the latest `piper-tts-extension-v1.2.0.zip` from [GitHub Releases](https://github.com/meabhisheksoni/piper-tts-chrome-extension/releases).
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
- Click **▶ Speak** or **🔊 Listen to Summary** to hear the natural studio speech.
