/*
 * FunctionCard — displays analysis results for a single function
 * Design: Laboratory Terminal
 * Shows: function name, parameters, conditions, constraints, and test cases
 */
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FunctionSquare,
  Zap,
} from "lucide-react";
import type { FunctionResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FunctionCardProps {
  result: FunctionResult;
  index: number;
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "Boundary Below":
      return "bg-[oklch(0.72_0.18_80_/_15%)] text-[oklch(0.78_0.16_80)] border-[oklch(0.72_0.18_80_/_30%)]";
    case "Boundary":
      return "bg-[oklch(0.70_0.15_145_/_15%)] text-[oklch(0.76_0.15_145)] border-[oklch(0.70_0.15_145_/_30%)]";
    case "Boundary Above":
      return "bg-[oklch(0.68_0.12_250_/_15%)] text-[oklch(0.74_0.12_250)] border-[oklch(0.68_0.12_250_/_30%)]";
    case "Null":
      return "bg-[oklch(0.65_0.20_25_/_15%)] text-[oklch(0.72_0.18_25)] border-[oklch(0.65_0.20_25_/_30%)]";
    default:
      return "bg-muted/30 text-muted-foreground border-border";
  }
}

function getCategoryBorder(category: string): string {
  switch (category) {
    case "Boundary Below":
      return "border-l-[oklch(0.72_0.18_80)]";
    case "Boundary":
      return "border-l-[oklch(0.70_0.15_145)]";
    case "Boundary Above":
      return "border-l-[oklch(0.68_0.12_250)]";
    case "Null":
      return "border-l-[oklch(0.65_0.20_25)]";
    default:
      return "border-l-border";
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

export default function FunctionCard({ result, index }: FunctionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showConstraints, setShowConstraints] = useState(true);
  const fn = result.function;

  return (
    <div
      className="border border-border bg-card rounded-lg overflow-hidden transition-all duration-200"
      style={{
        animationDelay: `${index * 40}ms`,
        animation: `fadeInUp 0.3s ease-out ${index * 40}ms both`,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
      >
        <div className="text-muted-foreground transition-transform duration-200"
          style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          <ChevronDown className="w-4 h-4" />
        </div>
        <FunctionSquare className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-foreground">
              {fn.name}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              ({fn.parameters.length} param{fn.parameters.length !== 1 ? "s" : ""})
            </span>
            {fn.has_loops && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono">
                <Zap className="w-2.5 h-2.5 mr-1" />
                loops
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fn.raises.length > 0 && (
            <span className="text-xs text-[oklch(0.65_0.20_25)] font-mono">
              {fn.raises.length} raise{fn.raises.length > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs text-muted-foreground font-mono">
            {result.test_cases.length} cases
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50">
          {/* Parameters */}
          {fn.parameters.length > 0 && (
            <div className="pt-3">
              <div className="text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wider">
                Parameters
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fn.parameters.map((param) => (
                  <span
                    key={param.name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/50 border border-border/50"
                  >
                    <span className="font-mono text-xs text-foreground">{param.name}</span>
                    {param.annotation && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        : {param.annotation}
                      </span>
                    )}
                    {param.default !== null && (
                      <span className="font-mono text-[10px] text-primary">
                        = {param.default}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Conditions */}
          {fn.conditions.length > 0 && (
            <div>
              <div className="text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wider">
                Conditions
              </div>
              <div className="space-y-1">
                {fn.conditions.map((cond, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-secondary/30 border border-border/30 font-mono text-xs"
                  >
                    <span className="text-muted-foreground w-8 text-right shrink-0">
                      L{cond.lineno}
                    </span>
                    <span className="text-foreground">{cond.source}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Return statements */}
          {fn.returns.length > 0 && (
            <div>
              <div className="text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wider">
                Returns
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fn.returns.map((ret, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary/30 border border-border/30 font-mono text-xs"
                  >
                    <span className="text-muted-foreground">L{ret.lineno}</span>
                    <span className="text-foreground">{ret.source}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Constraints (collapsible) */}
          {result.constraints.length > 0 && (
            <div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConstraints(!showConstraints);
                }}
                className="flex items-center gap-1.5 mb-1.5"
              >
                {showConstraints ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                )}
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Constraints ({result.constraints.length})
                </span>
              </button>
              {showConstraints && (
                <div className="space-y-1.5">
                  {result.constraints.map((constraint, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-2 rounded bg-secondary/20 border border-border/30"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-primary">
                          {constraint.variable}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">
                          {constraint.accessor}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {constraint.boundaries.map((b, j) => (
                          <span
                            key={j}
                            className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[oklch(0.22_0.01_175_/_30%)] text-[oklch(0.78_0.15_175)] border border-[oklch(0.78_0.15_175_/_20%)]"
                          >
                            {b.operator} {formatValue(b.value)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Test Cases */}
          <div>
            <div className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">
              Test Cases ({result.test_cases.length})
            </div>
            <div className="grid gap-1.5">
              {result.test_cases.map((tc, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-3 py-2 rounded border-l-3 ${getCategoryBorder(tc.category)} bg-secondary/20`}
                >
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] font-mono h-5 px-1.5 ${getCategoryColor(tc.category)}`}
                  >
                    {tc.category}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-muted-foreground">{tc.variable}</span>
                      <span className="text-foreground font-medium">=</span>
                      <span className="text-primary font-medium">
                        {formatValue(tc.value)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {tc.reason}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                      tc.source === "AI"
                        ? "bg-[oklch(0.78_0.15_175_/_15%)] text-[oklch(0.78_0.15_175)]"
                        : "bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {tc.source}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
