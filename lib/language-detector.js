// Language Detector for Hindi and English with Script Analysis & Fallback

const DEVANAGARI_REGEX = /[\u0900-\u097F]/g;
const LATIN_REGEX = /[A-Za-z]/g;

/**
 * Analyzes string content to determine if it is predominantly Hindi (Devanagari) or English.
 * @param {string} text 
 * @returns {{ language: 'hi' | 'en', confidence: number, devanagariCount: number, latinCount: number }}
 */
function detectLanguageFromText(text) {
  if (!text || typeof text !== "string") {
    return { language: "en", confidence: 1.0, devanagariCount: 0, latinCount: 0 };
  }

  const devanagariMatches = text.match(DEVANAGARI_REGEX);
  const latinMatches = text.match(LATIN_REGEX);

  const devanagariCount = devanagariMatches ? devanagariMatches.length : 0;
  const latinCount = latinMatches ? latinMatches.length : 0;
  const totalLetters = devanagariCount + latinCount;

  if (totalLetters === 0) {
    return { language: "en", confidence: 0.5, devanagariCount: 0, latinCount: 0 };
  }

  const devanagariRatio = devanagariCount / totalLetters;
  const latinRatio = latinCount / totalLetters;

  // If even 15% of script is Devanagari in mixed text, treat as Hindi reading context
  if (devanagariRatio >= 0.15) {
    return {
      language: "hi",
      confidence: Math.min(1.0, devanagariRatio + 0.2),
      devanagariCount,
      latinCount
    };
  }

  return {
    language: "en",
    confidence: latinRatio,
    devanagariCount,
    latinCount
  };
}

/**
 * Async wrapper that attempts chrome.i18n.detectLanguage if available, falling back to script analysis.
 * @param {string} text 
 * @returns {Promise<{ language: string, isReliable: boolean }>}
 */
async function detectLanguage(text) {
  const localResult = detectLanguageFromText(text);

  // If Devanagari characters are detected locally, prioritize Hindi immediately
  if (localResult.language === "hi") {
    return { language: "hi", isReliable: true };
  }

  if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.detectLanguage) {
    try {
      const res = await new Promise((resolve) => {
        chrome.i18n.detectLanguage(text, (result) => resolve(result));
      });
      if (res && res.languages && res.languages.length > 0) {
        const top = res.languages[0];
        if (top.language.startsWith("hi")) return { language: "hi", isReliable: top.percentage > 40 };
        if (top.language.startsWith("en")) return { language: "en", isReliable: top.percentage > 40 };
      }
    } catch (e) {
      // Fallback
    }
  }

  return { language: localResult.language, isReliable: localResult.confidence > 0.6 };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { detectLanguageFromText, detectLanguage };
}
