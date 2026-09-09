# AI Edge Case Detector — Design Brainstorm

## Three Approaches

### 1. Laboratory Terminal
- **Theme Name**: Laboratory Terminal
- **Very Brief Intro**: A dark, technical workspace inspired by developer tools and CI/CD dashboards. Code input dominates the left, analysis results cascade on the right like a terminal output. Monospace-heavy with amber/green accent tokens.
- **Probability**: 0.07

### 2. Blueprint Studio
- **Theme Name**: Blueprint Studio
- **Very Brief Intro**: Clean, structured, and architectural. Uses a light canvas with grid lines, precise borders, and a muted blue-gray palette. Feels like a technical blueprint — every element has purpose and alignment.
- **Probability**: 0.04

### 3. Code Surgeon
- **Theme Name**: Code Surgeon
- **Very Brief Intro**: A surgical, high-precision interface where code is dissected under a microscope. Dark theme with teal/cyan accents, monospace code blocks, and card-based result panels that expand like medical charts. Minimal decoration, maximum signal.
- **Probability**: 0.06

---

## Chosen Approach: Laboratory Terminal

### Design Movement
Developer-tool aesthetic — inspired by VS Code, GitHub Actions, and CI/CD pipelines. The interface feels like a professional testing console, not a marketing page.

### Core Principles
1. **Code-first layout** — The code editor is the hero; results are the supporting actor
2. **Dense information, zero clutter** — Every pixel earns its place; no decorative whitespace
3. **Terminal hierarchy** — Results flow top-to-bottom like a structured log output
4. **Status-driven color** — Colors communicate state (boundary below = amber, boundary = green, boundary above = blue, null = red)

### Color Philosophy
- Background: Deep charcoal (#0d1117) — like GitHub Dark
- Surface: Slightly lighter (#161b22) — cards, panels
- Primary accent: Teal (#2dd4bf) — for active elements, buttons, highlights
- Code editor: Dark terminal gray (#1c1f27)
- Success/Green: #3fb950
- Warning/Amber: #d29922
- Danger/Red: #f85149
- Boundary category colors: Below=Amber, Exact=Green, Above=Blue (#58a6ff)

### Layout Paradigm
Split-panel: left side for code input (monospace editor feel), right side for analysis results. On smaller screens, stacks vertically with the editor on top. Results display as expandable cards per function.

### Signature Elements
1. Monospace font for all code-related content
2. Subtle dot-grid background pattern on panels
3. Left-border color strips on result cards indicating category

### Interaction Philosophy
- Instant feedback on button press (scale down)
- Results animate in with staggered reveals
- Function cards expand/collapse with smooth transitions
- Loading state shows a terminal-style progress indicator

### Animation
- Button press: scale(0.97) with 160ms ease-out
- Result cards: stagger entrance 40ms each, from opacity:0 + translateY(8px)
- Function name headers: fade in at 200ms
- Loading: pulsing dot animation (not a spinner — too generic)
- All transitions: cubic-bezier(0.23, 1, 0.32, 1)

### Typography System
- Headings/UI: "Inter" (medium, 500) — clean, legible for labels
- Code/Monospace: "JetBrains Mono" — for all code input, function names, values, and terminal-like output
- Body: "Inter" (regular, 400) — for descriptions and reasons

### Brand Essence
"A surgical testing console that exposes edge cases at a glance — for developers who test before they deploy."
Personality: Precise, Technical, No-nonsense

### Brand Voice
- Headlines: Direct and technical. "Analyze" not "Get Started"
- CTAs: Action verbs. "Run Analysis", "Clear", "Copy"
- Microcopy: Terminal-style status messages. "Ready", "Analyzing...", "No functions found"

### Wordmark & Logo
A bold icon: a magnifying glass overlapping a bracket `{}`, rendered in teal. No text needed — the name is in the header bar.

### Signature Brand Color
Teal (#2dd4bf) — used for primary buttons, active states, the logo icon, and the header accent line.
