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

from backend.contracts import Plan, Presentation, QueryResult
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
    template = load_prompt("presenter")
    system = render(template, chart_rules=load_doc("CHART_RULES.yaml"))
    user = _build_user_message(interpreted_question, plan, results)
    raw = complete_text(system, user, max_tokens=4096)
    return _parse_presenter_output(raw)


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

    full = complete_text_stream(system, user, handle, max_tokens=4096)
    # Defensive: ensure the buffer matches the streamed total.
    if not state["buffer"]:
        state["buffer"] = full
    return _parse_presenter_output(state["buffer"])
