"""Agent 1: Interpreter.

Decides whether the user question is clear enough to plan against, or whether
to ask one clarifying question. No schema injection — only business intent.
"""
from __future__ import annotations

import json

from backend.contracts import InterpretationResult, Message
from backend.llm import complete_json
from backend.prompts import load_prompt


def interpret(question: str, history: list[Message] | None = None) -> InterpretationResult:
    system = load_prompt("interpreter")
    history = history or []
    user = (
        f"USER QUESTION:\n{question}\n\n"
        f"CONVERSATION HISTORY:\n{json.dumps([m.model_dump() for m in history], indent=2)}\n\n"
        "Return only the JSON described in the system prompt."
    )
    raw = complete_json(system, user, max_tokens=1024)
    return InterpretationResult.model_validate(raw)
