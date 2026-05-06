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
        return "(none — this is the first analysis)"
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
            except RuntimeError as exc:
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


def _can_use_local_fallback(error: Exception) -> bool:
    message = str(error).lower()
    return "content_filter" in message or "too many requests" in message or "429" in message


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
