/**
 * Provider configuration lives in environment variables on the host only
 * (PLAN.md 4.2/4.5) — never sent to clients, never logged. `hasApiKey()` is
 * exposed to the frontend via `/api/config` so the UI can explain degraded
 * behavior (e.g. keyword-only search, no chat) instead of failing silently.
 */
export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function hasGeminiApiKey(): boolean {
  return getGeminiApiKey() !== null;
}

// Model names drift over time (providers deprecate/replace them), which is
// exactly why PLAN.md 5.1 says to keep them in config rather than hard-coded
// throughout the codebase. If chat or embeddings start failing with a 404
// "model not found"/"no longer available" error, the model name below is
// almost certainly the cause — list current models with your key via
// `GET https://generativelanguage.googleapis.com/v1beta/models?key=...`
// and update these defaults (or set the env var override) accordingly.
export const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001';
export const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? 'gemini-3.8-flash';

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// --- Chat request limits (PLAN.md 4.2/5.2) ---------------------------------
// Per-board, in-memory (reset on host restart) — enough for a single-host
// demo/portfolio deployment without adding a separate rate-limit store.

export const CHAT_MAX_REQUESTS_PER_WINDOW = numEnv('CHAT_MAX_REQUESTS_PER_WINDOW', 8);
export const CHAT_WINDOW_MS = numEnv('CHAT_WINDOW_MS', 5 * 60 * 1000);
export const CHAT_REQUEST_TIMEOUT_MS = numEnv('CHAT_REQUEST_TIMEOUT_MS', 30_000);

// A configurable spending cap per board protects the host from a runaway
// or abusive guest, since guests never see (and can't check) the provider
// bill themselves.
export const CHAT_BUDGET_USD_PER_BOARD = numEnv('CHAT_BUDGET_USD_PER_BOARD', 1.0);

// Rough, configurable per-1K-token cost estimates — NOT authoritative
// pricing. Good enough to demonstrate budget enforcement and give the host
// a ballpark; check the provider's current pricing page for real numbers.
export const GEMINI_INPUT_COST_PER_1K_USD = numEnv('GEMINI_INPUT_COST_PER_1K_USD', 0.000075);
export const GEMINI_OUTPUT_COST_PER_1K_USD = numEnv('GEMINI_OUTPUT_COST_PER_1K_USD', 0.0003);

export function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  return (promptTokens / 1000) * GEMINI_INPUT_COST_PER_1K_USD + (completionTokens / 1000) * GEMINI_OUTPUT_COST_PER_1K_USD;
}
