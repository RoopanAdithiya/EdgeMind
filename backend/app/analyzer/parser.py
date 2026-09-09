"""
Stage 1 of the EdgeMind pipeline: Parser

Takes raw Python source code (a single function) and extracts its
structure using the built-in `ast` module:
    - function name
    - parameters (with defaults/annotations if present)
    - conditions (comparisons found in if/while statements)
    - return values

This output is intentionally "dumb" and mechanical -- no interpretation
or judgement happens here. That's the job of the next stage
(constraint_extractor.py). Keeping this stage dumb is what makes the
whole pipeline reliable: if something breaks, you know which stage to
blame.
"""

import ast
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class Parameter:
    name: str
    annotation: Optional[str] = None
    default: Optional[Any] = None


@dataclass
class Condition:
    # Raw text reconstruction of the comparison, e.g. "age >= 18"
    source: str
    # Variable name the constraint is really about, e.g. "age" (None if we
    # can't confidently identify one)
    variable: Optional[str]
    # Comparison operator as a string, e.g. ">=", "==", "!=", "<", ">", "<=", "in", "is"
    operator: str
    # Right-hand side value, if it's a literal we can extract (else raw source text)
    value: Any
    # Line number in source, for debugging/UI display
    lineno: int
    # What kind of access the variable goes through:
    # "direct" (age >= 18), "len" (len(password) >= 8), or "unknown"
    accessor: str = "direct"


@dataclass
class ReturnValue:
    source: str
    lineno: int


@dataclass
class ParsedFunction:
    name: str
    parameters: list[Parameter] = field(default_factory=list)
    conditions: list[Condition] = field(default_factory=list)
    returns: list[ReturnValue] = field(default_factory=list)
    has_loops: bool = False
    raises: list[str] = field(default_factory=list)


class ParseError(Exception):
    """Raised when the input isn't valid, parseable Python, or contains no function."""


_OP_MAP = {
    ast.Gt: ">",
    ast.Lt: "<",
    ast.GtE: ">=",
    ast.LtE: "<=",
    ast.Eq: "==",
    ast.NotEq: "!=",
    ast.In: "in",
    ast.NotIn: "not in",
    ast.Is: "is",
    ast.IsNot: "is not",
}


def _unparse(node: ast.AST) -> str:
    try:
        return ast.unparse(node)
    except Exception:
        return "<unparseable>"


def _extract_literal(node: ast.AST) -> Any:
    """Best-effort extraction of a literal value from an AST node."""
    try:
        return ast.literal_eval(node)
    except Exception:
        return _unparse(node)


_FLIP_OP = {
    ">": "<",
    "<": ">",
    ">=": "<=",
    "<=": ">=",
    "==": "==",
    "!=": "!=",
    "is": "is",
    "is not": "is not",
}


def _describe_operand(node: ast.AST) -> tuple[Optional[str], str]:
    """
    Given one side of a comparison, try to identify (variable_name, accessor).
    accessor is "direct" for a bare Name, "len" for len(name), else "unknown".
    """
    if isinstance(node, ast.Name):
        return node.id, "direct"
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "len"
        and len(node.args) == 1
        and isinstance(node.args[0], ast.Name)
    ):
        return node.args[0].id, "len"
    return None, "unknown"


def _extract_conditions_from_test(test: ast.AST) -> list[Condition]:
    """
    Walks a boolean test expression (the condition of an if/while) and
    pulls out individual comparisons, even if joined by `and`/`or`.
    """
    conditions: list[Condition] = []

    def visit(node: ast.AST):
        if isinstance(node, ast.BoolOp):
            for value in node.values:
                visit(value)
        elif isinstance(node, ast.Compare):
            # Handle chained comparisons like `0 <= x < 10` by breaking
            # them into pairwise comparisons.
            left = node.left
            for op, comparator in zip(node.ops, node.comparators):
                op_str = _OP_MAP.get(type(op), _unparse(op))

                left_var, left_accessor = _describe_operand(left)
                right_var, right_accessor = _describe_operand(comparator)

                if left_var is not None:
                    # Normal case: variable on the left, e.g. age >= 18
                    variable, accessor = left_var, left_accessor
                    value = _extract_literal(comparator)
                elif right_var is not None:
                    # Variable on the right, e.g. 18 <= age -- flip the
                    # operator so downstream stages can treat it uniformly
                    # as "variable OP value".
                    variable, accessor = right_var, right_accessor
                    op_str = _FLIP_OP.get(op_str, op_str)
                    value = _extract_literal(left)
                else:
                    variable, accessor = None, "unknown"
                    value = _extract_literal(comparator)

                conditions.append(
                    Condition(
                        source=_unparse(node),
                        variable=variable,
                        operator=op_str,
                        value=value,
                        lineno=getattr(node, "lineno", -1),
                        accessor=accessor,
                    )
                )
                left = comparator
        elif isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            visit(node.operand)
        # else: skip things like bare function calls (e.g. `if is_valid(x):`)
        # -- we can't extract a variable/operator/value from those safely.

    visit(test)
    return conditions


def _build_parsed_function(func_node) -> ParsedFunction:
    """Extract structure from a single ast.FunctionDef/AsyncFunctionDef node."""
    parsed = ParsedFunction(name=func_node.name)

    # --- Parameters ---
    args = func_node.args
    defaults_offset = len(args.args) - len(args.defaults)
    for i, arg in enumerate(args.args):
        default_val = None
        default_index = i - defaults_offset
        if default_index >= 0:
            default_val = _extract_literal(args.defaults[default_index])
        annotation = _unparse(arg.annotation) if arg.annotation else None
        parsed.parameters.append(
            Parameter(name=arg.arg, annotation=annotation, default=default_val)
        )

    # --- Walk the function body for conditions, returns, loops, raises ---
    for node in ast.walk(func_node):
        if isinstance(node, (ast.If, ast.While)):
            parsed.conditions.extend(_extract_conditions_from_test(node.test))
        elif isinstance(node, (ast.For,)):
            parsed.has_loops = True
        elif isinstance(node, ast.While):
            parsed.has_loops = True
        elif isinstance(node, ast.Return):
            value_str = _unparse(node.value) if node.value is not None else "None"
            parsed.returns.append(
                ReturnValue(source=value_str, lineno=getattr(node, "lineno", -1))
            )
        elif isinstance(node, ast.Raise):
            if node.exc is not None:
                parsed.raises.append(_unparse(node.exc))

    return parsed


def parse_all_functions(source_code: str) -> list[ParsedFunction]:
    """
    Parse a source code string (a whole file, or any number of pasted
    functions) and return a ParsedFunction for every TOP-LEVEL function
    definition found, in source order.

    Nested/inner functions and methods on classes are intentionally
    skipped for now -- top-level functions are the realistic unit test
    target for this tool. Class methods are a natural next extension.
    """
    source_code = source_code.strip()
    if not source_code:
        raise ParseError("No code provided.")

    try:
        tree = ast.parse(source_code)
    except SyntaxError as e:
        raise ParseError(f"Invalid Python syntax: {e}") from e

    func_nodes = [
        node for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]

    if not func_nodes:
        raise ParseError("No top-level function definitions found in the provided code.")

    return [_build_parsed_function(node) for node in func_nodes]


def parse_function(source_code: str) -> ParsedFunction:
    """
    Parse a source code string and return a ParsedFunction for the FIRST
    top-level function found. Kept for backward compatibility / simple
    single-function use cases -- prefer parse_all_functions for anything
    that might contain more than one function (e.g. an uploaded file).
    """
    return parse_all_functions(source_code)[0]


def parsed_function_to_dict(parsed: ParsedFunction) -> dict:
    """Convert ParsedFunction into a plain dict, ready for JSON / next pipeline stage."""
    return {
        "name": parsed.name,
        "parameters": [
            {"name": p.name, "annotation": p.annotation, "default": p.default}
            for p in parsed.parameters
        ],
        "conditions": [
            {
                "source": c.source,
                "variable": c.variable,
                "operator": c.operator,
                "value": c.value,
                "lineno": c.lineno,
                "accessor": c.accessor,
            }
            for c in parsed.conditions
        ],
        "returns": [{"source": r.source, "lineno": r.lineno} for r in parsed.returns],
        "has_loops": parsed.has_loops,
        "raises": parsed.raises,
    }
