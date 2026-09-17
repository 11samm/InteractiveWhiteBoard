import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import type { MessageRecord } from '../messages';
import type { SearchResult } from '../search';
import { CHAT_REQUEST_TIMEOUT_MS, GEMINI_CHAT_MODEL, getGeminiApiKey } from './config';

const SYSTEM_INSTRUCTION = `You are a patient, encouraging study tutor embedded in a collaborative whiteboard.
Multiple students may be drawing and asking questions together.

Rules:
- If a "Board snapshot" image is provided, look at it — it is a picture of the group's current whiteboard.
- If "Retrieved sources" are provided below, ground your answer in them and reference them by their [n] marker
  when you use them (e.g. "...as shown in [1]"). Only cite a source if you actually used it.
- If none of the retrieved sources are relevant to the question, say so plainly instead of guessing or citing them.
- If no sources were retrieved at all, answer from general knowledge and say you have no uploaded material on the topic.
- Be concise. Prefer short explanations and concrete examples over long lectures.`;

export interface ChatContext {
  history: MessageRecord[];
  userText: string;
  retrieved: SearchResult[];
  boardImageBase64?: string;
}

/** Renders retrieved chunks as a numbered context block the model is asked to cite by index. */
function buildSourcesBlock(retrieved: SearchResult[]): string {
  if (retrieved.length === 0) return 'Retrieved sources: none.';
  return [
    'Retrieved sources:',
    ...retrieved.map(
      (r, i) => `[${i + 1}] (page ${r.chunk.page}, relevance ${r.score.toFixed(2)}):\n${r.chunk.text}`,
    ),
  ].join('\n\n');
}

export function buildContents(ctx: ChatContext): Content[] {
  const history: Content[] = ctx.history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const userParts: Content['parts'] = [
    { text: `${buildSourcesBlock(ctx.retrieved)}\n\nStudent question: ${ctx.userText}` },
  ];
  if (ctx.boardImageBase64) {
    userParts.push({ inlineData: { mimeType: 'image/png', data: ctx.boardImageBase64 } });
  }

  return [...history, { role: 'user', parts: userParts }];
}

/**
 * Starts a streamed chat completion. Throws if no provider key is
 * configured — callers must check `hasGeminiApiKey()` first to produce a
 * clean "not configured" error instead of this generic one.
 */
export async function startChatStream(contents: Content[], signal: AbortSignal) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('No Gemini API key configured on the host.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_CHAT_MODEL, systemInstruction: SYSTEM_INSTRUCTION });

  return model.generateContentStream(
    { contents },
    { signal, timeout: CHAT_REQUEST_TIMEOUT_MS },
  );
}
