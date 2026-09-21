"""
EdgeMind backend - FastAPI app.

Exposes the pipeline (parser -> constraint extractor -> boundary
generator -> AI reasoner -> execution engine -> validator) over HTTP.

The AI reasoning stage calls Gemini (app/analyzer/ai_reasoner.py) and
fails gracefully: if GEMINI_API_KEY is missing or the call errors out,
that function's result just has zero "AI" cases -- Boundary Rule cases
are never affected.

The execution engine (app/analyzer/execution_engine.py) then runs the
real function against every generated case (Boundary Rule + AI) and
fills in what actually happened -- return value, raised exception, or
timeout.

The validator (app/analyzer/validator.py) is a deterministic, rule-based
check (NOT another LLM call) that cross-checks each AI case's own
category claim against its value and the execution result, flagging
(not removing) cases where the claim doesn't hold up.

Analyzes EVERY top-level function in the submitted code, not just the
first one -- this is what makes it usable on a real uploaded file
rather than one function at a time.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.analyzer.parser import parse_all_functions, parsed_function_to_dict, ParseError
from app.analyzer.constraint_extractor import extract_constraints, constraint_to_dict
from app.analyzer.boundary_generator import generate_all_boundary_cases, test_case_to_dict
from app.analyzer.ai_reasoner import generate_ai_cases
from app.analyzer.execution_engine import execute_test_cases
from app.analyzer.validator import validate_test_cases

app = FastAPI(title="EdgeMind API", version="0.5.0")

# Wide open for local dev; tighten this before deploying anywhere real.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    code: str
    language: str = "python"  # reserved for future Java support


class FunctionResult(BaseModel):
    function: dict
    constraints: list[dict]
    test_cases: list[dict]


class AnalyzeResponse(BaseModel):
    functions: list[FunctionResult]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    if req.language != "python":
        raise HTTPException(status_code=400, detail="Only Python is supported right now.")

    try:
        parsed_functions = parse_all_functions(req.code)
    except ParseError as e:
        raise HTTPException(status_code=400, detail=str(e))

    results = []
    for parsed in parsed_functions:
        constraints = extract_constraints(parsed)
        cases_by_var = generate_all_boundary_cases(constraints)

        boundary_cases = []
        for var_cases in cases_by_var.values():
            boundary_cases.extend(var_cases)

        ai_cases = generate_ai_cases(parsed, constraints, boundary_cases)

        all_cases = boundary_cases + ai_cases
        execute_test_cases(parsed, constraints, all_cases)
        validate_test_cases(all_cases)

        results.append(
            FunctionResult(
                function=parsed_function_to_dict(parsed),
                constraints=[constraint_to_dict(c) for c in constraints],
                test_cases=[test_case_to_dict(tc) for tc in all_cases],
            )
        )

    return AnalyzeResponse(functions=results)
