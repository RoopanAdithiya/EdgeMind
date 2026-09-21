import type { TestCase } from "../types";

function formatValue(v: TestCase["value"]): string {
  if (v === null) return "None";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

function ExecutionCell({ tc }: { tc: TestCase }) {
  switch (tc.execution_status) {
    case "success":
      return (
        <span className="exec exec--success">
          → {tc.actual_output === null ? "None" : JSON.stringify(tc.actual_output)}
        </span>
      );
    case "raises":
      return (
        <span className="exec exec--raises">
          raises {tc.exception_type}
          {tc.exception_message ? <span className="exec__detail mono">{tc.exception_message}</span> : null}
        </span>
      );
    case "timeout":
      return <span className="exec exec--error">timed out</span>;
    case "error":
      return <span className="exec exec--error">could not run</span>;
    default:
      return <span className="exec exec--muted">not run</span>;
  }
}

export default function TestCaseTable({ testCases }: { testCases: TestCase[] }) {
  return (
    <table className="test-table">
      <thead>
        <tr>
          <th>Value</th>
          <th>Category</th>
          <th>Source</th>
          <th>Reason</th>
          <th>Execution</th>
        </tr>
      </thead>
      <tbody>
        {testCases.map((tc, i) => (
          <tr key={i}>
            <td className="mono">
              {tc.variable} = {formatValue(tc.value)}
            </td>
            <td>{tc.category}</td>
            <td>
              <span className={`chip ${tc.source === "AI" ? "chip--ai" : "chip--rule"}`}>{tc.source}</span>
            </td>
            <td className="test-table__reason">{tc.reason}</td>
            <td>
              <ExecutionCell tc={tc} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
