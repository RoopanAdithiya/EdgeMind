import { useState, useRef } from 'react'
import './App.css'

const API_URL = 'http://localhost:8000'

const CATEGORY_COLOR = {
  'Boundary Below': 'var(--below)',
  'Boundary': 'var(--boundary)',
  'Boundary Above': 'var(--above)',
  'Null': 'var(--null)',
}

const EXAMPLE_CODE = `def isEligible(age):
    if age >= 18:
        return True
    return False

def is_valid_password(password):
    if len(password) >= 8:
        return True
    return False`

function formatValue(v) {
  if (v === null) return 'None'
  if (typeof v === 'string') return `"${v}"`
  return String(v)
}

function chunkTriples(cases) {
  const boundaryTypes = new Set(['Boundary Below', 'Boundary', 'Boundary Above'])
  const boundaryCases = cases.filter((c) => boundaryTypes.has(c.category))
  const triples = []
  for (let i = 0; i < boundaryCases.length; i += 3) {
    triples.push(boundaryCases.slice(i, i + 3))
  }
  return { triples }
}

function toPytestParametrize(functionName, variable, cases) {
  const values = cases.map((c) => (c.value === null ? 'None' : JSON.stringify(c.value)))
  return `@pytest.mark.parametrize("${variable}", [\n    ${values.join(',\n    ')}\n])\ndef test_${functionName}_${variable}(${variable}):\n    result = ${functionName}(${variable})\n    # TODO: assert expected behaviour for each case\n`
}

function BoundaryRuler({ variable, triple }) {
  return (
    <div className="ruler">
      <div className="ruler-label">{variable}</div>
      <div className="ruler-track">
        <div className="ruler-line" />
        {triple.map((tc, i) => (
          <div
            className="ruler-tick"
            key={i}
            style={{ '--tick-color': CATEGORY_COLOR[tc.category] || 'var(--text-muted)' }}
          >
            <div className="ruler-dot" />
            <div className="ruler-value">{formatValue(tc.value)}</div>
            <div className="ruler-tag">{tc.category}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FunctionResultCard({ functionResult, index, copiedKey, onCopyExport }) {
  const { function: fn, test_cases } = functionResult

  const casesByVariable = {}
  for (const tc of test_cases) {
    if (!casesByVariable[tc.variable]) casesByVariable[tc.variable] = []
    casesByVariable[tc.variable].push(tc)
  }

  const noConditions = Object.keys(casesByVariable).length === 0

  return (
    <div className="function-card">
      <div className="function-summary">
        <span className="function-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="mono">{fn.name}</span>
        <span className="text-muted">({fn.parameters.map((p) => p.name).join(', ')})</span>
      </div>

      {noConditions && (
        <div className="empty-state small">
          No numeric boundary conditions found in this function — nothing
          to generate yet at the rule-based stage. (String equality checks
          like <code>role == "admin"</code> will get value cases once the
          AI stage is added.)
        </div>
      )}

      {Object.entries(casesByVariable).map(([variable, cases]) => {
        const { triples } = chunkTriples(cases)
        const key = `${fn.name}:${variable}`
        return (
          <div className="variable-block" key={variable}>
            {triples.map((triple, i) => (
              <BoundaryRuler variable={variable} triple={triple} key={i} />
            ))}

            <table className="cases-table">
              <thead>
                <tr>
                  <th>Value</th>
                  <th>Category</th>
                  <th>Reason</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((tc, i) => (
                  <tr key={i}>
                    <td className="mono">{formatValue(tc.value)}</td>
                    <td>
                      <span
                        className="badge"
                        style={{ '--badge-color': CATEGORY_COLOR[tc.category] || 'var(--text-muted)' }}
                      >
                        {tc.category}
                      </span>
                    </td>
                    <td className="reason-cell">{tc.reason}</td>
                    <td>
                      <span className={`source-tag source-${tc.source === 'AI' ? 'ai' : 'rule'}`}>
                        {tc.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button className="export-btn" onClick={() => onCopyExport(fn.name, variable, cases)}>
              {copiedKey === key ? 'Copied ✓' : `Export ${variable} as pytest →`}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function App() {
  const [code, setCode] = useState(EXAMPLE_CODE)
  const [language, setLanguage] = useState('python')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [functions, setFunctions] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const [fileName, setFileName] = useState(null)
  const fileInputRef = useRef(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setFunctions(null)
    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Analysis failed.')
      }
      setFunctions(data.functions)
    } catch (e) {
      setError(e.message || 'Could not reach the EdgeMind API. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.py')) {
      setError('Please upload a .py file.')
      return
    }
    setError(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => setCode(evt.target.result)
    reader.readAsText(file)
  }

  function handleCopyExport(functionName, variable, cases) {
    const snippet = toPytestParametrize(functionName, variable, cases)
    navigator.clipboard.writeText(snippet).catch(() => {})
    const key = `${functionName}:${variable}`
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">::</span>
          <span className="brand-name">EdgeMind</span>
        </div>
        <div className="tagline">context-aware edge-case test generation</div>
      </header>

      <main className="layout">
        <section className="panel input-panel">
          <div className="panel-header">
            <span className="panel-title">01&nbsp;&nbsp;Paste or upload code</span>
            <select
              className="lang-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="python">Python</option>
              <option value="java" disabled>
                Java (soon)
              </option>
            </select>
          </div>

          <div className="upload-row">
            <button className="upload-btn" onClick={() => fileInputRef.current?.click()}>
              Upload .py file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".py"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {fileName && <span className="file-name">{fileName}</span>}
          </div>

          <textarea
            className="code-input"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setFileName(null)
            }}
            spellCheck={false}
          />
          <button className="generate-btn" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Analyzing…' : 'Generate edge cases →'}
          </button>
          {error && <div className="error-box">{error}</div>}
        </section>

        <section className="panel results-panel">
          <div className="panel-header">
            <span className="panel-title">02&nbsp;&nbsp;Boundaries &amp; test cases</span>
            {functions && (
              <span className="function-count">
                {functions.length} function{functions.length !== 1 ? 's' : ''} analyzed
              </span>
            )}
          </div>

          {!functions && !loading && (
            <div className="empty-state">
              Paste a function (or a whole file with several) and click
              Generate. Every function found gets its own boundary
              breakdown — nothing is silently dropped.
            </div>
          )}

          {loading && <div className="empty-state">Walking the AST…</div>}

          {functions && (
            <div className="results-body">
              {functions.map((fr, i) => (
                <FunctionResultCard
                  key={fr.function.name + i}
                  functionResult={fr}
                  index={i}
                  copiedKey={copiedKey}
                  onCopyExport={handleCopyExport}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
