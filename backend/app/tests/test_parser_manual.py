"""
Manual smoke test: run several real-ish functions through the parser
and print the extracted structure, to verify it generalizes beyond the
one toy example (isEligible) from the project brief.
"""
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.analyzer.parser import parse_function, parsed_function_to_dict, ParseError

EXAMPLES = {
    "simple_boundary": """
def isEligible(age):
    if age >= 18:
        return True
    return False
""",
    "string_length": """
def is_valid_password(password):
    if len(password) >= 8:
        return True
    return False
""",
    "multiple_conditions": """
def classify_grade(score):
    if score >= 90:
        return "A"
    elif score >= 75:
        return "B"
    elif score >= 50:
        return "C"
    else:
        return "F"
""",
    "chained_comparison": """
def in_range(x):
    if 0 <= x < 10:
        return True
    return False
""",
    "loop_and_raise": """
def average(numbers):
    if not numbers:
        raise ValueError("empty list")
    total = 0
    for n in numbers:
        total += n
    return total / len(numbers)
""",
    "none_default": """
def greet(name=None):
    if name is None:
        return "Hello, stranger"
    return f"Hello, {name}"
""",
}

MULTI_FUNCTION_FILE = """
def isEligible(age):
    if age >= 18:
        return True
    return False

def is_valid_password(password):
    if len(password) >= 8:
        return True
    return False

def get_shipping_cost(weight):
    if weight <= 1:
        return 5
    elif weight <= 5:
        return 10
    return 25
"""

if __name__ == "__main__":
    for label, code in EXAMPLES.items():
        print(f"\n{'=' * 60}\n{label}\n{'=' * 60}")
        try:
            parsed = parse_function(code)
            print(json.dumps(parsed_function_to_dict(parsed), indent=2, default=str))
        except ParseError as e:
            print(f"ParseError: {e}")

    from app.analyzer.parser import parse_all_functions

    print(f"\n{'=' * 60}\nmulti_function_file (whole-file mode)\n{'=' * 60}")
    funcs = parse_all_functions(MULTI_FUNCTION_FILE)
    print(f"Found {len(funcs)} top-level functions: {[f.name for f in funcs]}")
