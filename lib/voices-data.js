// Piper Voices Catalog and Configuration
const HF_VOICES_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/";

const PIPER_VOICES = {
  // Hindi Voices
  "hi_IN-pratham-medium": {
    id: "hi_IN-pratham-medium",
    name: "Pratham",
    gender: "male",
    language: "hi",
    languageName: "Hindi (हिन्दी)",
    quality: "medium",
    sampleRate: 22050,
    sizeMB: 38,
    onnxPath: "hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx",
    jsonPath: "hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx.json",
    description: "Natural male Hindi voice, clear pronunciation"
  },
  "hi_IN-priyamvada-medium": {
    id: "hi_IN-priyamvada-medium",
    name: "Priyamvada",
    gender: "female",
    language: "hi",
    languageName: "Hindi (हिन्दी)",
    quality: "medium",
    sampleRate: 22050,
    sizeMB: 38,
    onnxPath: "hi/hi_IN/priyamvada/medium/hi_IN-priyamvada-medium.onnx",
    jsonPath: "hi/hi_IN/priyamvada/medium/hi_IN-priyamvada-medium.onnx.json",
    description: "Clear and expressive female Hindi voice"
  },
  "hi_IN-rohan-medium": {
    id: "hi_IN-rohan-medium",
    name: "Rohan",
    gender: "male",
    language: "hi",
    languageName: "Hindi (हिन्दी)",
    quality: "medium",
    sampleRate: 22050,
    sizeMB: 38,
    onnxPath: "hi/hi_IN/rohan/medium/hi_IN-rohan-medium.onnx",
    jsonPath: "hi/hi_IN/rohan/medium/hi_IN-rohan-medium.onnx.json",
    description: "Deep male Hindi voice, great for long reading"
  },

  // English Voices
  "en_US-lessac-low": {
    id: "en_US-lessac-low",
    name: "Lessac (Fast)",
    gender: "female",
    language: "en",
    languageName: "English (US)",
    quality: "low",
    sampleRate: 16000,
    sizeMB: 16,
    onnxPath: "en/en_US/lessac/low/en_US-lessac-low.onnx",
    jsonPath: "en/en_US/lessac/low/en_US-lessac-low.onnx.json",
    description: "Lightweight and fast English voice, sub-100ms latency"
  },
  "en_US-lessac-medium": {
    id: "en_US-lessac-medium",
    name: "Lessac (Natural)",
    gender: "female",
    language: "en",
    languageName: "English (US)",
    quality: "medium",
    sampleRate: 22050,
    sizeMB: 38,
    onnxPath: "en/en_US/lessac/medium/en_US-lessac-medium.onnx",
    jsonPath: "en/en_US/lessac/medium/en_US-lessac-medium.onnx.json",
    description: "High-fidelity balanced English voice"
  },
  "en_US-amy-low": {
    id: "en_US-amy-low",
    name: "Amy (Fast)",
    gender: "female",
    language: "en",
    languageName: "English (US)",
    quality: "low",
    sampleRate: 16000,
    sizeMB: 16,
    onnxPath: "en/en_US/amy/low/en_US-amy-low.onnx",
    jsonPath: "en/en_US/amy/low/en_US-amy-low.onnx.json",
    description: "Fast female English voice"
  },
  "en_US-amy-medium": {
    id: "en_US-amy-medium",
    name: "Amy (Natural)",
    gender: "female",
    language: "en",
    languageName: "English (US)",
    quality: "medium",
    sampleRate: 22050,
    sizeMB: 38,
    onnxPath: "en/en_US/amy/medium/en_US-amy-medium.onnx",
    jsonPath: "en/en_US/amy/medium/en_US-amy-medium.onnx.json",
    description: "Expressive female English voice"
  },
  "en_US-danny-low": {
    id: "en_US-danny-low",
    name: "Danny (Fast)",
    gender: "male",
    language: "en",
    languageName: "English (US)",
    quality: "low",
    sampleRate: 16000,
    sizeMB: 16,
    onnxPath: "en/en_US/danny/low/en_US-danny-low.onnx",
    jsonPath: "en/en_US/danny/low/en_US-danny-low.onnx.json",
    description: "Fast male English voice"
  }
};

function getVoiceUrl(filePath) {
  return `${HF_VOICES_BASE}${filePath}`;
}

function getVoicesByLanguage(langCode) {
  return Object.values(PIPER_VOICES).filter(v => v.language === langCode);
}

function getDefaultVoiceForLanguage(langCode, quality = "medium") {
  const matches = getVoicesByLanguage(langCode);
  if (!matches.length) return PIPER_VOICES["en_US-lessac-low"];
  const exact = matches.find(v => v.quality === quality);
  return exact || matches[0];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PIPER_VOICES, HF_VOICES_BASE, getVoiceUrl, getVoicesByLanguage, getDefaultVoiceForLanguage };
}
