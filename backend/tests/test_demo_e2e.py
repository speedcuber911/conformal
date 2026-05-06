"""End-to-end demo tests for the 5 scripted questions in DEMO_SCRIPT.md.

These hit the live API and run the full pipeline. They are smoke tests, not
exact-match: narrative wording will vary, but the structural assertions
(intent_understood, analysis count, presentation has at least one visual,
narrative mentions key tokens) should hold every run.

Skipped automatically unless RUN_LIVE_LLM_TESTS=1 is set.
"""
from __future__ import annotations

import os

import pytest

from backend.duckdb_loader import open_database
from backend.pipeline import run_pipeline

requires_api = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_LLM_TESTS") != "1",
    reason="RUN_LIVE_LLM_TESTS=1 not set",
)


DEMO_QUESTIONS = [
    {
        "id": "Q1_fy26_close",
        "question": "How is FY26 closing? Where are we vs plan?",
        "min_analyses": 2,
        "max_analyses": 4,
        "must_mention": ["FY26"],
    },
    {
        "id": "Q2_distributor_health",
        "question": "Show me distributors who are buying less, paying late, and selling slow",
        "min_analyses": 1,
        "max_analyses": 4,
        "must_mention": ["distributor"],
    },
    {
        "id": "Q3_procurement_premium",
        "question": "Are we paying above market on any raw material?",
        "min_analyses": 1,
        "max_analyses": 4,
        "must_mention": ["Glyphosate"],
    },
    {
        "id": "Q4_regulatory_pipeline",
        "question": "What's in our regulatory pipeline?",
        "min_analyses": 1,
        "max_analyses": 4,
        "must_mention": ["pipeline"],
    },
    {
        "id": "Q5_q2_ebitda_miss",
        "question": "Why did Q2 FY26 EBITDA miss budget?",
        "min_analyses": 2,
        "max_analyses": 4,
        "must_mention": ["EBITDA"],
    },
]


@pytest.fixture(scope="module")
def db():
    return open_database()


@requires_api
@pytest.mark.parametrize("case", DEMO_QUESTIONS, ids=lambda c: c["id"])
def test_demo_question(case, db):
    state, specs = run_pipeline(case["question"], conn=db)

    assert state.interpretation is not None
    assert state.interpretation.intent_understood is True, (
        f"interpreter asked for clarification on a scripted question: "
        f"{state.interpretation.clarifying_question!r}"
    )

    assert state.plan is not None
    assert case["min_analyses"] <= len(state.plan.analyses) <= case["max_analyses"]

    # Every analysis should have executed (success or graceful failure).
    assert len(state.query_results) == len(state.plan.analyses)
    successful = [r for r in state.query_results if r.success]
    assert successful, "no analyses succeeded — SQL all failed"

    assert state.presentation is not None
    narrative = state.presentation.narrative
    for needle in case["must_mention"]:
        assert needle.lower() in narrative.lower(), (
            f"narrative did not mention {needle!r}; got: {narrative[:200]}"
        )

    # Layout should have at least one visual; chart_specs match 1:1.
    assert state.presentation.layout
    assert len(specs) == len(state.presentation.layout)
    assert len(state.presentation.layout) <= 4
