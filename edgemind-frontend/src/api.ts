import type { AnalyzeErrorResponse, AnalyzeResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class AnalyzeError extends Error {}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

export async function analyzeCode(code: string, language: "python"): Promise<AnalyzeResponse> {
  const res = await fetch(`${BASE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language })
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as AnalyzeErrorResponse | null;
    throw new AnalyzeError(body?.detail ?? `Request failed with status ${res.status}`);
  }

  return res.json();
}
