import type { AnalyzedFunction } from "../types";
import { generatePytest, generateStrictAssertions } from "../export/pytest";

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/x-python" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  fn: AnalyzedFunction;
  moduleName: string;
}

export default function ExportButton({ fn, moduleName }: Props) {
  const name = fn.function.name;
  const isSingleParam = fn.function.parameters.length === 1;

  return (
    <div className="export-row">
      <button
        className="btn btn--ghost"
        onClick={() => download(`test_${name}.py`, generatePytest(fn, moduleName))}
      >
        Export pytest
      </button>
      {isSingleParam && (
        <button
          className="btn btn--ghost"
          onClick={() => download(`test_${name}_strict.py`, generateStrictAssertions(fn))}
        >
          Export pytest (strict asserts)
        </button>
      )}
    </div>
  );
}
