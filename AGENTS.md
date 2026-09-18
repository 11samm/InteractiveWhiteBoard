# Agent notes

Start with **[`README.md`](README.md)**. It is the source of truth for architecture, APIs, trust boundaries, file map, and what not to invent.

Measured numbers only: [`docs/evaluation.md`](docs/evaluation.md) and [`docs/reliability.md`](docs/reliability.md).

`PLAN.md` and `HANDOFF.md` are local working notes (gitignored). Use them if they exist on disk; do not add them back to git.

Non-negotiables:

- tldraw owns the editor and sync engine; this repo owns hosting, persistence, ingest, retrieval, tutor context, limits, and bounded AI annotations.
- Provider keys stay on the host. Never commit `.env`, `data/`, `PLAN.md`, `HANDOFF.md`, or `node_modules`.
- Failures must be named user-facing states.
- Do not add voice, OCR, extra providers, or a visual redesign unless asked.
- After chunking/embedding/chat changes, re-run `npm run eval:retrieval` instead of guessing scores.
