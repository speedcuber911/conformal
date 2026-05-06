"""Prompt loading + variable substitution.

Each agent's system prompt lives in `backend/prompts/{agent}.md`. We load them
at import time and let callers substitute `{{variable}}` placeholders with
runtime values via `render(...)`.

This is intentionally not Jinja: we don't want any logic in prompt files, just
literal placeholder strings. `str.replace` keeps the prompts readable even when
they contain JSON examples (which would otherwise need brace-escaping under
`str.format`).
"""
from __future__ import annotations

from functools import cache
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
DOCS_DIR = Path(__file__).resolve().parent.parent / "Docs"


@cache
def load_prompt(name: str) -> str:
    path = PROMPTS_DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"Missing prompt file: {path}")
    return path.read_text()


@cache
def load_doc(filename: str) -> str:
    """Load a doc file from Docs/ (e.g. 'SCHEMA.md', 'CHART_RULES.yaml')."""
    path = DOCS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Missing doc file: {path}")
    return path.read_text()


def render(template: str, **vars: str) -> str:
    """Replace `{{key}}` markers with the provided values."""
    out = template
    for key, val in vars.items():
        out = out.replace("{{" + key + "}}", str(val))
    return out
