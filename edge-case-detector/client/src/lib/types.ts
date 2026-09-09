// Types matching the AI Edge Case Detector API contract

export interface Parameter {
  name: string;
  annotation: string | null;
  default: string | null;
}

export interface Condition {
  source: string;
  variable: string;
  operator: string;
  value: unknown;
  lineno: number;
  accessor: string;
}

export interface ReturnStatement {
  source: string;
  lineno: number;
}

export interface FunctionDef {
  name: string;
  parameters: Parameter[];
  conditions: Condition[];
  returns: ReturnStatement[];
  has_loops: boolean;
  raises: string[];
}

export interface Boundary {
  operator: string;
  value: unknown;
  lineno: number;
}

export interface Constraint {
  variable: string;
  accessor: string;
  param_annotation: string | null;
  param_default: string | null;
  boundaries: Boundary[];
}

export interface TestCase {
  variable: string;
  value: unknown;
  category: "Boundary Below" | "Boundary" | "Boundary Above" | "Null";
  reason: string;
  source: "Boundary Rule" | "AI";
}

export interface FunctionResult {
  function: FunctionDef;
  constraints: Constraint[];
  test_cases: TestCase[];
}

export interface AnalyzeResponse {
  functions: FunctionResult[];
}

export interface AnalyzeRequest {
  code: string;
  language: string;
}

export interface HealthResponse {
  status: "ok";
}

export interface ErrorResponse {
  detail: string;
}
