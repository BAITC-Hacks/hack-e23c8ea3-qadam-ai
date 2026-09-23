"""AI-конструктор; публичные контракты и вызов провайдера принадлежат общим модулям."""

import json
import logging
import re
import secrets
from typing import TypeVar

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app import llm
from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    BuildCardRequest,
    BuildCardResponse,
    Card,
    QuestionField,
)

log = logging.getLogger(__name__)
UNKNOWN = {
    "", "не знаю", "пока не знаю", "пока не знаю, нужно уточнить",
    "нужно уточнить", "не уточнено", "уточним", "не указано",
    "не определено", "ещё не определили", "еще не определили",
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Detected(StrictModel):
    need: bool
    users: bool
    data: bool
    constraints: bool
    result: bool
    criteria: bool
    contact: bool


class ModelQuestion(StrictModel):
    field: QuestionField
    text: str


class ModelAnalysis(StrictModel):
    detected: Detected
    missing: list[QuestionField]
    questions: list[ModelQuestion] = Field(min_length=3, max_length=5)

    @model_validator(mode="after")
    def validate_questions(self):
        missing = set(self.missing)
        expected = {
            key for key, present in self.detected.model_dump().items() if not present
        }
        if len(missing) != len(self.missing) or missing != expected:
            raise ValueError("missing must match detected without duplicates")
        fields = [q.field for q in self.questions]
        texts = [
            " ".join(q.text.casefold().split()).rstrip("?.!") for q in self.questions
        ]
        if (
            len(set(fields)) != len(fields)
            or len(set(texts)) != len(texts)
            or not all(texts)
        ):
            raise ValueError(
                "questions must have unique fields and nonempty distinct text"
            )
        if len(missing) >= 3 and not set(fields).issubset(missing):
            raise ValueError("ask missing fields before refining known fields")
        if len(missing) < 3 and not missing.issubset(fields):
            raise ValueError("include all missing fields before refinements")
        for question in self.questions:
            if "[[QADAM_CONTACT_" in question.text:
                raise ValueError("questions must not repeat contact tokens")
            question.text = question.text.strip()
        return self


class ModelCard(StrictModel):
    # Нет defaults: каждое поле обязательно для Structured Outputs.
    # Контакт и отрасль добавляются локально из исходного ввода.
    title: str | None
    context: str | None
    need: str | None
    users: str | None
    data: str | None
    constraints: str | None
    result: str | None
    criteria: str | None
    format: str | None


class ModelBuild(StrictModel):
    card: ModelCard
    warnings: list[str]


# Ограниченная маскировка, не полноценное распознавание персональных данных.
CONTACT_PATTERN = re.compile(
    # Не начинаем поиск заново с каждого суффикса длинного слова.
    # Possessive-квантификаторы доступны в поддерживаемом Python 3.11+.
    r"(?<![\w.+%@-])[\w.+%-]++@[\w-]++(?:\.[\w-]++)+"
    r"|(?:https?://)?t\.me/[A-Za-z0-9_]+"
    r"|(?<!\w)@[A-Za-z][A-Za-z0-9_]{2,}"
    # Поглощаем весь числовой кандидат даже при неверной длине, без перебора
    # его суффиксов. Отделяющие пробелы/скобки вернём неизменёнными.
    r"|(?P<phone>(?<![\w+])\+?\d[\d ()-]*+)",
    re.IGNORECASE,
)
CONTACT_TOKEN = re.compile(r"\[\[QADAM_CONTACT_[^\[\]\s]*\]\]")
DATE_PREFIX = re.compile(r"(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})(?:$|[ ()])")


def _contact_value(match: re.Match[str]) -> str:
    if match.group("phone") is None:
        return match.group()
    value = match.group().rstrip(" ()-")
    if DATE_PREFIX.match(value):
        return ""
    # Не выделяем телефон внутри идентификатора вида 77000000000abc.
    if match.end() < len(match.string) and match.group() == value:
        following = match.string[match.end()]
        if following.isalnum() or following == "_":
            return ""
    return value if 10 <= sum(char.isdigit() for char in value) <= 15 else ""


class ContactMask:
    def __init__(self):
        self.prefix = f"[[QADAM_CONTACT_{secrets.token_hex(4)}_"
        self.values: dict[str, str] = {}
        self._tokens: dict[str, str] = {}

    def redact(self, text: str) -> str:
        def replace(match):
            value = _contact_value(match)
            if not value:
                return match.group()
            token = self._tokens.get(value)
            if token is None:
                token = f"{self.prefix}{len(self.values) + 1}]]"
                self.values[token] = value
                self._tokens[value] = token
            return token + match.group()[len(value):]

        return CONTACT_PATTERN.sub(replace, text)

    def restore(self, text: str) -> str:
        return CONTACT_TOKEN.sub(lambda m: self.values.get(m.group(), m.group()), text)

    def hide(self, text: str) -> str:
        return CONTACT_TOKEN.sub(
            lambda m: "[контакт скрыт]" if m.group() in self.values else m.group(),
            text,
        )

    def check_output(self, result: BaseModel) -> None:
        text = result.model_dump_json()
        # Модель может повторить выданный токен, но не придумать контакт или токен.
        for match in CONTACT_PATTERN.finditer(text):
            if _contact_value(match):
                raise ValueError("model output contains an unmasked contact")
        if "[[QADAM_CONTACT_" in self.hide(text):
            raise ValueError("model output contains an unknown contact token")


T = TypeVar("T", bound=BaseModel)


def _ensure_ai_available() -> None:
    if not llm.ai_available():
        raise llm.LLMError(
            "ИИ недоступен. Используйте локальную заглушку или ручное заполнение."
        )


def _ask(name: str, payload: dict, schema: type[T], mask: ContactMask) -> T:
    system = llm.load_prompt(name)
    prompt = json.dumps(payload, ensure_ascii=False)
    for attempt in range(2):
        try:
            result = llm.ask_json(prompt, schema, system=system)
            result = schema.model_validate(result)
            mask.check_output(result)
            return result
        except (llm.LLMError, ValidationError, ValueError) as exc:
            # Не пишем текст ошибки и ответ: оба могут содержать пользовательский ввод.
            log.warning(
                "Constructor %s attempt %d failed: %s",
                name,
                attempt + 1,
                type(exc).__name__,
            )
    raise llm.LLMError(
        "Не удалось получить корректный ответ ИИ. Используйте локальную заглушку или ручное заполнение."
    )


def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    _ensure_ai_available()
    mask = ContactMask()
    payload = {
        "draft": mask.redact(request.draft),
        "industry": mask.redact(request.industry),
    }
    result = _ask("analyze", payload, ModelAnalysis, mask)
    return AnalyzeResponse(**result.model_dump(), source="ai")


def _text(value: str | None) -> str:
    value = (value or "").strip()
    normalized = " ".join(value.casefold().strip(" \t\r\n.,;:!?").split())
    return "" if normalized in UNKNOWN else value


def build_card(request: BuildCardRequest) -> BuildCardResponse:
    _ensure_ai_available()
    mask = ContactMask()
    draft = mask.redact(request.draft)
    original_contacts = list(mask.values.values())
    contact = _text(request.answers.get("contact")) or "; ".join(original_contacts)
    payload = {
        "draft": draft,
        "industry": mask.redact(request.industry),
        "answers": {
            field: mask.redact(answer)
            for field, answer in request.answers.items()
            if field != "contact"
        },
    }
    result = _ask("card", payload, ModelBuild, mask)
    values = {
        key: mask.restore(_text(value))
        for key, value in result.card.model_dump().items()
    }
    values["industry"] = request.industry
    values["contact"] = contact
    warnings = list(
        dict.fromkeys(warning.strip() for warning in result.warnings if warning.strip())
    )
    # Предупреждения не должны раскрывать замаскированные контакты.
    warnings = [mask.hide(warning) for warning in warnings]
    for field, value in values.items():
        if (
            field != "industry"
            and not value
            and not any(w.startswith(f"{field}:") for w in warnings)
        ):
            warnings.append(
                f"{field}: сведения не уточнены; заполните поле перед подтверждением."
            )
    if request.answers.get("contact", "").strip():
        warnings.append(
            "contact: ответ сохранён локально; проверьте контакт и при необходимости перенесите порядок консультаций в format."
        )
    return BuildCardResponse(card=Card(**values), warnings=warnings, source="ai")
