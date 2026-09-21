# EdgeMind frontend

New frontend, built from scratch against the current `/analyze` API contract
only (Stage 4 AI Reasoner + Stage 5 Execution Engine). No auth, no keys — the
backend needs no credentials from the frontend, and the Gemini key stays
server-side.

## Setup

```bash
npm install
cp .env.example .env   # only sets VITE_API_BASE_URL, defaults to localhost:8000
npm run dev
```

Requires the FastAPI backend running separately (`GET /health`, `POST /analyze`).

## What's here

- Paste-code panel, Python only (the backend 400s on anything else right now,
  so there's no language selector for a Java path that doesn't exist yet).
- Per-function boundary ruler: a literal number line per constrained
  variable, plotting boundary thresholds and every tested value. Points are
  colored by `source` (Boundary Rule vs AI) and outlined instead of filled
  when `execution_status === "raises"`. Non-numeric values (`None`, strings)
  can't sit on a number line, so they're listed as chips underneath.
- Test case table: value, category, source, reason, and the real execution
  result (`success` → output, `raises` → exception type + message, `timeout`
  / `error` handled distinctly).
- A soft notice when a function comes back with zero AI-sourced cases —
  the API contract notes this can happen silently (e.g. Gemini failure) and
  still returns `200` with Boundary Rule cases intact, so the UI says so
  rather than looking like nothing happened.
- Pytest export only. JUnit/Java export was in the original project scope
  but isn't built here, because the backend doesn't accept `language: "java"`
  yet — a JUnit button would be exporting for a path that doesn't exist.
  The pytest export is honest about what it doesn't know: the API only
  reports one varied variable per test case, not the sibling parameter
  values used during backend execution, so generated tests for
  multi-parameter functions leave the other arguments as a marked `TODO`
  rather than guessing at them.

## Known gaps / not built

- No JUnit export (see above).
- No way to re-run/retry a single test case from the UI — every re-analysis
  re-runs the whole function.
- No persistence — results live in React state only, refreshing the page
  loses them.
