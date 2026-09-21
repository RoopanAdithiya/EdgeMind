import { useState } from "react";
import CodeInput from "./components/CodeInput";
import FunctionResult from "./components/FunctionResult";
import { analyzeCode, AnalyzeError } from "./api";
import type { AnalyzedFunction } from "./types";

export default function App() {
  const [functions, setFunctions] = useState<AnalyzedFunction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze(code: string) {
    setLoading(true);
    setError(null);
    setFunctions(null);
    try {
      const res = await analyzeCode(code, "python");
      setFunctions(res.functions);
    } catch (err) {
      setError(err instanceof AnalyzeError ? err.message : "Could not reach the EdgeMind backend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <CodeInput onAnalyze={handleAnalyze} loading={loading} />

      {error && <p className="error-banner">{error}</p>}

      {functions && functions.length === 0 && (
        <p className="empty-note">No top-level function definitions were found.</p>
      )}

      {functions?.map((fn, i) => {
        const hasAiCases = fn.test_cases.some((tc) => tc.source === "AI");
        return (
          <div key={i}>
            {!hasAiCases && (
              <p className="soft-note">
                No AI-generated cases came back for this run — showing Boundary Rule cases only.
              </p>
            )}
            <FunctionResult fn={fn} />
          </div>
        );
      })}
    </main>
  );
}
