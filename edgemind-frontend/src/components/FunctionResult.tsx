import type { AnalyzedFunction } from "../types";
import BoundaryRuler from "./BoundaryRuler";
import TestCaseTable from "./TestCaseTable";
import ExportButton from "./ExportButton";

export default function FunctionResult({ fn }: { fn: AnalyzedFunction }) {
  const { function: parsed, constraints, test_cases } = fn;
  const signature = `${parsed.name}(${parsed.parameters.map((p) => p.name).join(", ")})`;

  const testCasesByVariable = (variable: string) =>
    test_cases.filter((tc) => tc.variable === variable);

  return (
    <section className="function-result">
      <h2 className="mono function-result__signature">{signature}</h2>

      {constraints.length > 0 && (
        <div className="function-result__rulers">
          {constraints.map((c, i) => (
            <BoundaryRuler key={i} constraint={c} testCases={testCasesByVariable(c.variable)} />
          ))}
        </div>
      )}

      <TestCaseTable testCases={test_cases} />

      {/* moduleName is a placeholder — we have no way to know what file the
          user will save the pasted function as. They'll need to adjust the
          import line in the exported test file. */}
      <ExportButton fn={fn} moduleName="function_under_test" />
    </section>
  );
}
