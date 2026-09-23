"""HTTP contract of the backend foundation, independent of constructor routes."""

from typing import get_args

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.llm import LLMError
from app.main import app
from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    BuildCardRequest,
    BuildCardResponse,
    Card,
    QuestionField,
)


CARD_FIELDS = {
    "title", "industry", "context", "need", "users", "data",
    "constraints", "result", "criteria", "contact", "format",
}
QUESTION_FIELDS = {
    "need", "users", "data", "constraints", "result", "criteria", "contact",
}


@pytest.fixture
def contract_client():
    # The production constructor router belongs to another branch. These routes
    # exercise its public request schemas with the production error handlers.
    probe = FastAPI(exception_handlers=app.exception_handlers)

    @probe.post("/analyze")
    def analyze(_: AnalyzeRequest):
        return {"ok": True}

    @probe.post("/card")
    def card(_: BuildCardRequest):
        return {"ok": True}

    @probe.get("/http-error")
    def http_error():
        raise HTTPException(status_code=400, detail="bad request")

    @probe.get("/llm-error")
    def llm_error():
        raise LLMError("ИИ недоступен")

    with TestClient(probe) as client:
        yield client


def test_public_field_names_match_frontend_contract():
    assert set(Card.model_fields) == CARD_FIELDS
    assert set(get_args(QuestionField)) == QUESTION_FIELDS


def test_response_schemas_require_public_envelopes():
    analysis = AnalyzeResponse.model_validate({
        "detected": {"need": True},
        "missing": ["data"],
        "questions": [{"field": "data", "text": "Какие данные доступны?"}],
        "source": "ai",
    })
    card = BuildCardResponse.model_validate({
        "card": {"title": "Бот для записи", "industry": "Услуги"},
        "warnings": [],
        "source": "ai",
    })

    assert set(analysis.model_dump()) == {"detected", "missing", "questions", "source"}
    assert set(card.model_dump()) == {"card", "warnings", "source"}
    assert set(card.card.model_dump()) == CARD_FIELDS
    with pytest.raises(ValueError):
        AnalyzeResponse.model_validate({"detected": {}, "missing": [], "questions": []})
    with pytest.raises(ValueError):
        BuildCardResponse.model_validate({"card": {}, "warnings": [], "source": "unknown"})


def test_health_does_not_expose_key(monkeypatch, caplog):
    secret = "test-only-secret-key"
    monkeypatch.setenv("AI_MODE", "auto")
    monkeypatch.setenv("OPENAI_API_KEY", secret)
    monkeypatch.setenv("OPENAI_MODEL", "test-model")

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "ai_mode": "auto",
        "ai_available": True,
        "openai_key": True,
        "model": "test-model",
    }
    assert secret not in response.text
    assert secret not in caplog.text


def test_app_starts_without_key_and_reports_ai_unavailable(monkeypatch, caplog):
    monkeypatch.setenv("AI_MODE", "auto")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_MODEL", "test-model")

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "ai_mode": "auto",
        "ai_available": False,
        "openai_key": False,
        "model": "test-model",
    }
    assert "OPENAI_API_KEY" not in caplog.text


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/analyze", {"draft": "two words", "industry": "Услуги"}),
        ("/card", {"draft": "two words", "industry": "Услуги", "answers": {}}),
    ],
)
def test_short_draft_returns_uniform_422(contract_client, path, payload):
    response = contract_client.post(path, json=payload)

    assert response.status_code == 422
    assert set(response.json()) == {"error"}
    assert "draft" in response.json()["error"]
    assert "3" in response.json()["error"]


def test_missing_answers_and_malformed_json_return_uniform_422(contract_client):
    missing = contract_client.post("/card", json={"draft": "нужен бот для записи"})
    malformed = contract_client.post(
        "/analyze", content="{broken", headers={"content-type": "application/json"}
    )

    for response in (missing, malformed):
        assert response.status_code == 422
        assert set(response.json()) == {"error"}
    assert "answers" in missing.json()["error"]
    assert "некорректный JSON" in malformed.json()["error"]


def test_http_and_llm_errors_use_same_shape(contract_client):
    for path, status in (("/http-error", 400), ("/llm-error", 503)):
        response = contract_client.get(path)
        assert response.status_code == status
        assert set(response.json()) == {"error"}

    missing_route = TestClient(app).get("/api/not-found")
    assert missing_route.status_code == 404
    assert set(missing_route.json()) == {"error"}
