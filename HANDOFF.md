# Handoff — Interactive Whiteboard

**Date:** 2026-09-18  
**Repo:** https://github.com/11samm/InteractiveWhiteBoard

**Read [`README.md`](README.md) first.** That file is the public and agent-facing source of truth (architecture, API, trust model, file map, measurements). This handoff is only for switching machines and leftover packaging.

---

## Status

| Phase | Status |
| --- | --- |
| 0–4 | Done (board, rooms, PDFs, grounded tutor) |
| 5 LAN + CI | Done |
| 5 README | Done — root `README.md` |
| 5 remaining | Narrated 60–90s clip; skipped reliability rows if easy |
| 6 AI annotations | Implemented (propose → validate → review → apply). Record visual / two-device / one-Undo if not already written down |
| 7 | Out of scope |

Roadmap: [`PLAN.md`](PLAN.md). Numbers: [`docs/evaluation.md`](docs/evaluation.md), [`docs/reliability.md`](docs/reliability.md).

---

## Not in git (copy off this machine)

`.env` is gitignored. Without it, chat/annotations are off and search falls back to keywords.

```env
GEMINI_API_KEY=<host-only key>
# optional: GEMINI_CHAT_MODEL, GEMINI_EMBEDDING_MODEL,
# CHAT_MAX_REQUESTS_PER_WINDOW, CHAT_WINDOW_MS, CHAT_BUDGET_USD_PER_BOARD, LAN_IPV4
```

Also local-only: `data/whiteboard.sqlite` (+ WAL), `data/uploads/`.

Admin secret is **per browser**: `localStorage` key `whiteboard:admin-secret:<boardId>`. Create a new board on a new machine. Display names: `wb:name:<boardId>`.

---

## Setup on another PC

Prefer **Node 22 LTS** on Windows. Node v24.15.0 lacked a `better-sqlite3` prebuild here; v22.23.2 installed one. Original machine also ran Node v24.14.0 successfully.

```powershell
git clone https://github.com/11samm/InteractiveWhiteBoard.git
cd InteractiveWhiteBoard
npm i
copy .env.example .env   # paste GEMINI_API_KEY
npm run dev
```

Vite: http://localhost:5173 · API: http://localhost:8787 (`GET /api/health` → `{ "ok": true }`).

Restart the host after `.env` changes.

---

## Leftover work (optional packaging)

1. Record a 60–90s narrated demo (two devices, PDF, citation, apply annotations + undo) and link it from the README if you want a recruiter-facing clip.
2. Fill skipped reliability rows only with real evidence: R4 (isolated WS drop), oversized PDF, one-page scanned PDF.
3. Confirm the first GitHub Actions run on the pushed branch is green.

Do not invent Pass/Fail. Do not start voice, OCR, extra providers, or a visual redesign.

---

## Continue in a new chat

> Read README.md, then PLAN.md and HANDOFF.md. The product README is in place. Do not present tldraw as original work. Do not invent evaluation numbers. Remaining packaging: narrated demo clip and any unverified reliability rows. Never commit .env or data/.
