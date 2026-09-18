# Agent notes

Start with **[`README.md`](README.md)**. It is the source of truth for architecture, APIs, trust boundaries, file map, and what not to invent.

Then:

- [`PLAN.md`](PLAN.md) — original product plan and phase list
- [`HANDOFF.md`](HANDOFF.md) — env, Node version, leftover packaging
- [`docs/evaluation.md`](docs/evaluation.md) / [`docs/reliability.md`](docs/reliability.md) — measured numbers only

Non-negotiables:

- tldraw owns the editor and sync engine; this repo owns hosting, persistence, ingest, retrieval, tutor context, limits, and bounded AI annotations.
- Provider keys stay on the host. Never commit `.env`, `data/`, or `node_modules`.
- Failures must be named user-facing states.
- Do not add voice, OCR, extra providers, or a visual redesign unless asked.
- After chunking/embedding/chat changes, re-run `npm run eval:retrieval` instead of guessing scores.
