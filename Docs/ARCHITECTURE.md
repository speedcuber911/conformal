# ARCHITECTURE

## The system in one diagram

```
                          User
                            │
                            ▼
                  ┌───────────────────┐
                  │   React Frontend  │
                  │  (chat UI + viz)  │
                  └─────────┬─────────┘
                            │ POST /query (SSE response)
                            ▼
            ┌───────────────────────────────────┐
            │       FastAPI Backend             │
            │                                   │
            │  ┌──────────────────────────┐     │
            │  │  Agent 1: Interpreter    │ ←─── conversation history
            │  └────────────┬─────────────┘     │
            │               │ {clear|clarify}   │
            │       (if clarify, return)        │
            │               ▼                   │
            │  ┌──────────────────────────┐     │
            │  │  Agent 2: AnalysisPlanner│ ←─── SCHEMA.md
            │  └────────────┬─────────────┘     │
            │               │ plan: [analyses]  │
            │               ▼                   │
            │  ┌──────────────────────────┐     │
            │  │  Agent 3: QueryExecutor  │ ←─── SCHEMA.md
            │  │  (loops over plan)       │     │
            │  │                          │     │
            │  │  for each analysis:      │     │
            │  │   - generate SQL         │     │
            │  │   - execute on DuckDB    │     │
            │  │   - capture observations │     │
            │  └────────────┬─────────────┘     │
            │               │ results: [DFs]    │
            │               ▼                   │
            │  ┌──────────────────────────┐     │
            │  │  Chart Spec Builder      │     │
            │  │  (deterministic Python)  │ ←─── CHART_RULES.yaml
            │  └────────────┬─────────────┘     │
            │               │ specs: [chart_*]  │
            │               ▼                   │
            │  ┌──────────────────────────┐     │
            │  │  Agent 4: PresentDesigner│     │
            │  │  (streamed)              │     │
            │  └────────────┬─────────────┘     │
            │               │ payload+narrative │
            └───────────────┼───────────────────┘
                            ▼
                  ┌───────────────────┐
                  │   DuckDB (in-mem) │ ←─── docs/sfs_demo_dataset.xlsx
                  │                   │      (one sheet per table, loaded at startup)
                  └───────────────────┘
```

## Component-by-component

### Frontend (React + Vite + TypeScript + Recharts)

Single-page chat interface. Three regions:
- **Header**: app name, "demo mode" badge
- **Message list**: scrolling conversation. Each assistant turn is a card containing optional plan display + narrative + tables + charts
- **Input**: text box, send button

State managed with `useState`. Conversation history is an array of `{role, content, attachments}`. No persistence. Page refresh = fresh session.

Streaming via SSE (`EventSource` API). Each event has a `type` field: `interpretation`, `plan`, `analysis_started`, `analysis_complete`, `narrative_chunk`, `presentation`, `done`, `error`. Frontend updates UI incrementally as events arrive.

Chart rendering: `<Chart>` component switches on `spec.type` and renders the appropriate Recharts primitive (`<BarChart>`, `<LineChart>`, etc.).

### Backend (FastAPI + Python 3.11+)

Single FastAPI app. One main route: `POST /query`. SSE response streams workflow events.

Loads all sheets from `docs/sfs_demo_dataset.xlsx` into DuckDB at startup, one DuckDB table per sheet (sheet name = table name; the `README` sheet is skipped). Schema doc loaded from `docs/SCHEMA.md` at startup, cached as a string.

Anthropic SDK for all LLM calls. One `AsyncAnthropic` client, reused across requests.

### DuckDB

In-memory database, populated at startup from `docs/sfs_demo_dataset.xlsx`. Each sheet becomes a DuckDB table (table name = sheet name). The `README` sheet is metadata and is not loaded.

```python
import duckdb
import pandas as pd

XLSX_PATH = "docs/sfs_demo_dataset.xlsx"
SKIP_SHEETS = {"README"}

conn = duckdb.connect(":memory:")
xl = pd.ExcelFile(XLSX_PATH)
for sheet in xl.sheet_names:
    if sheet in SKIP_SHEETS:
        continue
    df = pd.read_excel(xl, sheet_name=sheet)
    conn.register("_df", df)
    conn.execute(f"CREATE TABLE {sheet} AS SELECT * FROM _df")
    conn.unregister("_df")
```

Connection is shared across requests. DuckDB is thread-safe for reads.

## The four agents — contracts

All agent inputs/outputs are Pydantic models. The full models are in `backend/contracts.py`. Below is the conceptual schema for each.

### Agent 1: Interpreter

**Purpose**: Decide if the question is clear enough to plan against, or needs clarification.

**Inputs**:
- `user_question: str`
- `conversation_history: list[Message]` — last N turns
- `schema_overview: str` — table names + 1-line descriptions only (NOT full schema)

**Outputs**:
```python
class InterpretationResult(BaseModel):
    intent_understood: bool
    interpreted_question: str | None  # rephrased, self-contained version
    implicit_assumptions: list[str]   # e.g. ["Q2 FY26 = Jul-Sep 2025", "miss = below budget"]
    clarifying_question: str | None
    options_for_user: list[str] | None  # if showing multiple-choice clarification
```

If `intent_understood == False`, the pipeline returns the clarifying question to the user and stops. Otherwise pipeline continues with `interpreted_question`.

**Model**: Claude Sonnet 4.6 (could be Haiku 4.5 in v2 for latency)

### Agent 2: AnalysisPlanner

**Purpose**: Decompose the interpreted question into a list of analytical tasks.

**Inputs**:
- `interpreted_question: str`
- `implicit_assumptions: list[str]`
- `schema: str` — full SCHEMA.md content
- `analysis_patterns: str` — content of ANALYSIS_PATTERNS.md (for grounding)

**Outputs**:
```python
class Analysis(BaseModel):
    analysis_id: str  # "a1", "a2", ...
    purpose: str  # natural-language description of what this answers
    type: AnalysisType  # enum: kpi_lookup, trend, breakdown, ranking, comparison, decomposition, correlation
    tables_needed: list[str]
    filters: dict[str, str] = {}
    measures: list[str] = []
    dimensions: list[str] = []
    expected_output_shape: str  # e.g. "3-4 row table"

class Plan(BaseModel):
    analyses: list[Analysis]  # max 4
    plan_rationale: str
```

**Constraints enforced in prompt**:
- Maximum 4 analyses (hard cap)
- Each analysis must be independently meaningful
- Prefer breadth over depth

**Model**: Claude Sonnet 4.6

### Agent 3: QueryExecutor

**Purpose**: Per analysis, generate SQL, execute on DuckDB, capture results and observations.

**This is a loop**, not a single call. One LLM call per analysis. Subsequent calls see prior results' summaries.

**Inputs (per iteration)**:
- `analysis: Analysis` — the spec from the plan
- `schema: str` — full SCHEMA.md content
- `prior_results_summary: list[ResultSummary]` — shape + key facts of previous analyses, NOT full data

**Outputs (per iteration)**:
```python
class QueryResult(BaseModel):
    analysis_id: str
    sql: str
    success: bool
    error: str | None
    result_df: pd.DataFrame | None  # full result, passed by reference
    row_count: int
    notable_observations: str  # 1-2 sentences flagging anything noteworthy
```

**Error handling**: If SQL fails (DuckDB raises), append the error to the prompt and retry once. If still failing, mark `success=False` and continue to the next analysis. The Presenter sees which analyses succeeded.

**Model**: Claude Sonnet 4.6

### Chart Spec Builder (deterministic, not an agent)

**Purpose**: Translate (DataFrame, chart_hint) → Recharts-compatible JSON spec.

**Inputs**:
- `df: pd.DataFrame`
- `chart_hint: ChartType` enum (bar, line, stacked_bar, kpi_card, scatter, table, none)

**Output**:
```python
class ChartSpec(BaseModel):
    type: str
    data: list[dict]  # df.to_dict("records")
    x_key: str | None
    y_key: str | None
    stack_keys: list[str] | None
    title: str | None
    subtitle: str | None
    y_label: str | None  # humanized from column suffix
```

**Logic**: switch on `chart_hint`. For each, infer columns from DataFrame structure (first column = x-axis usually, second = measure). Apply unit-suffix humanization (`_cr` → "₹ Cr", `_pct` → "%", `_days` → "days") to label outputs.

But wait — Agent 2 doesn't emit `chart_hint` directly. **Chart selection happens later, in Agent 4**. The flow is:
1. Agent 3 produces results (DataFrames, no chart info yet)
2. Agent 4 sees all results together and decides per-result presentation type
3. For each result Agent 4 marks as a chart, the deterministic builder constructs the spec

This is a deviation from the simpler architecture and matters: putting chart selection in Agent 4 lets it design the *whole presentation* coherently rather than each analysis picking its chart in isolation.

**Code location**: `backend/chart_spec.py`

### Agent 4: PresentationDesigner

**Purpose**: Given all analysis results, decide the presentation layout and write the unified narrative.

**Inputs**:
- `interpreted_question: str`
- `plan: Plan`
- `results: list[QueryResult]` — full results, but DataFrames summarized (first 20 rows + aggregates)
- `chart_rules: str` — content of CHART_RULES.yaml

**Outputs (streamed)**:
```python
class Presentation(BaseModel):
    narrative: str  # markdown, written first/streamed
    layout: list[PresentationElement]
    key_observations: list[str]

class PresentationElement(BaseModel):
    type: Literal["kpi_card", "bar_chart", "line_chart", "stacked_bar", "scatter", "table", "narrative_only"]
    analysis_id: str | None  # which analysis result feeds this; None for narrative-only
    title: str
    subtitle: str | None
    chart_options: dict | None  # passed through to chart spec builder if chart type
    table_options: dict | None  # e.g. {"highlight_row": "CCC"}
```

**The narrative streams first**, then the layout JSON arrives at the end. Frontend renders narrative as it streams; layout elements pop in once layout is parsed.

**Important**: this agent does NOT see SQL. It sees results and observations only. Same separation-of-concerns rule as the simpler architecture.

**Model**: Claude Sonnet 4.6

## Workflow state

A single Pydantic model that accumulates as the pipeline runs:

```python
class WorkflowState(BaseModel):
    user_question: str
    conversation_history: list[Message] = []

    # Filled by Agent 1
    interpretation: InterpretationResult | None = None

    # Filled by Agent 2
    plan: Plan | None = None

    # Filled by Agent 3 (one entry per analysis)
    query_results: list[QueryResult] = []

    # Filled by Agent 4
    presentation: Presentation | None = None

    # Pipeline meta
    started_at: datetime
    errors: list[str] = []
```

Held in memory for the duration of one request. Discarded when the response completes.

## Streaming protocol (SSE events)

Events the backend emits during a request, in order:

| event type | data | when |
|---|---|---|
| `interpretation` | `InterpretationResult` JSON | After Agent 1 completes |
| `plan` | `Plan` JSON | After Agent 2 completes |
| `analysis_started` | `{analysis_id, purpose}` | When Agent 3 starts each analysis |
| `analysis_complete` | `{analysis_id, success, row_count, notable_observations}` | When each analysis finishes |
| `narrative_chunk` | `{text: "..."}` | Streamed tokens from Agent 4's narrative |
| `presentation` | `{layout, chart_specs}` | After Agent 4's layout JSON parses |
| `done` | `{}` | Pipeline complete |
| `error` | `{stage, message}` | On any unrecoverable failure |

Frontend listens to these and updates UI incrementally. The progressive disclosure (showing the plan, then "running analysis 1/3", then the narrative streaming, then charts popping in) is the demo's "thinking partner" feel.

## File structure

```
sfs-chatbot/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md         # this file
│   ├── SCHEMA.md
│   ├── AGENT_PROMPTS.md
│   ├── ANALYSIS_PATTERNS.md
│   ├── CHART_RULES.yaml
│   ├── DEMO_SCRIPT.md
│   └── sfs_demo_dataset.xlsx   # one sheet per table; loaded into DuckDB at startup
├── backend/
│   ├── main.py                 # FastAPI app, /query route, SSE
│   ├── contracts.py            # Pydantic models for all inter-agent contracts
│   ├── state.py                # WorkflowState
│   ├── duckdb_loader.py        # XLSX sheets → DuckDB at startup
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── interpreter.py      # Agent 1
│   │   ├── analysis_planner.py # Agent 2
│   │   ├── query_executor.py   # Agent 3
│   │   └── presentation.py     # Agent 4
│   ├── chart_spec.py           # deterministic Recharts spec builder
│   ├── prompts/                # prompt templates loaded at startup
│   │   ├── interpreter.md
│   │   ├── planner.md
│   │   ├── executor.md
│   │   └── presenter.md
│   └── tests/
│       ├── test_agents.py      # per-agent unit tests
│       └── test_demo_e2e.py    # all 5 demo questions end-to-end
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts              # SSE client
│   │   ├── types.ts            # mirrors backend contracts
│   │   └── components/
│   │       ├── ChatInput.tsx
│   │       ├── MessageList.tsx
│   │       ├── AssistantMessage.tsx  # composite: narrative + layout
│   │       ├── PlanDisplay.tsx
│   │       ├── ProgressIndicator.tsx
│   │       ├── KpiCard.tsx
│   │       ├── DataTable.tsx
│   │       └── Chart.tsx       # Recharts dispatcher
│   ├── package.json
│   └── vite.config.ts
├── .env.example                # ANTHROPIC_API_KEY
├── pyproject.toml
└── README.md                   # quickstart: how to run locally
```

## Stack — pinned versions

### Backend
- Python 3.11+
- FastAPI 0.115+
- Uvicorn 0.30+
- DuckDB 1.x
- Pandas 2.x
- Anthropic 0.40+
- Pydantic 2.x
- PyYAML 6.x (for CHART_RULES.yaml)
- openpyxl 3.x (xlsx loader engine for pandas)

### Frontend
- Node 20+
- Vite 5.x
- React 18.x
- TypeScript 5.x
- Recharts 2.12+
- react-markdown 9.x + remark-gfm 4.x

### Why these
- **DuckDB over Postgres/Snowflake**: zero ops, sub-second analytical queries on this dataset, embedded in the Python process
- **FastAPI over Flask/Django**: native async (matters for concurrent agent calls in v2), built-in SSE support, Pydantic integration
- **Vite over Next.js**: faster local dev iteration, no SSR complexity needed for a demo
- **Recharts over Chart.js/Plotly**: declarative React components, integrates with state cleanly, looks professional out of the box
- **Raw Anthropic SDK over LangChain/LlamaIndex**: framework overhead exceeds value at this scale; debugging stays simple

## Latency budget

| Stage | Time | Cumulative |
|---|---|---|
| Agent 1 (Interpreter) | ~1s | 1s |
| Agent 2 (AnalysisPlanner) | ~3-4s | 5s |
| Agent 3 (QueryExecutor × N) | ~2s × 3 | 11s |
| Chart Spec Builder | ~50ms | 11s |
| Agent 4 (Presenter) starts streaming | ~1s | 12s |
| Agent 4 finishes | ~3s of streaming | 15s |

Total: 13-15 seconds. Mitigated by progressive UI throughout.

## What's deliberately not in this architecture

- **No agent framework** (LangChain etc.). Direct SDK calls, less to debug.
- **No vector DB / RAG.** Schema fits in 4K tokens.
- **No tool-use / function-calling.** Fixed pipeline, simpler reasoning surface.
- **No conversation memory across sessions.** State dies with the request.
- **No fine-tuning.** Off-the-shelf Claude Sonnet 4.6.
- **No caching.** Every query runs fresh. (For demo robustness, consider caching the 5 scripted plans — see PRD.)

## Future-state evolution (NOT for this build)

For reference only — these are explicitly out of scope:

- Real warehouse connection (Snowflake/Databricks) replacing static CSVs
- Authentication and multi-user with isolated schemas
- Conversation memory across sessions, with a vector DB of past Q&A
- Tool use in Agent 3 (e.g., call external commodity APIs)
- Custom widget builder for users to save and rerun analyses
- Email/Slack delivery of scheduled reports
- Mobile-responsive UI

These are listed only so that current architectural decisions don't accidentally foreclose them.
