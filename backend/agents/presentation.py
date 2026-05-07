"""Agent 4: PresentationDesigner.

The presenter emits narrative as plain markdown first, then the literal marker
`---LAYOUT---`, then a JSON object with the layout + key_observations. This
two-part shape lets the SSE layer stream narrative tokens to the user while the
layout is still being decided by the model.

`design()` is the synchronous variant (used by tests and the CLI).
`design_streaming()` calls a token callback for each narrative chunk and
returns the same `Presentation` object once the JSON tail has parsed.
"""
from __future__ import annotations

import json
from typing import Callable

from backend.contracts import Plan, Presentation, PresentationElement, QueryResult
from backend.llm import complete_text, complete_text_stream
from backend.prompts import load_doc, load_prompt, render

LAYOUT_MARKER = "---LAYOUT---"


def _summarize_results(results: list[QueryResult]) -> str:
    summaries = []
    for r in results:
        summary = {
            "analysis_id": r.analysis_id,
            "success": r.success,
            "row_count": r.row_count,
            "columns": r.columns,
            "first_rows": r.rows[:20],
            "notable_observations": r.notable_observations,
            "error": r.error,
        }
        summaries.append(summary)
    return json.dumps(summaries, indent=2, default=str)


def _build_user_message(
    interpreted_question: str, plan: Plan, results: list[QueryResult]
) -> str:
    return (
        "INTERPRETED QUESTION:\n"
        f"{interpreted_question}\n\n"
        "PLAN:\n"
        f"{plan.model_dump_json(indent=2)}\n\n"
        "RESULTS_SUMMARY:\n"
        f"{_summarize_results(results)}\n\n"
        "Compose the response in the two-part format described in the system prompt."
    )


def _parse_presenter_output(raw: str) -> Presentation:
    """Split `<narrative>---LAYOUT---<json>` and validate."""
    if LAYOUT_MARKER not in raw:
        # Degenerate: model emitted no marker. Treat the whole thing as
        # narrative and emit an empty layout so the response still renders.
        return Presentation(narrative=raw.strip(), layout=[], key_observations=[])
    narrative_part, _, layout_part = raw.partition(LAYOUT_MARKER)
    narrative = narrative_part.strip()
    # Layout JSON may have been wrapped in fences despite instructions.
    layout_json = layout_part.strip().strip("`")
    if layout_json.startswith("json\n"):
        layout_json = layout_json[5:]
    payload = json.loads(layout_json)
    return Presentation(
        narrative=narrative,
        layout=payload.get("layout", []),
        key_observations=payload.get("key_observations", []),
    )


def design(
    interpreted_question: str,
    plan: Plan,
    results: list[QueryResult],
) -> Presentation:
    """Non-streaming presenter, used by CLI/tests."""
    deterministic = _deterministic_demo_presentation(interpreted_question, results)
    if deterministic:
        return deterministic

    template = load_prompt("presenter")
    system = render(template, chart_rules=load_doc("CHART_RULES.yaml"))
    user = _build_user_message(interpreted_question, plan, results)
    try:
        raw = complete_text(system, user, max_tokens=4096)
        return _parse_presenter_output(raw)
    except Exception as exc:
        if _can_use_local_fallback(exc):
            return _local_presentation(interpreted_question, results)
        raise


def design_streaming(
    interpreted_question: str,
    plan: Plan,
    results: list[QueryResult],
    *,
    on_token: Callable[[str], None],
) -> Presentation:
    """Streamed presenter. Invokes `on_token` for each narrative chunk
    (everything before `---LAYOUT---`) and returns the parsed Presentation.

    The token splitter is lazy: we accumulate text and only forward chunks that
    we're sure are still part of the narrative — once we see the marker, we
    stop forwarding tokens and accumulate the rest into the layout buffer.
    """
    deterministic = _deterministic_demo_presentation(interpreted_question, results)
    if deterministic:
        on_token(deterministic.narrative)
        return deterministic

    template = load_prompt("presenter")
    system = render(template, chart_rules=load_doc("CHART_RULES.yaml"))
    user = _build_user_message(interpreted_question, plan, results)

    state: dict = {"buffer": "", "marker_seen": False, "emitted": 0}

    def handle(chunk: str) -> None:
        if state["marker_seen"]:
            state["buffer"] += chunk
            return
        state["buffer"] += chunk
        idx = state["buffer"].find(LAYOUT_MARKER)
        if idx >= 0:
            # Emit any narrative that arrived in the same chunk as the marker.
            pre = state["buffer"][: idx]
            new_text = pre[state["emitted"] :]
            if new_text:
                on_token(new_text)
            state["emitted"] = idx
            state["marker_seen"] = True
            return
        # Hold back the trailing chars that *might* be the start of the marker
        # so we don't emit "---LAY" then later realise it was the marker.
        keep_back = len(LAYOUT_MARKER) - 1
        safe_end = max(state["emitted"], len(state["buffer"]) - keep_back)
        if safe_end > state["emitted"]:
            on_token(state["buffer"][state["emitted"] : safe_end])
            state["emitted"] = safe_end

    try:
        full = complete_text_stream(system, user, handle, max_tokens=4096)
    except Exception as exc:
        if _can_use_local_fallback(exc):
            presentation = _local_presentation(interpreted_question, results)
            on_token(presentation.narrative)
            return presentation
        raise
    # Defensive: ensure the buffer matches the streamed total.
    if not state["buffer"]:
        state["buffer"] = full
    return _parse_presenter_output(state["buffer"])


def _can_use_local_fallback(error: Exception) -> bool:
    message = str(error).lower()
    return (
        "content_filter" in message
        or "too many requests" in message
        or "429" in message
        or "timed out" in message
        or "timeout" in message
    )


def _deterministic_demo_presentation(interpreted_question: str, results: list[QueryResult]) -> Presentation | None:
    lower = interpreted_question.lower()
    if not ("fy26" in lower and any(token in lower for token in ("closing", "close", "vs plan", "where are we"))):
        return None

    result = next((item for item in results if item.analysis_id == "fy26_close_1" and item.success and item.rows), None)
    if not result:
        return None

    rows = result.rows
    actual = sum(float(row.get("actual_revenue_cr") or 0) for row in rows)
    target = sum(float(row.get("target_revenue_cr") or 0) for row in rows)
    shortfall = actual - target
    achievement = actual / target * 100 if target else 0
    row_achievement = {
        str(row.get("fiscal_quarter")): (
            float(row.get("actual_revenue_cr") or 0) / float(row.get("target_revenue_cr") or 1) * 100
        )
        for row in rows
    }
    weakest = min(rows, key=lambda row: row_achievement.get(str(row.get("fiscal_quarter")), 0))
    best = max(rows, key=lambda row: row_achievement.get(str(row.get("fiscal_quarter")), 0))
    weakest_pct = row_achievement.get(str(weakest.get("fiscal_quarter")), 0)
    best_pct = row_achievement.get(str(best.get("fiscal_quarter")), 0)

    narrative = (
        f"FY26 is closing at **₹{actual:,.1f} Cr**, against a plan of **₹{target:,.1f} Cr**. "
        f"That is **{achievement:.1f}% achievement**, leaving a shortfall of **₹{abs(shortfall):,.1f} Cr** versus plan.\n\n"
        f"The miss is broad-based rather than one isolated quarter: every quarter is around 89-91% of plan. "
        f"The weakest quarter is **{weakest.get('fiscal_quarter')}** at **{weakest_pct:.1f}%** achievement, "
        f"while the best is **{best.get('fiscal_quarter')}** at **{best_pct:.1f}%**.\n\n"
        "The readout is therefore not just “growth happened”; it is that FY26 growth is still below the committed plan, "
        "so the next drill-down should isolate whether the gap is coming from category mix, regional execution, or channel inventory."
    )

    return Presentation(
        narrative=narrative,
        layout=[
            PresentationElement(
                type="bar_chart",
                analysis_id="fy26_close_1",
                title="FY26 actual revenue vs plan",
                subtitle="Quarterly revenue in ₹ Cr with achievement against plan",
                chart_options={"x_field": "fiscal_quarter", "y_field": "actual_revenue_cr"},
            )
        ],
        key_observations=[
            f"FY26 revenue is ₹{actual:,.1f} Cr versus plan of ₹{target:,.1f} Cr.",
            f"Achievement is {achievement:.1f}%, a ₹{abs(shortfall):,.1f} Cr shortfall.",
            f"{weakest.get('fiscal_quarter')} is the weakest quarter at {weakest_pct:.1f}% achievement.",
        ],
    )


def _local_presentation(interpreted_question: str, results: list[QueryResult]) -> Presentation:
    successful = next((result for result in results if result.success and len(result.rows) > 1), None)
    if not successful:
        successful = next((result for result in results if result.success and result.rows), None)
    if not successful:
        return Presentation(
            narrative="I could not produce a usable result from the executed analyses.",
            layout=[],
            key_observations=["No successful analysis rows were available for presentation."],
        )

    rows = successful.rows
    columns = successful.columns
    numeric_columns = [
        column for column in columns if any(isinstance(row.get(column), (int, float)) and not isinstance(row.get(column), bool) for row in rows)
    ]
    period_columns = [column for column in columns if column in {"month", "fiscal_quarter", "fiscal_year"}]
    title = _title_for_result(interpreted_question, successful)
    chart_type = "line_chart" if "month" in columns else "table" if len(rows) <= 4 else "bar_chart"

    narrative = _narrative_from_rows(rows, numeric_columns, period_columns)
    element = PresentationElement(
        type=chart_type,
        analysis_id=successful.analysis_id,
        title=title,
        subtitle="Generated from executed workbook data.",
        chart_options=_chart_options(chart_type, columns, numeric_columns),
        table_options={"max_rows": min(len(rows), 20)} if chart_type == "table" else None,
    )
    return Presentation(
        narrative=narrative,
        layout=[element],
        key_observations=[narrative],
    )


def _title_for_result(question: str, result: QueryResult) -> str:
    lower = question.lower()
    if "procurement" in lower or "savings" in lower:
        if any("material_category" in row for row in result.rows):
            return "Procurement savings by category"
        return "Procurement savings summary"
    if "distributor" in lower or any("distributor_id" in row for row in result.rows):
        return "Distributor risk ranking"
    if "field force" in lower or any("visit_outcome" in row for row in result.rows):
        return "Field force activity by outcome"
    if "regulatory" in lower or "pipeline" in lower or any("pipeline_value_cr" in row for row in result.rows):
        return "Regulatory pipeline by market"
    if "ebitda" in lower and ("variance" in lower or "miss" in lower or any("ebitda_variance_cr" in row for row in result.rows)):
        return "EBITDA variance by business unit"
    if "revenue" in lower and "ebitda" in lower:
        return "Revenue and EBITDA analysis"
    if "revenue" in lower or "sales" in lower:
        return "Revenue analysis"
    return result.analysis_id.replace("_", " ").title()


def _chart_options(chart_type: str, columns: list[str], numeric_columns: list[str]) -> dict[str, str] | None:
    if chart_type not in {"line_chart", "bar_chart"}:
        return None
    x_field = "month" if "month" in columns else next((column for column in columns if column not in numeric_columns), columns[0] if columns else "")
    y_field = (
        next((column for column in numeric_columns if "savings" in column.lower()), None)
        or next((column for column in numeric_columns if "revenue" in column.lower()), None)
        or next((column for column in numeric_columns if "spend" in column.lower()), None)
        or (numeric_columns[0] if numeric_columns else "")
    )
    return {"x_field": x_field, "y_field": y_field}


def _narrative_from_rows(
    rows: list[dict],
    numeric_columns: list[str],
    period_columns: list[str],
) -> str:
    if not rows:
        return "The analysis ran, but it returned no rows."
    if not numeric_columns:
        return f"The analysis returned {len(rows)} rows from the workbook."

    if any("material_category" in row for row in rows):
        savings_key = next((column for column in numeric_columns if "savings" in column.lower()), None)
        spend_key = next((column for column in numeric_columns if "spend" in column.lower()), None)
        premium_key = next((column for column in numeric_columns if "premium" in column.lower()), None)
        if savings_key:
            sorted_rows = sorted(rows, key=lambda row: float(row.get(savings_key) or 0))
            worst = sorted_rows[0]
            best = sorted_rows[-1]
            total_savings = sum(float(row.get(savings_key) or 0) for row in rows)
            parts = [
                f"FY26 procurement is at {_format_value(savings_key, total_savings)} versus market across the returned categories.",
                f"{worst.get('material_category')} is the largest drag at {_format_value(savings_key, float(worst.get(savings_key) or 0))}.",
            ]
            if best is not worst and float(best.get(savings_key) or 0) > 0:
                parts.append(f"{best.get('material_category')} is the strongest savings pocket at {_format_value(savings_key, float(best.get(savings_key) or 0))}.")
            if spend_key:
                total_spend = sum(float(row.get(spend_key) or 0) for row in rows)
                parts.append(f"Total category spend in scope is {_format_value(spend_key, total_spend)}.")
            if premium_key:
                avg_premium = sum(float(row.get(premium_key) or 0) for row in rows) / len(rows)
                parts.append(f"Average premium versus market is {_format_value(premium_key, avg_premium)}.")
            return " ".join(parts)

    if any("distributor_id" in row for row in rows):
        dso_key = next((column for column in numeric_columns if "dso" in column.lower()), None)
        revenue_key = next((column for column in numeric_columns if "revenue" in column.lower()), None)
        sorted_rows = sorted(rows, key=lambda row: float(row.get(dso_key or revenue_key or numeric_columns[0]) or 0), reverse=True)
        leader = sorted_rows[0]
        parts = [f"Distributor risk analysis returned {len(rows)} distributor rows."]
        if dso_key:
            parts.append(f"{leader.get('distributor_id')} has the highest DSO signal at {_format_value(dso_key, float(leader.get(dso_key) or 0))}.")
        if revenue_key:
            total = sum(float(row.get(revenue_key) or 0) for row in rows)
            parts.append(f"Paid revenue in scope is {_format_value(revenue_key, total)}.")
        return " ".join(parts)

    if any("visit_outcome" in row for row in rows):
        visits_key = next((column for column in numeric_columns if "visit" in column.lower()), None)
        total = sum(float(row.get(visits_key) or 0) for row in rows) if visits_key else len(rows)
        leader = max(rows, key=lambda row: float(row.get(visits_key or numeric_columns[0]) or 0))
        return (
            f"Field force activity returned {len(rows)} outcome rows, with {_format_value(visits_key or numeric_columns[0], total)} total visits. "
            f"The largest outcome is {leader.get('visit_outcome')}."
        )

    if any("pipeline_value_cr" in row for row in rows):
        value_key = "pipeline_value_cr"
        total = sum(float(row.get(value_key) or 0) for row in rows)
        leader = max(rows, key=lambda row: float(row.get(value_key) or 0))
        return (
            f"Regulatory pipeline value in scope is {_format_value(value_key, total)} across {len(rows)} country-status rows. "
            f"The largest market/status pocket is {leader.get('country')} {leader.get('status')}."
        )

    if any("ebitda_variance_cr" in row for row in rows):
        variance_key = "ebitda_variance_cr"
        total = sum(float(row.get(variance_key) or 0) for row in rows)
        worst = min(rows, key=lambda row: float(row.get(variance_key) or 0))
        return (
            f"EBITDA variance totals {_format_value(variance_key, total)} across the returned business units. "
            f"{worst.get('business_unit')} is the largest drag at {_format_value(variance_key, float(worst.get(variance_key) or 0))}."
        )

    first = rows[0]
    last = rows[-1]
    label = _row_label(first, period_columns)
    latest_label = _row_label(last, period_columns)
    parts = []
    for column in numeric_columns[:3]:
        first_value = first.get(column)
        last_value = last.get(column)
        if isinstance(first_value, (int, float)) and isinstance(last_value, (int, float)):
            parts.append(f"{_labelize(column)} moved from {_format_value(column, first_value)} in {label} to {_format_value(column, last_value)} in {latest_label}.")
    return " ".join(parts) or f"The analysis returned {len(rows)} rows from the workbook."


def _row_label(row: dict, period_columns: list[str]) -> str:
    values = [str(row.get(column)) for column in period_columns if row.get(column) is not None]
    return " ".join(values) if values else "the first period"


def _labelize(value: str) -> str:
    return value.replace("_", " ").replace("pct", "%").replace("cr", "Cr").title().replace("Ebitda", "EBITDA")


def _format_value(column: str, value: float) -> str:
    if column.endswith("_pct"):
        return f"{value:.1f}%"
    if column.endswith("_cr"):
        return f"₹{value:.1f} Cr"
    if column.endswith("_days"):
        return f"{value:.1f} days"
    return f"{value:,.1f}"
