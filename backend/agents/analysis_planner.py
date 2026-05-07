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
    deterministic = _deterministic_demo_plan(interpreted_question)
    if deterministic:
        return deterministic

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
    except Exception as exc:
        if _can_use_local_fallback(exc):
            return _local_plan(interpreted_question)
        raise
    return Plan.model_validate(raw)


def _deterministic_demo_plan(interpreted_question: str) -> Plan | None:
    lower = interpreted_question.lower()
    asks_fy26_close = "fy26" in lower and any(token in lower for token in ("closing", "close", "vs plan", "where are we"))
    if not asks_fy26_close:
        return None

    return Plan(
        analyses=[
            Analysis(
                analysis_id="fy26_close_1",
                purpose="Compare FY26 actual revenue against plan by quarter and for the full year",
                type="comparison",
                tables_needed=["fact_targets"],
                filters={"fiscal_year": "FY26"},
                measures=[
                    "SUM(actual_net_value_inr) / 10000000 AS actual_revenue_cr",
                    "SUM(target_net_value_inr) / 10000000 AS target_revenue_cr",
                ],
                dimensions=["fiscal_quarter"],
                expected_output_shape="FY26 quarterly rows showing actual revenue and planned revenue in crores",
            )
        ],
        plan_rationale="Used the deterministic FY26 close demo plan so the main demo question always returns a plan-backed analysis.",
    )


def _can_use_local_fallback(error: Exception) -> bool:
    message = str(error).lower()
    return (
        "content_filter" in message
        or "too many requests" in message
        or "429" in message
        or "timed out" in message
        or "timeout" in message
    )


def _local_plan(interpreted_question: str) -> Plan:
    lower = interpreted_question.lower()
    asks_revenue = any(token in lower for token in ("revenue", "sales", "topline", "turnover"))
    asks_ebitda = any(token in lower for token in ("ebitda", "pbdt", "profit", "margin"))
    asks_time = any(token in lower for token in ("time series", "trend", "month", "monthly", "over time"))
    asks_last_two_quarters = "last two quarter" in lower or "last 2 quarter" in lower
    asks_procurement = any(token in lower for token in ("procurement", "supplier", "purchase", "po ", "savings", "premium vs market"))
    asks_fy26_ytd = any(token in lower for token in ("fy26 year-to-date", "fy26 ytd", "year-to-date", "ytd"))
    asks_distributor = any(token in lower for token in ("distributor", "dealer", "paying late", "selling slow", "dso"))
    asks_field_force = any(token in lower for token in ("field force", "mgo", "visit", "coverage"))
    asks_regulatory = any(token in lower for token in ("regulatory", "registration", "pipeline", "molecule", "regulator"))
    asks_ebitda_variance = "ebitda" in lower and any(token in lower for token in ("miss", "variance", "budget", "bridge"))

    if asks_procurement:
        filters = {"fiscal_year": "FY26"} if asks_fy26_ytd or "fy26" in lower else {}
        return Plan(
            analyses=[
                Analysis(
                    analysis_id="procurement_1",
                    purpose="Compare procurement value and savings against market price by material category",
                    type="breakdown",
                    tables_needed=["fact_procurement"],
                    filters=filters,
                    measures=[
                        "SUM(total_value_inr) / 10000000 AS spend_cr",
                        "SUM((market_spot_price_inr - contracted_price_inr) * qty) / 10000000 AS savings_vs_market_cr",
                        "AVG(premium_vs_market_pct) AS premium_vs_market_pct",
                    ],
                    dimensions=["material_category"],
                    expected_output_shape="Material-category rows with spend, savings against market, and average premium percentage",
                )
            ],
            plan_rationale="Used the local procurement planning fallback after the LLM provider rejected or under-specified a safe business prompt.",
        )

    if asks_ebitda_variance:
        return Plan(
            analyses=[
                Analysis(
                    analysis_id="ebitda_variance_1",
                    purpose="Break down Q2 FY26 EBITDA variance against budget by business unit",
                    type="breakdown",
                    tables_needed=["fact_finance_pl"],
                    filters={"fiscal_year": "FY26", "fiscal_quarter": "Q2"},
                    measures=[
                        "SUM(ebitda_inr) / 10000000 AS ebitda_cr",
                        "SUM(ebitda_budget_inr) / 10000000 AS ebitda_budget_cr",
                        "SUM(ebitda_variance_inr) / 10000000 AS ebitda_variance_cr",
                    ],
                    dimensions=["business_unit"],
                    expected_output_shape="Business-unit rows with actual EBITDA, budget EBITDA, and variance in crores",
                )
            ],
            plan_rationale="Used the local EBITDA variance fallback after the LLM provider rejected or under-specified a safe business prompt.",
        )

    if asks_distributor:
        return Plan(
            analyses=[
                Analysis(
                    analysis_id="distributor_risk_1",
                    purpose="Rank distributors by late-payment exposure and DSO",
                    type="ranking",
                    tables_needed=["fact_collections"],
                    filters={"status": "Paid"},
                    measures=[
                        "SUM(invoice_value_inr) / 10000000 AS paid_revenue_cr",
                        "AVG(actual_payment_days) AS avg_dso_days",
                        "SUM(days_overdue) AS overdue_days",
                    ],
                    dimensions=["distributor_id"],
                    expected_output_shape="Distributor rows with paid revenue, average DSO, and overdue-day load",
                )
            ],
            plan_rationale="Used the local distributor-risk fallback after the LLM provider rejected or under-specified a safe business prompt.",
        )

    if asks_field_force:
        return Plan(
            analyses=[
                Analysis(
                    analysis_id="field_force_1",
                    purpose="Summarise field-force activity by visit outcome",
                    type="breakdown",
                    tables_needed=["fact_field_visits"],
                    filters={},
                    measures=[
                        "COUNT(*) AS visits",
                        "AVG(duration_min) AS avg_duration_min",
                    ],
                    dimensions=["visit_outcome"],
                    expected_output_shape="Visit-outcome rows with visit counts and average duration",
                )
            ],
            plan_rationale="Used the local field-force fallback after the LLM provider rejected or under-specified a safe business prompt.",
        )

    if asks_regulatory:
        return Plan(
            analyses=[
                Analysis(
                    analysis_id="regulatory_pipeline_1",
                    purpose="Summarise in-flight regulatory pipeline value by country and status",
                    type="breakdown",
                    tables_needed=["fact_regulatory_pipeline"],
                    filters={"status": "Filed|Under Review"},
                    measures=[
                        "SUM(expected_revenue_uplift_inr_cr_y1) AS pipeline_value_cr",
                        "COUNT(*) AS registrations",
                    ],
                    dimensions=["country", "status"],
                    expected_output_shape="Country and status rows with pipeline value and registration count",
                )
            ],
            plan_rationale="Used the local regulatory-pipeline fallback after the LLM provider rejected or under-specified a safe business prompt.",
        )

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
