// Piper & Kokoro Voices Catalog and Configuration
const HF_VOICES_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/";

const KOKORO_VOICES = {
  // English (US)
  "af_heart": {
    id: "af_heart",
    name: "Heart",
    gender: "female",
    language: "en",
    accent: "US",
    rating: "Grade A",
    label: "Heart (Female • Warm Natural)",
    description: "Flagship warm conversational female voice, global benchmark #1"
  },
  "af_bella": {
    id: "af_bella",
    name: "Bella",
    gender: "female",
    language: "en",
    accent: "US",
    rating: "Grade A-",
    label: "Bella (Female • Expressive)",
    description: "Expressive, bright and engaging female voice"
  },
  "af_nicole": {
    id: "af_nicole",
    name: "Nicole",
    gender: "female",
    language: "en",
    accent: "US",
    rating: "Grade B-",
    label: "Nicole (Female • Audiobook)",
    description: "Clear and rhythmic narration voice"
  },
  "am_adam": {
    id: "am_adam",
    name: "Adam",
    gender: "male",
    language: "en",
    accent: "US",
    rating: "Deep",
    label: "Adam (Male • Conversational)",
    description: "Deep, warm conversational male voice"
  },
  "am_michael": {
    id: "am_michael",
    name: "Michael",
    gender: "male",
    language: "en",
    accent: "US",
    rating: "Clear",
    label: "Michael (Male • Narrator)",
    description: "Clear, crisp male narrator voice"
  },
  "am_puck": {
    id: "am_puck",
    name: "Puck",
    gender: "male",
    language: "en",
    accent: "US",
    rating: "Friendly",
    label: "Puck (Male • Casual)",
    description: "Playful, friendly male voice matching Gemini Puck"
  },
  // English (UK)
  "bf_emma": {
    id: "bf_emma",
    name: "Emma",
    gender: "female",
    language: "en",
    accent: "UK",
    rating: "Grade B-",
    label: "Emma (British Female • Crisp)",
    description: "Polished and articulate British female voice"
  },
  "bm_george": {
    id: "bm_george",
    name: "George",
    gender: "male",
    language: "en",
    accent: "UK",
    rating: "BBC",
    label: "George (British Male • BBC)",
    description: "Authoritative British BBC-style male voice"
  },
  // Hindi (IN)
  "hf_alpha": {
    id: "hf_alpha",
    name: "Alpha",
    gender: "female",
    language: "hi",
    accent: "IN",
    rating: "Natural",
    label: "Alpha (Hindi Female)",
    description: "Clear and natural Hindi female voice"
  },
  "hm_omega": {
    id: "hm_omega",
    name: "Omega",
    gender: "male",
    language: "hi",
    accent: "IN",
    rating: "Natural",
    label: "Omega (Hindi Male)",
    description: "Clear and natural Hindi male voice"
  }
};

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
    sampleUrl: "https://rhasspy.github.io/piper-samples/samples/hi/hi_IN/pratham/medium/speaker_0.mp3",
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
    sampleUrl: "https://rhasspy.github.io/piper-samples/samples/hi/hi_IN/priyamvada/medium/speaker_0.mp3",
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
    sampleUrl: "https://rhasspy.github.io/piper-samples/samples/hi/hi_IN/rohan/medium/speaker_0.mp3",
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
    sampleUrl: "https://rhasspy.github.io/piper-samples/samples/en/en_US/lessac/low/speaker_0.mp3",
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
    sampleUrl: "https://rhasspy.github.io/piper-samples/samples/en/en_US/lessac/medium/speaker_0.mp3",
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
    sampleUrl: "https://rhasspy.github.io/piper-samples/samples/en/en_US/amy/low/speaker_0.mp3",
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
    sampleUrl: "https://rhasspy.github.io/piper-samples/samples/en/en_US/amy/medium/speaker_0.mp3",
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
    sampleUrl: "https://rhasspy.github.io/piper-samples/samples/en/en_US/danny/low/speaker_0.mp3",
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
  module.exports = { KOKORO_VOICES, PIPER_VOICES, HF_VOICES_BASE, getVoiceUrl, getVoicesByLanguage, getDefaultVoiceForLanguage };
}
