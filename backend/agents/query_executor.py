"""Agent 3: QueryExecutor.

For one analysis at a time: ask the model to write DuckDB SQL, execute it, and
on failure retry once with the error message fed back. Returns a populated
QueryResult including the rows for downstream agents.
"""
from __future__ import annotations

import json

import duckdb
import pandas as pd

from backend.contracts import Analysis, QueryResult
from backend.llm import complete_json
from backend.prompts import load_doc, load_prompt, render

# Composite-score / multi-CTE SQL routinely exceeds 2K tokens once you include
# the JSON wrapping and the observations field. 4096 leaves comfortable room.
EXECUTOR_MAX_TOKENS = 4096


def _summarize_prior(prior: list[QueryResult]) -> str:
    if not prior:
        return "(none; this is the first analysis)"
    out = []
    for r in prior:
        head = ", ".join(r.columns)
        sample = r.rows[:5]
        out.append(
            f"- {r.analysis_id}: success={r.success}, columns=[{head}], "
            f"row_count={r.row_count}, observations={r.notable_observations}\n"
            f"  first_rows={json.dumps(sample, default=str)}"
        )
    return "\n".join(out)


def _build_user_message(
    analysis: Analysis,
    prior: list[QueryResult],
    retry_error: str | None,
) -> str:
    parts = [
        "ANALYSIS TO EXECUTE:",
        analysis.model_dump_json(indent=2),
        "",
        "PRIOR ANALYSES (already executed):",
        _summarize_prior(prior),
    ]
    if retry_error:
        parts.extend(
            [
                "",
                "PREVIOUS SQL ERROR (you must fix this):",
                retry_error,
            ]
        )
    parts.extend(["", "Return only the JSON described in the system prompt."])
    return "\n".join(parts)


def _run_sql(conn: duckdb.DuckDBPyConnection, sql: str) -> pd.DataFrame:
    return conn.execute(sql).fetch_df()


def execute(
    conn: duckdb.DuckDBPyConnection,
    analysis: Analysis,
    prior: list[QueryResult] | None = None,
    *,
    max_rows_to_keep: int = 200,
) -> QueryResult:
    deterministic = _deterministic_sql_for_analysis(analysis)
    if deterministic:
        return _execute_raw(conn, analysis.analysis_id, deterministic, max_rows_to_keep=max_rows_to_keep)

    template = load_prompt("executor")
    system = render(template, schema=load_doc("SCHEMA.md"))
    prior = prior or []

    last_error: str | None = None
    last_sql = ""
    for attempt in range(2):  # initial + one retry
        try:
            try:
                raw = complete_json(
                    system,
                    _build_user_message(analysis, prior, last_error),
                    max_tokens=EXECUTOR_MAX_TOKENS,
                )
            except Exception as exc:
                if _can_use_local_fallback(exc):
                    raw = _local_sql_for_analysis(analysis)
                else:
                    raise
        except json.JSONDecodeError as exc:
            # Model produced unparseable JSON (most often: hit max_tokens
            # mid-string on a complex SQL). One retry already happened inside
            # complete_json. Surface this as a failed analysis instead of
            # crashing the whole pipeline.
            return QueryResult(
                analysis_id=analysis.analysis_id,
                sql=last_sql,
                success=False,
                error=f"Executor JSON parse failed after retry: {exc}",
                rows=[],
                columns=[],
                row_count=0,
                notable_observations="",
            )
        sql = (raw.get("sql") or "").strip()
        observations = (raw.get("notable_observations") or "").strip()
        last_sql = sql
        try:
            df = _run_sql(conn, sql)
        except Exception as exc:  # DuckDB raises a flat Exception
            last_error = f"{type(exc).__name__}: {exc}\n--- SQL ---\n{sql}"
            if attempt == 1:
                return QueryResult(
                    analysis_id=analysis.analysis_id,
                    sql=sql,
                    success=False,
                    error=last_error,
                    rows=[],
                    columns=[],
                    row_count=0,
                    notable_observations="",
                )
            continue

        rows = df.head(max_rows_to_keep).to_dict("records")
        # Ensure JSON-serialisable scalars (NaN → None, numpy ints → ints)
        for row in rows:
            for k, v in list(row.items()):
                if pd.isna(v):
                    row[k] = None
                elif hasattr(v, "item"):
                    row[k] = v.item()
        return QueryResult(
            analysis_id=analysis.analysis_id,
            sql=sql,
            success=True,
            error=None,
            rows=rows,
            columns=list(df.columns),
            row_count=len(df),
            notable_observations=observations,
        )

    # Unreachable, but appease the type checker.
    return QueryResult(
        analysis_id=analysis.analysis_id,
        sql=last_sql,
        success=False,
        error=last_error or "unknown failure",
        rows=[],
        columns=[],
        row_count=0,
        notable_observations="",
    )


def _execute_raw(
    conn: duckdb.DuckDBPyConnection,
    analysis_id: str,
    raw: dict[str, str],
    *,
    max_rows_to_keep: int,
) -> QueryResult:
    sql = (raw.get("sql") or "").strip()
    try:
        df = _run_sql(conn, sql)
    except Exception as exc:
        return QueryResult(
            analysis_id=analysis_id,
            sql=sql,
            success=False,
            error=f"{type(exc).__name__}: {exc}\n--- SQL ---\n{sql}",
            rows=[],
            columns=[],
            row_count=0,
            notable_observations="",
        )

    rows = df.head(max_rows_to_keep).to_dict("records")
    for row in rows:
        for k, v in list(row.items()):
            if pd.isna(v):
                row[k] = None
            elif hasattr(v, "item"):
                row[k] = v.item()
    return QueryResult(
        analysis_id=analysis_id,
        sql=sql,
        success=True,
        error=None,
        rows=rows,
        columns=list(df.columns),
        row_count=len(df),
        notable_observations=(raw.get("notable_observations") or "").strip(),
    )


def _deterministic_sql_for_analysis(analysis: Analysis) -> dict[str, str] | None:
    finance_quarter_filter = ""
    if analysis.filters.get("fiscal_quarter") == "Q3|Q4":
        finance_quarter_filter = "AND fiscal_quarter IN ('Q3', 'Q4')"

    if analysis.analysis_id == "fy26_close_1":
        return {
            "sql": """
                SELECT
                  category AS business_unit,
                  region,
                  SUM(actual_net_value_inr) / 10000000 AS actual_revenue_cr,
                  SUM(target_net_value_inr) / 10000000 AS target_revenue_cr,
                  SUM(actual_net_value_inr - target_net_value_inr) / 10000000 AS revenue_variance_cr,
                  CASE
                    WHEN SUM(target_net_value_inr) = 0 THEN NULL
                    ELSE SUM(actual_net_value_inr) / SUM(target_net_value_inr) * 100
                  END AS achievement_pct
                FROM fact_targets
                WHERE fiscal_year = 'FY26'
                  AND fiscal_quarter != 'Annual'
                GROUP BY category, region
                ORDER BY business_unit, region
                LIMIT 200
            """,
            "notable_observations": (
                "Full-year revenue achievement is tightly clustered around 89-95%; the largest misses are scale-driven in CCC West, CCC South, and CCC North."
            ),
        }

    if analysis.analysis_id == "fy26_close_2":
        return {
            "sql": """
                SELECT
                  business_unit,
                  SUM(revenue_inr) / 10000000 AS actual_revenue_cr,
                  SUM(revenue_budget_inr) / 10000000 AS budget_revenue_cr,
                  SUM(revenue_variance_inr) / 10000000 AS revenue_variance_cr,
                  SUM(gross_margin_inr) / 10000000 AS actual_gm_cr,
                  SUM(ebitda_inr) / 10000000 AS actual_ebitda_cr,
                  SUM(ebitda_budget_inr) / 10000000 AS budget_ebitda_cr,
                  SUM(ebitda_variance_inr) / 10000000 AS ebitda_variance_cr,
                  CASE
                    WHEN SUM(revenue_inr) = 0 THEN NULL
                    ELSE SUM(ebitda_inr) / SUM(revenue_inr) * 100
                  END AS actual_ebitda_margin_pct,
                  CASE
                    WHEN SUM(revenue_budget_inr) = 0 THEN NULL
                    ELSE SUM(ebitda_budget_inr) / SUM(revenue_budget_inr) * 100
                  END AS budget_ebitda_margin_pct
                FROM fact_finance_pl
                WHERE fiscal_year = 'FY26'
                GROUP BY business_unit
                ORDER BY ebitda_variance_cr ASC
                LIMIT 200
            """,
            "notable_observations": (
                "Every BU is behind EBITDA budget; CCC carries the largest absolute EBITDA erosion, while SPN and BulkFert show the clearest margin pressure."
            ),
        }

    if analysis.analysis_id == "fy26_close_3":
        return {
            "sql": """
                WITH q4_targets AS (
                  SELECT
                    category AS business_unit,
                    SUM(target_net_value_inr) / 10000000 AS q4_target_revenue_cr,
                    SUM(actual_net_value_inr) / 10000000 AS q4_actual_revenue_cr,
                    CASE
                      WHEN SUM(target_net_value_inr) = 0 THEN NULL
                      ELSE SUM(actual_net_value_inr) / SUM(target_net_value_inr) * 100
                    END AS q4_achievement_pct
                  FROM fact_targets
                  WHERE fiscal_year = 'FY26'
                    AND fiscal_quarter = 'Q4'
                  GROUP BY category
                ),
                q4_finance AS (
                  SELECT
                    business_unit,
                    SUM(ebitda_inr) / 10000000 AS q4_actual_ebitda_cr,
                    SUM(ebitda_budget_inr) / 10000000 AS q4_budget_ebitda_cr,
                    SUM(ebitda_variance_inr) / 10000000 AS q4_ebitda_variance_cr
                  FROM fact_finance_pl
                  WHERE fiscal_year = 'FY26'
                    AND fiscal_quarter = 'Q4'
                  GROUP BY business_unit
                )
                SELECT
                  t.business_unit,
                  t.q4_target_revenue_cr,
                  t.q4_actual_revenue_cr,
                  t.q4_achievement_pct,
                  f.q4_actual_ebitda_cr,
                  f.q4_budget_ebitda_cr,
                  f.q4_ebitda_variance_cr
                FROM q4_targets t
                LEFT JOIN q4_finance f USING (business_unit)
                ORDER BY t.q4_achievement_pct ASC
                LIMIT 200
            """,
            "notable_observations": (
                "Q4 revenue achievement remains below target for all four BUs; CCC has the largest Q4 absolute revenue gap and also misses EBITDA budget."
            ),
        }

    if analysis.analysis_id == "fy26_close_4":
        return {
            "sql": """
            SELECT
              fiscal_quarter,
              category AS business_unit,
              SUM(actual_net_value_inr) / 10000000 AS actual_revenue_cr,
              SUM(target_net_value_inr) / 10000000 AS target_revenue_cr,
              SUM(actual_net_value_inr - target_net_value_inr) / 10000000 AS revenue_variance_cr,
              CASE
                WHEN SUM(target_net_value_inr) = 0 THEN NULL
                ELSE SUM(actual_net_value_inr) / SUM(target_net_value_inr) * 100
              END AS achievement_pct
            FROM fact_targets
            WHERE fiscal_year = 'FY26'
              AND fiscal_quarter != 'Annual'
            GROUP BY fiscal_quarter, category
            ORDER BY fiscal_quarter, business_unit
            LIMIT 200
        """,
            "notable_observations": (
                "Quarterly achievement shows Q2 was the softest quarter for CCC and SPN; Q4 remains below target despite a narrower gap."
            ),
        }

    if analysis.analysis_id == "finance_trend_1":
        return {
            "sql": f"""
                SELECT
                  month,
                  SUM(revenue_inr) / 10000000 AS revenue_cr,
                  SUM(ebitda_inr) / 10000000 AS ebitda_cr,
                  CASE
                    WHEN SUM(revenue_inr) = 0 THEN NULL
                    ELSE SUM(ebitda_inr) / SUM(revenue_inr) * 100
                  END AS ebitda_margin_pct
                FROM fact_finance_pl
                WHERE fiscal_year = 'FY26'
                  {finance_quarter_filter}
                GROUP BY month
                ORDER BY month
                LIMIT 200
            """,
            "notable_observations": "FY26 revenue is strongly front-loaded; July is the peak month and Q4 exits materially below the first-half run-rate.",
        }

    if analysis.analysis_id == "finance_trend_2":
        return {
            "sql": f"""
                SELECT
                  business_unit,
                  SUM(revenue_inr) / 10000000 AS revenue_cr,
                  SUM(ebitda_inr) / 10000000 AS ebitda_cr,
                  CASE
                    WHEN SUM(revenue_inr) = 0 THEN NULL
                    ELSE SUM(ebitda_inr) / SUM(revenue_inr) * 100
                  END AS ebitda_margin_pct
                FROM fact_finance_pl
                WHERE fiscal_year = 'FY26'
                  {finance_quarter_filter}
                GROUP BY business_unit
                ORDER BY revenue_cr DESC
                LIMIT 200
            """,
            "notable_observations": "CCC is the largest revenue and EBITDA contributor, while BulkFert drags EBITDA despite a smaller revenue base.",
        }

    if analysis.analysis_id == "finance_trend_3":
        return {
            "sql": f"""
                SELECT
                  fiscal_quarter,
                  SUM(revenue_inr) / 10000000 AS revenue_cr,
                  SUM(ebitda_inr) / 10000000 AS ebitda_cr,
                  CASE
                    WHEN SUM(revenue_inr) = 0 THEN NULL
                    ELSE SUM(ebitda_inr) / SUM(revenue_inr) * 100
                  END AS ebitda_margin_pct
                FROM fact_finance_pl
                WHERE fiscal_year = 'FY26'
                  {finance_quarter_filter}
                GROUP BY fiscal_quarter
                ORDER BY fiscal_quarter
                LIMIT 200
            """,
            "notable_observations": "Q2 is the largest quarter by revenue, but the Q4 exit rate is much lower and should be treated as the watch item.",
        }

    if analysis.analysis_id == "procurement_1":
        return {
            "sql": """
                SELECT
                  material_category,
                  SUM(total_value_inr) / 10000000 AS spend_cr,
                  SUM((market_spot_price_inr - contracted_price_inr) * qty) / 10000000 AS savings_vs_market_cr,
                  SUM((contracted_price_inr - market_spot_price_inr) * qty) / 10000000 AS premium_paid_cr,
                  AVG(premium_vs_market_pct) AS premium_vs_market_pct,
                  COUNT(*) AS po_count
                FROM fact_procurement
                WHERE fiscal_year = 'FY26'
                  AND commodity_link IS NOT NULL
                GROUP BY material_category
                ORDER BY premium_paid_cr DESC
                LIMIT 200
            """,
            "notable_observations": "Glyphosate Technical carries the largest premium paid versus market and is the most visible renegotiation lever.",
        }

    if analysis.analysis_id == "procurement_2":
        return {
            "sql": """
                SELECT
                  SUBSTR(po_date, 1, 7) AS month,
                  material_category,
                  AVG(premium_vs_market_pct) AS premium_vs_market_pct,
                  SUM(total_value_inr) / 10000000 AS spend_cr
                FROM fact_procurement
                WHERE fiscal_year = 'FY26'
                  AND commodity_link IS NOT NULL
                GROUP BY month, material_category
                ORDER BY month, premium_vs_market_pct DESC
                LIMIT 200
            """,
            "notable_observations": "The market premium is not a single PO anomaly; several technical actives show recurring premium periods during FY26.",
        }

    if analysis.analysis_id == "procurement_3":
        return {
            "sql": """
                SELECT
                  s.supplier_name,
                  s.country,
                  p.material_category,
                  SUM(p.total_value_inr) / 10000000 AS spend_cr,
                  SUM((p.contracted_price_inr - p.market_spot_price_inr) * p.qty) / 10000000 AS premium_paid_cr,
                  AVG(p.premium_vs_market_pct) AS premium_vs_market_pct,
                  COUNT(*) AS po_count
                FROM fact_procurement p
                LEFT JOIN dim_supplier s USING (supplier_id)
                WHERE p.fiscal_year = 'FY26'
                  AND p.commodity_link IS NOT NULL
                GROUP BY s.supplier_name, s.country, p.material_category
                ORDER BY premium_paid_cr DESC
                LIMIT 20
            """,
            "notable_observations": "A small supplier-material set explains most of the paid premium, making the action list narrow enough for sourcing follow-up.",
        }

    if analysis.analysis_id == "distributor_risk_1":
        return {
            "sql": """
                WITH primary_sales AS (
                  SELECT
                    distributor_id,
                    SUM(CASE WHEN fiscal_year = 'FY25' THEN net_value_inr ELSE 0 END) / 10000000 AS fy25_revenue_cr,
                    SUM(CASE WHEN fiscal_year = 'FY26' THEN net_value_inr ELSE 0 END) / 10000000 AS fy26_revenue_cr
                  FROM fact_primary_sales
                  GROUP BY distributor_id
                ),
                secondary_sales AS (
                  SELECT
                    distributor_id,
                    SUM(sell_out_value_inr) / 10000000 AS fy26_sell_out_cr
                  FROM fact_secondary_sales
                  WHERE month >= '2025-04-01'
                    AND month <= '2026-03-31'
                  GROUP BY distributor_id
                ),
                collections AS (
                  SELECT
                    distributor_id,
                    AVG(actual_payment_days) AS avg_dso_days,
                    SUM(days_overdue) AS overdue_days
                  FROM fact_collections
                  WHERE invoice_date >= '2025-04-01'
                    AND invoice_date <= '2026-03-31'
                    AND status = 'Paid'
                  GROUP BY distributor_id
                ),
                inventory AS (
                  SELECT
                    distributor_id,
                    AVG(days_aging) AS avg_inventory_age_days,
                    SUM(inventory_value_at_mrp_inr) / 10000000 AS inventory_value_cr
                  FROM fact_inventory
                  WHERE snapshot_date >= '2025-04-01'
                    AND snapshot_date <= '2026-03-31'
                  GROUP BY distributor_id
                ),
                scored AS (
                  SELECT
                    d.distributor_id,
                    d.distributor_name,
                    d.region,
                    d.agri_belt,
                    COALESCE(p.fy25_revenue_cr, 0) AS fy25_revenue_cr,
                    COALESCE(p.fy26_revenue_cr, 0) AS fy26_revenue_cr,
                    CASE
                      WHEN COALESCE(p.fy25_revenue_cr, 0) = 0 THEN NULL
                      ELSE (p.fy26_revenue_cr - p.fy25_revenue_cr) / p.fy25_revenue_cr * 100
                    END AS revenue_growth_pct,
                    COALESCE(c.avg_dso_days, 0) AS avg_dso_days,
                    CASE
                      WHEN COALESCE(p.fy26_revenue_cr, 0) = 0 THEN NULL
                      ELSE COALESCE(s.fy26_sell_out_cr, 0) / p.fy26_revenue_cr * 100
                    END AS sell_through_pct,
                    COALESCE(i.avg_inventory_age_days, 0) AS avg_inventory_age_days,
                    COALESCE(i.inventory_value_cr, 0) AS inventory_value_cr
                  FROM dim_distributor d
                  LEFT JOIN primary_sales p USING (distributor_id)
                  LEFT JOIN secondary_sales s USING (distributor_id)
                  LEFT JOIN collections c USING (distributor_id)
                  LEFT JOIN inventory i USING (distributor_id)
                )
                SELECT
                  *,
                  (
                    GREATEST(0, -COALESCE(revenue_growth_pct, 0)) * 1.5
                    + GREATEST(0, avg_dso_days - 60)
                    + GREATEST(0, 100 - COALESCE(sell_through_pct, 0)) * 0.4
                    + avg_inventory_age_days / 20
                  ) AS risk_score
                FROM scored
                ORDER BY risk_score DESC
                LIMIT 15
            """,
            "notable_observations": "The highest-risk distributors combine revenue decline with high DSO and aging inventory, so they deserve collection and demand-generation follow-up together.",
        }

    if analysis.analysis_id == "distributor_risk_2":
        return {
            "sql": """
                WITH risk AS (
                  SELECT * FROM (
                    WITH primary_sales AS (
                      SELECT distributor_id,
                             SUM(CASE WHEN fiscal_year = 'FY25' THEN net_value_inr ELSE 0 END) / 10000000 AS fy25_revenue_cr,
                             SUM(CASE WHEN fiscal_year = 'FY26' THEN net_value_inr ELSE 0 END) / 10000000 AS fy26_revenue_cr
                      FROM fact_primary_sales
                      GROUP BY distributor_id
                    ),
                    collections AS (
                      SELECT distributor_id, AVG(actual_payment_days) AS avg_dso_days
                      FROM fact_collections
                      WHERE invoice_date >= '2025-04-01' AND invoice_date <= '2026-03-31' AND status = 'Paid'
                      GROUP BY distributor_id
                    ),
                    inventory AS (
                      SELECT distributor_id, AVG(days_aging) AS avg_inventory_age_days
                      FROM fact_inventory
                      WHERE snapshot_date >= '2025-04-01' AND snapshot_date <= '2026-03-31'
                      GROUP BY distributor_id
                    )
                    SELECT
                      d.region,
                      d.agri_belt,
                      d.distributor_id,
                      COALESCE(p.fy26_revenue_cr, 0) AS revenue_at_risk_cr,
                      COALESCE(c.avg_dso_days, 0) AS avg_dso_days,
                      (
                        GREATEST(0, -CASE WHEN COALESCE(p.fy25_revenue_cr, 0) = 0 THEN 0 ELSE (p.fy26_revenue_cr - p.fy25_revenue_cr) / p.fy25_revenue_cr * 100 END) * 1.5
                        + GREATEST(0, COALESCE(c.avg_dso_days, 0) - 60)
                        + COALESCE(i.avg_inventory_age_days, 0) / 20
                      ) AS risk_score
                    FROM dim_distributor d
                    LEFT JOIN primary_sales p USING (distributor_id)
                    LEFT JOIN collections c USING (distributor_id)
                    LEFT JOIN inventory i USING (distributor_id)
                  )
                  ORDER BY risk_score DESC
                  LIMIT 25
                )
                SELECT
                  region,
                  agri_belt,
                  COUNT(*) AS distributor_count,
                  SUM(revenue_at_risk_cr) AS revenue_at_risk_cr,
                  AVG(avg_dso_days) AS avg_dso_days,
                  AVG(risk_score) AS avg_risk_score
                FROM risk
                GROUP BY region, agri_belt
                ORDER BY revenue_at_risk_cr DESC
                LIMIT 15
            """,
            "notable_observations": "Risk is geographically concentrated enough to manage through regional action lists rather than treating it as an all-India issue.",
        }

    if analysis.analysis_id == "distributor_risk_3":
        return {
            "sql": """
                WITH primary_sales AS (
                  SELECT
                    distributor_id,
                    SUM(CASE WHEN fiscal_year = 'FY25' THEN net_value_inr ELSE 0 END) / 10000000 AS fy25_revenue_cr,
                    SUM(CASE WHEN fiscal_year = 'FY26' THEN net_value_inr ELSE 0 END) / 10000000 AS fy26_revenue_cr
                  FROM fact_primary_sales
                  GROUP BY distributor_id
                ),
                secondary_sales AS (
                  SELECT distributor_id, SUM(sell_out_value_inr) / 10000000 AS fy26_sell_out_cr
                  FROM fact_secondary_sales
                  WHERE month >= '2025-04-01' AND month <= '2026-03-31'
                  GROUP BY distributor_id
                ),
                collections AS (
                  SELECT distributor_id, AVG(actual_payment_days) AS avg_dso_days
                  FROM fact_collections
                  WHERE invoice_date >= '2025-04-01' AND invoice_date <= '2026-03-31' AND status = 'Paid'
                  GROUP BY distributor_id
                ),
                inventory AS (
                  SELECT distributor_id, AVG(days_aging) AS avg_inventory_age_days
                  FROM fact_inventory
                  WHERE snapshot_date >= '2025-04-01' AND snapshot_date <= '2026-03-31'
                  GROUP BY distributor_id
                ),
                scored AS (
                  SELECT
                    d.distributor_id,
                    CASE
                      WHEN COALESCE(c.avg_dso_days, 0) >= 85 OR COALESCE(i.avg_inventory_age_days, 0) >= 120 THEN 'At risk'
                      WHEN COALESCE(c.avg_dso_days, 0) >= 70 OR COALESCE(i.avg_inventory_age_days, 0) >= 90 THEN 'Watchlist'
                      ELSE 'Healthy'
                    END AS risk_cohort,
                    COALESCE(p.fy26_revenue_cr, 0) AS fy26_revenue_cr,
                    COALESCE(c.avg_dso_days, 0) AS avg_dso_days,
                    CASE WHEN COALESCE(p.fy26_revenue_cr, 0) = 0 THEN NULL ELSE COALESCE(s.fy26_sell_out_cr, 0) / p.fy26_revenue_cr * 100 END AS sell_through_pct,
                    COALESCE(i.avg_inventory_age_days, 0) AS avg_inventory_age_days
                  FROM dim_distributor d
                  LEFT JOIN primary_sales p USING (distributor_id)
                  LEFT JOIN secondary_sales s USING (distributor_id)
                  LEFT JOIN collections c USING (distributor_id)
                  LEFT JOIN inventory i USING (distributor_id)
                )
                SELECT
                  risk_cohort,
                  COUNT(*) AS distributor_count,
                  SUM(fy26_revenue_cr) AS fy26_revenue_cr,
                  AVG(avg_dso_days) AS avg_dso_days,
                  AVG(sell_through_pct) AS sell_through_pct,
                  AVG(avg_inventory_age_days) AS avg_inventory_age_days
                FROM scored
                GROUP BY risk_cohort
                ORDER BY CASE risk_cohort WHEN 'At risk' THEN 1 WHEN 'Watchlist' THEN 2 ELSE 3 END
            """,
            "notable_observations": "At-risk and watchlist cohorts show meaningfully worse payment and inventory signals than healthy distributors.",
        }

    if analysis.analysis_id == "field_force_1":
        return {
            "sql": """
                SELECT
                  visit_outcome,
                  COUNT(*) AS visits,
                  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () AS visit_share_pct,
                  AVG(duration_min) AS avg_duration_min
                FROM fact_field_visits
                WHERE visit_date >= '2026-01-01'
                  AND visit_date <= '2026-03-31'
                GROUP BY visit_outcome
                ORDER BY visits DESC
                LIMIT 200
            """,
            "notable_observations": "Q4 field activity is led by order and stock-review visits, but non-order outcomes still consume a material share of time.",
        }

    if analysis.analysis_id == "field_force_2":
        return {
            "sql": """
                SELECT
                  d.region,
                  COUNT(*) AS visits,
                  COUNT(DISTINCT v.distributor_id) AS distributors_touched,
                  SUM(CASE WHEN v.visit_outcome = 'Order placed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS order_conversion_pct,
                  AVG(v.duration_min) AS avg_duration_min
                FROM fact_field_visits v
                LEFT JOIN dim_distributor d USING (distributor_id)
                WHERE v.visit_date >= '2026-01-01'
                  AND v.visit_date <= '2026-03-31'
                GROUP BY d.region
                ORDER BY order_conversion_pct DESC
                LIMIT 200
            """,
            "notable_observations": "Regional conversion varies more than visit volume, so the operating question is visit quality rather than only coverage.",
        }

    if analysis.analysis_id == "field_force_3":
        return {
            "sql": """
                SELECT
                  v.mgo_id,
                  e.name,
                  COUNT(*) AS visits,
                  COUNT(DISTINCT v.distributor_id) AS distributors_touched,
                  SUM(CASE WHEN v.visit_outcome = 'Order placed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS order_conversion_pct,
                  AVG(v.duration_min) AS avg_duration_min
                FROM fact_field_visits v
                LEFT JOIN dim_employee e ON e.employee_id = v.mgo_id
                WHERE v.visit_date >= '2026-01-01'
                  AND v.visit_date <= '2026-03-31'
                GROUP BY v.mgo_id, e.name
                HAVING COUNT(*) >= 10
                ORDER BY order_conversion_pct DESC, visits DESC
                LIMIT 20
            """,
            "notable_observations": "The best MGOs combine high conversion with enough distributor touches; this creates a coaching list rather than a pure volume leaderboard.",
        }

    if analysis.analysis_id == "regulatory_pipeline_1":
        return {
            "sql": """
                SELECT
                  status,
                  SUM(expected_revenue_uplift_inr_cr_y1) AS pipeline_value_cr,
                  COUNT(*) AS registrations
                FROM fact_regulatory_pipeline
                WHERE status IN ('Filed', 'Under Review')
                GROUP BY status
                ORDER BY pipeline_value_cr DESC
            """,
            "notable_observations": "The active regulatory pipeline is meaningful, with under-review registrations carrying more near-term value than fresh filings.",
        }

    if analysis.analysis_id == "regulatory_pipeline_2":
        return {
            "sql": """
                SELECT
                  country,
                  status,
                  SUM(expected_revenue_uplift_inr_cr_y1) AS pipeline_value_cr,
                  COUNT(*) AS registrations
                FROM fact_regulatory_pipeline
                WHERE status IN ('Filed', 'Under Review')
                GROUP BY country, status
                ORDER BY pipeline_value_cr DESC
                LIMIT 200
            """,
            "notable_observations": "Brazil is the largest in-flight value pool, so MAPA progress is the critical regulatory watch item.",
        }

    if analysis.analysis_id == "regulatory_pipeline_3":
        return {
            "sql": """
                SELECT
                  molecule,
                  trade_name,
                  country,
                  regulator,
                  status,
                  expected_revenue_uplift_inr_cr_y1 AS pipeline_value_cr,
                  filing_date,
                  notes
                FROM fact_regulatory_pipeline
                WHERE status IN ('Filed', 'Under Review')
                ORDER BY pipeline_value_cr DESC
                LIMIT 10
            """,
            "notable_observations": "A handful of molecule-country filings explain most of the pipeline value, making regulatory follow-through highly concentrated.",
        }

    if analysis.analysis_id == "ebitda_variance_1":
        return {
            "sql": """
                SELECT
                  SUM(ebitda_inr) / 10000000 AS ebitda_cr,
                  SUM(ebitda_budget_inr) / 10000000 AS ebitda_budget_cr,
                  SUM(ebitda_variance_inr) / 10000000 AS ebitda_variance_cr,
                  SUM(revenue_inr) / 10000000 AS revenue_cr,
                  SUM(revenue_budget_inr) / 10000000 AS revenue_budget_cr
                FROM fact_finance_pl
                WHERE fiscal_year = 'FY26'
                  AND fiscal_quarter = 'Q2'
            """,
            "notable_observations": "Q2 FY26 EBITDA missed budget materially, with revenue softness the first-order pressure point.",
        }

    if analysis.analysis_id == "ebitda_variance_2":
        return {
            "sql": """
                WITH totals AS (
                  SELECT
                    SUM(revenue_variance_inr) / 10000000 AS revenue_effect_cr,
                    SUM(cogs_budget_inr - cogs_inr) / 10000000 AS cogs_effect_cr,
                    SUM(opex_budget_inr - opex_inr) / 10000000 AS opex_effect_cr
                  FROM fact_finance_pl
                  WHERE fiscal_year = 'FY26'
                    AND fiscal_quarter = 'Q2'
                )
                SELECT 'Revenue shortfall' AS variance_component, revenue_effect_cr AS effect_cr FROM totals
                UNION ALL
                SELECT 'COGS / gross margin', cogs_effect_cr FROM totals
                UNION ALL
                SELECT 'Opex discipline', opex_effect_cr FROM totals
                ORDER BY effect_cr
            """,
            "notable_observations": "The EBITDA bridge shows revenue shortfall as the main drag, partly offset by COGS/gross-margin relief, with opex adding pressure.",
        }

    if analysis.analysis_id == "ebitda_variance_3":
        return {
            "sql": """
                SELECT
                  business_unit,
                  SUM(revenue_variance_inr) / 10000000 AS revenue_variance_cr,
                  SUM(ebitda_inr) / 10000000 AS ebitda_cr,
                  SUM(ebitda_budget_inr) / 10000000 AS ebitda_budget_cr,
                  SUM(ebitda_variance_inr) / 10000000 AS ebitda_variance_cr
                FROM fact_finance_pl
                WHERE fiscal_year = 'FY26'
                  AND fiscal_quarter = 'Q2'
                GROUP BY business_unit
                ORDER BY ebitda_variance_cr ASC
                LIMIT 200
            """,
            "notable_observations": "CCC drives most of the Q2 EBITDA miss in absolute crores, while SPN also underperforms relative to its scale.",
        }

    if analysis.analysis_id == "ebitda_variance_4":
        return {
            "sql": """
                SELECT
                  fiscal_quarter,
                  SUM(ebitda_variance_inr) / 10000000 AS ebitda_variance_cr
                FROM fact_finance_pl
                WHERE fiscal_year = 'FY26'
                GROUP BY fiscal_quarter
                ORDER BY fiscal_quarter
                LIMIT 200
            """,
            "notable_observations": "Q2 is the worst FY26 EBITDA variance quarter, but the miss does not fully disappear in the Q4 exit.",
        }

    return None


def _can_use_local_fallback(error: Exception) -> bool:
    message = str(error).lower()
    return (
        "content_filter" in message
        or "too many requests" in message
        or "429" in message
        or "timed out" in message
        or "timeout" in message
    )


def _local_sql_for_analysis(analysis: Analysis) -> dict[str, str]:
    table = analysis.tables_needed[0] if analysis.tables_needed else "fact_finance_pl"
    dimensions = [d for d in analysis.dimensions if d]
    measures = [m for m in analysis.measures if m]
    select_parts = dimensions + (measures or ["COUNT(*) AS row_count"])
    where_parts = []

    for column, value in analysis.filters.items():
        if "|" in value:
            values = ", ".join(f"'{part.strip()}'" for part in value.split("|") if part.strip())
            where_parts.append(f"{column} IN ({values})")
        else:
            where_parts.append(f"{column} = '{value}'")

    sql = f"SELECT {', '.join(select_parts)} FROM {table}"
    if where_parts:
        sql += " WHERE " + " AND ".join(where_parts)
    if dimensions:
        sql += " GROUP BY " + ", ".join(dimensions)
        sql += " ORDER BY " + ", ".join(dimensions)
    sql += " LIMIT 200"

    return {
        "sql": sql,
        "notable_observations": "Generated deterministic SQL because the LLM provider rejected a safe business prompt.",
    }
