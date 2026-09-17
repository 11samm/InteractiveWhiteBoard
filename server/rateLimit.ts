import { CHAT_MAX_REQUESTS_PER_WINDOW, CHAT_WINDOW_MS } from './ai/config';

/**
 * A minimal in-memory sliding-window limiter, per board. Sufficient for a
 * single-host demo/portfolio deployment (PLAN.md 4.2's "per-board chat rate
 * limits") — resets on restart, and doesn't need a separate store.
 */
const requestTimestamps = new Map<string, number[]>();

export function checkChatRateLimit(boardId: string): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - CHAT_WINDOW_MS;
  const timestamps = (requestTimestamps.get(boardId) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= CHAT_MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = timestamps[0] + CHAT_WINDOW_MS - now;
    requestTimestamps.set(boardId, timestamps);
    return { ok: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  timestamps.push(now);
  requestTimestamps.set(boardId, timestamps);
  return { ok: true };
}
