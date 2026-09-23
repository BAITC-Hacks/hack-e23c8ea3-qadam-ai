import copy
import json
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app import llm
from app.main import app

FIELDS = ["need", "users", "data", "constraints", "result", "criteria", "contact"]
DRAFT = "У нас небольшая пекарня, хотим сократить списания выпечки."


def analysis():
    return {
        "detected": {field: field == "need" for field in FIELDS},
        "missing": [field for field in FIELDS if field != "need"],
        "questions": [
            {"field": "data", "text": "Какие данные о списаниях доступны?"},
            {"field": "result", "text": "Какой результат должна передать команда?"},
            {"field": "criteria", "text": "Как вы проверите результат?"},
        ],
    }


def built_card():
    return {
        "card": {
            "title": "Планирование выпечки",
            "context": DRAFT,
            "need": "Сократить списания выпечки",
            "users": None,
            "data": None,
            "constraints": None,
            "result": None,
            "criteria": None,
            "format": None,
        },
        "warnings": [],
    }


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setattr(llm, "ai_available", lambda: True)
    responses = []

    def answer(prompt, schema, *, system=None):
        item = responses.pop(0)
        if isinstance(item, Exception):
            raise item
        if callable(item):
            item = item(json.loads(prompt))
        if isinstance(item, str):
            return schema.model_validate_json(item)
        return schema.model_validate(item)

    mock = Mock(side_effect=answer)
    monkeypatch.setattr(llm, "ask_json", mock)
    return responses, mock


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_analyze_contract(client, provider):
    responses, mock = provider
    responses.append(analysis())
    r = client.post(
        "/api/constructor/analyze", json={"draft": DRAFT, "industry": "HoReCa"}
    )
    assert r.status_code == 200
    assert r.json() == {**analysis(), "source": "ai"}
    assert mock.call_count == 1
    assert json.loads(mock.call_args.args[0])["draft"] == DRAFT
    assert mock.call_args.kwargs["system"]


@pytest.mark.parametrize(
    "bad",
    [
        "too_few",
        "too_many",
        "duplicate_field",
        "duplicate_text",
        "blank",
        "missing_mismatch",
        "detected_incomplete",
        "unsupported",
        "extra",
        "asks_known",
    ],
)
def test_invalid_analysis_retries_once(client, provider, bad):
    result = analysis()
    if bad == "too_few":
        result["questions"] = result["questions"][:2]
    elif bad == "too_many":
        result["questions"] *= 2
    elif bad == "duplicate_field":
        result["questions"][1]["field"] = "data"
    elif bad == "duplicate_text":
        result["questions"][1]["text"] = "  КАКИЕ данные о списаниях доступны? "
    elif bad == "blank":
        result["questions"][0]["text"] = "   "
    elif bad == "missing_mismatch":
        result["missing"].append("need")
    elif bad == "detected_incomplete":
        del result["detected"]["users"]
    elif bad == "unsupported":
        result["questions"][0]["field"] = "budget"
    elif bad == "extra":
        result["rating"] = 100
    else:
        result["questions"][0]["field"] = "need"
    responses, mock = provider
    responses.extend([result, analysis()])
    r = client.post("/api/constructor/analyze", json={"draft": DRAFT})
    assert r.status_code == 200
    assert r.json()["questions"] == analysis()["questions"]
    assert mock.call_count == 2


def test_full_draft_still_accepts_three_refinements(client, provider):
    result = analysis()
    result["detected"] = dict.fromkeys(FIELDS, True)
    result["missing"] = []
    provider[0].append(result)
    r = client.post("/api/constructor/analyze", json={"draft": DRAFT})
    assert r.status_code == 200
    assert len(r.json()["questions"]) == 3


@pytest.mark.parametrize("route", ["analyze", "card"])
def test_unavailable_provider_returns_503_without_call(
    client, provider, monkeypatch, route
):
    monkeypatch.setattr(llm, "ai_available", lambda: False)
    r = client.post(f"/api/constructor/{route}", json={"draft": DRAFT, "answers": {}})
    assert r.status_code == 503
    assert set(r.json()) == {"error"}
    provider[1].assert_not_called()


@pytest.mark.parametrize("route", ["analyze", "card"])
@pytest.mark.parametrize("failure", ["json", "provider"])
def test_persistent_failure_returns_safe_error(
    client, provider, caplog, route, failure
):
    responses, mock = provider
    raw = "private-person@example.com"
    responses.extend(
        ['{"broken":' if failure == "json" else llm.LLMError(raw) for _ in range(2)]
    )
    r = client.post(f"/api/constructor/{route}", json={"draft": DRAFT, "answers": {}})
    assert r.status_code == 503
    assert set(r.json()) == {"error"}
    assert raw not in r.text and raw not in caplog.text
    assert mock.call_count == 2


def test_build_card_keeps_contract_and_unknown_empty(client, provider):
    result = built_card()
    result["card"]["data"] = "CSV продаж за месяц"
    provider[0].append(result)
    payload = {
        "draft": DRAFT,
        "industry": "HoReCa",
        "answers": {"data": "CSV продаж за месяц"},
    }
    original = copy.deepcopy(payload)
    r = client.post("/api/constructor/card", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["source"] == "ai"
    assert data["card"]["data"] == payload["answers"]["data"]
    assert data["card"]["industry"] == "HoReCa"
    assert data["card"]["users"] == ""
    assert data["card"]["contact"] == ""
    assert all(isinstance(v, str) for v in data["card"].values())
    assert set(data["card"]) == {
        "title",
        "industry",
        "context",
        "need",
        "users",
        "data",
        "constraints",
        "result",
        "criteria",
        "contact",
        "format",
    }
    assert payload == original


def test_build_bad_schema_retries(client, provider):
    invalid = built_card()
    invalid["card"]["rating"] = 100
    provider[0].extend([invalid, built_card()])
    r = client.post("/api/constructor/card", json={"draft": DRAFT, "answers": {}})
    assert r.status_code == 200
    assert provider[1].call_count == 2


def test_build_contact_answer_never_sent_to_model(client, provider):
    private = "Синтетический контакт demo@example.com +7 700 000 00 00; консультации по пятницам"
    provider[0].append(built_card())
    r = client.post(
        "/api/constructor/card", json={"draft": DRAFT, "answers": {"contact": private}}
    )
    assert r.status_code == 200
    assert r.json()["card"]["contact"] == private
    sent = provider[1].call_args.args[0]
    assert (
        private not in sent and "demo@example.com" not in sent and "+7 700" not in sent
    )
    assert "contact" not in json.loads(sent)["answers"]


@pytest.mark.parametrize("route", ["analyze", "card"])
def test_free_text_contacts_redacted(client, provider, route):
    contacts = ["demo@example.com", "+7 700 000 00 00", "@demo_contact"]
    provider[0].append(analysis() if route == "analyze" else built_card())
    r = client.post(
        f"/api/constructor/{route}",
        json={
            "draft": DRAFT + " Связь: " + ", ".join(contacts),
            "industry": "HoReCa",
            "answers": {"data": "Связь demo@example.com"},
        },
    )
    assert r.status_code == 200
    sent = provider[1].call_args.args[0]
    assert all(value not in sent for value in contacts)
    if route == "card":
        assert all(value in r.json()["card"]["contact"] for value in contacts)


def test_redacted_context_restored_from_original_only(client, provider):
    draft = DRAFT + " Пишите demo@example.com."

    def response(sent):
        result = built_card()
        result["card"]["context"] = sent["draft"]
        return result

    provider[0].append(response)
    r = client.post("/api/constructor/card", json={"draft": draft, "answers": {}})
    assert r.status_code == 200
    assert r.json()["card"]["context"] == draft


@pytest.mark.parametrize("route", ["analyze", "card"])
def test_short_draft_rejected_without_model_call(client, provider, route):
    r = client.post(
        f"/api/constructor/{route}", json={"draft": "  два слова  ", "answers": {}}
    )
    assert r.status_code == 422 and set(r.json()) == {"error"}
    provider[1].assert_not_called()


def test_invalid_request_json_uses_error_contract(client, provider):
    r = client.post(
        "/api/constructor/analyze",
        content="{",
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 422 and set(r.json()) == {"error"}
    provider[1].assert_not_called()


def test_unknown_answer_field_rejected(client, provider):
    r = client.post(
        "/api/constructor/card", json={"draft": DRAFT, "answers": {"budget": "100"}}
    )
    assert r.status_code == 422
    provider[1].assert_not_called()


def test_invented_contact_is_retried(client, provider):
    bad = built_card()
    bad["card"]["context"] = "Пишите invented@example.com"
    provider[0].extend([bad, built_card()])
    r = client.post("/api/constructor/card", json={"draft": DRAFT, "answers": {}})
    assert r.status_code == 200
    assert "invented@example.com" not in r.text
    assert provider[1].call_count == 2


def test_unknown_contact_token_is_retried(client, provider):
    bad = built_card()
    bad["card"]["context"] = "Пишите [[QADAM_CONTACT_unknown_99]]"
    provider[0].extend([bad, built_card()])
    r = client.post("/api/constructor/card", json={"draft": DRAFT, "answers": {}})
    assert r.status_code == 200
    assert "QADAM_CONTACT" not in r.text
    assert provider[1].call_count == 2


def test_analysis_does_not_show_contact_tokens_in_questions(client, provider):
    def bad(sent):
        result = analysis()
        result["questions"][0]["text"] = "Подтвердите сведения: " + sent["draft"]
        return result

    provider[0].extend([bad, analysis()])
    r = client.post(
        "/api/constructor/analyze", json={"draft": DRAFT + " demo@example.com"}
    )
    assert r.status_code == 200
    assert "QADAM_CONTACT" not in r.text
    assert provider[1].call_count == 2


def test_provider_transient_error_recovers(client, provider):
    provider[0].extend([llm.LLMError("timeout"), analysis()])
    r = client.post("/api/constructor/analyze", json={"draft": DRAFT})
    assert r.status_code == 200
    assert provider[1].call_count == 2


def test_refinements_must_not_skip_remaining_missing_field(client, provider):
    bad = analysis()
    bad["detected"] = dict.fromkeys(FIELDS, True)
    bad["detected"]["users"] = False
    bad["missing"] = ["users"]
    good = copy.deepcopy(bad)
    good["questions"][0] = {
        "field": "users",
        "text": "Кто будет пользоваться результатом?",
    }
    provider[0].extend([bad, good])
    r = client.post("/api/constructor/analyze", json={"draft": DRAFT})
    assert r.status_code == 200
    assert provider[1].call_count == 2
