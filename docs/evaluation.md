# Evaluation

## Setup

- Date: 2026-09-17
- Device / OS: Windows 10 (build 19045)
- Network: localhost two-window
- Node/npm: v24.14.0 / 11.9.0
- Chat model (from server/ai/config.ts or env): `gemini-3.8-flash` (default)
- Embedding model: `gemini-embedding-001` (default)
- Provider key present for eval: yes
- Retrieval mode: semantic

## Retrieval

Command: `npm run eval:retrieval`

- Score: 15/16 (94%)
- Top-K: 5 (script constant)
- Misses: `[no source expected] "What is the boiling point of water on Mars?" — top score 0.51` (expected no retrieval hit; semantic score still above implicit threshold)

## Chat

Timed turns from DevTools `[chat timing]` on board `4e8dd7fe-5efc-4c2d-8d64-7b2cec8045d4` with fixture PDF uploaded.

- n = 3
- Time to first token (client, ms): 1999, 2169, 2360 — min 1999 / median 2169 / max 2360
- Total completion (server `usage.latencyMs`): 2022, 2280, 2669 — min 2022 / median 2280 / max 2669
- Tokens / estimated USD (host dashboard after those turns): requests 3; prompt tokens 5570; completion tokens 485; estimated spend $0.000563; budget $1; remaining $0.999437; avg latency 2324 ms

## Sync

- Method: visual observation, two tabs side by side, single short stroke on tab A while tab B visible; not instrumented
- n: 5
- Observations: all five trials appeared immediate (under ~100 ms perceived); no duplicate shapes observed when counts were checked via DOM shape nodes

## Failures observed during measurement

- Retrieval eval: one off-topic question not rejected (see Misses above).
- Reliability R6 probes (separate from timed chat): confirmed `no_api_key`, `rate_limited`, and `budget_exceeded` SSE error codes after `.env` overrides (limits restored afterward).
