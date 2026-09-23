"""Contract tests for the single-attempt OpenAI adapter; no network is used."""

from types import SimpleNamespace

import httpx
import openai
import pytest
from pydantic import BaseModel, ValidationError

from app import llm


class ModelAnswer(BaseModel):
    title: str
    count: int


class FakeCompletions:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = []

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.result


def completion(*, parsed=None, refusal=None, content=None):
    message = SimpleNamespace(parsed=parsed, refusal=refusal, content=content)
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


@pytest.fixture
def configured_adapter(monkeypatch):
    monkeypatch.setenv("AI_MODE", "auto")
    monkeypatch.setenv("OPENAI_API_KEY", "test-only-secret-key")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    monkeypatch.setattr(llm, "_client", None)

    def set_result(result=None, error=None):
        fake = FakeCompletions(result, error)
        monkeypatch.setattr(
            llm, "_client", SimpleNamespace(
                chat=SimpleNamespace(completions=fake)
            ),
        )
        return fake

    yield set_result

    monkeypatch.setattr(llm, "_client", None)


def test_valid_structured_answer_is_typed_and_sent_once(configured_adapter):
    fake = configured_adapter(completion(parsed={"title": "Forecast", "count": 3}))

    answer = llm.ask_json("Estimate demand", ModelAnswer, system="Follow schema")

    assert answer == ModelAnswer(title="Forecast", count=3)
    assert len(fake.calls) == 1
    assert fake.calls[0] == {
        "model": "test-model",
        "messages": [
            {"role": "system", "content": "Follow schema"},
            {"role": "user", "content": "Estimate demand"},
        ],
        "response_format": ModelAnswer,
    }


@pytest.mark.parametrize(
    ("response", "error_text"),
    [
        (completion(refusal="private@example.com cannot be processed"), "отказалась"),
        (completion(parsed=None), "пустой"),
        (completion(parsed={"title": "Forecast", "count": "bad"}), "схеме"),
        (SimpleNamespace(choices=[]), "формат"),
    ],
)
def test_refusal_empty_or_invalid_response_raises_safe_error(
    configured_adapter, caplog, response, error_text
):
    fake = configured_adapter(response)

    with pytest.raises(llm.LLMError, match=error_text):
        llm.ask_json("Estimate demand", ModelAnswer)

    assert len(fake.calls) == 1
    assert "private@example.com" not in caplog.text
    assert "test-only-secret-key" not in caplog.text


@pytest.mark.parametrize(
    "error",
    [
        openai.APIConnectionError(
            message="private@example.com test-only-secret-key +7 777 123 45 67",
            request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
        ),
        openai.APITimeoutError(
            request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
        ),
        ValueError("invalid JSON with private@example.com and test-only-secret-key"),
    ],
)
def test_provider_and_parse_errors_are_safe_and_single_attempt(
    configured_adapter, caplog, error
):
    fake = configured_adapter(error=error)

    with pytest.raises(llm.LLMError):
        llm.ask_json("Estimate demand", ModelAnswer)

    assert len(fake.calls) == 1
    assert "private@example.com" not in caplog.text
    assert "test-only-secret-key" not in caplog.text
    assert "777 123 45 67" not in caplog.text


def test_pydantic_parse_error_is_wrapped(configured_adapter):
    try:
        ModelAnswer.model_validate({"title": "Forecast", "count": "bad"})
    except ValidationError as error:
        fake = configured_adapter(error=error)

    with pytest.raises(llm.LLMError, match="схеме"):
        llm.ask_json("Estimate demand", ModelAnswer)

    assert len(fake.calls) == 1


def test_invalid_response_excerpt_masks_private_values(configured_adapter, caplog):
    raw = (
        'Bad data: owner@example.com +7 (777) 123-45-67 '
        'test-only-secret-key @owner_contact https://t.me/owner_contact'
    )
    configured_adapter(completion(parsed={"title": "Forecast", "count": "bad"}, content=raw))

    with pytest.raises(llm.LLMError, match="схеме"):
        llm.ask_json("Estimate demand", ModelAnswer)

    assert "фрагмент:" in caplog.text
    assert "[email]" in caplog.text
    assert "[phone]" in caplog.text
    assert "[key]" in caplog.text
    assert "[handle]" in caplog.text
    assert "[url]" in caplog.text
    for private_value in (
        "owner@example.com", "+7 (777) 123-45-67", "test-only-secret-key",
        "@owner_contact", "https://t.me/owner_contact",
    ):
        assert private_value not in caplog.text


def test_email_and_phone_are_masked_in_both_messages(configured_adapter, caplog):
    fake = configured_adapter(completion(parsed=ModelAnswer(title="Forecast", count=3)))
    prompt = "Call +7 (777) 123-45-67 or 87011234567; write to owner@example.com."
    system = "Secondary contact: second@example.kz, +1 415 555 2671"

    llm.ask_json(prompt, ModelAnswer, system=system)

    sent = " ".join(message["content"] for message in fake.calls[0]["messages"])
    for private_value in (
        "+7 (777) 123-45-67", "87011234567", "owner@example.com",
        "second@example.kz", "+1 415 555 2671",
    ):
        assert private_value not in sent
        assert private_value not in caplog.text
    assert "[email]" in sent
    assert "[phone]" in sent


def test_client_has_no_sdk_retries_and_at_most_twenty_second_timeout(
    configured_adapter, monkeypatch
):
    options = {}

    def make_client(**kwargs):
        options.update(kwargs)
        return object()

    monkeypatch.setattr(openai, "OpenAI", make_client)
    monkeypatch.setattr(llm, "_client", None)

    llm._get_client()

    assert options["api_key"] == "test-only-secret-key"
    assert options["max_retries"] == 0
    assert 0 < options["timeout"] <= 20


@pytest.mark.parametrize(
    ("mode", "key", "model", "available"),
    [
        ("auto", "test-key", "test-model", True),
        ("stub", "test-key", "test-model", False),
        ("auto", "", "test-model", False),
        ("auto", "test-key", "", False),
        ("unknown", "test-key", "test-model", False),
    ],
)
def test_configuration_gate(monkeypatch, mode, key, model, available):
    monkeypatch.setenv("AI_MODE", mode)
    monkeypatch.setenv("OPENAI_API_KEY", key)
    monkeypatch.setenv("OPENAI_MODEL", model)

    assert llm.ai_available() is available
    if not available:
        with pytest.raises(llm.LLMError, match="ИИ выключен"):
            llm.ask_json("Estimate demand", ModelAnswer)
