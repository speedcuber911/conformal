"""Pydantic models that pin the contracts between the four agents.

These mirror the schemas described in `Docs/ARCHITECTURE.md`. Keeping them in one
file makes the inter-agent boundaries explicit and lets the FastAPI layer
validate / serialise without scattered duplication.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# --- conversation -----------------------------------------------------------


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


# --- Agent 1: Interpreter ---------------------------------------------------


class InterpretationResult(BaseModel):
    intent_understood: bool
    interpreted_question: str | None = None
    implicit_assumptions: list[str] = Field(default_factory=list)
    clarifying_question: str | None = None
    options_for_user: list[str] | None = None


# --- Agent 2: AnalysisPlanner -----------------------------------------------


AnalysisType = Literal[
    "kpi_lookup",
    "trend",
    "breakdown",
    "ranking",
    "comparison",
    "decomposition",
    "correlation",
    "composite_score",
]


class Analysis(BaseModel):
    analysis_id: str
    purpose: str
    type: AnalysisType
    tables_needed: list[str]
    filters: dict[str, str] = Field(default_factory=dict)
    measures: list[str] = Field(default_factory=list)
    dimensions: list[str] = Field(default_factory=list)
    expected_output_shape: str


class Plan(BaseModel):
    analyses: list[Analysis]
    plan_rationale: str


# --- Agent 3: QueryExecutor -------------------------------------------------


class QueryResult(BaseModel):
    analysis_id: str
    sql: str
    success: bool
    error: str | None = None
    # We pass the DataFrame around as records so the model is JSON-serialisable;
    # callers that need a real DataFrame can wrap with `pd.DataFrame(...)`.
    rows: list[dict[str, Any]] = Field(default_factory=list)
    columns: list[str] = Field(default_factory=list)
    row_count: int = 0
    notable_observations: str = ""


# --- Chart Spec Builder (deterministic) -------------------------------------


ChartType = Literal[
    "kpi_card",
    "bar_chart",
    "line_chart",
    "stacked_bar",
    "scatter",
    "table",
    "narrative_only",
]


class ChartSpec(BaseModel):
    type: ChartType
    data: list[dict[str, Any]] = Field(default_factory=list)
    x_key: str | None = None
    y_key: str | None = None
    stack_keys: list[str] | None = None
    title: str | None = None
    subtitle: str | None = None
    y_label: str | None = None


# --- Agent 4: PresentationDesigner ------------------------------------------


class PresentationElement(BaseModel):
    type: ChartType
    analysis_id: str | None = None
    title: str
    subtitle: str | None = None
    chart_options: dict[str, Any] | None = None
    table_options: dict[str, Any] | None = None


class Presentation(BaseModel):
    narrative: str
    layout: list[PresentationElement] = Field(default_factory=list)
    key_observations: list[str] = Field(default_factory=list)


# --- Workflow state ---------------------------------------------------------


class WorkflowState(BaseModel):
    user_question: str
    conversation_history: list[Message] = Field(default_factory=list)

    interpretation: InterpretationResult | None = None
    plan: Plan | None = None
    query_results: list[QueryResult] = Field(default_factory=list)
    presentation: Presentation | None = None

    started_at: datetime = Field(default_factory=datetime.utcnow)
    errors: list[str] = Field(default_factory=list)
