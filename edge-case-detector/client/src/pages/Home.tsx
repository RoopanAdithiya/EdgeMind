/*
 * Home — main page of the AI Edge Case Detector
 * Design: Laboratory Terminal
 * Split-panel layout: code editor (left) | results (right)
 */
import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import CodeEditor from "@/components/CodeEditor";
import ResultsPanel from "@/components/ResultsPanel";
import LoadingDots from "@/components/LoadingDots";
import { checkHealth, analyzeCode } from "@/lib/api";
import type { AnalyzeResponse } from "@/lib/types";
import { toast } from "sonner";

export default function Home() {
  const [code, setCode] = useState("");
  const [results, setResults] = useState<AnalyzeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<"checking" | "connected" | "disconnected">("checking");

  // Check API health on mount
  useEffect(() => {
    let cancelled = false;

    async function check() {
      const status = await checkHealth();
      if (!cancelled) {
        setApiStatus(status ? "connected" : "disconnected");
      }
    }

    check();

    // Poll every 10s
    const interval = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await analyzeCode(code);

      if ("detail" in result) {
        setError(result.detail);
        toast.error(result.detail);
        return;
      }

      setResults(result);
      toast.success(`Found ${result.functions.length} function(s), ${result.functions.reduce((s, f) => s + f.test_cases.length, 0)} test cases`);
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Failed to connect to the analysis server. Is it running at http://localhost:8000?";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  const handleClear = useCallback(() => {
    setCode("");
    setResults(null);
    setError(null);
  }, []);

  const handleExportJson = useCallback(() => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "edge-cases.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to edge-cases.json");
  }, [results]);

  // Load example code
  const loadExample = useCallback(() => {
    setCode(`def isEligible(age):
    if age >= 18:
        return True
    return False

def calculateDiscount(price, quantity):
    total = price * quantity
    if total > 100:
        return total * 0.9
    return total

def validatePassword(password):
    if len(password) < 8:
        return False
    if len(password) > 128:
        return False
    return True`);
    setResults(null);
    setError(null);
    toast.info("Loaded example code — hit Run Analysis to test");
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Search className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">
                Edge Case Detector
              </h1>
              <p className="text-[10px] text-muted-foreground font-mono leading-tight">
                boundary test case generator
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadExample}
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent/30"
            >
              Load example
            </button>
          </div>
        </div>
      </header>

      {/* Main content — split panel */}
      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Left panel — Code editor */}
        <div className="lg:w-1/2 h-[50vh] lg:h-[calc(100vh-3.5rem)] border-b lg:border-b-0 lg:border-r border-border">
          <CodeEditor
            code={code}
            setCode={setCode}
            isLoading={isLoading}
            apiStatus={apiStatus}
            error={error}
            onAnalyze={handleAnalyze}
            onClear={handleClear}
            hasResults={results !== null}
          />
        </div>

        {/* Right panel — Results */}
        <div className="lg:w-1/2 h-[50vh] lg:h-[calc(100vh-3.5rem)]">
          {isLoading ? (
            <LoadingDots />
          ) : (
            <ResultsPanel results={results} onExportJson={handleExportJson} />
          )}
        </div>
      </main>
    </div>
  );
}
