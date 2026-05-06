"""End-to-end pipeline that runs the four agents against a single question.

Used by both the CLI (`backend.cli`) and the FastAPI route (`backend.main`),
so the orchestration logic lives in one place.

Phase 3: synchronous, no streaming. Phase 4 will add SSE event emission either
by adding a callback hook or by wrapping this function.
"""
from __future__ import annotations

from typing import Callable

import duckdb

from backend.agents.analysis_planner import plan as run_plan
from backend.agents.interpreter import interpret
from backend.agents.presentation import design, design_streaming
from backend.agents.query_executor import execute
from backend.chart_spec import build_spec
from backend.contracts import ChartSpec, Message, WorkflowState

ProgressCallback = Callable[[str, dict], None] | None


def run_pipeline(
    question: str,
    conn: duckdb.DuckDBPyConnection,
    history: list[Message] | None = None,
    on_event: ProgressCallback = None,
    *,
    stream_narrative: bool = False,
) -> tuple[WorkflowState, list[ChartSpec]]:
    """Run the full pipeline for one question.

    Returns the populated `WorkflowState` plus a list of `ChartSpec`s aligned
    1:1 with `state.presentation.layout` (or empty if the run terminated at
    the clarification step).

    `on_event` is invoked at each stage boundary so transport layers (SSE,
    CLI logger) can show progress without tangling the agent code.

    When `stream_narrative=True`, the presenter streams narrative tokens via
    extra `narrative_chunk` events before the final `presentation` event.
    """
    state = WorkflowState(user_question=question, conversation_history=history or [])
    fire = on_event or (lambda *_args, **_kw: None)

    state.interpretation = interpret(question, history)
    fire("interpretation", state.interpretation.model_dump())

    if not state.interpretation.intent_understood:
        # Pipeline stops here — frontend renders the clarification.
        fire("done", {})
        return state, []

    interpreted = state.interpretation.interpreted_question or question
    state.plan = run_plan(interpreted, state.interpretation.implicit_assumptions)
    fire("plan", state.plan.model_dump())

    for analysis in state.plan.analyses:
        fire("analysis_started", {"analysis_id": analysis.analysis_id, "purpose": analysis.purpose})
        result = execute(conn, analysis, prior=state.query_results)
        state.query_results.append(result)
        fire(
            "analysis_complete",
            {
                "analysis_id": result.analysis_id,
                "success": result.success,
                "row_count": result.row_count,
                "notable_observations": result.notable_observations,
                "error": result.error,
            },
        )

    if stream_narrative:
        def on_token(chunk: str) -> None:
            fire("narrative_chunk", {"text": chunk})

        state.presentation = design_streaming(
            interpreted, state.plan, state.query_results, on_token=on_token
        )
    else:
        state.presentation = design(interpreted, state.plan, state.query_results)

    chart_specs = _build_chart_specs(state)
    # Send the chart_specs alongside the layout so the frontend can render
    # in one step once the layout JSON has parsed.
    fire(
        "presentation",
        {
            **state.presentation.model_dump(),
            "chart_specs": [s.model_dump() for s in chart_specs],
        },
    )
    fire("done", {})
    return state, chart_specs


def _build_chart_specs(state: WorkflowState) -> list[ChartSpec]:
    if not state.presentation:
        return []
    by_id = {r.analysis_id: r for r in state.query_results}
    specs: list[ChartSpec] = []
    for element in state.presentation.layout:
        result = by_id.get(element.analysis_id) if element.analysis_id else None
        specs.append(build_spec(element, result))
    return specs
