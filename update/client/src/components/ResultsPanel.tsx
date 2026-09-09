/*
 * ResultsPanel — right-side panel showing analysis results
 * Design: Laboratory Terminal
 * Displays function cards, summary stats, and export button
 */
import { Button } from "@/components/ui/button";
import {
  FileJson,
  ChevronDown,
  ChevronUp,
  FlaskConical,
} from "lucide-react";
import { useState } from "react";
import type { AnalyzeResponse } from "@/lib/types";
import FunctionCard from "./FunctionCard";

interface ResultsPanelProps {
  results: AnalyzeResponse | null;
  onExportJson: () => void;
}

export default function ResultsPanel({ results, onExportJson }: ResultsPanelProps) {
  const [expandedAll, setExpandedAll] = useState(true);

  if (!results || results.functions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <FlaskConical className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-sm font-medium text-muted-foreground mb-1">
          No analysis yet
        </h3>
        <p className="text-xs text-muted-foreground/60 max-w-[200px]">
          Paste Python code in the editor and click "Run Analysis" to generate boundary test cases
        </p>
      </div>
    );
  }

  const totalCases = results.functions.reduce(
    (sum, fn) => sum + fn.test_cases.length,
    0
  );

  return (
    <div className="flex flex-col h-full">
      {/* Results header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-foreground font-medium">
              {results.functions.length} function{results.functions.length !== 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs font-mono text-muted-foreground">
              {totalCases} test cases
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-mono gap-1.5 px-2"
            onClick={() => setExpandedAll(!expandedAll)}
          >
            {expandedAll ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {expandedAll ? "Collapse" : "Expand"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs font-mono gap-1.5 px-2"
            onClick={onExportJson}
          >
            <FileJson className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Results body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {results.functions.map((fnResult, i) => (
          <FunctionCard key={fnResult.function.name + i} result={fnResult} index={i} />
        ))}
      </div>
    </div>
  );
}
