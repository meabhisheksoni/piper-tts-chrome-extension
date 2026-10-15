// Google Gemini 2.0 / 3.8 AI Audio & Summarization Engine
// Powers human-level conversational speech with natural pauses, emotional modulation, and intelligent text summarization

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_GEMINI_VOICE = "Puck";

const GEMINI_VOICES = {
  Puck: { name: "Puck", gender: "male", style: "Conversational, warm, natural pauses" },
  Kore: { name: "Kore", gender: "female", style: "Empathetic, clear, calm interviewer" },
  Fenrir: { name: "Fenrir", gender: "male", style: "Deep, authoritative, confident" },
  Aoede: { name: "Aoede", gender: "female", style: "Dynamic, melodic, expressive" },
  Charon: { name: "Charon", gender: "male", style: "Steady, executive, professional" }
};

/**
 * Summarizes text into a clear executive takeaway and 3-4 bullet points using Gemini.
 * @param {string} text 
 * @param {string} apiKey 
 * @param {string} model 
 * @returns {Promise<{ summary: string, rawText: string }>}
 */
async function generateGeminiSummary(text, apiKey, model = DEFAULT_GEMINI_MODEL) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Missing Gemini API Key. Please add it in extension settings.");
  }

  const endpoint = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey.trim()}`;

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
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 800
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

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
 * Generates natural human-like speech with interview-level pauses and emotional modulation.
 * @param {string} text 
 * @param {string} apiKey 
 * @param {string} voiceName 
 * @param {string} model 
 * @returns {Promise<{ audioBlobUrl: string, mimeType: string }>}
 */
async function generateGeminiAudio(text, apiKey, voiceName = DEFAULT_GEMINI_VOICE, model = DEFAULT_GEMINI_MODEL) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Missing Gemini API Key. Please add it in extension settings.");
  }

  const endpoint = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey.trim()}`;

  const prompt = `Read the following text aloud with a warm, natural, human interviewer tone. Use realistic pauses, conversational cadence, subtle breath pauses, and clear emotional inflection where appropriate. Speak naturally without rushing:\n\n${text}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
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

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || response.statusText;
    throw new Error(`Gemini Audio Error (${response.status}): ${message}`);
  }

  const data = await response.json();
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
  // If response is raw PCM, wrap in a standard 44-byte RIFF WAV header
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
    DEFAULT_GEMINI_VOICE,
    GEMINI_VOICES
  };
}
