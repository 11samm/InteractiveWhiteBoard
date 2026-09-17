import { embedQuery } from './ai/embeddings';
import { listChunksForBoard, type ChunkRecord } from './chunks';

export interface SearchResult {
  chunk: ChunkRecord;
  score: number;
}

/**
 * In-process retrieval over one board's chunks (PLAN.md 4.3 — fine at this
 * document scale; a real vector DB would only matter at much higher volume).
 *
 * When a chunk has no stored embedding (no provider key was configured at
 * ingestion time, or one wasn't set at query time either), we fall back to
 * a simple keyword overlap score instead of returning nothing — degraded,
 * but still useful, and it never silently drops a board's only files.
 */
export async function searchChunks(boardId: string, query: string, topK = 5): Promise<SearchResult[]> {
  const chunks = listChunksForBoard(boardId);
  if (chunks.length === 0) return [];

  const queryEmbedding = await embedQuery(query).catch(() => null);

  const scored: SearchResult[] = chunks.map((chunk) => {
    if (queryEmbedding && chunk.embedding) {
      return { chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) };
    }
    return { chunk, score: keywordScore(query, chunk.text) };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Fraction of distinct query words (3+ chars) that appear in the chunk text. */
function keywordScore(query: string, text: string): number {
  const words = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length >= 3),
    ),
  );
  if (words.length === 0) return 0;
  const haystack = text.toLowerCase();
  const hits = words.filter((w) => haystack.includes(w)).length;
  return hits / words.length;
}
