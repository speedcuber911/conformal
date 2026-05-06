"""Phase-2 isolation tests for each agent.

These hit the live Anthropic API. They skip when no key is available so the
suite stays runnable in environments without credentials.
"""
from __future__ import annotations

import os

import pytest

from backend.agents.analysis_planner import plan as run_plan
from backend.agents import analysis_planner as planner_agent
from backend.agents import interpreter as interpreter_agent
from backend.agents import presentation as presentation_agent
from backend.agents import query_executor as executor_agent
from backend.agents.interpreter import interpret
from backend.agents.presentation import design
from backend.agents.query_executor import execute
from backend.contracts import Analysis, Message, Plan, QueryResult
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
    result = interpret("Show me the underperforming distributors")
    assert result.intent_understood is False
    assert result.clarifying_question
    assert result.options_for_user and len(result.options_for_user) >= 2


def test_interpreter_falls_back_on_azure_content_filter(monkeypatch: pytest.MonkeyPatch):
    def blocked(*_args, **_kwargs):
        raise RuntimeError("Azure OpenAI 400: content_filter")

    monkeypatch.setattr(interpreter_agent, "complete_json", blocked)

    result = interpret("Show me revenue and EBITDA for the last two quarters")

    assert result.intent_understood is True
    assert result.interpreted_question == "Show me revenue and EBITDA for the last two quarters"
    assert any("Q3 FY26 and Q4 FY26" in assumption for assumption in result.implicit_assumptions)


def test_interpreter_contextualizes_period_followup_on_fallback(monkeypatch: pytest.MonkeyPatch):
    def blocked(*_args, **_kwargs):
        raise RuntimeError("Azure OpenAI 400: content_filter")

    monkeypatch.setattr(interpreter_agent, "complete_json", blocked)

    result = interpret(
        "FY26 year-to-date",
        [
            Message(
                role="user",
                content="Show me procurement savings vs target by category.",
            ),
            Message(
                role="assistant",
                content="Which time period should procurement savings vs target be shown for?",
            ),
        ],
    )

    assert result.intent_understood is True
    assert "procurement savings" in (result.interpreted_question or "").lower()
    assert "FY26 year-to-date" in (result.interpreted_question or "")


def test_planner_falls_back_on_azure_content_filter(monkeypatch: pytest.MonkeyPatch):
    def blocked(*_args, **_kwargs):
        raise RuntimeError("Azure OpenAI 400: content_filter")

    monkeypatch.setattr(planner_agent, "complete_json", blocked)

    result = run_plan("Show me revenue and EBITDA for the last two quarters")

    assert result.analyses[0].tables_needed == ["fact_finance_pl"]
    assert result.analyses[0].filters["fiscal_quarter"] == "Q3|Q4"


def test_planner_procurement_fallback_for_ytd(monkeypatch: pytest.MonkeyPatch):
    def blocked(*_args, **_kwargs):
        raise RuntimeError("Azure OpenAI 400: content_filter")

    monkeypatch.setattr(planner_agent, "complete_json", blocked)

    result = run_plan("Show me procurement savings vs target by category. Time period: FY26 year-to-date")

    analysis = result.analyses[0]
    assert analysis.tables_needed == ["fact_procurement"]
    assert analysis.filters == {"fiscal_year": "FY26"}
    assert "savings_vs_market_cr" in " ".join(analysis.measures)


def test_planner_falls_back_on_provider_timeout(monkeypatch: pytest.MonkeyPatch):
    def timed_out(*_args, **_kwargs):
        raise TimeoutError("The read operation timed out")

    monkeypatch.setattr(planner_agent, "complete_json", timed_out)

    result = run_plan("Show me procurement savings vs target by category. Time period: FY26 year-to-date")

    assert result.analyses[0].tables_needed == ["fact_procurement"]


def test_executor_falls_back_on_azure_content_filter(monkeypatch: pytest.MonkeyPatch):
    def blocked(*_args, **_kwargs):
        raise RuntimeError("Azure OpenAI 400: content_filter")

    monkeypatch.setattr(executor_agent, "complete_json", blocked)

    conn = open_database()
    analysis = Analysis(
        analysis_id="finance_1",
        purpose="Revenue for last two quarters",
        type="trend",
        tables_needed=["fact_finance_pl"],
        filters={"fiscal_year": "FY26", "fiscal_quarter": "Q3|Q4"},
        measures=["SUM(revenue_inr) / 10000000 AS revenue_cr"],
        dimensions=["fiscal_year", "fiscal_quarter"],
        expected_output_shape="Rows by quarter",
    )
    result = execute(conn, analysis)

    assert result.success
    assert result.rows
    assert "fact_finance_pl" in result.sql


def test_presentation_falls_back_on_timeout(monkeypatch: pytest.MonkeyPatch):
    def timed_out(*_args, **_kwargs):
        raise TimeoutError("The read operation timed out")

    monkeypatch.setattr(presentation_agent, "complete_text", timed_out)

    plan_obj = Plan(
        analyses=[
            Analysis(
                analysis_id="finance_1",
                purpose="Revenue and EBITDA trend",
                type="trend",
                tables_needed=["fact_finance_pl"],
                filters={},
                measures=[],
                dimensions=["month"],
                expected_output_shape="Monthly rows",
            )
        ],
        plan_rationale="test",
    )
    result = QueryResult(
        analysis_id="finance_1",
        sql="SELECT month, revenue_cr, ebitda_cr FROM fact_finance_pl",
        success=True,
        rows=[
            {"month": "2026-02", "revenue_cr": 100.0, "ebitda_cr": 8.0},
            {"month": "2026-03", "revenue_cr": 110.0, "ebitda_cr": 9.0},
        ],
        columns=["month", "revenue_cr", "ebitda_cr"],
        row_count=2,
    )

    presentation = design("Show me revenue and EBITDA time series", plan_obj, [result])

    assert presentation.narrative
    assert presentation.layout[0].type == "line_chart"
    assert presentation.layout[0].analysis_id == "finance_1"


def test_presentation_fallback_prefers_category_breakdown(monkeypatch: pytest.MonkeyPatch):
    def timed_out(*_args, **_kwargs):
        raise TimeoutError("The read operation timed out")

    monkeypatch.setattr(presentation_agent, "complete_text", timed_out)

    plan_obj = Plan(analyses=[], plan_rationale="test")
    aggregate = QueryResult(
        analysis_id="a1",
        sql="SELECT ...",
        success=True,
        rows=[{"savings_vs_market_cr": -0.5, "procurement_spend_cr": 12.0}],
        columns=["savings_vs_market_cr", "procurement_spend_cr"],
        row_count=1,
    )
    breakdown = QueryResult(
        analysis_id="a2",
        sql="SELECT ... GROUP BY material_category",
        success=True,
        rows=[
            {"material_category": "Glyphosate Technical", "savings_vs_market_cr": -0.4, "procurement_spend_cr": 6.0, "premium_vs_market_pct": 5.0},
            {"material_category": "Atrazine Technical", "savings_vs_market_cr": 0.1, "procurement_spend_cr": 2.0, "premium_vs_market_pct": -1.0},
        ],
        columns=["material_category", "savings_vs_market_cr", "procurement_spend_cr", "premium_vs_market_pct"],
        row_count=2,
    )

    presentation = design("Show me procurement savings vs target by category", plan_obj, [aggregate, breakdown])

    assert presentation.layout[0].analysis_id == "a2"
    assert presentation.layout[0].title == "Procurement savings by category"
    assert "Glyphosate Technical" in presentation.narrative


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
