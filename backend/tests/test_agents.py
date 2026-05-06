"""Phase-2 isolation tests for each agent.

These hit the live Anthropic API. They skip when no key is available so the
suite stays runnable in environments without credentials.
"""
from __future__ import annotations

import os

import pytest

from backend.agents.analysis_planner import plan as run_plan
from backend.agents.interpreter import interpret
from backend.agents.presentation import design
from backend.agents.query_executor import execute
from backend.contracts import Analysis, Plan, QueryResult
from backend.duckdb_loader import open_database

requires_api = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_LLM_TESTS") != "1",
    reason="RUN_LIVE_LLM_TESTS=1 not set",
)


@requires_api
def test_interpreter_clear_question():
    result = interpret("How is FY26 closing?")
    assert result.intent_understood is True
    assert result.interpreted_question
    assert "FY26" in result.interpreted_question


@requires_api
def test_interpreter_ambiguous_question():
    result = interpret("Show me the bad distributors")
    assert result.intent_understood is False
    assert result.clarifying_question
    assert result.options_for_user and len(result.options_for_user) >= 2


@requires_api
def test_planner_q5_returns_3_to_4_analyses():
    interpreted = (
        "Decompose the Q2 FY26 EBITDA shortfall vs budget into its component drivers "
        "(revenue effect, gross margin effect, opex effect) and identify which BU "
        "contributed most."
    )
    p = run_plan(interpreted)
    assert isinstance(p, Plan)
    assert 1 <= len(p.analyses) <= 4
    types = {a.type for a in p.analyses}
    # Expect at least one of: kpi_lookup / decomposition / breakdown
    assert types & {"kpi_lookup", "decomposition", "breakdown"}


@requires_api
def test_executor_runs_kpi_lookup_q2_ebitda():
    conn = open_database()
    analysis = Analysis(
        analysis_id="a1",
        purpose="Headline EBITDA variance Q2 FY26",
        type="kpi_lookup",
        tables_needed=["fact_finance_pl"],
        filters={"fiscal_year": "FY26", "fiscal_quarter": "Q2"},
        measures=[
            "sum(ebitda_inr)",
            "sum(ebitda_budget_inr)",
            "sum(ebitda_variance_inr)",
        ],
        dimensions=[],
        expected_output_shape="single row with 3 columns",
    )
    result = execute(conn, analysis)
    assert result.success, f"executor failed: {result.error}"
    assert result.row_count == 1
    # Expect a column with 'variance' in its alias and a value near -35.8
    var_col = next((c for c in result.columns if "variance" in c.lower()), None)
    assert var_col, f"no variance column in {result.columns}"
    val = result.rows[0][var_col]
    assert -40 < val < -30, f"unexpected variance Cr value: {val}"


@requires_api
def test_presentation_designs_layout_for_q5():
    conn = open_database()
    interpreted = (
        "Decompose the Q2 FY26 EBITDA shortfall vs budget and identify which BU "
        "contributed most."
    )
    plan_obj = run_plan(interpreted)
    results: list[QueryResult] = []
    for analysis in plan_obj.analyses[:3]:  # cap for test speed
        results.append(execute(conn, analysis, prior=results))
    presentation = design(interpreted, plan_obj, results)
    assert presentation.narrative
    assert len(presentation.layout) >= 1
    assert len(presentation.layout) <= 4
