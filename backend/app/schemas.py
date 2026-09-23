"""Форматы API конструктора с ИИ — общий файл.

Названия полей совпадают с фронтендом (front/src/data/seed.js, front/src/lib/ai.js).
Меняешь формат — поправь фронтенд и сообщи команде (см. AGENTS.md).
"""

from typing import Literal

from pydantic import BaseModel, field_validator

# Поля, о которых ИИ задаёт вопросы (ключи QUESTION_BANK во front/src/lib/ai.js).
QuestionField = Literal["need", "users", "data", "constraints", "result", "criteria", "contact"]
Source = Literal["ai", "stub"]

def _check_draft(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Напишите бизнес-идею или задачу")
    return value


class Card(BaseModel):
    """Карточка задачи — как EMPTY_CARD во front/src/data/seed.js."""

    title: str = ""
    industry: str = ""
    context: str = ""
    need: str = ""
    users: str = ""
    data: str = ""
    constraints: str = ""
    result: str = ""
    criteria: str = ""
    contact: str = ""
    format: str = ""


class AnalyzeRequest(BaseModel):
    draft: str
    industry: str = ""

    @field_validator("draft")
    @classmethod
    def _draft_length(cls, value: str) -> str:
        return _check_draft(value)


class Question(BaseModel):
    field: QuestionField
    text: str


class AnalyzeResponse(BaseModel):
    detected: dict[QuestionField, bool]
    missing: list[QuestionField]
    questions: list[Question]
    source: Source


class BuildCardRequest(BaseModel):
    draft: str
    industry: str = ""
    answers: dict[QuestionField, str]

    @field_validator("draft")
    @classmethod
    def _draft_length(cls, value: str) -> str:
        return _check_draft(value)


class BuildCardResponse(BaseModel):
    card: Card
    warnings: list[str]
    source: Source
