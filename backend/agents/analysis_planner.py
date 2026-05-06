"""Agent 2: AnalysisPlanner.

Decomposes an interpreted question into 1-4 analyses. Sees the full schema and
the analysis pattern library so it can produce concrete, type-tagged specs that
the QueryExecutor can turn into SQL.
"""
from __future__ import annotations

from backend.contracts import Analysis, Plan
from backend.llm import complete_json
from backend.prompts import load_doc, load_prompt, render


def plan(interpreted_question: str, implicit_assumptions: list[str] | None = None) -> Plan:
    template = load_prompt("planner")
    system = render(
        template,
        schema=load_doc("SCHEMA.md"),
        analysis_patterns=load_doc("ANALYSIS_PATTERNS.md"),
    )
    user = (
        "INTERPRETED QUESTION:\n"
        f"{interpreted_question}\n\n"
        "IMPLICIT ASSUMPTIONS:\n"
        f"{chr(10).join('- ' + a for a in (implicit_assumptions or [])) or '(none)'}\n\n"
        "Decompose into 1-4 analyses. Return only the JSON described in the system prompt."
    )
    try:
        raw = complete_json(system, user, max_tokens=2048)
    except RuntimeError as exc:
        if _can_use_local_fallback(exc):
            return _local_plan(interpreted_question)
        raise
    return Plan.model_validate(raw)


def _can_use_local_fallback(error: Exception) -> bool:
    message = str(error).lower()
    return "content_filter" in message or "too many requests" in message or "429" in message


def _local_plan(interpreted_question: str) -> Plan:
    lower = interpreted_question.lower()
    asks_revenue = any(token in lower for token in ("revenue", "sales", "topline", "turnover"))
    asks_ebitda = any(token in lower for token in ("ebitda", "pbdt", "profit", "margin"))
    asks_time = any(token in lower for token in ("time series", "trend", "month", "monthly", "over time"))
    asks_last_two_quarters = "last two quarter" in lower or "last 2 quarter" in lower

    if asks_revenue or asks_ebitda or asks_last_two_quarters:
        measures = []
        if asks_revenue or asks_last_two_quarters:
            measures.append("SUM(revenue_inr) / 10000000 AS revenue_cr")
        if asks_ebitda or asks_last_two_quarters:
            measures.append("SUM(ebitda_inr) / 10000000 AS ebitda_cr")
            measures.append("CASE WHEN SUM(revenue_inr) = 0 THEN NULL ELSE SUM(ebitda_inr) / SUM(revenue_inr) * 100 END AS ebitda_margin_pct")

        dimensions = ["month"] if asks_time else ["fiscal_year", "fiscal_quarter"]
        filters = {"fiscal_year": "FY26", "fiscal_quarter": "Q3|Q4"} if asks_last_two_quarters else {}
        return Plan(
            analyses=[
                Analysis(
                    analysis_id="finance_1",
                    purpose="Answer the finance performance question from the monthly P&L table",
                    type="trend" if asks_time or asks_last_two_quarters else "kpi_lookup",
                    tables_needed=["fact_finance_pl"],
                    filters=filters,
                    measures=measures or ["SUM(revenue_inr) / 10000000 AS revenue_cr"],
                    dimensions=dimensions,
                    expected_output_shape="Rows grouped by the requested period with finance metrics in crores",
                )
            ],
            plan_rationale="Used the local finance planning fallback after the LLM provider rejected a safe business prompt.",
        )

    return Plan(
        analyses=[
            Analysis(
                analysis_id="sales_1",
                purpose="Summarise booked revenue by region and category",
                type="breakdown",
                tables_needed=["sales_enriched"],
                filters={},
                measures=["SUM(net_value_inr) / 10000000 AS booked_revenue_cr"],
                dimensions=["region", "category"],
                expected_output_shape="Regional/category revenue rows in crores",
            )
        ],
        plan_rationale="Used the local sales planning fallback after the LLM provider rejected a safe business prompt.",
    )
