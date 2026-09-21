import { useState } from "react";

interface Props {
  onAnalyze: (code: string) => void;
  loading: boolean;
}

const PLACEHOLDER = `def is_eligible(age):
    if age >= 18:
        return True
    return False`;

export default function CodeInput({ onAnalyze, loading }: Props) {
  const [code, setCode] = useState("");

  return (
    <section className="code-input">
      <div className="code-input__head">
        <h1>EdgeMind</h1>
        <span className="code-input__lang mono">python</span>
      </div>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        rows={12}
        className="mono"
      />

      <div className="code-input__actions">
        <button
          className="btn btn--primary"
          disabled={!code.trim() || loading}
          onClick={() => onAnalyze(code)}
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>
    </section>
  );
}
