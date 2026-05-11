"""Agent 1: Interpreter.

Decides whether the user question is clear enough to plan against, or whether
to ask one clarifying question. No schema injection; only business intent.
"""
from __future__ import annotations

import json

from backend.contracts import InterpretationResult, Message
from backend.llm import complete_json
from backend.prompts import load_prompt


def _local_interpretation(question: str, history: list[Message] | None = None) -> InterpretationResult:
    """Conservative fallback when the LLM refuses a harmless business prompt."""
    cleaned = _contextual_question(" ".join(question.split()).strip(), history or [])
    if not cleaned:
        return InterpretationResult(
            intent_understood=False,
            clarifying_question="What would you like to analyse?",
            options_for_user=[
                "Revenue, EBITDA, or margin performance",
                "Sales by region, product, or channel",
                "Distributor health or collections risk",
            ],
        )

    assumptions: list[str] = []
    lower = cleaned.lower()
    if any(token in lower for token in ("current", "now", "this quarter", "latest")):
        assumptions.append("Latest available period means Q4 FY26.")
    if "last two quarter" in lower or "last 2 quarter" in lower:
        assumptions.append("Last two quarters means Q3 FY26 and Q4 FY26.")
    if any(token in lower for token in ("revenue", "sales", "ebitda", "margin", "crore", "inr")):
        assumptions.append("Money values should be reported in INR crores where applicable.")

    return InterpretationResult(
        intent_understood=True,
        interpreted_question=cleaned,
        implicit_assumptions=assumptions,
        clarifying_question=None,
        options_for_user=None,
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


def _contextual_question(question: str, history: list[Message]) -> str:
    lower = question.lower()
    period_only = bool(
        history
        and any(token in lower for token in ("fy26", "q4", "q3", "year-to-date", "ytd", "full year", "custom period"))
        and not any(token in lower for token in ("revenue", "ebitda", "procurement", "sales", "nps", "field force", "churn"))
    )
    if not period_only:
        return question

    last_user = next((message.content for message in reversed(history) if message.role == "user"), "")
    if not last_user:
        return question
    return f"{last_user} Time period: {question}"


def interpret(question: str, history: list[Message] | None = None) -> InterpretationResult:
    deterministic = _deterministic_demo_interpretation(question, history)
    if deterministic:
        return deterministic

    system = load_prompt("interpreter")
    history = history or []
    user = (
        f"USER QUESTION:\n{question}\n\n"
        f"CONVERSATION HISTORY:\n{json.dumps([m.model_dump() for m in history], indent=2)}\n\n"
        "Return only the JSON described in the system prompt."
    )
    try:
        raw = complete_json(system, user, max_tokens=1024)
    except Exception as exc:
        if _can_use_local_fallback(exc):
            return _local_interpretation(question, history)
        raise
    return InterpretationResult.model_validate(raw)


def _deterministic_demo_interpretation(question: str, history: list[Message] | None = None) -> InterpretationResult | None:
    cleaned = _contextual_question(" ".join(question.split()).strip(), history or [])
    lower = cleaned.lower()
    asks_fy26_close = "fy26" in lower and any(token in lower for token in ("closing", "close", "vs plan", "where are we"))
    asks_finance_trend = any(token in lower for token in ("revenue over last 12 months", "revenue and ebitda time series", "time series"))
    asks_procurement = any(token in lower for token in ("procurement", "raw material", "above market", "premium vs market"))
    asks_distributor = any(token in lower for token in ("distributor", "paying late", "selling slow", "dso"))
    asks_field_force = any(token in lower for token in ("field force", "visit", "coverage"))
    asks_regulatory = any(token in lower for token in ("regulatory", "pipeline", "registration"))
    asks_ebitda_variance = "ebitda" in lower and any(token in lower for token in ("miss", "budget", "variance", "why"))

    if not any(
        (
            asks_fy26_close,
            asks_finance_trend,
            asks_procurement,
            asks_distributor,
            asks_field_force,
            asks_regulatory,
            asks_ebitda_variance,
        )
    ):
        return None

    assumptions = ["Money values should be reported in INR crores where applicable."]
    if asks_fy26_close:
        assumptions.insert(0, "FY26 closing means full-year FY26 performance against plan, with Q4 close risk called out.")
    elif asks_finance_trend:
        assumptions.insert(0, "Last 12 months means FY26, Apr 2025-Mar 2026, unless the user specifies another period.")
    elif asks_procurement:
        assumptions.insert(0, "Procurement market comparison should use market-linked FY26 raw materials and exclude non-tradable rows.")
    elif asks_distributor:
        assumptions.insert(0, "Distributor risk combines buying decline, late payment, sell-through, and aging inventory.")
    elif asks_field_force:
        assumptions.insert(0, "This quarter means the latest available quarter, Q4 FY26.")
    elif asks_regulatory:
        assumptions.insert(0, "Regulatory pipeline means filed and under-review registrations, with approved items treated as context.")
    elif asks_ebitda_variance:
        assumptions.insert(0, "Q2 means Q2 FY26, and miss means actual EBITDA below budget.")

    return InterpretationResult(
        intent_understood=True,
        interpreted_question=cleaned,
        implicit_assumptions=assumptions,
        clarifying_question=None,
        options_for_user=None,
    )
