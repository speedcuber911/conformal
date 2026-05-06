"""Thin wrapper around LLM providers.

We call providers directly (no LangChain etc., per CLAUDE.md). The wrapper
handles the things every agent needs:

- provider/model defaults from env
- JSON output parsing with one retry on decode failure (LLMs occasionally wrap
  JSON in markdown fences or add a stray prefix; we strip both)
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Callable
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

DEFAULT_PROVIDER = (
    os.environ.get("LLM_PROVIDER")
    or (
        "azure_openai"
        if os.environ.get("AZURE_OPENAI_ENDPOINT") and os.environ.get("AZURE_OPENAI_API_KEY")
        else "anthropic"
    )
).strip().lower()
DEFAULT_ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
DEFAULT_BEDROCK_MODEL = os.environ.get("BEDROCK_MODEL_ID")
DEFAULT_AWS_REGION = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
DEFAULT_AZURE_DEPLOYMENT = (
    os.environ.get("AZURE_OPENAI_GPT55_DEPLOYMENT")
    or os.environ.get("AZURE_OPENAI_DEPLOYMENT")
    or os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME")
    or os.environ.get("AZURE_OPENAI_MODEL")
    or "gpt-5.5"
)
DEFAULT_AZURE_API_STYLE = os.environ.get("AZURE_OPENAI_API_STYLE", "responses").strip().lower()
DEFAULT_AZURE_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21")
DEFAULT_AZURE_TIMEOUT = int(os.environ.get("AZURE_OPENAI_TIMEOUT_MS", "60000")) / 1000
_client: Anthropic | None = None
_bedrock_client: Any | None = None


def get_client() -> Anthropic:
    """Lazily-constructed shared client. Raises a friendly error if no key."""
    global _client
    if _client is None:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add a key."
            )
        _client = Anthropic()
    return _client


def get_bedrock_client() -> Any:
    """Lazily-constructed Bedrock runtime client."""
    global _bedrock_client
    if _bedrock_client is None:
        if not DEFAULT_AWS_REGION:
            raise RuntimeError(
                "AWS_REGION is not set. Set AWS_REGION to the Bedrock region that has Claude access."
            )
        try:
            import boto3
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise RuntimeError(
                "boto3 is not installed. Run `pip install -e .` after updating dependencies."
            ) from exc
        _bedrock_client = boto3.client("bedrock-runtime", region_name=DEFAULT_AWS_REGION)
    return _bedrock_client


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _strip_fences(text: str) -> str:
    """Strip leading ```json / ``` fences if a model added them despite the prompt."""
    return _FENCE_RE.sub("", text).strip()


def _extract_first_json(text: str) -> str:
    """Pull out the first balanced JSON object from `text`.

    Some prompts (especially Agent 4) emit narrative followed by a `---LAYOUT---`
    marker and then JSON. This finds the first `{...}` block and returns it.
    """
    text = _strip_fences(text)
    start = text.find("{")
    if start < 0:
        return text  # let json.loads raise the actual decode error
    depth = 0
    for i in range(start, len(text)):
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return text[start:]


def _provider() -> str:
    if DEFAULT_PROVIDER not in {"anthropic", "bedrock", "azure_openai", "azure"}:
        raise RuntimeError(
            f"Unsupported LLM_PROVIDER={DEFAULT_PROVIDER!r}. Use 'anthropic', 'bedrock', or 'azure_openai'."
        )
    return "azure_openai" if DEFAULT_PROVIDER == "azure" else DEFAULT_PROVIDER


def _bedrock_model(model: str | None) -> str:
    selected = model or DEFAULT_BEDROCK_MODEL
    if not selected:
        raise RuntimeError(
            "BEDROCK_MODEL_ID is not set. Set it to the Claude model ID or inference profile "
            "available in your AWS Bedrock account."
        )
    return selected


def _bedrock_request(
    system: str,
    user: str,
    *,
    model: str | None,
    max_tokens: int,
    temperature: float,
) -> dict[str, Any]:
    return {
        "modelId": _bedrock_model(model),
        "system": [{"text": system}],
        "messages": [{"role": "user", "content": [{"text": user}]}],
        "inferenceConfig": {"maxTokens": max_tokens, "temperature": temperature},
    }


def _bedrock_text_from_message(message: dict[str, Any]) -> str:
    blocks = message.get("output", {}).get("message", {}).get("content", [])
    return "".join(block.get("text", "") for block in blocks)


def _azure_endpoint() -> str:
    endpoint = (os.environ.get("AZURE_OPENAI_ENDPOINT") or os.environ.get("OPENAI_BASE_URL") or "").rstrip("/")
    if not endpoint:
        raise RuntimeError("AZURE_OPENAI_ENDPOINT is not set.")
    return endpoint


def _azure_api_key() -> str:
    api_key = os.environ.get("AZURE_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("AZURE_OPENAI_API_KEY is not set.")
    return api_key


def _uses_v1_endpoint(endpoint: str) -> bool:
    return endpoint.rstrip("/").endswith("/openai/v1")


def _azure_url() -> str:
    endpoint = _azure_endpoint()
    deployment = quote(DEFAULT_AZURE_DEPLOYMENT)
    style = DEFAULT_AZURE_API_STYLE

    if style == "chat":
        if _uses_v1_endpoint(endpoint):
            return f"{endpoint}/chat/completions"
        if endpoint.endswith("/openai"):
            return f"{endpoint}/deployments/{deployment}/chat/completions?api-version={quote(DEFAULT_AZURE_API_VERSION)}"
        return f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={quote(DEFAULT_AZURE_API_VERSION)}"

    if _uses_v1_endpoint(endpoint):
        return f"{endpoint}/responses"
    if endpoint.endswith("/openai"):
        return f"{endpoint}/v1/responses"
    return f"{endpoint}/openai/v1/responses"


def _azure_body(system: str, user: str, *, model: str | None, max_tokens: int) -> dict[str, Any]:
    deployment = model or DEFAULT_AZURE_DEPLOYMENT
    if DEFAULT_AZURE_API_STYLE == "chat":
        body: dict[str, Any] = {
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_completion_tokens": max_tokens,
        }
        if _uses_v1_endpoint(_azure_endpoint()):
            body["model"] = deployment
        return body

    return {
        "model": deployment,
        "input": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_output_tokens": max_tokens,
    }


def _azure_text_from_response(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str):
        return str(payload["output_text"])

    output = payload.get("output")
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content")
            if not isinstance(content, list):
                continue
            for part in content:
                if isinstance(part, dict) and isinstance(part.get("text"), str):
                    return str(part["text"])

    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            return str(message["content"])

    return ""


def _complete_azure_text(system: str, user: str, *, model: str | None, max_tokens: int) -> str:
    body = json.dumps(_azure_body(system, user, model=model, max_tokens=max_tokens)).encode("utf-8")
    request = Request(
        _azure_url(),
        data=body,
        headers={
            "Content-Type": "application/json",
            "api-key": _azure_api_key(),
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=DEFAULT_AZURE_TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Azure OpenAI {exc.code}: {detail[:500]}") from exc

    text = _azure_text_from_response(payload)
    if not text:
        raise RuntimeError("Azure OpenAI response did not include text output.")
    return text


def complete_text(
    system: str,
    user: str,
    *,
    model: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.0,
) -> str:
    """Single-shot text completion. Returns the full assistant text."""
    if _provider() == "azure_openai":
        return _complete_azure_text(system, user, model=model, max_tokens=max_tokens)

    if _provider() == "bedrock":
        request = _bedrock_request(
            system,
            user,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        resp = get_bedrock_client().converse(**request)
        return _bedrock_text_from_message(resp)

    client = get_client()
    resp = client.messages.create(
        model=model or DEFAULT_ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    parts = [b.text for b in resp.content if getattr(b, "type", None) == "text"]
    return "".join(parts)


def complete_text_stream(
    system: str,
    user: str,
    on_token: Callable[[str], None],
    *,
    model: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.0,
) -> str:
    """Streamed text completion. Calls `on_token(chunk)` for each delta and
    returns the full assembled text when done.
    """
    if _provider() == "azure_openai":
        # The sidecar streams transport events already. Keeping Azure provider
        # single-shot avoids divergent Responses API streaming payload shapes.
        text = _complete_azure_text(system, user, model=model, max_tokens=max_tokens)
        on_token(text)
        return text

    if _provider() == "bedrock":
        full = []
        request = _bedrock_request(
            system,
            user,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        resp = get_bedrock_client().converse_stream(**request)
        for event in resp.get("stream", []):
            token = event.get("contentBlockDelta", {}).get("delta", {}).get("text")
            if token:
                full.append(token)
                on_token(token)
        return "".join(full)

    client = get_client()
    full = []
    with client.messages.stream(
        model=model or DEFAULT_ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=[{"role": "user", "content": user}],
    ) as stream:
        for chunk in stream.text_stream:
            full.append(chunk)
            on_token(chunk)
    return "".join(full)


def complete_json(
    system: str,
    user: str,
    *,
    model: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.0,
) -> dict[str, Any]:
    """Call the model and return parsed JSON. One retry on decode failure."""
    raw = complete_text(system, user, model=model, max_tokens=max_tokens, temperature=temperature)
    try:
        return json.loads(_extract_first_json(raw))
    except json.JSONDecodeError:
        # One retry — re-prompt the model with the bad output and ask for clean JSON.
        retry_user = (
            f"{user}\n\n"
            "Your previous response was not valid JSON. Re-emit the same answer as a "
            "single JSON object with no prose, no markdown fences. Previous response:\n"
            f"---\n{raw}\n---"
        )
        raw2 = complete_text(
            system, retry_user, model=model, max_tokens=max_tokens, temperature=temperature
        )
        return json.loads(_extract_first_json(raw2))
