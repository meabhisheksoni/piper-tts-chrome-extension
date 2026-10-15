# Product Requirements Document (PRD)
## Piper Neural TTS Chrome Extension (Manifest V3)
**Local, Multi-Lingual, Cursor-Controlled Neural Speech for the Web**

---

## 1. Executive Summary & Vision

### 1.1 Product Overview
The **Piper Neural TTS Chrome Extension** is an open-source, privacy-first browser extension built on Google Chrome's Manifest V3 architecture. It brings the power of **Rhasspy Piper**—a state-of-the-art, ultra-fast, local neural text-to-speech engine—directly into the browser. 

Users can select or hover over text on any web page to hear it spoken in natural, human-grade voices across multiple languages (with primary first-class support for English and Hindi). The extension operates **100% locally on the client** using WebAssembly (WASM) and ONNX Runtime Web within a dedicated Chrome Offscreen document, guaranteeing zero latency from external APIs, complete privacy (no text sent over the wire), and offline capability once voice models are cached.

### 1.2 Core Value Propositions
* **Zero-Server Client Execution:** Runs Piper ONNX voice models directly inside Chrome via `@microsoft/onnxruntime-web` and Web Audio API.
* **Auto-Language Detection:** Automatically identifies whether the selected or hovered text is in English, Hindi, or another language, instantly switching to the corresponding Piper neural voice.
* **Granular Parameter & Speaker Control:** Exposes Piper's native inference controls—speaker persona (`speaker_id`), quality tiers (`x_low`, `low`, `medium`, `high`), speaking rate (`length_scale`), and phonetic expressiveness (`noise_scale`, `noise_w`).
* **Mouse Scrub & Hover-to-Seek:** A floating Shadow DOM overlay allows users to scrub playback speed (0.5x–2.5x) using mouse drag/wheel movements and skip dynamically to any sentence or paragraph simply by hovering their cursor over it.

---

## 2. Problem Statement & User Personas

### 2.1 The Problem
1. **Cloud Dependency & Privacy Risks:** Traditional browser read-aloud extensions transmit user-selected text, articles, and confidential web documents to cloud servers (e.g., Google Cloud TTS, ElevenLabs, Azure Speech), creating data leakage risks and subscription costs.
2. **Robotic Web Speech API:** The browser's default `window.speechSynthesis` API produces robotic, inconsistent voices that vary wildly across operating systems and lack multi-speaker expressiveness.
3. **Clunky Playback Controls:** Standard screen readers lack intuitive spatial seeking. Skipping forward or backward through long articles requires hunting for small UI buttons rather than pointing at the text itself.
4. **Poor Multi-Lingual Context Switching:** Reading mixed-language articles (e.g., Hinglish, Hindi news with English titles) often results in English voices trying to phonetically mangle Hindi script or vice versa.

### 2.2 Target User Personas
* **Persona A: The Research Analyst / Student:** Reads long PDFs, documentation, and technical blogs; wants fast 1.5x–2.0x playback with quick paragraph-skipping by moving the mouse.
* **Persona B: The Multi-Lingual Reader:** Frequently switches between English content and Hindi content (e.g., regional news, blogs, literature); needs zero-friction automatic language switching.
* **Persona C: The Privacy-Conscious Professional:** Reads internal wikis, legal docs, and emails; refuses to send text to third-party cloud APIs.

---

## 3. GitHub Repository Context & Feasibility: `rhasspy/piper`

### 3.1 Repository Architecture Overview
[Rhasspy Piper](https://github.com/rhasspy/piper) is an open-source (MIT licensed) neural text-to-speech system based on the **VITS** (Variational Inference with adversarial learning for end-to-end Text-to-Speech) architecture. 

```
┌────────────────────────────────────────────────────────┐
│                   rhasspy/piper                        │
│                                                        │
│  [Text] ──> [Phonemizer / eSpeak-ng] ──> [Phoneme IDs] │
│                                                │       │
│                                                ▼       │
│  [Scales / Speaker ID] ───────────> [ONNX Model (VITS)]│
│                                                │       │
│                                                ▼       │
│                                    [Raw PCM Audio / WAV]
└────────────────────────────────────────────────────────┘
```

### 3.2 ONNX Model Specifications
Piper models are distributed as two files:
1. `model.onnx`: The neural network containing the text encoder, stochastic duration predictor, and HiFi-GAN vocoder.
2. `model.onnx.json`: The metadata and configuration file containing:
   * `audio.sample_rate`: Sampling rate (typically `22050` Hz).
   * `espeak.voice`: eSpeak-ng language identifier (e.g., `en-us`, `hi`).
   * `phoneme_id_map`: Dictionary mapping IPA phoneme characters to integer tensor IDs.
   * `num_speakers`: Number of supported speakers (1 for single-speaker, >1 for multi-speaker).
   * `speaker_id_map`: Dictionary mapping speaker names to integer speaker IDs.
   * `inference`: Default values for `noise_scale` (0.667), `length_scale` (1.0), and `noise_w` (0.8).

### 3.3 ONNX Tensor Input/Output Contract
When running inference with `@microsoft/onnxruntime-web`, the session accepts:
* `input`: `BigInt64Array` of shape `[1, sequence_length]` containing phoneme IDs.
* `input_lengths`: `BigInt64Array` of shape `[1]` containing `[sequence_length]`.
* `scales`: `Float32Array` of shape `[3]` containing `[noise_scale, length_scale, noise_w]`.
* `sid`: (Optional, for multi-speaker models) `BigInt64Array` of shape `[1]` containing the `speaker_id`.
* **Output:** `Float32Array` of shape `[1, 1, num_samples]` representing raw mono PCM audio at the model's sample rate.

### 3.4 Community Voice Models (HuggingFace Integration)
The extension pulls models on-demand from the official `rhasspy/piper-voices` repository:
* **English (`en_US`):**
  * `en_US-lessac-low` (~16 MB)
  * `en_US-lessac-medium` (~38 MB)
  * `en_US-libritts_r-medium` (Multi-speaker: 904 distinct speakers!)
* **Hindi (`hi_IN`):**
  * `hi_IN-hindi-medium` (~38 MB)
  * `hi_IN-cmu_indic-medium` (CMU Indic Hindi dataset)

---

## 4. System Architecture (Manifest V3)

Due to Chrome Manifest V3 constraints (no persistent background DOM, service workers cannot access the Web Audio API or run long WebAssembly threads), the extension uses an **Offscreen Document Pipeline**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CHROME TAB                                │
│                                                                        │
│  [Webpage DOM]                                                         │
│     │                                                                  │
│     ├─► [User Text Selection / Hover]                                  │
│     │                                                                  │
│     ▼                                                                  │
│  [Content Script (Shadow DOM Overlay)]                                 │
│     ├─ Floating Trigger Pill ("🔊 Speak")                             │
│     ├─ Floating Player HUD (Scrub Bar + Speed Multiplier)             │
│     ├─ Sentence Highlighter & Hover-to-Seek Detector                   │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ chrome.runtime.sendMessage
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      BACKGROUND SERVICE WORKER                         │
│                                                                        │
│  - Extension lifecycle & context menus                                 │
│  - Offscreen document creator & supervisor                             │
│  - Message router between Content Script and Offscreen Sandbox         │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ chrome.runtime.sendMessage
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       OFFSCREEN DOCUMENT SANDBOX                       │
│                       (offscreen/offscreen.html)                       │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ IndexedDB Cache Manager                                          │  │
│  │ (Stores *.onnx weights & *.onnx.json configs locally)            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ONNX Runtime Web (WASM SIMD)                                     │  │
│  │ (Runs inference on phoneme tokens -> Float32 PCM)                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Web Audio API AudioContext                                       │  │
│  │ (AudioBufferSourceNode, Dynamic playbackRate, Seek Queue)        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Functional Requirements (FR)

### FR-1: Text Selection & Floating Trigger Pill
* **FR-1.1:** Upon `mouseup` or `selectionchange` on any web page where selected text length is > 1 character, the content script calculates the bounding client rect of the selection.
* **FR-1.2:** A sleek floating trigger pill ("🔊 Speak") appears 8px above/below the selection.
* **FR-1.3:** The pill contains a primary speak button, a badge showing the detected language (e.g. `[HI]` or `[EN]`), and a quick dropdown to change voice quality or speaker before starting.
* **FR-1.4:** Clicking outside the selection immediately dismisses the trigger pill.

### FR-2: Automatic Language Detection
* **FR-2.1:** When text is hovered or selected, the extension executes dual-stage language detection:
  1. Primary: Native `chrome.i18n.detectLanguage(text)` API.
  2. Fallback: Unicode script range analysis (e.g., Devanagari range `[\u0900-\u097F]` for Hindi).
* **FR-2.2:** If Devanagari/Hindi characters constitute > 20% of the selected text, the extension automatically routes the text to the active **Hindi (`hi_IN`)** voice model.
* **FR-2.3:** If Latin characters constitute the majority, it routes to the active **English (`en_US`)** voice model.
* **FR-2.4:** The user can override auto-detection at any time via the UI pill or HUD dropdown.

### FR-3: Voice Quality & Inference Parameter Customization
* **FR-3.1:** The extension supports three standardized quality presets per language:
  * **Fast / Low Quality (`x_low` / `low`):** ~16MB model footprint, sub-100ms synthesis, ideal for lower-end machines.
  * **Standard / Medium Quality (`medium`):** ~38MB model footprint, high fidelity, balanced CPU utilization.
  * **Studio / High Quality (`high`):** ~60MB+ model footprint, maximum naturalness.
* **FR-3.2 (Speaker Selection):** For multi-speaker models (such as `libritts_r`), the user can choose from available speaker personas in a dropdown or switch between male/female voices.
* **FR-3.3 (Inference Sliders):** Advanced settings expose Piper's native parameters:
  * `noise_scale` (0.1 to 1.0, default 0.667): Controls expressiveness/variability.
  * `noise_w` (0.1 to 1.0, default 0.8): Controls phoneme duration variability.
  * `length_scale` (0.5 to 2.5, default 1.0): Speech pace multiplier during ONNX generation.

### FR-4: Floating Player HUD & Mouse Speed Scrubbing
* **FR-4.1:** Once playback begins, the trigger pill morphs into an interactive Floating Player HUD docked to the bottom-right or pinned near the active text.
* **FR-4.2:** Controls include:
  * Play / Pause toggle.
  * Stop / Dismiss (clears all audio and removes highlights).
  * Elapsed time / Total duration counter.
  * Sentence / Paragraph progress bar.
* **FR-4.3 (Mouse Speed Scrub Control):**
  * The speed multiplier badge (e.g., `1.0x`) acts as an interactive scrubbing surface.
  * **Horizontal Mouse Drag:** Holding left-click and dragging horizontally adjusts the speed smoothly between `0.5x` and `2.5x` with real-time numeric feedback.
  * **Mouse Wheel Scrub:** Hovering over the speed badge and scrolling the mouse wheel increments/decrements speed by `0.1x`.
  * Speed adjustments update the active Web Audio `AudioBufferSourceNode.playbackRate` immediately without re-running ONNX inference or causing audio stutter.

### FR-5: Cursor Hover-to-Seek & Paragraph Skipping
* **FR-5.1 (Text Chunking):** Selected text is parsed into structured chunks:
  ```typescript
  interface TextChunk {
    id: number;
    paragraphIndex: number;
    sentenceIndex: number;
    text: string;
    domRange: Range;
  }
  ```
* **FR-5.2 (Karaoke Highlighting):** The chunk currently being read is highlighted on the webpage with a soft accent color (customizable in settings).
* **FR-5.3 (Hover-to-Seek Detection):**
  * When mouse cursor hovers over any other sentence or paragraph within the reading passage:
  * A light dotted preview border and a floating tooltip (`"Jump here ⏭"`) appear.
  * If the user hovers for > 250ms (or left-clicks the hovered segment):
    1. The content script sends `SEEK_TO_CHUNK` with `{ chunkId }` to the service worker.
    2. The offscreen audio engine immediately executes `AudioBufferSourceNode.stop()`.
    3. The synthesis queue immediately cancels unplayed previous buffers and starts streaming audio from the selected chunk index.
    4. The visual active-reading highlight instantly jumps to the hovered sentence/paragraph.

### FR-6: Extension Popup & Local Storage Management
* **FR-6.1:** Clicking the extension icon in Chrome's toolbar opens `popup/popup.html`.
* **FR-6.2:** Allows users to:
  * View installed models and total IndexedDB storage utilized.
  * Download new languages (Hindi, English, Spanish, German, etc.) and delete unused models.
  * Test voice playback with a preview sample.
  * Configure default preferred language, quality tier, and default reading speed.

---

## 6. Non-Functional Requirements (NFR)

* **NFR-1 (Privacy & Security):** 100% of text normalization, phonemization, ONNX inference, and audio rendering occurs locally inside Chrome. Zero outbound telemetry or text payload transmission.
* **NFR-2 (Latency):** Time-to-first-sound for the initial sentence chunk must be < 400ms on modern multi-core CPUs. Subsequent sentences are pre-synthesized in a background double-buffer queue.
* **NFR-3 (Manifest V3 Compliance):** No dynamic `eval()` or remote script loading. WASM binaries (`ort-wasm-simd.wasm`) must be packaged locally within the extension bundle.
* **NFR-4 (DOM Non-Destructiveness):** All injected UI elements must reside within a closed `ShadowRoot` with isolated CSS resets (`all: initial`) to ensure zero visual collision with parent page stylesheets.

---

## 7. UI/UX Design Specifications

### 7.1 Floating Trigger Pill (Pre-Play)
```
┌──────────────────────────────────────────────┐
│  🔊 Speak  │  [HI] Hindi ▾  │  Medium (38MB)  │
└──────────────────────────────────────────────┘
```

### 7.2 Floating Player HUD (Active Playback)
```
┌─────────────────────────────────────────────────────────────┐
│  ▶/⏸  ⏹   [ 01:24 / 03:45 ]  ────────●───────  [ 1.25x ⬍ ]  │
│                                              (Drag/Wheel)   │
│  Reading: "भारत एक विविधतापूर्ण देश है..."                  │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Hover-to-Seek Visual Indicator
```
[Active sentence highlighted in solid cyan]
"First paragraph is currently being spoken aloud by Piper..."

[Hovered sentence with dotted border & mini badge]
"┌┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┐"
"┊ Next paragraph user wants to hear.   [ ⏭ Jump here ]   ┊"
"└┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┘"
```

---

## 8. Failure Modes & Edge Cases

| Scenario / Edge Case | Failure Risk | Mitigation Strategy |
| :--- | :--- | :--- |
| **User selects 5,000+ words** | High memory usage, tab freeze during ONNX inference | Chunk text into discrete sentences; synthesize only 2 sentences ahead in a double-buffer queue. |
| **Model not downloaded yet** | Delay on first click | Show a sleek inline download progress bar (0%–100%) inside the trigger pill with cancel button. |
| **Host page has strict CSP** | Offscreen document execution blocked | Offscreen documents run in extension origin (`chrome-extension://...`) and are immune to host page CSP. |
| **Mixed Language Sentences** | Voice mispronouncing foreign words | Sentence-level language detection; if paragraph switches from English to Hindi, dynamically switch the active ONNX model session. |
| **Rapid Mouse Scrubbing** | Audio popping or desync | Throttle DOM updates to 60fps and update `playbackRate.setValueAtTime()` with exponential ramp. |

---

## 9. Implementation Roadmap & Milestones

* **Milestone 1: Repository Exploration & Model Tensor Validation**
  * Clone `rhasspy/piper`, verify ONNX tensor inputs/outputs, export phoneme mappings, download sample `en_US` and `hi_IN` ONNX model pairs.
* **Milestone 2: Manifest V3 Offscreen Audio Pipeline**
  * Set up `manifest.json`, `service-worker.js`, and `offscreen/offscreen.html` with `@microsoft/onnxruntime-web` + WASM.
  * Verify local audio synthesis and playback via Web Audio API.
* **Milestone 3: Content Script & Shadow DOM Overlay**
  * Build selection listener, floating trigger pill, and language auto-detector (Hindi vs English).
* **Milestone 4: Floating Player HUD & Mouse Controls**
  * Implement mouse drag and scroll wheel speed scrubbers (0.5x–2.5x).
* **Milestone 5: Sentence Chunking & Hover-to-Seek**
  * Build non-destructive sentence DOM highlighter, mouseover dwell detector, and instant audio queue flush-and-seek mechanism.
* **Milestone 6: Popup Settings & IndexedDB Model Management**
  * Build model download manager, storage quota viewer, and voice configuration panel.

---

## 10. Acceptance Criteria (Definition of Done)

- [ ] Chrome extension loads cleanly from unpacked folder with zero Manifest V3 errors.
- [ ] Selecting Hindi text auto-detects `hi_IN` and synthesizes fluent Hindi audio locally.
- [ ] Selecting English text auto-detects `en_US` and synthesizes fluent English audio locally.
- [ ] Dragging or wheel-scrolling on the HUD speed widget adjusts speech speed between 0.5x and 2.5x in real time.
- [ ] Hovering over any paragraph/sentence in the reading text for >250ms immediately jumps audio playback to that section.
- [ ] Model weights are persisted in IndexedDB and work completely offline on subsequent runs.
