# CLAUDE.md

This file is read by Claude Code on every invocation in this repo. Read it first.

## What this project is

A **demo-grade** AI-powered analytics chatbot for SFS (Shriram Farm Solutions). User asks a business question in natural language; the system plans analyses, queries data, and returns a response with narrative + tables + charts. Built to demo to a single executive (Anand at DCM Shriram). Will run on a laptop. Not production.

## Read these before doing non-trivial work

1. `docs/PRD.md` — what we're building and acceptance criteria
2. `docs/ARCHITECTURE.md` — system design, agent contracts, state model
3. `docs/SCHEMA.md` — the data model. Loaded verbatim into Agent 2 and Agent 3 system prompts at runtime.
4. `docs/AGENT_PROMPTS.md` — the four agent prompts, their inputs, outputs, examples
5. `docs/ANALYSIS_PATTERNS.md` — the library of analysis types Agent 2 uses
6. `docs/CHART_RULES.yaml` — visualization decision rubric
7. `docs/DEMO_SCRIPT.md` — the 5 demo questions with expected behavior

## How you should work in this repo

**Optimize for working code, not for production patterns.** This is a demo. Skip:
- Authentication, user accounts, sessions
- Logging frameworks (use `print()` and stdout)
- Docker, Kubernetes, deployment configs
- Monitoring, observability, metrics
- Database migrations (DuckDB is in-memory)
- CI/CD configurations
- Comprehensive error handling — handle the common cases, let the rest crash with a clear message

**Source-of-truth rules:**
- For SQL/schema decisions → `docs/SCHEMA.md` is authoritative
- For agent behavior → `docs/AGENT_PROMPTS.md` is authoritative
- For chart selection → `docs/CHART_RULES.yaml` is authoritative
- For "what should this do" → `docs/PRD.md` is authoritative
- If these conflict, ask the user which wins. Don't silently pick.

**Coding style:**
- Prefer functions over classes. Classes only for stateful things (the workflow state object).
- Prefer one file per concern over deep folder hierarchies.
- Type hints on all function signatures. Pydantic models for inter-agent contracts.
- Don't add comments that just restate the code. Do add comments for non-obvious *why*.
- Black-formatted Python, Prettier-formatted TS.

**Dependencies:**
- Pin versions in `pyproject.toml` and `package.json`.
- Ask before adding any new dependency. The stack is specified in `docs/ARCHITECTURE.md`; don't deviate without permission.

**Verification before claiming done:**
- After backend changes: run `pytest` if tests exist, or at minimum run `python -m backend.main` and confirm it starts.
- After frontend changes: run `npm run build` and confirm it compiles.
- After agent prompt changes: run the demo questions in `docs/DEMO_SCRIPT.md` end-to-end.
- Don't say "this should work now" — say "I ran X and got Y."

**When you're stuck:**
- If a doc is ambiguous, ask. Don't guess.
- If you hit a wall on prompt engineering, show the actual model output that's wrong before proposing a fix.
- If you want to deviate from the architecture, say so explicitly with the reason. Don't just do it.

## Conventions specific to this codebase

- **Money is INR.** Database stores rupees. UI displays crores (₹ Cr = INR / 1e7) or lakhs as appropriate. Always include the unit in column aliases (`revenue_cr`, `dso_days`, `premium_pct`).
- **Fiscal year is Apr–Mar.** FY25 = Apr 2024 to Mar 2025. Tables already have pre-computed `fiscal_year` and `fiscal_quarter` columns — use those; don't derive from dates.
- **Dates are stored as ISO strings** (`YYYY-MM-DD`), not native dates. Comparisons work; arithmetic needs `CAST(... AS DATE)`.
- **The four agents are**: Interpreter, AnalysisPlanner, QueryExecutor, PresentationDesigner. Use these exact names in code.
- **Workflow state** is a Pydantic model called `WorkflowState`, passed through the pipeline by reference.

## Don't

- Don't add a vector database, RAG, or retrieval layer. Schema fits in context.
- Don't add a framework like LangChain, LlamaIndex, or AutoGen. Raw Anthropic SDK calls only.
- Don't generate the chart spec inside an LLM call. Chart spec is deterministic Python.
- Don't put Recharts API details in any system prompt. The Planner picks chart families from a finite enum; the deterministic builder turns that into Recharts JSON.
- Don't change the four-agent architecture without asking. If the architecture seems wrong, surface it as a question, don't unilaterally redesign.
- Don't run more than 4 analyses per question (hard cap enforced in Agent 2's prompt).

## Project phases

Build in this order. Don't get ahead of yourself.

1. **Skeleton**: backend + frontend folders, FastAPI app, Vite+React app, DuckDB loader, one placeholder route. Confirm everything starts.
2. **Agents in isolation**: implement and test each of the 4 agents independently against fixed inputs. No frontend integration yet.
3. **Pipeline integration**: wire the agents together with the workflow state. Run the 5 demo questions end-to-end via CLI.
4. **Frontend integration**: chat UI, streaming narrative, chart rendering.
5. **Polish**: progressive disclosure UI ("Planning…", "Running analysis 1/3…"), error states, demo-mode CSS.

After each phase: stop and confirm with the user before starting the next.
