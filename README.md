# EdgeMind — AI-Assisted Semantic Edge Case Test Generator

Current status (Review 1): the deterministic core of the pipeline is
built and working end-to-end, with no AI dependency yet. The AI
reasoning stage (Phase 4 in the design doc) is stubbed as a clear next
step — the whole app runs and demos fine without any API key.

**Update:** the tool now analyzes a whole file — paste or upload a
`.py` file with multiple functions, and every top-level function gets
its own boundary breakdown. Nothing is silently dropped to "just the
first function" anymore.

## Pipeline implemented so far

```
Paste / upload code (one or many functions)
      ↓
[1] Parser (Python `ast`)          -> app/analyzer/parser.py
      ↓  (loops over EVERY top-level function)
[2] Constraint Extractor           -> app/analyzer/constraint_extractor.py
      ↓
[3] Boundary Generator (rule-based)-> app/analyzer/boundary_generator.py
      ↓
[4] AI Reasoner                    -> NOT YET BUILT (next milestone)
      ↓
[5] Validator                      -> NOT YET BUILT
      ↓
[6] Exporter (pytest)              -> done client-side in the React app
```

Every stage does one job only, and every stage's output is inspectable
JSON — this is deliberate, so a reviewer (or you, debugging later) can
see exactly which stage produced which value.

## Project structure

```
edgemind/
  backend/
    app/
      analyzer/
        parser.py               # Stage 1: AST -> structured function data
        constraint_extractor.py # Stage 2: conditions -> per-variable constraints
        boundary_generator.py   # Stage 3: constraints -> N-1/N/N+1 test cases
      tests/
        test_parser_manual.py   # smoke test across 6 function shapes
      main.py                   # FastAPI app, /analyze endpoint
    requirements.txt
  frontend/
    src/
      App.jsx                   # paste box, boundary ruler viz, results table
      App.css
      index.css                 # design tokens
    package.json
```

## Running it locally

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8000
```

**Frontend** (separate terminal):
```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The example
function (`isEligible`) is pre-loaded — click "Generate edge cases".

## What to demo for Review 1

1. The `isEligible(age)` example from the brief → shows 17/18/19 with
   reasons, matching the project doc exactly.
2. Upload or paste a **file with multiple functions** (e.g. `isEligible`,
   `is_valid_password`, `get_shipping_cost` together) → shows the tool
   returns a separate boundary breakdown per function, not just the
   first one. This is the strongest "practically useful" demo moment.
3. Point out `is_valid_password` specifically → shows it correctly
   reasons about string *length* (7/8/9-character strings), not the
   string value itself.
4. Point out `get_shipping_cost` → shows it finds *all three*
   thresholds (1, 5, 20 in the earlier example), not just one.
5. Point out: every test case is tagged `source: "Boundary Rule"` —
   this field is what will distinguish rule-based cases from AI-added
   ones once Stage 4 is built, which is the project's actual novelty
   claim.

## Known limitations (worth stating proactively in review)

- Only handles conditions that are direct comparisons or `len()` calls;
  a condition like `if is_valid(x):` (calling another function) can't
  be turned into a boundary yet — this is intentional scope, not a bug.
- Only **top-level** functions are analyzed — methods inside classes
  and nested/inner functions are skipped for now (a natural next
  extension, not implemented yet).
- Java support, the AI stage, and the Validator stage are next.
