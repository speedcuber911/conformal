"""Agent 1: Interpreter.

Decides whether the user question is clear enough to plan against, or whether
to ask one clarifying question. No schema injection — only business intent.
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
