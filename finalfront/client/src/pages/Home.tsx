import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clipboard,
  Code2,
  Command,
  Copy,
  FileCode2,
  FileJson,
  FileUp,
  FlaskConical,
  GitBranch,
  Info,
  Keyboard,
  Layers3,
  Lightbulb,
  Loader2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Terminal,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

type ConnectionState = "checking" | "connected" | "offline";
type ViewMode = "analyze" | "results" | "docs";
type AnalyzeState = "idle" | "loading" | "success" | "error";

type Parameter = { name: string; annotation: string | null; default: unknown };
type Condition = { source: string; variable: string; operator: string; value: unknown; lineno: number; accessor: string };
type ReturnValue = { source: string; lineno: number };
type FunctionMeta = {
  name: string;
  parameters: Parameter[];
  conditions: Condition[];
  returns: ReturnValue[];
  has_loops: boolean;
  raises: string[];
};
type Boundary = { operator: string; value: unknown; lineno: number };
type Constraint = {
  variable: string;
  accessor: "direct" | "len";
  param_annotation: string | null;
  param_default: unknown;
  boundaries: Boundary[];
};
type TestCase = {
  variable: string;
  value: string | number | boolean | null;
  category: string;
  reason: string;
  source: "Boundary Rule" | "AI";
  execution_status: "not_run" | "success" | "raises" | "timeout" | "error";
  actual_output: unknown;
  exception_type: string | null;
  exception_message: string | null;
  validated: boolean;
  validation_note: string | null;
};
type FunctionResult = { function: FunctionMeta; constraints: Constraint[]; test_cases: TestCase[] };
type AnalyzeResponse = { functions: FunctionResult[] };

type CaseGroup = { fnIndex: number; caseIndex: number; item: TestCase; functionName: string };

const API_BASE = "http://localhost:8000";
const INITIAL_CODE = "";

const categoryStyles: Record<string, string> = {
  "Boundary Below": "border-slate-600/60 bg-slate-700/30 text-slate-200",
  Boundary: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  "Boundary Above": "border-sky-400/30 bg-sky-400/10 text-sky-200",
  Null: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  "Invalid Type": "border-rose-400/30 bg-rose-400/10 text-rose-200",
  "Extreme Value": "border-orange-400/30 bg-orange-400/10 text-orange-200",
  Negative: "border-red-400/30 bg-red-400/10 text-red-200",
  Empty: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  "Unicode/Special Characters": "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200",
  "Semantically Implausible": "border-yellow-400/30 bg-yellow-400/10 text-yellow-200",
};

const statusStyles = {
  success: { label: "Returned", icon: CheckCircle2, color: "text-emerald-300", bg: "bg-emerald-400/10 border-emerald-400/20" },
  raises: { label: "Raises", icon: AlertCircle, color: "text-amber-300", bg: "bg-amber-400/10 border-amber-400/20" },
  timeout: { label: "Timed out", icon: AlertCircle, color: "text-orange-300", bg: "bg-orange-400/10 border-orange-400/20" },
  error: { label: "Execution error", icon: AlertCircle, color: "text-rose-300", bg: "bg-rose-400/10 border-rose-400/20" },
  not_run: { label: "Not run", icon: CircleDot, color: "text-slate-400", bg: "bg-slate-400/10 border-slate-400/20" },
} as const;

function formatValue(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "string") return `\"${value}\"`;
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

function displayDefault(value: unknown) {
  if (value === null || value === undefined) return "";
  return ` = ${formatValue(value)}`;
}

function formatOutput(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

function escapePy(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}

function formatFunctionSignature(fn: FunctionMeta) {
  const params = fn.parameters.map((param) => `${param.name}${param.annotation ? `: ${param.annotation}` : ""}${displayDefault(param.default)}`).join(", ");
  return `def ${fn.name}(${params}):`;
}

function buildPytestExport(data: AnalyzeResponse) {
  const lines = ["import pytest", ""];
  data.functions.forEach((result) => {
    result.test_cases.forEach((testCase, index) => {
      const testName = `test_${result.function.name}_${testCase.variable}_${index + 1}`.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
      lines.push(`@pytest.mark.parametrize(\"${testCase.variable}\", [${escapePy(testCase.value)}])`);
      lines.push(`def ${testName}(${testCase.variable}):`);
      lines.push(`    # ${testCase.source}: ${testCase.category}`);
      lines.push(`    # Expected execution: ${testCase.execution_status}`);
      lines.push(`    result = ${result.function.name}(${testCase.variable})`);
      lines.push(`    assert result is not None  # Replace with the expected assertion for your function`);
      lines.push("");
    });
  });
  return lines.join("\n");
}

function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <div className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]", className)}>{children}</span>;
}

function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div>
        {eyebrow && <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{eyebrow}</div>}
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function AppSidebar({ view, setView, collapsed, onToggle, connection, onDocs }: { view: ViewMode; setView: (view: ViewMode) => void; collapsed: boolean; onToggle: () => void; connection: ConnectionState; onDocs: () => void }) {
  const navItems = [
    { id: "analyze" as const, label: "Analyze", icon: Code2, shortcut: "⌘ 1" },
    { id: "results" as const, label: "Results", icon: FlaskConical, shortcut: "⌘ 2" },
  ];
  return (
    <aside className={cn("sidebar-shell hidden shrink-0 flex-col border-r border-border bg-sidebar/80 transition-[width] duration-200 lg:flex", collapsed ? "w-[64px]" : "w-[232px]")}>
      <div className={cn("flex h-[68px] items-center border-b border-border", collapsed ? "justify-center" : "gap-3 px-4")}>
        <LogoMark size={30} />
        {!collapsed && <div className="min-w-0"><div className="text-[14px] font-semibold tracking-[-0.02em] text-foreground">EdgeMind</div><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Boundary Lab</div></div>}
      </div>
      <div className="flex flex-1 flex-col px-2 py-4">
        {!collapsed && <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">Workspace</div>}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return <button key={item.id} onClick={() => setView(item.id)} className={cn("nav-item group", active && "nav-item-active", collapsed && "justify-center px-0")} title={collapsed ? item.label : undefined}>
              <Icon size={16} strokeWidth={active ? 2.2 : 1.7} />
              {!collapsed && <><span className="flex-1 text-left">{item.label}</span><span className="font-mono text-[10px] text-muted-foreground/60">{item.shortcut}</span></>}
            </button>;
          })}
        </nav>
        {!collapsed && <div className="mb-2 mt-7 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">Reference</div>}
        <button onClick={onDocs} className={cn("nav-item", collapsed && "justify-center px-0")} title={collapsed ? "Pipeline docs" : undefined}>
          <BookOpen size={16} strokeWidth={1.7} />
          {!collapsed && <><span className="flex-1 text-left">Pipeline docs</span><ArrowRight size={13} className="text-muted-foreground/60" /></>}
        </button>
      </div>
      <div className="border-t border-border p-2">
        {!collapsed && <div className="mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-[11px] text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", connection === "connected" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" : connection === "checking" ? "bg-amber-400" : "bg-rose-400")} /> API {connection === "connected" ? "connected" : connection === "checking" ? "checking" : "offline"}</div>}
        <button onClick={onToggle} className={cn("nav-item text-muted-foreground", collapsed && "justify-center px-0")} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} /><span className="flex-1 text-left">Collapse</span><kbd className="kbd">⌘ .</kbd></>}
        </button>
      </div>
    </aside>
  );
}

function TopBar({ view, theme, onThemeToggle, onDocs, onCommand, onExport, hasResults }: { view: ViewMode; theme: string; onThemeToggle: () => void; onDocs: () => void; onCommand: () => void; onExport: () => void; hasResults: boolean }) {
  const title = view === "analyze" ? "Analyze" : view === "results" ? "Results" : "Documentation";
  return <header className="topbar flex h-[68px] shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-7">
    <div className="flex items-center gap-3"><div className="h-4 w-px bg-border" /><span className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">{title}</span>{view === "results" && hasResults && <><span className="text-muted-foreground/40">/</span><span className="font-mono text-[11px] text-muted-foreground">latest run</span></>}</div>
    <div className="flex items-center gap-1.5">
      <button onClick={onCommand} className="command-trigger hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground transition hover:border-violet-400/40 hover:text-foreground md:flex"><Search size={13} /><span>Command menu</span><kbd className="kbd">⌘ K</kbd></button>
      <button onClick={onDocs} className="icon-btn" title="Open documentation"><BookOpen size={15} /></button>
      {hasResults && <button onClick={onExport} className="icon-btn" title="Export test cases"><ArrowDownToLine size={15} /></button>}
      <button onClick={onThemeToggle} className="icon-btn" title="Toggle theme">{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button>
      <button className="icon-btn" title="Settings (not available)"><Settings2 size={15} /></button>
    </div>
  </header>;
}

function ConnectionBadge({ state, onRetry }: { state: ConnectionState; onRetry: () => void }) {
  if (state === "checking") return <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Checking API connection</div>;
  if (state === "connected") return <div className="flex items-center gap-2 text-[11px] text-emerald-300"><span className="status-dot status-dot-live" /> Backend connected <span className="font-mono text-[10px] text-muted-foreground">localhost:8000</span></div>;
  return <button onClick={onRetry} className="flex items-center gap-2 text-[11px] text-rose-300 transition hover:text-rose-200"><span className="status-dot bg-rose-400" /> Backend offline <span className="underline underline-offset-2">Retry</span></button>;
}

function AnalyzeView({ code, setCode, onAnalyze, analyzeState, error, connection, onRetry, onOpenFile, fileName, clearFile, hasResults, onViewResults }: { code: string; setCode: (value: string) => void; onAnalyze: () => void; analyzeState: AnalyzeState; error: string | null; connection: ConnectionState; onRetry: () => void; onOpenFile: (event: React.ChangeEvent<HTMLInputElement>) => void; fileName: string | null; clearFile: () => void; hasResults: boolean; onViewResults: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const lineCount = Math.max(1, code.split("\n").length);
  const canAnalyze = code.trim().length > 0 && analyzeState !== "loading";
  return <main className="workspace-scroll flex-1 overflow-y-auto">
    <div className="mx-auto max-w-[1360px] px-4 py-7 md:px-8 md:py-10">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><div className="mb-2 flex items-center gap-2"><Pill className="border-violet-400/25 bg-violet-400/10 text-violet-300"><Zap size={10} /> deterministic + AI</Pill><span className="text-[11px] text-muted-foreground">Python edge-case analysis</span></div><h1 className="text-[28px] font-semibold tracking-[-0.04em] text-foreground md:text-[34px]">Find the edges before users do.</h1><p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground">Trace every boundary, validate every generated input, and see what your function actually does under pressure.</p></div>
        <ConnectionBadge state={connection} onRetry={onRetry} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(330px,.75fr)]">
        <section className="editor-panel overflow-hidden rounded-xl border border-border bg-card shadow-[0_20px_70px_rgba(0,0,0,.16)]">
          <div className="flex h-12 items-center justify-between border-b border-border px-4"><div className="flex items-center gap-2"><FileCode2 size={15} className="text-violet-300" /><span className="text-[12px] font-semibold text-foreground">source.py</span>{fileName && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{fileName}</span>}</div><div className="flex items-center gap-1"><button onClick={() => fileInput.current?.click()} className="toolbar-btn"><UploadCloud size={14} /> Upload .py</button><input ref={fileInput} type="file" accept=".py,text/x-python" onChange={onOpenFile} className="hidden" />{fileName && <button onClick={clearFile} className="icon-btn-sm" title="Clear uploaded file"><X size={13} /></button>}</div></div>
          <div className="editor-wrap min-h-[430px] bg-[#101014] dark:bg-[#101014]">
            <div className="line-numbers select-none border-r border-white/[0.06] bg-[#0d0d10] px-3 py-4 text-right font-mono text-[12px] leading-[1.9] text-slate-600">{Array.from({ length: lineCount }, (_, i) => <div key={i}>{String(i + 1).padStart(2, "0")}</div>)}</div>
            <textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} placeholder={'Paste a Python function or file here…\n\nEdgeMind will parse conditions, derive boundaries, and execute generated cases.'} className="code-input min-h-[430px] flex-1 resize-none bg-transparent px-4 py-4 font-mono text-[13px] leading-[1.9] text-slate-200 outline-none placeholder:text-slate-700" aria-label="Python source code" />
          </div>
          <div className="flex flex-col justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center"><div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"><span>Python</span><span className="text-border">•</span><span>{code.length.toLocaleString()} chars</span><span className="text-border">•</span><span>{lineCount} lines</span></div><button onClick={onAnalyze} disabled={!canAnalyze} className="primary-btn"><span>{analyzeState === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}</span>{analyzeState === "loading" ? "Running analysis…" : "Analyze function"}<span className="btn-shortcut">⌘ ↵</span></button></div>
        </section>
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card p-5"><SectionHeader eyebrow="The pipeline" title="Six stages. One traceable run." /><div className="space-y-3">{["Parse AST structure", "Extract constraints", "Derive boundary values", "Generate AI edge cases", "Execute every input", "Validate category claims"].map((step, index) => <div key={step} className="flex items-center gap-3"><div className={cn("pipeline-number", index === 0 && "pipeline-number-active")}>{String(index + 1).padStart(2, "0")}</div><span className="text-[12px] text-muted-foreground">{step}</span>{index < 5 && <div className="ml-auto h-px w-4 bg-border" />}</div>)}</div></section>
          <section className="rounded-xl border border-violet-400/15 bg-violet-400/[0.045] p-5"><div className="mb-3 flex items-center gap-2 text-violet-300"><Lightbulb size={15} /><span className="text-[11px] font-semibold uppercase tracking-[0.12em]">How to use</span></div><p className="text-[12px] leading-5 text-muted-foreground">Paste a function with numeric conditions for the richest boundary analysis. Uploading a file works the same way—the browser reads it locally before sending the code string.</p><div className="mt-4 flex items-center gap-2 text-[11px] text-violet-200/80"><ShieldCheck size={13} /> No code is stored by EdgeMind</div></section>
          {error && <div className="rounded-xl border border-rose-400/25 bg-rose-400/[0.06] p-4 text-[12px] text-rose-200"><div className="mb-1 flex items-center gap-2 font-semibold"><AlertCircle size={14} /> Analysis could not complete</div><p className="leading-5 text-rose-200/75">{error}</p></div>}
          {hasResults && <button onClick={onViewResults} className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition hover:border-violet-400/35 hover:bg-violet-400/[0.04]"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Latest run available</div><div className="text-[13px] font-medium text-foreground">Review generated test cases</div></div><ArrowRight size={16} className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-violet-300" /></button>}
        </div>
      </div>
    </div>
  </main>;
}

function PipelineStrip({ result }: { result: AnalyzeResponse }) {
  const counts = result.functions.reduce((acc, fn) => { acc.cases += fn.test_cases.length; acc.boundary += fn.test_cases.filter((item) => item.source === "Boundary Rule").length; acc.ai += fn.test_cases.filter((item) => item.source === "AI").length; acc.warnings += fn.test_cases.filter((item) => item.source === "AI" && !item.validated).length; return acc; }, { cases: 0, boundary: 0, ai: 0, warnings: 0 });
  return <section className="pipeline-strip rounded-xl border border-border bg-card p-4 md:p-5"><div className="mb-4 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Analysis pipeline</div><div className="mt-1 text-[12px] text-muted-foreground">Deterministic core extended by transparent AI suggestions</div></div><Pill className="border-emerald-400/25 bg-emerald-400/10 text-emerald-300"><Check size={10} /> run complete</Pill></div><div className="pipeline-track">{[{ label: "Parsed", value: `${result.functions.length} fn`, icon: Code2 }, { label: "Boundaries", value: `${counts.boundary} cases`, icon: GitBranch }, { label: "AI cases", value: `${counts.ai} cases`, icon: Sparkles }, { label: "Executed", value: `${counts.cases} inputs`, icon: Terminal }, { label: "Validated", value: counts.warnings ? `${counts.warnings} flagged` : "all clear", icon: ShieldCheck }].map((step, index, items) => { const Icon = step.icon; return <div key={step.label} className="pipeline-step"><div className={cn("pipeline-icon", index === items.length - 1 && counts.warnings ? "pipeline-icon-warn" : "pipeline-icon-done")}><Icon size={14} /></div><div><div className="text-[11px] font-semibold text-foreground">{step.label}</div><div className="font-mono text-[10px] text-muted-foreground">{step.value}</div></div>{index < items.length - 1 && <div className="pipeline-connector" />}</div>; })}</div></section>;
}

function SummaryStat({ label, value, accent }: { label: string; value: string | number; accent?: string }) { return <div className="rounded-lg border border-border bg-card px-4 py-3"><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className={cn("font-mono text-[20px] font-medium tracking-[-0.04em] text-foreground", accent)}>{value}</div></div>; }

function FunctionNav({ result, selected, setSelected }: { result: AnalyzeResponse; selected: number; setSelected: (index: number) => void }) {
  return <aside className="function-nav rounded-xl border border-border bg-card p-2"><div className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Functions <span className="ml-1 text-muted-foreground/60">{result.functions.length}</span></div>{result.functions.map((fn, index) => <button key={`${fn.function.name}-${index}`} onClick={() => setSelected(index)} className={cn("function-nav-item", selected === index && "function-nav-item-active")}><div className="flex items-center gap-2"><Code2 size={14} className={selected === index ? "text-violet-300" : "text-muted-foreground"} /><span className="truncate font-mono text-[12px]">{fn.function.name}()</span></div><div className="mt-1 flex items-center gap-2 pl-6 text-[10px] text-muted-foreground"><span>{fn.test_cases.length} cases</span><span className="text-border">•</span><span>{fn.function.parameters.length} params</span></div></button>)}</aside>;
}

function MetaPanel({ result }: { result: FunctionResult }) {
  const fn = result.function;
  return <div className="grid gap-4 xl:grid-cols-2">
    <section className="rounded-xl border border-border bg-card p-5"><SectionHeader eyebrow="AST extraction" title="Conditions & returns" /><div className="mb-4 rounded-lg bg-[#101014] px-3 py-3 font-mono text-[12px] text-violet-200">{formatFunctionSignature(fn)}</div><div className="space-y-2">{fn.conditions.length === 0 && <div className="empty-mini">No conditions detected</div>}{fn.conditions.map((condition, index) => <div key={`${condition.source}-${index}`} className="flex items-start gap-3 rounded-lg border border-border/70 px-3 py-2.5"><span className="mt-0.5 font-mono text-[10px] text-muted-foreground">L{condition.lineno}</span><div className="min-w-0 flex-1"><code className="break-all text-[11px] text-foreground">{condition.source}</code><div className="mt-1 text-[10px] text-muted-foreground">{condition.variable} <span className="text-violet-300">{condition.operator}</span> {formatValue(condition.value)}</div></div></div>)}</div><div className="mt-5 border-t border-border pt-4"><div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Return paths</div><div className="space-y-1.5">{fn.returns.length === 0 && <div className="empty-mini">No return statements detected</div>}{fn.returns.map((ret, index) => <div key={`${ret.lineno}-${index}`} className="flex items-center gap-3 font-mono text-[11px]"><span className="text-[10px] text-muted-foreground">L{ret.lineno}</span><span className="text-emerald-200/90">return</span><span className="truncate text-slate-300">{ret.source}</span></div>)}</div></div></section>
    <section className="rounded-xl border border-border bg-card p-5"><SectionHeader eyebrow="Detected model" title="Constraints" action={fn.has_loops ? <Pill className="border-amber-400/25 bg-amber-400/10 text-amber-200">loop detected</Pill> : null} />{result.constraints.length === 0 && <div className="empty-mini">No parameter constraints detected.</div>}<div className="space-y-2">{result.constraints.map((constraint) => <div key={`${constraint.variable}-${constraint.accessor}`} className="rounded-lg border border-border/70 p-3"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="rounded bg-violet-400/10 px-1.5 py-0.5 font-mono text-[11px] text-violet-200">{constraint.variable}</span><span className="text-[10px] text-muted-foreground">{constraint.accessor === "len" ? "length accessor" : "direct value"}</span></div>{constraint.param_annotation && <span className="font-mono text-[10px] text-muted-foreground">{constraint.param_annotation}</span>}</div><div className="flex flex-wrap gap-2">{constraint.boundaries.length === 0 ? <span className="text-[11px] text-muted-foreground">No explicit boundaries; AI coverage extends this parameter.</span> : constraint.boundaries.map((boundary, index) => <span key={`${boundary.lineno}-${index}`} className="rounded-md border border-slate-600/60 bg-slate-700/20 px-2 py-1 font-mono text-[11px] text-slate-200"><span className="text-violet-300">{boundary.operator}</span> {formatValue(boundary.value)} <span className="ml-1 text-[9px] text-muted-foreground">L{boundary.lineno}</span></span>)}</div></div>)}</div></section>
  </div>;
}

function CaseRow({ item, index, onClick }: { item: TestCase; index: number; onClick: () => void }) {
  const status = statusStyles[item.execution_status];
  const StatusIcon = status.icon;
  return <button onClick={onClick} className={cn("case-row group w-full text-left", item.source === "AI" ? "case-row-ai" : "case-row-boundary")}><div className="flex min-w-0 items-center gap-3"><span className="w-5 shrink-0 font-mono text-[10px] text-muted-foreground/60">{String(index + 1).padStart(2, "0")}</span><span className={cn("case-source", item.source === "AI" ? "case-source-ai" : "case-source-boundary")}>{item.source === "AI" ? <Sparkles size={11} /> : <GitBranch size={11} />}{item.source === "AI" ? "AI" : "Rule"}</span><span className="min-w-[80px] shrink-0 font-mono text-[11px] text-foreground">{item.variable}</span><span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-300">{formatValue(item.value)}</span><span className={cn("hidden rounded border px-2 py-1 text-[10px] font-medium md:inline-flex", categoryStyles[item.category] || "border-border bg-muted text-muted-foreground")}>{item.category}</span><span className={cn("flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium", status.bg, status.color)}><StatusIcon size={11} />{status.label}</span>{item.source === "AI" && !item.validated && <span className="validation-dot" title={item.validation_note || "AI category validation warning"}>!</span>}<ChevronRight size={14} className="shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-violet-300" /></div><div className="mt-2 pl-[104px] text-[11px] leading-5 text-muted-foreground"><span className="line-clamp-1">{item.reason}</span></div></button>;
}

function CasesExplorer({ result, fnIndex, onSelect }: { result: FunctionResult; fnIndex: number; onSelect: (item: CaseGroup) => void }) {
  const [filter, setFilter] = useState<"all" | "Boundary Rule" | "AI">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const cases = result.test_cases.filter((item) => (filter === "all" || item.source === filter) && (statusFilter === "all" || item.execution_status === statusFilter));
  const boundaryCount = result.test_cases.filter((item) => item.source === "Boundary Rule").length;
  const aiCount = result.test_cases.filter((item) => item.source === "AI").length;
  return <section className="rounded-xl border border-border bg-card"><div className="border-b border-border p-5"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Execution matrix</div><h2 className="text-[16px] font-semibold tracking-[-0.02em] text-foreground">Test cases <span className="ml-1 font-mono text-[12px] text-muted-foreground">{result.test_cases.length}</span></h2></div><div className="flex items-center gap-2"><button onClick={() => setFilter("all")} className={cn("filter-tab", filter === "all" && "filter-tab-active")}>All <span>{result.test_cases.length}</span></button><button onClick={() => setFilter("Boundary Rule")} className={cn("filter-tab", filter === "Boundary Rule" && "filter-tab-active")}>Rule <span>{boundaryCount}</span></button><button onClick={() => setFilter("AI")} className={cn("filter-tab", filter === "AI" && "filter-tab-active")}>AI <span>{aiCount}</span></button></div></div><div className="mt-4 flex items-center gap-2"><div className="relative flex-1"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input placeholder="Filter by variable, category or reason…" className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-400/50" /></div><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground outline-none"><option value="all">All statuses</option><option value="success">Returned</option><option value="raises">Raises</option><option value="timeout">Timed out</option><option value="error">Errors</option></select></div></div><div className="divide-y divide-border">{cases.length === 0 ? <div className="p-8 text-center text-[12px] text-muted-foreground">No cases match this filter.</div> : cases.map((item) => { const originalIndex = result.test_cases.indexOf(item); return <CaseRow key={`${originalIndex}-${item.variable}-${item.category}`} item={item} index={originalIndex} onClick={() => onSelect({ fnIndex, caseIndex: originalIndex, item, functionName: result.function.name })} />; })}</div></section>;
}

function ResultsView({ data, onSelect, onExportJson, onExportPytest }: { data: AnalyzeResponse; onSelect: (item: CaseGroup) => void; onExportJson: () => void; onExportPytest: () => void }) {
  const [selectedFn, setSelectedFn] = useState(0);
  const current = data.functions[selectedFn] || data.functions[0];
  const allCases = data.functions.flatMap((item) => item.test_cases);
  const returned = allCases.filter((item) => item.execution_status === "success").length;
  const raises = allCases.filter((item) => item.execution_status === "raises").length;
  const ai = allCases.filter((item) => item.source === "AI").length;
  const warnings = allCases.filter((item) => item.source === "AI" && !item.validated).length;
  return <main className="workspace-scroll flex-1 overflow-y-auto"><div className="mx-auto max-w-[1460px] px-4 py-6 md:px-7 md:py-8"><div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2"><Pill className="border-emerald-400/25 bg-emerald-400/10 text-emerald-300"><Check size={10} /> analysis complete</Pill><span className="font-mono text-[10px] text-muted-foreground">{data.functions.length} function{data.functions.length === 1 ? "" : "s"} analyzed</span></div><h1 className="text-[26px] font-semibold tracking-[-0.04em] text-foreground">Analysis results</h1><p className="mt-1 text-[12px] text-muted-foreground">A transparent view of what was detected, generated, executed, and verified.</p></div><div className="flex items-center gap-2"><button onClick={onExportPytest} className="secondary-btn"><FileCode2 size={14} /> Export pytest</button><button onClick={onExportJson} className="secondary-btn"><FileJson size={14} /> Raw JSON</button></div></div><PipelineStrip result={data} /><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryStat label="Total test cases" value={allCases.length} /><SummaryStat label="Boundary rules" value={allCases.filter((item) => item.source === "Boundary Rule").length} accent="text-slate-200" /><SummaryStat label="AI extensions" value={ai} accent="text-violet-200" /><SummaryStat label="Returned / raised" value={`${returned} / ${raises}`} accent="text-emerald-200" /></div><div className="mt-6 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]"><FunctionNav result={data} selected={selectedFn} setSelected={setSelectedFn} /><div className="min-w-0 space-y-4"><div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/10 text-violet-300"><Code2 size={16} /></div><div><div className="font-mono text-[14px] font-medium text-foreground">{current.function.name}()</div><div className="text-[10px] text-muted-foreground">{current.function.parameters.length} parameters · {current.test_cases.length} generated cases</div></div></div><div className="hidden items-center gap-3 text-[10px] text-muted-foreground md:flex"><span className="flex items-center gap-1.5"><span className="status-dot bg-emerald-400" />{returned} returned</span><span className="flex items-center gap-1.5"><span className="status-dot bg-amber-400" />{raises} raised</span>{warnings > 0 && <span className="flex items-center gap-1.5 text-amber-300"><span className="validation-dot">!</span>{warnings} label warnings</span>}</div></div><MetaPanel result={current} /><CasesExplorer result={current} fnIndex={selectedFn} onSelect={onSelect} /></div></div></div></main>;
}

function DetailDrawer({ selected, onClose }: { selected: CaseGroup | null; onClose: () => void }) {
  if (!selected) return null;
  const { item } = selected;
  const status = statusStyles[item.execution_status];
  const StatusIcon = status.icon;
  return <><button aria-label="Close test case details" onClick={onClose} className="fixed inset-0 z-30 cursor-default bg-black/35 backdrop-blur-[1px]" /><aside className="detail-drawer fixed right-0 top-0 z-40 h-full w-full max-w-[440px] overflow-y-auto border-l border-border bg-card shadow-[-20px_0_60px_rgba(0,0,0,.35)]"><div className="flex h-[68px] items-center justify-between border-b border-border px-5"><div><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Test case detail</div><div className="mt-1 font-mono text-[12px] text-foreground">{selected.functionName} · {item.variable}</div></div><button onClick={onClose} className="icon-btn"><X size={16} /></button></div><div className="space-y-5 p-5"><div className="flex items-center justify-between"><span className={cn("case-source", item.source === "AI" ? "case-source-ai" : "case-source-boundary")}>{item.source === "AI" ? <Sparkles size={11} /> : <GitBranch size={11} />}{item.source}</span><span className={cn("flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium", status.bg, status.color)}><StatusIcon size={12} />{status.label}</span></div><div><div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Generated input</div><div className="rounded-lg border border-border bg-[#101014] p-4 font-mono text-[20px] text-violet-200">{item.variable} = {formatValue(item.value)}</div></div><div><div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Category</div><span className={cn("inline-flex rounded border px-2.5 py-1.5 text-[11px] font-medium", categoryStyles[item.category] || "border-border bg-muted text-muted-foreground")}>{item.category}</span></div><div className="rounded-lg border border-border bg-muted/20 p-4"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"><Info size={12} /> Why this case exists</div><p className="text-[12px] leading-5 text-muted-foreground">{item.reason}</p></div><div><div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Execution result</div>{item.execution_status === "success" && <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-4"><div className="mb-1 text-[11px] text-emerald-300">Function returned normally</div><div className="font-mono text-[16px] text-emerald-100">{formatOutput(item.actual_output)}</div></div>}{item.execution_status === "raises" && <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-4"><div className="mb-2 text-[11px] text-amber-300">Meaningful exception path</div><div className="mb-1 font-mono text-[14px] text-amber-100">{item.exception_type || "Exception"}</div><p className="break-words font-mono text-[11px] leading-5 text-amber-100/65">{item.exception_message || "No exception message returned."}</p></div>}{item.execution_status === "timeout" && <div className="rounded-lg border border-orange-400/20 bg-orange-400/[0.06] p-4 text-[12px] leading-5 text-orange-200">The function did not return within the 2 second execution window. This may indicate an infinite loop or unusually expensive path.</div>}{item.execution_status === "error" && <div className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] p-4 text-[12px] leading-5 text-rose-200">The function could not be compiled or executed for this input.</div>}</div>{item.source === "AI" && <div className={cn("rounded-lg border p-4", item.validated ? "border-emerald-400/20 bg-emerald-400/[0.04]" : "border-amber-400/25 bg-amber-400/[0.05]")}><div className={cn("mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em]", item.validated ? "text-emerald-300" : "text-amber-300")}>{item.validated ? <ShieldCheck size={13} /> : <AlertCircle size={13} />}{item.validated ? "Independent validation passed" : "Category label needs review"}</div><p className="text-[11px] leading-5 text-muted-foreground">{item.validated ? "A deterministic sanity check agreed with the AI-generated category." : item.validation_note || "The AI's category claim did not fully hold up against the automated check."}</p></div>}</div></aside></>;
}

function DocsView() {
  const steps = ["Parse AST structure", "Extract constraints", "Derive boundary values", "Generate AI edge cases", "Execute every input", "Validate category claims"];
  return <main className="workspace-scroll flex-1 overflow-y-auto"><div className="mx-auto max-w-[1000px] px-5 py-10 md:px-10 md:py-14"><div className="mb-10 max-w-2xl"><Pill className="border-violet-400/25 bg-violet-400/10 text-violet-300"><BookOpen size={10} /> documentation</Pill><h1 className="mt-4 text-[34px] font-semibold tracking-[-0.05em] text-foreground">A test case is only as useful as its trace.</h1><p className="mt-4 text-[14px] leading-7 text-muted-foreground">EdgeMind combines a deterministic boundary engine with an AI extension layer, then executes every generated input. The result is not a suggestion list—it is an inspectable account of how your function behaves.</p></div><div className="grid gap-3">{steps.map((step, index) => <div key={step} className="group flex gap-5 rounded-xl border border-border bg-card p-5 transition hover:border-violet-400/30"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-400/20 bg-violet-400/10 font-mono text-[11px] text-violet-300">0{index + 1}</div><div><h2 className="text-[14px] font-semibold text-foreground">{step}</h2><p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">{["The Python AST is parsed to identify top-level functions, parameters, conditions, returns, loops, and raises.", "Every parameter is mapped to the constraints the function actually expresses, including direct values and length accessors.", "For numeric comparisons, EdgeMind derives N−1, N, and N+1 values around each boundary.", "Gemini proposes additional null, invalid-type, extreme, negative, empty, unicode, and semantic edge cases.", "Each generated input is run against the function. Returns and exceptions are both meaningful observations.", "A deterministic check compares AI category claims with the generated value and execution outcome, surfacing disagreements without hiding them."][index]}</p></div></div>)}</div><div className="mt-10 rounded-xl border border-border bg-card p-6"><div className="mb-3 flex items-center gap-2 text-violet-300"><ShieldCheck size={16} /><span className="text-[13px] font-semibold text-foreground">The product promise</span></div><p className="text-[13px] leading-6 text-muted-foreground">Boundary Rule cases are the reliable deterministic core. AI cases extend coverage, but never disappear behind an opaque label: their source and validation state are always visible.</p></div></div></main>;
}

function CommandPalette({ open, onClose, onAnalyze, onView, onDocs, onTheme }: { open: boolean; onClose: () => void; onAnalyze: () => void; onView: () => void; onDocs: () => void; onTheme: () => void }) {
  const actions = [{ label: "Analyze current source", hint: "Run the backend analysis", icon: Play, action: onAnalyze }, { label: "Open results", hint: "View latest test cases", icon: FlaskConical, action: onView }, { label: "Open pipeline docs", hint: "Learn how EdgeMind works", icon: BookOpen, action: onDocs }, { label: "Toggle light / dark mode", hint: "Change interface theme", icon: Sun, action: onTheme }];
  if (!open) return null;
  return <><button onClick={onClose} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" aria-label="Close command palette" /><div className="command-palette fixed left-1/2 top-[18%] z-50 w-[min(520px,calc(100%-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"><div className="flex items-center gap-3 border-b border-border px-4 py-3"><Command size={15} className="text-violet-300" /><input autoFocus placeholder="Type a command…" className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground" /><kbd className="kbd">esc</kbd></div><div className="p-2">{actions.map((item) => { const Icon = item.icon; return <button key={item.label} onClick={() => { item.action(); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-violet-400/[0.08]"><Icon size={15} className="text-muted-foreground" /><div className="flex-1"><div className="text-[12px] text-foreground">{item.label}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{item.hint}</div></div><ArrowRight size={13} className="text-muted-foreground/50" /></button>; })}</div></div></>;
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<ViewMode>("analyze");
  const [code, setCode] = useState(INITIAL_CODE);
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseGroup | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  const checkHealth = useCallback(async () => {
    setConnection("checking");
    try { const response = await fetch(`${API_BASE}/health`); if (!response.ok) throw new Error(); setConnection("connected"); } catch { setConnection("offline"); }
  }, []);
  useEffect(() => { void checkHealth(); }, [checkHealth]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen((open) => !open); }
      if (event.key === "Escape") { setCommandOpen(false); setSelectedCase(null); }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && view === "analyze") { event.preventDefault(); void runAnalysis(); }
      if ((event.metaKey || event.ctrlKey) && event.key === "1") { event.preventDefault(); setView("analyze"); }
      if ((event.metaKey || event.ctrlKey) && event.key === "2" && data) { event.preventDefault(); setView("results"); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });
  const runAnalysis = async () => {
    if (!code.trim() || analyzeState === "loading") return;
    setAnalyzeState("loading"); setError(null); setSelectedCase(null);
    try {
      const response = await fetch(`${API_BASE}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, language: "python" }) });
      let body: AnalyzeResponse | { detail?: string } = {};
      try { body = await response.json(); } catch { /* backend returned no JSON */ }
      if (!response.ok) throw new Error((body as { detail?: string }).detail || `The backend returned ${response.status}.`);
      setData(body as AnalyzeResponse); setAnalyzeState("success"); setView("results"); setConnection("connected");
    } catch (err) {
      setAnalyzeState("error"); setError(err instanceof Error ? err.message : "Unable to reach the backend. Check that it is running at localhost:8000.");
    }
  };
  const onOpenFile = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { setCode(String(reader.result || "")); setFileName(file.name); setError(null); }; reader.onerror = () => setError("The selected file could not be read in the browser."); reader.readAsText(file); };
  const exportJson = () => { if (data) downloadText("edgemind-analysis.json", JSON.stringify(data, null, 2), "application/json"); };
  const exportPytest = () => { if (data) downloadText("test_edgemind_generated.py", buildPytestExport(data), "text/x-python"); };
  const onDocs = () => { setView("docs"); setCommandOpen(false); };
  const hasResults = Boolean(data && data.functions.length);
  return <div className="app-shell flex h-screen overflow-hidden bg-background text-foreground"><AppSidebar view={view} setView={setView} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} connection={connection} onDocs={onDocs} /><div className="flex min-w-0 flex-1 flex-col"><TopBar view={view} theme={theme} onThemeToggle={() => toggleTheme?.()} onDocs={onDocs} onCommand={() => setCommandOpen(true)} onExport={exportJson} hasResults={hasResults} />{view === "analyze" && <AnalyzeView code={code} setCode={(value) => { setCode(value); if (analyzeState === "error") setAnalyzeState("idle"); }} onAnalyze={() => void runAnalysis()} analyzeState={analyzeState} error={error} connection={connection} onRetry={() => void checkHealth()} onOpenFile={onOpenFile} fileName={fileName} clearFile={() => { setFileName(null); setCode(""); }} hasResults={hasResults} onViewResults={() => setView("results")} />}{view === "results" && data && <ResultsView data={data} onSelect={setSelectedCase} onExportJson={exportJson} onExportPytest={exportPytest} />}{view === "results" && !data && <div className="flex flex-1 items-center justify-center p-6"><div className="max-w-sm text-center"><FlaskConical size={28} className="mx-auto mb-4 text-muted-foreground" /><h2 className="text-[16px] font-semibold">No analysis to inspect</h2><p className="mt-2 text-[12px] leading-5 text-muted-foreground">Run an analysis first. Real backend results will appear here—never sample data.</p><button onClick={() => setView("analyze")} className="primary-btn mx-auto mt-5">Go to analyzer <ArrowRight size={14} /></button></div></div>}{view === "docs" && <DocsView />}</div><DetailDrawer selected={selectedCase} onClose={() => setSelectedCase(null)} /><CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onAnalyze={() => { setView("analyze"); void runAnalysis(); }} onView={() => setView(hasResults ? "results" : "analyze")} onDocs={onDocs} onTheme={() => toggleTheme?.()} /></div>;
}
