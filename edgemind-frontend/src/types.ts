// Mirrors the current EdgeMind API contract (POST /analyze).
// Nothing here is speculative — every field maps directly to "api_endpoints".

export type Accessor = "direct" | "len";

export interface FunctionParameter {
  name: string;
  annotation: string | null;
  default: string | null;
}

export interface FunctionCondition {
  source: string;
  variable: string;
  operator: string;
  value: number | string | null;
  lineno: number;
  accessor: Accessor;
}

export interface FunctionReturn {
  source: string;
  lineno: number;
}

export interface ParsedFunction {
  name: string;
  parameters: FunctionParameter[];
  conditions: FunctionCondition[];
  returns: FunctionReturn[];
  has_loops: boolean;
  raises: string[];
}

export interface Boundary {
  operator: string;
  value: number;
  lineno: number;
}

export interface Constraint {
  variable: string;
  accessor: Accessor;
  param_annotation: string | null;
  param_default: string | null;
  boundaries: Boundary[];
}

export type TestCaseCategory =
  | "Boundary Below"
  | "Boundary"
  | "Boundary Above"
  | "Null"
  | "Invalid Type"
  | "Extreme Value"
  | "Negative"
  | "Empty"
  | "Unicode/Special Characters"
  | "Semantically Implausible";

export type TestCaseSource = "Boundary Rule" | "AI";

export type ExecutionStatus = "not_run" | "success" | "raises" | "timeout" | "error";

export interface TestCase {
  variable: string;
  value: number | string | null;
  category: TestCaseCategory;
  reason: string;
  source: TestCaseSource;
  execution_status: ExecutionStatus;
  actual_output: unknown;
  exception_type: string | null;
  exception_message: string | null;
}

export interface AnalyzedFunction {
  function: ParsedFunction;
  constraints: Constraint[];
  test_cases: TestCase[];
}

export interface AnalyzeResponse {
  functions: AnalyzedFunction[];
}

export interface AnalyzeErrorResponse {
  detail: string;
}
