"""Agent 2: AnalysisPlanner.

Decomposes an interpreted question into 1-4 analyses. Sees the full schema and
the analysis pattern library so it can produce concrete, type-tagged specs that
the QueryExecutor can turn into SQL.
"""
from __future__ import annotations

from backend.contracts import Plan
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
    raw = complete_json(system, user, max_tokens=2048)
    return Plan.model_validate(raw)
