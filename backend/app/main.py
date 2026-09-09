"""
EdgeMind backend - FastAPI app.

Exposes the pipeline (parser -> constraint extractor -> boundary
generator) over HTTP. The AI reasoning stage is stubbed for now
(returns an empty list) so the app is fully runnable and demoable
without any external API key -- we'll wire in the real AI call next.

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

app = FastAPI(title="EdgeMind API", version="0.2.0")

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

        flat_cases = []
        for var_cases in cases_by_var.values():
            flat_cases.extend(test_case_to_dict(tc) for tc in var_cases)

        results.append(
            FunctionResult(
                function=parsed_function_to_dict(parsed),
                constraints=[constraint_to_dict(c) for c in constraints],
                test_cases=flat_cases,
            )
        )

    return AnalyzeResponse(functions=results)
