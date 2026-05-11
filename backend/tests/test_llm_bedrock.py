from __future__ import annotations

import importlib

import pytest

import backend.llm as llm


def reload_llm(monkeypatch: pytest.MonkeyPatch, **env: str) -> object:
    for key in (
        "LLM_PROVIDER",
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_MODEL",
        "BEDROCK_MODEL_ID",
        "AWS_REGION",
        "AWS_DEFAULT_REGION",
        "AZURE_OPENAI_DEPLOYMENT",
        "AZURE_OPENAI_DEPLOYMENT_NAME",
        "AZURE_OPENAI_MODEL",
        "AZURE_OPENAI_GPT55_DEPLOYMENT",
    ):
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    return importlib.reload(llm)


class FakeBedrockClient:
    def __init__(self) -> None:
        self.converse_calls: list[dict] = []
        self.converse_stream_calls: list[dict] = []

    def converse(self, **kwargs):
        self.converse_calls.append(kwargs)
        return {"output": {"message": {"content": [{"text": "hello from bedrock"}]}}}

    def converse_stream(self, **kwargs):
        self.converse_stream_calls.append(kwargs)
        return {
            "stream": [
                {"contentBlockDelta": {"delta": {"text": "hello"}}},
                {"contentBlockDelta": {"delta": {"text": " from"}}},
                {"contentBlockDelta": {"delta": {"text": " bedrock"}}},
            ]
        }


def test_bedrock_requires_model_id(monkeypatch: pytest.MonkeyPatch):
    module = reload_llm(
        monkeypatch,
        LLM_PROVIDER="bedrock",
        BEDROCK_MODEL_ID="",
        AWS_REGION="us-east-1",
    )

    with pytest.raises(RuntimeError, match="BEDROCK_MODEL_ID"):
        module.complete_text("system", "user")


def test_complete_text_uses_bedrock_converse(monkeypatch: pytest.MonkeyPatch):
    module = reload_llm(
        monkeypatch,
        LLM_PROVIDER="bedrock",
        BEDROCK_MODEL_ID="anthropic.claude-test",
        AWS_REGION="us-east-1",
    )
    fake_client = FakeBedrockClient()
    monkeypatch.setattr(module, "get_bedrock_client", lambda: fake_client)

    result = module.complete_text("system prompt", "user prompt", max_tokens=123, temperature=0.2)

    assert result == "hello from bedrock"
    assert fake_client.converse_calls == [
        {
            "modelId": "anthropic.claude-test",
            "system": [{"text": "system prompt"}],
            "messages": [{"role": "user", "content": [{"text": "user prompt"}]}],
            "inferenceConfig": {"maxTokens": 123, "temperature": 0.2},
        }
    ]


def test_complete_text_stream_uses_bedrock_converse_stream(monkeypatch: pytest.MonkeyPatch):
    module = reload_llm(
        monkeypatch,
        LLM_PROVIDER="bedrock",
        BEDROCK_MODEL_ID="anthropic.claude-test",
        AWS_REGION="us-east-1",
    )
    fake_client = FakeBedrockClient()
    monkeypatch.setattr(module, "get_bedrock_client", lambda: fake_client)
    tokens: list[str] = []

    result = module.complete_text_stream("system prompt", "user prompt", tokens.append)

    assert result == "hello from bedrock"
    assert tokens == ["hello", " from", " bedrock"]
    assert fake_client.converse_stream_calls[0]["modelId"] == "anthropic.claude-test"


def test_azure_deployment_prefers_generic_fast_model(monkeypatch: pytest.MonkeyPatch):
    module = reload_llm(
        monkeypatch,
        LLM_PROVIDER="azure_openai",
        AZURE_OPENAI_DEPLOYMENT="gpt-5.4-mini",
        AZURE_OPENAI_GPT55_DEPLOYMENT="gpt-5.5",
    )

    assert module.DEFAULT_AZURE_DEPLOYMENT == "gpt-5.4-mini"
