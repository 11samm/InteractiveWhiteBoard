import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { GEMINI_EMBEDDING_MODEL, getGeminiApiKey } from './config';

// The embedding API accepts a batch per request but caps it well below what
// a large document could produce; keep batches modest and sequential so one
// big PDF can't blow past provider request-size limits.
const BATCH_SIZE = 20;

/**
 * Embeds a batch of chunk texts, preserving order. Returns `null` for every
 * entry when no provider key is configured, or when the embedding call
 * itself fails (e.g. a deprecated/misconfigured model name) — callers store
 * that as "no embedding yet" and `server/search.ts` falls back to keyword
 * matching, so ingestion degrades gracefully instead of failing the whole
 * file over a provider hiccup.
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
    try {
      const { embeddings } = await model.batchEmbedContents({
        requests: batch.map((text) => ({
          content: { role: 'user', parts: [{ text }] },
          taskType: TaskType.RETRIEVAL_DOCUMENT,
        })),
      });
      results.push(...embeddings.map((e) => e.values));
    } catch (err) {
      console.error(
        `[embeddings] batchEmbedContents failed (model "${GEMINI_EMBEDDING_MODEL}"), falling back to keyword search for this batch:`,
        err,
      );
      results.push(...batch.map(() => null));
    }
  }
  return results;
}

/** Embeds a single search query. Returns `null` if no provider key is configured or the call fails. */
export async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });
    const { embedding } = await model.embedContent({
      content: { role: 'user', parts: [{ text }] },
      taskType: TaskType.RETRIEVAL_QUERY,
    });
    return embedding.values;
  } catch (err) {
    console.error(`[embeddings] embedContent failed (model "${GEMINI_EMBEDDING_MODEL}"):`, err);
    return null;
  }
}
