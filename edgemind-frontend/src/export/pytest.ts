import type { AnalyzedFunction, TestCase } from "../types";

function formatPyValue(value: TestCase["value"]): string {
  if (value === null) return "None";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function formatExpected(tc: TestCase): string | null {
  if (tc.execution_status === "success") {
    const out = tc.actual_output;
    if (out === null) return "None";
    if (typeof out === "string") return JSON.stringify(out);
    if (typeof out === "number" || typeof out === "boolean") return String(out);
    return null; // unknown/complex shape — don't guess a repr
  }
  return null;
}

/**
 * Generates one parametrized pytest test per varied parameter.
 *
 * Honest limitation: each TestCase varies a single named variable; the
 * concrete values the backend used for sibling parameters during execution
 * aren't part of the API response, so they can't be reconstructed here.
 * Where a function takes more than one parameter, the generated call leaves
 * the other arguments as an explicit TODO rather than inventing values.
 */
export function generatePytest(fn: AnalyzedFunction, moduleName: string): string {
  const { name, parameters } = fn.function;
  const otherParams = parameters.map((p) => p.name);

  const byVariable = new Map<string, TestCase[]>();
  for (const tc of fn.test_cases) {
    const list = byVariable.get(tc.variable) ?? [];
    list.push(tc);
    byVariable.set(tc.variable, list);
  }

  const blocks: string[] = [
    `from ${moduleName} import ${name}`,
    "import pytest",
    ""
  ];

  for (const [variable, cases] of byVariable) {
    const remainingParams = otherParams.filter((p) => p !== variable);
    const paramLines = cases
      .map((tc) => {
        const comment = `  # ${tc.category} (${tc.source}) — ${tc.reason}`;
        return `        ${formatPyValue(tc.value)},${comment}`;
      })
      .join("\n");

    blocks.push(`@pytest.mark.parametrize(\n    "${variable}",\n    [\n${paramLines}\n    ]\n)`);
    blocks.push(`def test_${name}_${variable}(${variable}):`);

    if (remainingParams.length > 0) {
      blocks.push(`    # TODO: this function also takes ${remainingParams.join(", ")} —`);
      blocks.push(`    # fill in values for those before running this test.`);
    }

    const callArgs = [variable, ...remainingParams.map((p) => `${p}=None`)].join(", ");

    const raisesCases = cases.filter((tc) => tc.execution_status === "raises");
    const successCases = cases.filter((tc) => tc.execution_status === "success");

    if (raisesCases.length > 0 && successCases.length === 0) {
      const exceptionTypes = [...new Set(raisesCases.map((tc) => tc.exception_type ?? "Exception"))];
      const exc = exceptionTypes.length === 1 ? exceptionTypes[0] : "Exception";
      blocks.push(`    with pytest.raises(${exc}):`);
      blocks.push(`        ${name}(${callArgs})`);
    } else {
      blocks.push(`    ${name}(${callArgs})`);
      blocks.push(`    # NOTE: expected outputs vary per case (see comments above);`);
      blocks.push(`    # this asserts the call succeeds. Tighten with specific`);
      blocks.push(`    # assertions per value if you need exact-output checks.`);
    }

    blocks.push("");
  }

  return blocks.join("\n");
}

/** All success-status test cases where the exact expected output is a plain
 * JSON-safe scalar get a stricter, individually-asserted test instead of the
 * parametrized skeleton above. Kept separate so the parametrized block above
 * never silently guesses at a repr for complex return values. */
export function generateStrictAssertions(fn: AnalyzedFunction): string {
  const { name, parameters } = fn.function;
  if (parameters.length !== 1) {
    return "# Strict per-value assertions are only generated for single-parameter functions.\n";
  }
  const param = parameters[0].name;
  const lines = [`from function_under_test import ${name}`, ""];

  for (const tc of fn.test_cases) {
    if (tc.execution_status === "success") {
      const expected = formatExpected(tc);
      if (expected === null) continue;
      lines.push(
        `def test_${name}_${param}_${String(tc.value).replace(/[^a-zA-Z0-9]/g, "_")}():`
      );
      lines.push(`    assert ${name}(${formatPyValue(tc.value)}) == ${expected}`);
      lines.push("");
    } else if (tc.execution_status === "raises" && tc.exception_type) {
      lines.push(
        `def test_${name}_${param}_${String(tc.value).replace(/[^a-zA-Z0-9]/g, "_")}_raises():`
      );
      lines.push(`    with pytest.raises(${tc.exception_type}):`);
      lines.push(`        ${name}(${formatPyValue(tc.value)})`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
