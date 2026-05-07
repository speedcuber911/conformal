"""Deterministic demo contracts for common cockpit questions.

These tests deliberately force the local fallback path, so they run in CI
without live LLM credentials. They protect the demo surface from responses that
have prose but no useful visual, or charts with no meaningful axes/data.
"""
from __future__ import annotations

import pytest

from backend.agents import analysis_planner, interpreter, presentation, query_executor
from backend.contracts import ChartSpec
from backend.duckdb_loader import open_database
from backend.pipeline import run_pipeline


DEMO_CONTRACTS = [
    {
        "id": "fy26_close_vs_plan",
        "question": "How is FY26 closing? Where are we vs plan?",
        "visual_types": {"bar_chart"},
        "must_mention": ["FY26", "plan", "shortfall"],
    },
    {
        "id": "revenue_12_months",
        "question": "revenue over last 12 months",
        "visual_types": {"line_chart"},
        "must_mention": ["revenue"],
    },
    {
        "id": "finance_time_series",
        "question": "Show me the revenue and EBITDA time series.",
        "visual_types": {"line_chart"},
        "must_mention": ["revenue", "EBITDA"],
    },
    {
        "id": "procurement_category",
        "question": "Show me procurement savings vs target by category. Time period: FY26 year-to-date",
        "visual_types": {"bar_chart"},
        "must_mention": ["procurement"],
    },
    {
        "id": "distributor_risk",
        "question": "Show me distributors who are buying less, paying late, and selling slow",
        "visual_types": {"bar_chart", "table"},
        "must_mention": ["distributor"],
    },
    {
        "id": "field_force_q4",
        "question": "How is the field force tracking this quarter?",
        "visual_types": {"bar_chart", "line_chart"},
        "must_mention": ["field"],
    },
    {
        "id": "regulatory_pipeline",
        "question": "What's in our regulatory pipeline?",
        "visual_types": {"bar_chart", "table"},
        "must_mention": ["pipeline"],
    },
    {
        "id": "ebitda_variance",
        "question": "Why did Q2 FY26 EBITDA miss budget?",
        "visual_types": {"bar_chart", "table"},
        "must_mention": ["EBITDA"],
    },
]


@pytest.fixture(scope="module")
def db():
    return open_database()


@pytest.fixture(autouse=True)
def force_local_agent_fallbacks(monkeypatch: pytest.MonkeyPatch):
    def timed_out(*_args, **_kwargs):
        raise TimeoutError("provider timed out during deterministic demo contract")

    monkeypatch.setattr(interpreter, "complete_json", timed_out)
    monkeypatch.setattr(analysis_planner, "complete_json", timed_out)
    monkeypatch.setattr(query_executor, "complete_json", timed_out)
    monkeypatch.setattr(presentation, "complete_text", timed_out)


@pytest.mark.parametrize("case", DEMO_CONTRACTS, ids=lambda case: case["id"])
def test_demo_question_has_answer_and_usable_visual(case, db):
    state, specs = run_pipeline(case["question"], conn=db)

    assert state.interpretation is not None
    assert state.interpretation.intent_understood is True

    assert state.plan is not None
    assert 1 <= len(state.plan.analyses) <= 4

    successful_results = [result for result in state.query_results if result.success and result.rows]
    assert successful_results, "no executed analysis returned data"

    assert state.presentation is not None
    assert state.presentation.narrative.strip()
    for needle in case["must_mention"]:
        assert needle.lower() in state.presentation.narrative.lower()

    assert specs
    assert len(specs) == len(state.presentation.layout)
    assert any(spec.type in case["visual_types"] for spec in specs)
    assert any(is_usable_visual(spec) for spec in specs), [
        spec.model_dump() for spec in specs
    ]


def is_usable_visual(spec: ChartSpec) -> bool:
    if spec.type in {"narrative_only", "kpi_card"}:
        return False
    if spec.type == "table":
        return len(spec.data) >= 2
    return len(spec.data) >= 2 and bool(spec.x_key) and bool(spec.y_key)
