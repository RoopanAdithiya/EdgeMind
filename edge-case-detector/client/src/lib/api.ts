import type {
  AnalyzeRequest,
  AnalyzeResponse,
  HealthResponse,
  ErrorResponse,
} from "./types";

const BASE_URL = "http://localhost:8000";

export async function checkHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function analyzeCode(
  code: string,
  language: string = "python"
): Promise<AnalyzeResponse | ErrorResponse> {
  const res = await fetch(`${BASE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language }),
  });

  const data = await res.json();

  if (!res.ok) {
    return data as ErrorResponse;
  }

  return data as AnalyzeResponse;
}
