"""
Stage 5 of the EdgeMind pipeline: Execution Engine
Location: app/analyzer/execution_engine.py

Actually runs the parsed function against every generated TestCase's
input and records what really happens -- return value, raised
exception, or timeout -- instead of only telling the user "this input
is worth testing."

Design decisions locked in:
  - Sandboxing: timeout only, no subprocess/process isolation. This is
    a local college-project demo, not a multi-tenant service running
    untrusted code from strangers -- a hard timeout via a worker thread
    is enough to stop an infinite loop from hanging the request. (A
    genuinely malicious function could still do things a real sandbox
    would stop -- documented tradeoff, not attempted here.)
  - Windows-safe timeout: signal.alarm() doesn't exist on Windows, so
    this uses concurrent.futures.ThreadPoolExecutor + future.result(timeout=...)
    instead. Caveat: Python threads can't be forcibly killed, so a truly
    infinite-looping function's thread keeps running in the background
    after we give up waiting on it -- acceptable for a demo, not for
    production.
  - A raised exception is USEFUL DATA, not a failure: e.g. price="invalid"
    raising TypeError IS the test result the user wants to see, so it's
    recorded as execution_status="raises" with the exception type/message,
    not treated as this stage failing.
  - Multi-parameter functions: a TestCase only specifies ONE variable's
    value (that's what's being tested). Every OTHER parameter needs SOME
    value to actually call the function, so siblings are held at a
    "satisfying default" -- see _derive_satisfying_value(). This reuses
    the same idea flagged earlier for the deferred expected_output field,
    so it can be shared by both features later.
"""

from __future__ import annotations
import ast
import concurrent.futures
from typing import Any, Dict, List, Optional

from app.analyzer.parser import ParsedFunction
from app.analyzer.constraint_extractor import Constraint
from app.analyzer.boundary_generator import TestCase

DEFAULT_TIMEOUT_SECONDS = 2.0


# ---------------------------------------------------------------------------
# Compiling the function
# ---------------------------------------------------------------------------

def _compile_function(parsed: ParsedFunction):
    """Compiles the function's own source (captured by the parser as
    raw_source) into a callable, in an isolated namespace."""
    namespace: Dict[str, Any] = {}
    code = compile(parsed.raw_source, filename=f"<edgemind:{parsed.name}>", mode="exec")
    exec(code, namespace)
    return namespace[parsed.name]


# ---------------------------------------------------------------------------
# Sibling parameter defaults
# ---------------------------------------------------------------------------

def _derive_satisfying_value(constraint: Constraint) -> Any:
    """
    Picks a value for a SIBLING parameter that plausibly satisfies its own
    constraints, so testing one variable's boundary doesn't get
    short-circuited by an unrelated parameter failing its own check.

    Heuristic (documented tradeoff, not exhaustive):
      1. Use the declared parameter default, if any.
      2. If it's a len()-based constraint, build a string whose length
         satisfies all length boundaries.
      3. Otherwise derive from the first numeric boundary:
         >= -> that value | > -> value+1 | <= -> that value | < -> value-1
         == -> that value
      4. Otherwise use the first "== <literal>" boundary if one exists
         (e.g. user_type == "premium").
      5. Otherwise fall back by annotation: int/float -> 0, str -> "",
         bool -> True, else None.
    """
    if constraint.param_default is not None:
        return constraint.param_default

    if constraint.accessor == "len":
        length = 3
        for b in constraint.sorted_numeric_boundaries:
            if b.operator == ">=":
                length = max(length, int(b.value))
            elif b.operator == ">":
                length = max(length, int(b.value) + 1)
            elif b.operator == "<=":
                length = min(length, int(b.value))
            elif b.operator == "<":
                length = min(length, int(b.value) - 1)
        return "a" * max(length, 0)

    numeric = constraint.sorted_numeric_boundaries
    if numeric:
        b = numeric[0]
        if b.operator == ">=":
            return b.value
        if b.operator == ">":
            return b.value + 1
        if b.operator == "<=":
            return b.value
        if b.operator == "<":
            return b.value - 1
        if b.operator == "==":
            return b.value

    for b in constraint.boundaries:
        if b.operator == "==" and b.value is not None:
            return b.value

    ann = (constraint.param_annotation or "").lower()
    if "int" in ann or "float" in ann:
        return 0
    if "str" in ann:
        return ""
    if "bool" in ann:
        return True
    return None


def _build_default_args(parsed: ParsedFunction, constraints: List[Constraint]) -> Dict[str, Any]:
    """One satisfying value per parameter -- the starting point before a
    given TestCase overrides the ONE variable it's actually testing."""
    # last constraint wins if a variable has both a "direct" and a "len"
    # constraint (rare) -- documented limitation, not disambiguated further.
    constraints_by_var = {c.variable: c for c in constraints}

    defaults: Dict[str, Any] = {}
    for param in parsed.parameters:
        constraint = constraints_by_var.get(param.name)
        if constraint is not None:
            defaults[param.name] = _derive_satisfying_value(constraint)
        elif param.default is not None:
            defaults[param.name] = param.default
        else:
            defaults[param.name] = None
    return defaults


# ---------------------------------------------------------------------------
# Running with a timeout
# ---------------------------------------------------------------------------

def _run_with_timeout(func, kwargs: Dict[str, Any], timeout: float) -> dict:
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(lambda: func(**kwargs))
        try:
            return {"status": "success", "return_value": future.result(timeout=timeout)}
        except concurrent.futures.TimeoutError:
            return {"status": "timeout", "return_value": None}
        except Exception as e:
            return {
                "status": "raises",
                "return_value": None,
                "exception_type": type(e).__name__,
                "exception_message": str(e),
            }


# ---------------------------------------------------------------------------
# Orchestration entry point -- this is what main.py calls
# ---------------------------------------------------------------------------

def execute_test_cases(
    parsed: ParsedFunction,
    constraints: List[Constraint],
    test_cases: List[TestCase],
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> List[TestCase]:
    """
    Runs the real function against every TestCase's input (siblings held
    at satisfying defaults) and fills in each TestCase's execution_*
    fields IN PLACE. Never raises out of this function -- if the function
    itself can't even be compiled, every case is marked
    execution_status="error" with the compile error, rather than taking
    down the whole /analyze request.
    """
    try:
        func = _compile_function(parsed)
    except Exception as e:
        for tc in test_cases:
            tc.execution_status = "error"
            tc.exception_type = type(e).__name__
            tc.exception_message = f"Could not compile function: {e}"
        return test_cases

    base_args = _build_default_args(parsed, constraints)

    for tc in test_cases:
        kwargs = dict(base_args)
        kwargs[tc.variable] = tc.value
        result = _run_with_timeout(func, kwargs, timeout)

        tc.execution_status = result["status"]
        tc.actual_output = result.get("return_value")
        tc.exception_type = result.get("exception_type")
        tc.exception_message = result.get("exception_message")

    return test_cases
