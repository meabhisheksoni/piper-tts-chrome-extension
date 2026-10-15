# 🔊 Piper Neural Text-to-Speech (Chrome Extension Manifest V3)

A privacy-first, 100% client-side Chrome extension that uses **Rhasspy Piper** neural text-to-speech to read aloud selected text in natural Hindi and English with interactive **mouse speed scrubbing** and **cursor hover-to-seek** paragraph jumping.

---

## 🌟 Key Features

1. **Automatic Language Detection (Hindi & English):**
   * Uses Devanagari script detection (`[\u0900-\u097F]`) and Chrome i18n APIs.
   * Selecting Hindi text automatically triggers a Hindi voice (`hi_IN-pratham-medium`), while English text triggers an English voice (`en_US-lessac-low`).

2. **Interactive Floating Player HUD:**
   * Injected seamlessly via a closed **Shadow DOM** so it never clashes with host page styles.
   * Play / Pause / Stop controls and progress indicator.

3. **Mouse Speed Scrubbing (0.5x – 2.5x):**
   * **Horizontal Drag:** Click and drag left/right on the speed badge to scrub speed in real time.
   * **Mouse Wheel:** Scroll up/down over the speed badge to increment or decrement speed by `0.1x`.

4. **Cursor Hover-to-Seek / Paragraph Skip:**
   * Move your mouse cursor over any other paragraph or sentence in the selection to see a `"⏭ Jump here"` cue.
   * Dwelling for 250ms (or clicking) immediately flushes the audio queue and jumps playback to that paragraph!

5. **Local Offline Inference & IndexedDB Caching:**
   * Utilizes an MV3 Chrome **Offscreen Document** (`offscreen/offscreen.html`) with the Web Audio API.
   * Downloaded ONNX model weights and JSON configurations are stored in **IndexedDB** for offline playback with zero external server dependency.

---

## 🚀 How to Install & Load in Google Chrome

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
2. Enable **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the directory:
   ```
   piper-tts-extension/
   ```
5. The extension **"Piper Neural Text-to-Speech"** will now appear in your extensions list!

---

## 🧪 Testing with the Built-in Demo Page

1. Open `piper-tts-extension/test-demo.html` in Chrome:
   ```
   file:///teamspace/studios/this_studio/piper-tts-extension/test-demo.html
   ```
2. Select text in the **Hindi Section**:
   * Observe the floating trigger pill with `[HI]` badge.
   * Click **Speak** to listen in Hindi.
3. Select text in the **English Section**:
   * Observe the floating trigger pill with `[EN]` badge.
   * Click **Speak** to listen in English.
4. While audio is playing:
   * **Mouse Scrub:** Drag horizontally on the speed pill to change speed from `1.0x` to `1.5x` or `2.0x`.
   * **Hover-to-Seek:** Move your cursor over the next paragraph to jump the audio immediately!
