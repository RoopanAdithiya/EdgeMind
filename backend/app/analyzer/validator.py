"""
Stage 6 of the EdgeMind pipeline: Validator
Location: app/analyzer/validator.py

Deterministic, rule-based sanity check on AI-generated (source="AI")
TestCases -- catches cases where the AI's OWN CLAIM (its category label)
doesn't hold up against either:
  (a) the value it actually generated (structural check), or
  (b) what the Execution Engine found when it actually ran the function
      with that value (behavioral check).

NOT an LLM call. No new dependency, no added latency, no new 503-prone
failure mode stacked on the one already in ai_reasoner.py. "AI proposes,
deterministic logic verifies" -- a cleaner two-layer story than "AI
proposes, a second AI checks," and free to run.

Boundary Rule cases (source="Boundary Rule") are NOT validated -- they
are deterministic by construction, so there's nothing to catch.

Adds two fields to each TestCase:
  - validated: bool           -- True if every applicable check passed
                                  (always True for Boundary Rule cases)
  - validation_note: str|None -- explanation when validated is False,
                                  else None

Design choice: a failed check does NOT remove the case from the
response. It still appears in test_cases, just flagged -- the goal is
transparency ("here's what the AI proposed, and here's why we're not
fully confident in its own label"), not silent deletion. Flag if you'd
rather failed cases be dropped instead.

Coverage: "Semantically Implausible" has no structural or behavioral
check possible with data we have -- it needs domain judgement (e.g.
"is 'admin' really an implausible user_type?"), not something
verifiable against the value or execution result alone. Categories not
listed in _CHECKS pass through unvalidated (validated=True) rather than
being falsely flagged, in case the case list ever grows before this
file is updated to match.
"""

from __future__ import annotations
import re
from typing import List, Optional

from app.analyzer.boundary_generator import TestCase

EXTREME_NUMERIC_THRESHOLD = 1_000_000
EXTREME_STRING_LENGTH_THRESHOLD = 1_000


def _check_null(tc: TestCase) -> Optional[str]:
    if tc.value is not None:
        return f'Category is "Null" but value is {tc.value!r}, not None.'
    return None


def _check_empty(tc: TestCase) -> Optional[str]:
    if not isinstance(tc.value, str):
        return f'Category is "Empty" but value ({tc.value!r}) is not a string.'
    if tc.value != "":
        return f'Category is "Empty" but value is {tc.value!r}, not an empty string.'
    return None


def _check_negative(tc: TestCase) -> Optional[str]:
    if not isinstance(tc.value, (int, float)) or isinstance(tc.value, bool):
        return f'Category is "Negative" but value ({tc.value!r}) is not numeric.'
    if tc.value >= 0:
        return f'Category is "Negative" but value is {tc.value!r}, not less than 0.'
    return None


def _check_unicode_special(tc: TestCase) -> Optional[str]:
    if not isinstance(tc.value, str):
        return f'Category is "Unicode/Special Characters" but value ({tc.value!r}) is not a string.'
    has_non_ascii = any(not ch.isascii() for ch in tc.value)
    has_special = bool(re.search(r"[^a-zA-Z0-9\s]", tc.value))
    if not (has_non_ascii or has_special):
        return (
            f'Category is "Unicode/Special Characters" but {tc.value!r} looks '
            f"like plain ASCII alphanumeric text."
        )
    return None


def _check_extreme_value(tc: TestCase) -> Optional[str]:
    if isinstance(tc.value, (int, float)) and not isinstance(tc.value, bool):
        if abs(tc.value) < EXTREME_NUMERIC_THRESHOLD:
            return (
                f'Category is "Extreme Value" but {tc.value!r} isn\'t unusually '
                f"large/small (threshold: {EXTREME_NUMERIC_THRESHOLD})."
            )
        return None
    if isinstance(tc.value, str):
        if len(tc.value) < EXTREME_STRING_LENGTH_THRESHOLD:
            return (
                f'Category is "Extreme Value" but the string is only '
                f"{len(tc.value)} chars (threshold: {EXTREME_STRING_LENGTH_THRESHOLD})."
            )
        return None
    return f'Category is "Extreme Value" but value ({tc.value!r}) is neither a large number nor a long string.'


def _check_invalid_type(tc: TestCase) -> Optional[str]:
    # Behavioral check: the AI's premise is "this input is the wrong type
    # for this function." If the Execution Engine ran it and the function
    # returned normally anyway, that premise wasn't confirmed.
    if tc.execution_status == "success":
        return (
            'Category is "Invalid Type" but execution_status is "success" '
            f"(returned {tc.actual_output!r}) -- the function handled this "
            "input without erroring, so the \"invalid type\" premise wasn't confirmed."
        )
    return None


_CHECKS = {
    "Null": _check_null,
    "Empty": _check_empty,
    "Negative": _check_negative,
    "Unicode/Special Characters": _check_unicode_special,
    "Extreme Value": _check_extreme_value,
    "Invalid Type": _check_invalid_type,
}

# No reliable structural or behavioral check possible -- needs domain
# judgement, not something verifiable against value/execution alone.
_UNVERIFIABLE_CATEGORIES = {"Semantically Implausible"}


def validate_test_case(tc: TestCase) -> None:
    """Fills in tc.validated / tc.validation_note IN PLACE."""
    if tc.source != "AI":
        tc.validated = True
        tc.validation_note = None
        return

    if tc.category in _UNVERIFIABLE_CATEGORIES:
        tc.validated = True
        tc.validation_note = "Not structurally checkable -- category depends on domain judgement."
        return

    check = _CHECKS.get(tc.category)
    if check is None:
        tc.validated = True
        tc.validation_note = None
        return

    note = check(tc)
    tc.validated = note is None
    tc.validation_note = note


def validate_test_cases(test_cases: List[TestCase]) -> List[TestCase]:
    """Runs validate_test_case over every case IN PLACE. Never raises --
    a bug in one check shouldn't take down the whole /analyze request."""
    for tc in test_cases:
        try:
            validate_test_case(tc)
        except Exception as e:
            tc.validated = True
            tc.validation_note = f"Validator internal error, skipped: {e}"
    return test_cases
