// Google Gemini 3.8 AI Audio & Summarization Engine
// Powers human-level conversational speech with natural pauses, emotional modulation, and intelligent text summarization

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";
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

  // Automatic model resolution: default to dedicated TTS model
  let targetModel = model;
  if (!targetModel || targetModel.includes("2.0") || targetModel.includes("2.5") || targetModel === "gemini-3.8-flash") {
    targetModel = DEFAULT_GEMINI_TTS_MODEL;
  }

  // Pure text payload without prompt instructions (prevents prompt reading bug)
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: cleanText,
            speech_metadata: {
              style: "conversational interviewer with natural pauses"
            }
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: "You are an audio text-to-speech narrator. Synthesize the text verbatim in natural spoken voice without adding greetings, preambles, or explanations."
        }
      ]
    },
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceName
          }
        }
      }
    }
  };

  async function executeAudioRequest(modelName) {
    const endpoint = `${GEMINI_API_BASE}/${modelName}:generateContent?key=${apiKey.trim()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

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
        const timeoutErr = new Error("Gemini Audio request timed out (7s).");
        timeoutErr.status = 408;
        throw timeoutErr;
      }
      throw err;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || response.statusText;
      const err = new Error(`Gemini Audio Error (${response.status}): ${message}`);
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  let data;
  try {
    data = await executeAudioRequest(targetModel);
  } catch (err) {
    // If dedicated TTS model returned 404 or failed, fallback to standard gemini-3.8-flash
    if ((err.status === 404 || err.status === 408) && targetModel !== DEFAULT_GEMINI_MODEL) {
      console.warn(`[Gemini Audio] ${targetModel} status ${err.status}, retrying with ${DEFAULT_GEMINI_MODEL}`);
      data = await executeAudioRequest(DEFAULT_GEMINI_MODEL);
    } else {
      throw err;
    }
  }

  const candidate = data.candidates?.[0];
  const audioPart = candidate?.content?.parts?.find(p => p.inlineData);

  if (!audioPart || !audioPart.inlineData?.data) {
    throw new Error("Gemini did not return audio data for this request.");
  }

  const mimeType = audioPart.inlineData.mimeType || "audio/wav";
  const base64Audio = audioPart.inlineData.data;

  // Convert base64 to Blob
  const byteCharacters = atob(base64Audio);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  let blob;
  if (mimeType.includes("pcm")) {
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    blob = pcmToWavBlob(byteArray, sampleRate);
  } else {
    blob = new Blob([byteArray], { type: mimeType });
  }

  const audioBlobUrl = URL.createObjectURL(blob);
  return { audioBlobUrl, mimeType };
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
