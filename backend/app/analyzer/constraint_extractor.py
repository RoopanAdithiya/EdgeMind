"""
Stage 2 of the EdgeMind pipeline: Constraint Extractor

Takes the raw list of Condition objects from the parser (stage 1) and
groups/normalizes them into clean per-variable Constraint objects.

Why this stage exists separately from the parser:
    The parser's job is purely mechanical (walk the AST, find comparisons).
    This stage adds a first bit of *interpretation*: e.g. merging three
    separate conditions on `score` (>=90, >=75, >=50) into one picture of
    "score has boundaries at 50, 75, 90", or recognizing that a `len()`
    accessor means the boundary applies to length, not the raw value.

This stage is still deterministic / rule-based -- no AI involved yet.
"""

from dataclasses import dataclass, field
from typing import Any, Optional

from app.analyzer.parser import ParsedFunction, Condition


@dataclass
class Boundary:
    operator: str  # ">=", ">", "<=", "<", "==", "!=", "is", "is not"
    value: Any
    lineno: int


@dataclass
class Constraint:
    variable: str
    accessor: str  # "direct" or "len"
    param_annotation: Optional[str] = None
    param_default: Optional[Any] = None
    boundaries: list[Boundary] = field(default_factory=list)

    @property
    def sorted_numeric_boundaries(self) -> list[Boundary]:
        """Boundaries sorted by value, skipping non-numeric ones (e.g. None, strings)."""
        numeric = [b for b in self.boundaries if isinstance(b.value, (int, float)) and not isinstance(b.value, bool)]
        return sorted(numeric, key=lambda b: b.value)


def extract_constraints(parsed: ParsedFunction) -> list[Constraint]:
    """
    Group the parser's flat Condition list into one Constraint per
    (variable, accessor) pair, attaching parameter metadata (annotation,
    default) where available.
    """
    param_lookup = {p.name: p for p in parsed.parameters}

    constraints_by_key: dict[tuple[str, str], Constraint] = {}

    for cond in parsed.conditions:
        if cond.variable is None:
            continue  # couldn't confidently identify a variable -- skip

        key = (cond.variable, cond.accessor)
        if key not in constraints_by_key:
            param = param_lookup.get(cond.variable)
            constraints_by_key[key] = Constraint(
                variable=cond.variable,
                accessor=cond.accessor,
                param_annotation=param.annotation if param else None,
                param_default=param.default if param else None,
            )

        constraints_by_key[key].boundaries.append(
            Boundary(operator=cond.operator, value=cond.value, lineno=cond.lineno)
        )

    # Also include parameters that appear in the signature but have NO
    # conditions on them at all (e.g. a function that just uses a param
    # in an expression, no if-check) -- still worth flagging as something
    # to test (null / wrong type at minimum), even with zero boundaries.
    for param in parsed.parameters:
        key_direct = (param.name, "direct")
        already_covered = any(k[0] == param.name for k in constraints_by_key)
        if not already_covered:
            constraints_by_key[key_direct] = Constraint(
                variable=param.name,
                accessor="direct",
                param_annotation=param.annotation,
                param_default=param.default,
            )

    return list(constraints_by_key.values())


def constraint_to_dict(c: Constraint) -> dict:
    return {
        "variable": c.variable,
        "accessor": c.accessor,
        "param_annotation": c.param_annotation,
        "param_default": c.param_default,
        "boundaries": [
            {"operator": b.operator, "value": b.value, "lineno": b.lineno}
            for b in c.boundaries
        ],
    }
