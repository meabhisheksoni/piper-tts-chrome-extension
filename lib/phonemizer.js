// Phonemizer & Sentence Chunker for Piper TTS (Hindi & English)

const BOS = "^";
const EOS = "$";
const PAD = "_";

/**
 * Splits text into logical sentence chunks for low-latency streaming and hover-seeking.
 * Supports standard English punctuation and Hindi Purna Viram (।).
 * @param {string} text 
 * @returns {Array<{ id: number, text: string, paragraphIndex: number }>}
 */
function splitIntoSentenceChunks(text) {
  if (!text || typeof text !== "string") return [];

  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let chunkId = 0;

  paragraphs.forEach((para, pIdx) => {
    const trimmedPara = para.trim();
    if (!trimmedPara) return;

    // Split sentences by ., !, ?, or Hindi Purna Viram (।) while keeping punctuation
    const rawSentences = trimmedPara.match(/[^.!?।\n]+[.!?।\n]+|[^.!?।\n]+$/g) || [trimmedPara];

    rawSentences.forEach((s) => {
      const trimmedSentence = s.trim();
      if (trimmedSentence.length > 0) {
        chunks.push({
          id: chunkId++,
          paragraphIndex: pIdx,
          text: trimmedSentence
        });
      }
    });
  });

  return chunks;
}

/**
 * Converts text into phoneme IDs according to the Piper model's phoneme_id_map.
 * @param {string} text 
 * @param {Object} phonemeIdMap 
 * @returns {BigInt64Array}
 */
function textToPhonemeIds(text, phonemeIdMap) {
  if (!phonemeIdMap) {
    throw new Error("phoneme_id_map is required for phonemization");
  }

  const ids = [];

  // Add Beginning of Sentence (BOS)
  if (phonemeIdMap[BOS]) {
    ids.push(...phonemeIdMap[BOS]);
  }

  // Normalize spaces and lowercase if model vocabulary is lowercase
  const normalizedText = text.replace(/\s+/g, " ");

  // Map each character or symbol to the phoneme ID
  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    
    let tokenIds = phonemeIdMap[char];
    if (!tokenIds && phonemeIdMap[char.toLowerCase()]) {
      tokenIds = phonemeIdMap[char.toLowerCase()];
    }

    if (tokenIds) {
      ids.push(...tokenIds);
      if (phonemeIdMap[PAD]) {
        ids.push(...phonemeIdMap[PAD]);
      }
    }
  }

  // Add End of Sentence (EOS)
  if (phonemeIdMap[EOS]) {
    ids.push(...phonemeIdMap[EOS]);
  }

  // Fallback if no matching tokens found
  if (ids.length <= 2) {
    // Provide a minimal valid silence sequence
    return new BigInt64Array([1n, 0n, 2n]);
  }

  return new BigInt64Array(ids.map(n => BigInt(n)));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { splitIntoSentenceChunks, textToPhonemeIds, BOS, EOS, PAD };
}
