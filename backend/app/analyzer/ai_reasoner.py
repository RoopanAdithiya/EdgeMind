"""
Stage 4 of the EdgeMind pipeline: AI Reasoner
Location: app/analyzer/ai_reasoner.py

Takes the Constraint objects (stage 2) and the Boundary Rule TestCases
already generated for a function (stage 3), and asks Gemini to propose
ADDITIONAL edge cases the deterministic layer can't derive on its own:
nulls, wrong types, unicode, empty inputs, extreme values, semantically
implausible values. Every case returned here is tagged source="AI".

Reuses your actual Constraint (constraint_extractor.py) and TestCase
(boundary_generator.py) classes directly -- no parallel/incompatible
redefinitions.

Design decisions locked in:
  - Model: Gemini, via `google-genai`, structured output through
    response_schema (not free-text + regex parsing).
  - Reasoner sees ONLY structured Constraint objects + parameter
    name/annotation/default from ParsedFunction. It does NOT see raw
    source, docstrings, or comments.
  - Dedup: prompt-level (model told which variable/value pairs are
    already covered) + post-hoc filtering (dropped if the AI repeats
    a covered pair anyway, or duplicates itself within one response).
  - Graceful degradation: if the Gemini call fails for any reason
    (missing key, network, quota, bad JSON), this stage returns an
    empty list rather than raising -- the deterministic Boundary Rule
    results should never be taken down by an AI-layer failure. Flag if
    you'd rather it surface as a visible error in the UI instead.
"""

from __future__ import annotations
import json
import os
from typing import List

from google import genai

from app.analyzer.parser import ParsedFunction
from app.analyzer.constraint_extractor import Constraint
from app.analyzer.boundary_generator import TestCase


# ---------------------------------------------------------------------------
# Gemini response schema
# ---------------------------------------------------------------------------

AI_CASE_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "cases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "variable": {"type": "string"},
                    "value": {
                        "anyOf": [
                            {"type": "string"},
                            {"type": "number"},
                            {"type": "boolean"},
                            {"type": "null"},
                        ]
                    },
                    "category": {
                        "type": "string",
                        "enum": [
                            "Null",
                            "Invalid Type",
                            "Extreme Value",
                            "Negative",
                            "Empty",
                            "Unicode/Special Characters",
                            "Semantically Implausible",
                        ],
                    },
                    "reason": {"type": "string"},
                },
                "required": ["variable", "value", "category", "reason"],
            },
        }
    },
    "required": ["cases"],
}


# ---------------------------------------------------------------------------
# Prompt construction (built from your ACTUAL Constraint/Boundary shape)
# ---------------------------------------------------------------------------

def _format_parameters(parsed: ParsedFunction) -> str:
    parts = []
    for p in parsed.parameters:
        s = p.name
        if p.annotation:
            s += f": {p.annotation}"
        if p.default is not None:
            s += f" = {p.default!r}"
        parts.append(s)
    return ", ".join(parts) if parts else "(none)"


def _format_constraints(constraints: List[Constraint]) -> str:
    lines = []
    for c in constraints:
        acc_note = " [length-based: constraint applies to len(...), not the raw value]" \
            if c.accessor == "len" else ""
        ann = f", annotated {c.param_annotation}" if c.param_annotation else ""
        default = f", default={c.param_default!r}" if c.param_default is not None else ""

        if c.boundaries:
            boundary_str = "; ".join(f"{b.operator} {b.value!r}" for b in c.boundaries)
            lines.append(f'- "{c.variable}"{acc_note}{ann}{default}: {boundary_str}')
        else:
            # A parameter with no explicit conditions on it at all -- still
            # worth testing for null/wrong-type/extreme at minimum.
            lines.append(
                f'- "{c.variable}"{acc_note}{ann}{default}: no explicit conditions '
                f'found in the code -- still consider null/type/extreme cases'
            )
    return "\n".join(lines) if lines else "(no constraints extracted)"


def _format_existing_cases(existing_cases: List[TestCase]) -> str:
    if not existing_cases:
        return "(none yet)"
    return "\n".join(
        f"- {tc.variable} = {tc.value!r}  ({tc.category})" for tc in existing_cases
    )


def build_reasoner_prompt(
    parsed: ParsedFunction,
    constraints: List[Constraint],
    existing_cases: List[TestCase],
) -> str:
    return f"""You are the AI layer in a two-stage test case generator.
A deterministic rule-based layer has ALREADY produced boundary value test
cases (N-1, N, N+1) for this function. Your job is ONLY to add edge cases
a boundary-value rule cannot derive on its own: nulls, wrong-type inputs,
empty inputs, unicode/special characters, extreme values, and
semantically implausible values. Do not restate ordinary boundary values.

Function: {parsed.name}
Parameters: {_format_parameters(parsed)}

Extracted constraints:
{_format_constraints(constraints)}

Test cases already generated by the deterministic layer (DO NOT repeat
any of these variable/value pairs):
{_format_existing_cases(existing_cases)}

Return additional edge cases as JSON matching the required schema. Each
case must target one of the listed parameters. Prefer 3-6 high-value
cases per function rather than an exhaustive list. If a constraint is
length-based, a None or a wrong-type value (e.g. an int where a string
is expected) is usually more useful than another length boundary.
"""


# ---------------------------------------------------------------------------
# Gemini call
# ---------------------------------------------------------------------------

def _call_gemini(prompt: str, model: str) -> dict:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": AI_CASE_RESPONSE_SCHEMA,
        },
    )
    return json.loads(response.text)


# ---------------------------------------------------------------------------
# Post-hoc dedup
# ---------------------------------------------------------------------------

def _normalize(value) -> tuple:
    """(type_name, value) so e.g. False and 0 don't collide."""
    return (type(value).__name__, value)


def _dedupe(ai_cases: List[TestCase], existing_cases: List[TestCase]) -> List[TestCase]:
    covered = {(tc.variable, _normalize(tc.value)) for tc in existing_cases}
    deduped = []
    for tc in ai_cases:
        key = (tc.variable, _normalize(tc.value))
        if key not in covered:
            deduped.append(tc)
            covered.add(key)
    return deduped


# ---------------------------------------------------------------------------
# Orchestration entry point -- this is what main.py calls
# ---------------------------------------------------------------------------

def generate_ai_cases(
    parsed: ParsedFunction,
    constraints: List[Constraint],
    boundary_cases: List[TestCase],
    model: str = "gemini-2.5-flash",
) -> List[TestCase]:
    """
    Returns AI-generated TestCases (source="AI"), deduped against
    boundary_cases. On ANY failure (missing API key, network, bad JSON),
    returns [] so the deterministic results still come back successfully.
    """
    try:
        prompt = build_reasoner_prompt(parsed, constraints, boundary_cases)
        raw = _call_gemini(prompt, model=model)
    except Exception as e:
        # Swallowed deliberately -- see module docstring "graceful degradation".
        print(f"[ai_reasoner] Gemini call failed, skipping AI cases: {e}")
        return []

    try:
        parsed_cases = [
            TestCase(
                variable=c["variable"],
                value=c["value"],
                category=c["category"],
                reason=c["reason"],
                source="AI",
            )
            for c in raw.get("cases", [])
        ]
    except (KeyError, TypeError) as e:
        print(f"[ai_reasoner] Malformed Gemini response, skipping AI cases: {e}")
        return []

    return _dedupe(parsed_cases, boundary_cases)
