"""
Stage 3 of the EdgeMind pipeline: Boundary Generator

Takes Constraint objects (stage 2) and deterministically generates
boundary test values -- N-1, N, N+1 style -- with NO AI involved.

This is the "reliable core" of EdgeMind: even if the AI stage (stage 4)
were removed entirely, this stage alone already produces meaningful,
explainable edge cases. The AI's job later is only to ADD cases this
stage can't reach (null handling heuristics, wrong types, unicode,
huge numbers) -- never to replace this deterministic layer.

Every generated case is tagged source="Boundary Rule" so the UI/exporter
can always show the user "this came from deterministic logic, not AI".

TestCase also carries:
  - execution_* fields (stage 5, Execution Engine): what actually
    happened when the function was run with this input.
  - validated / validation_note (stage 6, Validator): whether the AI's
    own category claim held up under a rule-based check. Always
    validated=True for Boundary Rule cases (deterministic, nothing to
    check).
Both default to their "not yet run" state until their stage fills them in.
"""

from dataclasses import dataclass
from typing import Any, Optional

from app.analyzer.constraint_extractor import Constraint


@dataclass
class TestCase:
    variable: str
    value: Any
    category: str       # e.g. "Boundary Below", "Boundary", "Boundary Above"
    reason: str          # human-readable explanation
    source: str = "Boundary Rule"  # "Boundary Rule" or "AI" (set later by AI stage)

    # --- filled in later by the Execution Engine (stage 5) ---
    execution_status: str = "not_run"   # "not_run" | "success" | "raises" | "timeout" | "error"
    actual_output: Any = None
    exception_type: Optional[str] = None
    exception_message: Optional[str] = None

    # --- filled in later by the Validator (stage 6) ---
    validated: bool = True
    validation_note: Optional[str] = None


def _length_input(length: int, fill_char: str = "a") -> str:
    """Build a concrete string of the given length for len()-based constraints."""
    if length <= 0:
        return ""
    return fill_char * length


def _generate_for_numeric_boundary(constraint: Constraint, boundary_value: int, is_length: bool) -> list[TestCase]:
    cases = []
    triples = [
        (boundary_value - 1, "Boundary Below", "one below the boundary"),
        (boundary_value, "Boundary", "exact boundary value"),
        (boundary_value + 1, "Boundary Above", "one above the boundary"),
    ]
    for raw_value, category, phrase in triples:
        if is_length:
            value = _length_input(raw_value)
            reason = (
                f"Input whose length is {raw_value} ({phrase} for "
                f"len({constraint.variable}) constraint at {boundary_value})"
            )
        else:
            value = raw_value
            reason = f"{constraint.variable} = {raw_value} ({phrase} at {boundary_value})"
        cases.append(
            TestCase(
                variable=constraint.variable,
                value=value,
                category=category,
                reason=reason,
            )
        )
    return cases


def generate_boundary_cases(constraint: Constraint) -> list[TestCase]:
    """
    Generate deterministic boundary cases for a single constraint.
    Handles numeric direct boundaries and len()-based boundaries.
    Deduplicates identical (value) pairs that can arise from multiple
    boundaries resolving to the same neighboring integers.
    """
    is_length = constraint.accessor == "len"
    cases: list[TestCase] = []
    seen_values = set()

    for boundary in constraint.sorted_numeric_boundaries:
        # Only int boundaries make sense for the -1/+1 pattern (floats
        # don't have a meaningful "adjacent" value in the same way).
        if isinstance(boundary.value, int):
            for case in _generate_for_numeric_boundary(constraint, boundary.value, is_length):
                if case.value not in seen_values:
                    seen_values.add(case.value)
                    cases.append(case)

    # Explicit None / is-None checks -> add a None test case even though
    # it's not a numeric boundary.
    for boundary in constraint.boundaries:
        if boundary.value is None and boundary.operator in ("is", "is not", "==", "!="):
            if None not in seen_values:
                seen_values.add(None)
                cases.append(
                    TestCase(
                        variable=constraint.variable,
                        value=None,
                        category="Null",
                        reason=f"Explicit null check found on {constraint.variable} ({boundary.operator} None)",
                    )
                )

    return cases


def generate_all_boundary_cases(constraints: list[Constraint]) -> dict[str, list[TestCase]]:
    """Run boundary generation across every constraint, keyed by variable name."""
    result: dict[str, list[TestCase]] = {}
    for constraint in constraints:
        result[constraint.variable] = generate_boundary_cases(constraint)
    return result


def test_case_to_dict(tc: TestCase) -> dict:
    return {
        "variable": tc.variable,
        "value": tc.value,
        "category": tc.category,
        "reason": tc.reason,
        "source": tc.source,
        "execution_status": tc.execution_status,
        "actual_output": tc.actual_output,
        "exception_type": tc.exception_type,
        "exception_message": tc.exception_message,
        "validated": tc.validated,
        "validation_note": tc.validation_note,
    }
