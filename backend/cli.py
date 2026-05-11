"""End-to-end CLI for one question.

Usage:
    python -m backend.cli "How is FY26 closing?"

Streams progress to stdout via the pipeline's `on_event` hook so we can debug
without waiting for the whole pipeline. Mirrors what the SSE layer will surface
to the frontend in Phase 4.
"""
from __future__ import annotations

import json
import sys
import textwrap

from backend.duckdb_loader import open_database
from backend.pipeline import run_pipeline


def _wrap(label: str, text: str, width: int = 100) -> str:
    return f"\n=== {label} ===\n{textwrap.fill(text, width=width)}"


def _print_event(event: str, data: dict) -> None:
    if event == "interpretation":
        print(_wrap("INTERPRETATION", json.dumps(data, indent=2)))
    elif event == "plan":
        print(f"\n=== PLAN ({len(data.get('analyses', []))} analyses) ===")
        for a in data.get("analyses", []):
            print(f"  {a['analysis_id']}: {a['type']} - {a['purpose']}")
        print(f"  rationale: {data.get('plan_rationale', '')}")
    elif event == "analysis_started":
        print(f"\n--- running {data['analysis_id']}: {data['purpose']} ---")
    elif event == "analysis_complete":
        if data.get("success"):
            print(f"  rows={data['row_count']}, observations: {data['notable_observations']}")
        else:
            print(f"  FAILED: {data.get('error')}")
    elif event == "presentation":
        print(_wrap("NARRATIVE", data["narrative"]))
        print("\n=== LAYOUT ===")
        for el in data.get("layout", []):
            print(f"  [{el['type']}] {el['title']} (analysis_id={el.get('analysis_id')})")
        if data.get("key_observations"):
            print("\n=== KEY OBSERVATIONS ===")
            for k in data["key_observations"]:
                print(f"  • {k}")


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: python -m backend.cli <question>", file=sys.stderr)
        return 2
    question = " ".join(argv[1:])
    print(_wrap("QUESTION", question))

    conn = open_database()
    state, specs = run_pipeline(question, conn=conn, on_event=_print_event)

    print(f"\n=== CHART SPECS ({len(specs)}) ===")
    for s in specs:
        print(f"  type={s.type} x_key={s.x_key} y_key={s.y_key} y_label={s.y_label}")
    if state.errors:
        print(f"\nerrors: {state.errors}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
