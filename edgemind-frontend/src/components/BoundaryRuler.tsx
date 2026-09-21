import type { Constraint, TestCase } from "../types";

interface Props {
  constraint: Constraint;
  testCases: TestCase[];
}

const WIDTH = 760;
const HEIGHT = 96;
const PAD_X = 32;
const LINE_Y = 60;

function isPlottableNumber(v: TestCase["value"]): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export default function BoundaryRuler({ constraint, testCases }: Props) {
  const numericValues = testCases.map((tc) => tc.value).filter(isPlottableNumber);
  const boundaryValues = constraint.boundaries.map((b) => b.value);
  const domainValues = [...numericValues, ...boundaryValues];

  const nonNumeric = testCases.filter((tc) => !isPlottableNumber(tc.value));

  if (domainValues.length === 0) {
    return (
      <div className="ruler ruler--empty">
        <span className="mono">{constraint.variable}</span>
        <span className="ruler__empty-note">no numeric boundaries to plot</span>
      </div>
    );
  }

  let min = Math.min(...domainValues);
  let max = Math.max(...domainValues);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;
  const padding = range * 0.18;
  min -= padding;
  max += padding;

  const toX = (v: number) => PAD_X + ((v - min) / (max - min)) * (WIDTH - 2 * PAD_X);

  return (
    <div className="ruler">
      <div className="ruler__label mono">
        {constraint.variable}
        {constraint.accessor === "len" && <span className="ruler__accessor"> (length)</span>}
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="ruler__svg" role="img" aria-label={`Boundary ruler for ${constraint.variable}`}>
        <line x1={PAD_X} y1={LINE_Y} x2={WIDTH - PAD_X} y2={LINE_Y} stroke="var(--line-strong)" strokeWidth={1} />

        {constraint.boundaries.map((b, i) => {
          const x = toX(b.value);
          return (
            <g key={`boundary-${i}`}>
              <line x1={x} y1={LINE_Y - 14} x2={x} y2={LINE_Y + 14} stroke="var(--text-muted)" strokeWidth={1} />
              <text x={x} y={LINE_Y - 20} textAnchor="middle" className="ruler__tick-label mono">
                {b.operator} {b.value}
              </text>
            </g>
          );
        })}

        {testCases
          .filter((tc) => isPlottableNumber(tc.value))
          .map((tc, i) => {
            const x = toX(tc.value as number);
            const color = tc.source === "AI" ? "var(--ai)" : "var(--rule)";
            const isRaises = tc.execution_status === "raises";
            return (
              <g key={`point-${i}`}>
                <circle
                  cx={x}
                  cy={LINE_Y}
                  r={6}
                  fill={isRaises ? "var(--surface)" : color}
                  stroke={color}
                  strokeWidth={isRaises ? 2 : 0}
                />
                <text x={x} y={LINE_Y + 26} textAnchor="middle" className="ruler__value-label mono">
                  {String(tc.value)}
                </text>
              </g>
            );
          })}
      </svg>

      {nonNumeric.length > 0 && (
        <div className="ruler__non-numeric">
          {nonNumeric.map((tc, i) => (
            <span
              key={i}
              className={`chip ${tc.source === "AI" ? "chip--ai" : "chip--rule"} ${
                tc.execution_status === "raises" ? "chip--raises" : ""
              }`}
            >
              {tc.value === null ? "None" : `"${tc.value}"`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
