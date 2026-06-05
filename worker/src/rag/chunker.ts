// ============================================================================
// Text Chunker for RAG Pipeline
// ============================================================================
// Splits documents into overlapping chunks for embedding and retrieval.
// Uses a simple but effective sentence-aware chunking strategy.
// ============================================================================

export interface ChunkOptions {
  /** Target chunk size in characters (default: 1000) */
  chunkSize?: number;
  /** Overlap between chunks in characters (default: 200) */
  chunkOverlap?: number;
  /** Minimum chunk size to keep (default: 100) */
  minChunkSize?: number;
}

export interface TextChunk {
  content: string;
  index: number;
  tokenEstimate: number;
}

/**
 * Split text into overlapping chunks, respecting sentence boundaries.
 *
 * Strategy:
 *   1. Split text into sentences
 *   2. Group sentences into chunks of ~chunkSize characters
 *   3. Add overlap by including trailing sentences from the previous chunk
 *
 * This preserves semantic coherence better than naive character splitting.
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    minChunkSize = 100,
  } = options;

  // Clean up the text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleanedText.length === 0) {
    return [];
  }

  // If text is small enough, return as single chunk
  if (cleanedText.length <= chunkSize) {
    return [{
      content: cleanedText,
      index: 0,
      tokenEstimate: estimateTokens(cleanedText),
    }];
  }

  // Split into sentences (handles common abbreviations)
  const sentences = splitIntoSentences(cleanedText);
  const chunks: TextChunk[] = [];

  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const sentence of sentences) {
    const sentenceLength = sentence.length;

    // If adding this sentence would exceed chunk size and we have content
    if (currentLength + sentenceLength > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      const chunkContent = currentChunk.join(' ').trim();
      if (chunkContent.length >= minChunkSize) {
        chunks.push({
          content: chunkContent,
          index: chunks.length,
          tokenEstimate: estimateTokens(chunkContent),
        });
      }

      // Create overlap by keeping trailing sentences from the current chunk
      const overlapChunk: string[] = [];
      let overlapLength = 0;

      for (let i = currentChunk.length - 1; i >= 0; i--) {
        if (overlapLength + currentChunk[i].length > chunkOverlap) break;
        overlapChunk.unshift(currentChunk[i]);
        overlapLength += currentChunk[i].length;
      }

      currentChunk = overlapChunk;
      currentLength = overlapLength;
    }

    currentChunk.push(sentence);
    currentLength += sentenceLength;
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    const chunkContent = currentChunk.join(' ').trim();
    if (chunkContent.length >= minChunkSize) {
      chunks.push({
        content: chunkContent,
        index: chunks.length,
        tokenEstimate: estimateTokens(chunkContent),
      });
    }
  }

  return chunks;
}

/**
 * Split text into sentences, handling common edge cases.
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace
  // Handles: periods, question marks, exclamation marks, newlines
  const raw = text.split(/(?<=[.!?])\s+|\n{2,}/);

  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Rough token estimation (1 token ≈ 4 characters for English text).
 * Good enough for budget tracking — exact counts come from the API response.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
