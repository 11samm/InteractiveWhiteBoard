import { buildContents, startChatStream } from './ai/chat';
import { estimateCostUsd, hasGeminiApiKey, CHAT_BUDGET_USD_PER_BOARD, GEMINI_CHAT_MODEL } from './ai/config';
import { getFile } from './files';
import { addCitations, createMessage, listRecentMessages, type CitationRecord } from './messages';
import { checkChatRateLimit } from './rateLimit';
import { searchChunks } from './search';
import { getBoardSpendUsd, recordUsage } from './usage';

const HISTORY_TURNS = 8;
const TOP_K_SOURCES = 5;
const MAX_BOARD_IMAGE_BASE64_CHARS = 8_000_000; // ~6 MB decoded — plenty for a viewport PNG

export type ChatEvent =
  | { type: 'token'; text: string }
  | {
      type: 'done';
      messageId: string;
      citations: CitationRecord[];
      usage: { promptTokens: number; completionTokens: number; latencyMs: number; estimatedCostUsd: number };
    }
  | { type: 'error'; code: string; message: string };

/**
 * Orchestrates one grounded chat turn end to end (PLAN.md 5.2): validates
 * limits, persists the user's message, retrieves context, streams the
 * model's answer, then persists the assistant reply, its citations, and
 * usage. Yields discriminated events the HTTP route forwards as SSE.
 */
export async function* runChatTurn(
  boardId: string,
  userText: string,
  boardImageBase64: string | undefined,
  signal: AbortSignal,
): AsyncGenerator<ChatEvent> {
  if (!hasGeminiApiKey()) {
    yield {
      type: 'error',
      code: 'no_api_key',
      message: 'The host has not configured an AI provider key yet, so the tutor is unavailable.',
    };
    return;
  }

  const rateLimit = checkChatRateLimit(boardId);
  if (!rateLimit.ok) {
    yield {
      type: 'error',
      code: 'rate_limited',
      message: `Too many questions in a short time. Try again in about ${Math.ceil(rateLimit.retryAfterMs / 1000)}s.`,
    };
    return;
  }

  if (getBoardSpendUsd(boardId) >= CHAT_BUDGET_USD_PER_BOARD) {
    yield {
      type: 'error',
      code: 'budget_exceeded',
      message: 'This board has reached its AI usage budget for this session.',
    };
    return;
  }

  if (boardImageBase64 && boardImageBase64.length > MAX_BOARD_IMAGE_BASE64_CHARS) {
    yield { type: 'error', code: 'board_image_too_large', message: 'Board snapshot is too large to send.' };
    return;
  }

  const history = listRecentMessages(boardId, HISTORY_TURNS).filter((m) => m.role !== 'error');
  createMessage(boardId, 'user', userText);

  const retrieved = await searchChunks(boardId, userText, TOP_K_SOURCES).catch(() => []);
  const contents = buildContents({ history, userText, retrieved, boardImageBase64 });

  const startedAt = Date.now();
  let fullText = '';

  try {
    const { stream, response } = await startChatStream(contents, signal);

    for await (const chunk of stream) {
      if (signal.aborted) break;
      const text = chunk.text();
      if (text) {
        fullText += text;
        yield { type: 'token', text };
      }
    }

    const final = await response;
    const latencyMs = Date.now() - startedAt;
    const usageMeta = final.usageMetadata;
    const promptTokens = usageMeta?.promptTokenCount ?? 0;
    const completionTokens = usageMeta?.candidatesTokenCount ?? 0;
    const estimatedCostUsd = estimateCostUsd(promptTokens, completionTokens);

    const assistantMessage = createMessage(boardId, 'assistant', fullText);

    const filenameCache = new Map<string, string>();
    const filenameFor = (fileId: string): string => {
      if (!filenameCache.has(fileId)) {
        filenameCache.set(fileId, getFile(fileId)?.filename ?? 'Unknown source');
      }
      return filenameCache.get(fileId)!;
    };

    const citations = retrieved.map((r) => ({
      chunkId: r.chunk.id,
      fileId: r.chunk.fileId,
      filename: filenameFor(r.chunk.fileId),
      page: r.chunk.page,
      excerpt: r.chunk.text.slice(0, 400),
      retrievalScore: r.score,
    }));
    if (citations.length > 0) addCitations(assistantMessage.id, citations);

    recordUsage({
      boardId,
      messageId: assistantMessage.id,
      model: GEMINI_CHAT_MODEL,
      promptTokens,
      completionTokens,
      latencyMs,
      estimatedCostUsd,
    });

    yield {
      type: 'done',
      messageId: assistantMessage.id,
      citations: citations.map((c, i) => ({ id: `${assistantMessage.id}-${i}`, messageId: assistantMessage.id, ...c })),
      usage: { promptTokens, completionTokens, latencyMs, estimatedCostUsd },
    };
  } catch (err) {
    const aborted = signal.aborted;
    const code = aborted ? 'cancelled' : 'model_failed';
    const message = aborted
      ? 'Request cancelled or timed out.'
      : 'The AI tutor request failed. Please try again in a moment.';
    console.error(`[chat] board ${boardId} failed:`, err);
    if (!aborted) createMessage(boardId, 'error', message);
    yield { type: 'error', code, message };
  }
}
