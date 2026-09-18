# Reliability checklist

Date: 2026-09-17
Machine / OS: Windows 10 (build 19045)
Browsers: Cursor embedded browser (Chromium), two tabs on http://localhost:5173
GEMINI_API_KEY configured: yes
Notes: Two-tab same-profile run; guest behavior simulated by clearing `whiteboard:admin-secret:*` in the guest tab only.

- R1 concurrent edits: **Pass** — Tab A created board `4e8dd7fe-5efc-4c2d-8d64-7b2cec8045d4`; tab B joined same URL; each tab drew a stroke; shape count stayed matched (2) on both without refresh.
- R2 PDF ingest + invalid type: **Pass** — Fixture PDF ingested on board A (multipart POST to `/api/files`, same handler as Study Context); both tabs showed `ready` (5 pages). `.txt` upload returned `unsupported_type` / “Only PDF files are supported right now.” Oversized (>20 MB) file: **Skipped** (no fixture generated).
- R3 refresh + host restart: **Pass** — After 3s wait, refresh kept 2 shapes and PDF; stopping port 8787 showed “Reconnecting…” banner; after restart, both tabs reconnected with shapes and file intact (no duplicate strokes on reconnect).
- R4 disconnect/reconnect: **Skipped** — DevTools “Offline” / `Network.setOffline` not available in the automated browser MCP; could not isolate tab B WS drop without a second browser profile.
- R5 board+doc chat and citations: **Pass** — “subspace” on board + board snapshot; streamed answer with `Linear_Algebra_Ch3.pdf · p.1` citation/excerpt; Stop mid-stream on a later prompt halted generation without crash (no `[chat timing]` `onDone` for aborted turn).
- R6a no API key: **Pass** — Commented `GEMINI_API_KEY` in `.env`, restarted host; chat SSE `code: no_api_key` with host-not-configured message.
- R6b rate limit: **Pass** — `CHAT_MAX_REQUESTS_PER_WINDOW=2`; first two chats succeeded; third returned `rate_limited` / “Too many questions in a short time…”.
- R6c budget: **Pass** — `CHAT_BUDGET_USD_PER_BOARD=0.0000001` after prior spend; chat returned `budget_exceeded` / session budget message.
- R6d scanned PDF: **Skipped** — No one-page scanned fixture prepared in this pass.
- R6e usage 403: **Pass** — `GET /api/boards/4e8dd7fe-5efc-4c2d-8d64-7b2cec8045d4/usage` without header returned HTTP 403 `{"error":"forbidden"}`.
- R6f host dashboard guest vs creator: **Pass** — Creator tab shows “Host dashboard” link and loads usage at `/host/:id`; guest tab (admin secret removed) hides link and `/host/:id` shows not-creator message.
- R7 host usage numbers: **Pass** — After three completed chats, dashboard showed `aiConfigured`, request count 3, spend/budget/remaining consistent; guest `fetch` without secret got 403.

Issues found: None blocking; R4 and oversized/scanned cases deferred as Skipped.

## LAN smoke check (2026-09-17)

After binding Vite and the API host to `0.0.0.0`, `npm run dev` advertised `http://192.168.10.132:5173/`. From the host machine, requests to that LAN IPv4 returned the app (HTTP 200) and `/api/health` (`ok: true`). A board was created through the Vite proxy, and a WebSocket connection to `/api/sync/:boardId` reached `Open`. `/api/config` returned `lanIPv4: 192.168.10.132`.

Follow-up: the host dashboard link opened on a second physical device, and the user reported that it worked. The device/browser, two-way edits and presence, and reconnect behavior were not recorded separately, so the full two-device workflow remains to be documented for the narrated demo.
