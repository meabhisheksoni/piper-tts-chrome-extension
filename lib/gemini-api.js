// Google Gemini 3.8 AI Audio & Summarization Engine
// Powers human-level conversational speech with natural pauses, emotional modulation, and intelligent text summarization

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const DEFAULT_GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_GEMINI_VOICE = "Puck";

const GEMINI_VOICES = {
  Puck: { name: "Puck", gender: "male", style: "Conversational, warm, natural pauses" },
  Kore: { name: "Kore", gender: "female", style: "Empathetic, clear, calm interviewer" },
  Fenrir: { name: "Fenrir", gender: "male", style: "Deep, authoritative, confident" },
  Aoede: { name: "Aoede", gender: "female", style: "Dynamic, melodic, expressive" },
  Charon: { name: "Charon", gender: "male", style: "Steady, executive, professional" }
};

/**
 * Summarizes text into a clear executive takeaway and 3-4 bullet points using Gemini 3.8 Flash.
 * @param {string} text 
 * @param {string} apiKey 
 * @param {string} model 
 * @returns {Promise<{ summary: string, rawText: string }>}
 */
async function generateGeminiSummary(text, apiKey, model = DEFAULT_GEMINI_MODEL) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Missing Gemini API Key. Please add it in extension settings.");
  }

  let targetModel = model;
  if (!targetModel || targetModel.includes("2.0") || targetModel.includes("2.5")) {
    targetModel = DEFAULT_GEMINI_MODEL;
  }

  const endpoint = `${GEMINI_API_BASE}/${targetModel}:generateContent?key=${apiKey.trim()}`;

  const prompt = `You are a world-class executive analytical assistant.
Analyze the following text and summarize it so the reader understands it in under 30 seconds.
Follow this exact format:
🎯 KEY INSIGHT:
[2 concise, clear sentences capturing the core conclusion]

📌 ESSENTIAL TAKEAWAYS:
• [Point 1: Key detail or finding]
• [Point 2: Why it matters or context]
• [Point 3: Main action, data point, or outcome]

If the source text is in Hindi or Hinglish, write the entire summary in natural, clear Hindi. If in English, write in clear English.

TEXT TO SUMMARIZE:
${text}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 800
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Gemini Summary request timed out (9s). Please check your internet connection.");
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || response.statusText;
    throw new Error(`Gemini API Error (${response.status}): ${message}`);
  }

  const data = await response.json();
  const summaryText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!summaryText) {
    throw new Error("Gemini returned an empty summary.");
  }

  return { summary: summaryText, rawText: text };
}

/**
 * Generates natural human-like speech with interview-level pauses and emotional modulation using Gemini 3.8.
 * NOTE: Passes pure text only (no prompt preamble) to prevent introductory prompt speech leakage!
 * @param {string} text 
 * @param {string} apiKey 
 * @param {string} voiceName 
 * @param {string} model 
 * @returns {Promise<{ audioBlobUrl: string, mimeType: string }>}
 */
async function generateGeminiAudio(text, apiKey, voiceName = DEFAULT_GEMINI_VOICE, model = DEFAULT_GEMINI_TTS_MODEL) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Missing Gemini API Key. Please add it in extension settings.");
  }

  const cleanText = (text || "").trim();
  if (!cleanText) {
    throw new Error("No text provided for audio synthesis.");
  }

  const requestedModel = (model || "").trim() || DEFAULT_GEMINI_TTS_MODEL;

  // Prioritize dedicated audio models (gemini-2.5-flash-preview-tts & gemini-2.0-flash)
  const candidateModels = [
    requestedModel,
    "gemini-2.5-flash-preview-tts",
    "gemini-2.0-flash"
  ].filter((m, idx, arr) => m && arr.indexOf(m) === idx && m !== "gemini-3.8-flash");

  // If requested model was text-only gemini-3.8-flash, ensure at least one audio model is present
  if (candidateModels.length === 0) {
    candidateModels.push("gemini-2.5-flash-preview-tts", "gemini-2.0-flash");
  }

  // Exact Google Gemini API specification payload
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: cleanText
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceName || DEFAULT_GEMINI_VOICE
          }
        }
      }
    }
  };

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const endpoint = `${GEMINI_API_BASE}/${modelName}:generateContent?key=${apiKey.trim()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || response.statusText;
        const err = new Error(`Gemini Audio Error (${response.status}): ${message}`);
        err.status = response.status;
        lastError = err;

        const isBadKey = message.toLowerCase().includes("api key") || response.status === 403;
        if (isBadKey) {
          throw new Error("Invalid Gemini API Key. Please verify your API key in Google AI Studio.");
        }

        console.warn(`[Gemini Audio] Model ${modelName} returned ${response.status} (${message}), attempting next candidate model...`);
        continue;
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const audioPart = candidate?.content?.parts?.find(p => p.inlineData || p.inline_data);

      if (!audioPart) {
        const textPart = candidate?.content?.parts?.find(p => p.text);
        const snippet = textPart?.text ? textPart.text.substring(0, 80) : "empty text";
        console.warn(`[Gemini Audio] Model ${modelName} returned text instead of audio ("${snippet}"). Falling back to next audio model...`);
        lastError = new Error(`Model ${modelName} returned text instead of audio.`);
        continue;
      }

      const inline = audioPart.inlineData || audioPart.inline_data;
      if (!inline || !inline.data) {
        console.warn(`[Gemini Audio] Model ${modelName} returned empty inline audio data. Trying next candidate...`);
        lastError = new Error("Missing inline audio data in Gemini response.");
        continue;
      }

      const base64Audio = inline.data;
      const mimeType = inline.mimeType || inline.mime_type || "audio/wav";

      // Convert base64 to byte array
      const byteCharacters = atob(base64Audio);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }

      // Check if data already contains standard RIFF WAV header
      const isRiffWav = byteArray.length > 4 &&
        byteArray[0] === 0x52 && // 'R'
        byteArray[1] === 0x49 && // 'I'
        byteArray[2] === 0x46 && // 'F'
        byteArray[3] === 0x46;   // 'F'

      let blob;
      if (isRiffWav) {
        blob = new Blob([byteArray], { type: "audio/wav" });
      } else if (mimeType.toLowerCase().includes("pcm") || mimeType.toLowerCase().includes("l16")) {
        const rateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        blob = pcmToWavBlob(byteArray, sampleRate);
      } else {
        blob = new Blob([byteArray], { type: mimeType });
      }

      const audioBlobUrl = URL.createObjectURL(blob);
      return { audioBlobUrl, mimeType, modelUsed: modelName };
    } catch (err) {
      if (err.message && err.message.includes("Invalid Gemini API Key")) {
        throw err;
      }
      lastError = err;
      console.warn(`[Gemini Audio] Model ${modelName} failed with: ${err.message}. Trying next candidate...`);
      continue;
    }
  }

  throw lastError || new Error("Failed to generate audio with any supported Gemini model. Please check your Gemini API key.");
}

/**
 * Prepends a standard 44-byte RIFF/WAVE header to 16-bit mono raw PCM data.
 */
function pcmToWavBlob(pcmData, sampleRate = 24000) {
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // "RIFF"
  writeString(view, 0, "RIFF");
  // Total file length - 8
  view.setUint32(4, 36 + pcmData.length, true);
  // "WAVE"
  writeString(view, 8, "WAVE");
  // "fmt "
  writeString(view, 12, "fmt ");
  // Subchunk1Size (16 for PCM)
  view.setUint32(16, 16, true);
  // AudioFormat (1 for PCM)
  view.setUint16(20, 1, true);
  // NumChannels (1 = mono)
  view.setUint16(22, 1, true);
  // SampleRate
  view.setUint32(24, sampleRate, true);
  // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint32(28, sampleRate * 1 * 2, true);
  // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true);
  // BitsPerSample (16 bits)
  view.setUint16(34, 16, true);
  // "data"
  writeString(view, 36, "data");
  // Subchunk2Size (NumSamples * NumChannels * BitsPerSample/8)
  view.setUint32(40, pcmData.length, true);

  return new Blob([wavHeader, pcmData], { type: "audio/wav" });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateGeminiSummary,
    generateGeminiAudio,
    pcmToWavBlob,
    DEFAULT_GEMINI_MODEL,
    DEFAULT_GEMINI_TTS_MODEL,
    DEFAULT_GEMINI_VOICE,
    GEMINI_VOICES
  };
}
