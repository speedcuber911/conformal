"""Deterministic chart spec builder.

Agent 4 picks a `type` and (optionally) `x_field` / `y_field` for each
presentation element. This module turns that decision plus the source
DataFrame into a Recharts-ready ChartSpec the frontend can render directly.

Keeping this deterministic (instead of having the LLM emit Recharts JSON) means
unit labels, axis-key inference, and stack handling stay consistent regardless
of how the model phrases its answer.
"""
from __future__ import annotations

from typing import Any

from backend.contracts import ChartSpec, ChartType, PresentationElement, QueryResult

# CHART_RULES.yaml.unit_humanizers, hardcoded here so we don't pay the YAML
# parse on every request. Keep in sync with Docs/CHART_RULES.yaml.
UNIT_HUMANIZERS: dict[str, str] = {
    "_cr": "₹ Cr",
    "_pct": "%",
    "_days": "days",
    "_units": "units",
    "_inr": "₹",
    "_kg": "kg",
    "_mt": "MT",
}


def _humanize(column: str | None) -> str | None:
    if not column:
        return None
    for suffix, label in UNIT_HUMANIZERS.items():
        if column.endswith(suffix):
            return label
    return None


def _is_numeric_col(rows: list[dict[str, Any]], col: str) -> bool:
    for row in rows:
        v = row.get(col)
        if v is None:
            continue
        return isinstance(v, (int, float)) and not isinstance(v, bool)
    return False


def _first_categorical(rows: list[dict[str, Any]], cols: list[str]) -> str | None:
    for c in cols:
        if not _is_numeric_col(rows, c):
            return c
    return None


def _first_numeric(rows: list[dict[str, Any]], cols: list[str], skip: set[str]) -> str | None:
    for c in cols:
        if c in skip:
            continue
        if _is_numeric_col(rows, c):
            return c
    return None


def build_spec(element: PresentationElement, result: QueryResult | None) -> ChartSpec:
    """Map (PresentationElement, QueryResult) → ChartSpec.

    For `narrative_only` and `kpi_card`, we still emit a ChartSpec so the
    frontend has a uniform render path. Tables pass through the rows as data.
    """
    chart_type: ChartType = element.type
    rows = result.rows if result else []
    columns = result.columns if result else []
    options = element.chart_options or {}

    if chart_type == "narrative_only":
        return ChartSpec(
            type="narrative_only",
            data=[],
            title=element.title,
            subtitle=element.subtitle,
        )

    if chart_type == "kpi_card":
        # KPI takes the first row's first 1-3 numeric columns. Frontend renders
        # them as a primary value (+ optional comparison).
        return ChartSpec(
            type="kpi_card",
            data=rows[:1],
            x_key=None,
            y_key=_first_numeric(rows, columns, skip=set()),
            title=element.title,
            subtitle=element.subtitle,
            y_label=None,
        )

    if chart_type == "table":
        return ChartSpec(
            type="table",
            data=rows,
            title=element.title,
            subtitle=element.subtitle,
        )

    # bar_chart, line_chart, stacked_bar, scatter
    x_key = options.get("x_field") or _first_categorical(rows, columns)
    skip = {x_key} if x_key else set()
    y_key = options.get("y_field") or _first_numeric(rows, columns, skip)
    stack_field = options.get("stack_field")
    stack_keys: list[str] | None = None
    if chart_type == "stacked_bar" and stack_field:
        stack_keys = sorted({str(r.get(stack_field)) for r in rows if r.get(stack_field) is not None})

    return ChartSpec(
        type=chart_type,
        data=rows,
        x_key=x_key,
        y_key=y_key,
        stack_keys=stack_keys,
        title=element.title,
        subtitle=element.subtitle,
        y_label=_humanize(y_key),
    )
