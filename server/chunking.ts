export interface Chunk {
  text: string;
  tokenCount: number;
}

const CHUNK_SIZE = 900; // characters — a rough proxy for ~200-250 tokens
const CHUNK_OVERLAP = 150;

/**
 * Splits one page's text into overlapping chunks on whitespace boundaries.
 * Overlap keeps sentences that straddle a chunk boundary retrievable from
 * either side. Token count is a cheap approximation (chars / 4) — good
 * enough for the budget/limit purposes in PLAN.md 5.2, not exact BPE.
 */
export function chunkPageText(text: string): Chunk[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  if (normalized.length <= CHUNK_SIZE) {
    return [{ text: normalized, tokenCount: estimateTokens(normalized) }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);
    // Prefer to break on a word boundary rather than mid-word.
    if (end < normalized.length) {
      const lastSpace = normalized.lastIndexOf(' ', end);
      if (lastSpace > start) end = lastSpace;
    }
    const slice = normalized.slice(start, end).trim();
    if (slice) chunks.push({ text: slice, tokenCount: estimateTokens(slice) });
    if (end >= normalized.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
