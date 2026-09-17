import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { GEMINI_EMBEDDING_MODEL, getGeminiApiKey } from './config';

// The embedding API accepts a batch per request but caps it well below what
// a large document could produce; keep batches modest and sequential so one
// big PDF can't blow past provider request-size limits.
const BATCH_SIZE = 20;

/**
 * Embeds a batch of chunk texts, preserving order. Returns `null` for every
 * entry when no provider key is configured on the host — callers store that
 * as "no embedding yet" and `server/search.ts` falls back to keyword
 * matching, so ingestion still works end-to-end without a key.
 */
export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return texts.map(() => null);
  if (texts.length === 0) return [];

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });

  const results: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await model.batchEmbedContents({
      requests: batch.map((text) => ({
        content: { role: 'user', parts: [{ text }] },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      })),
    });
    results.push(...embeddings.map((e) => e.values));
  }
  return results;
}

/** Embeds a single search query. Returns `null` if no provider key is configured. */
export async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });
  const { embedding } = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    taskType: TaskType.RETRIEVAL_QUERY,
  });
  return embedding.values;
}
