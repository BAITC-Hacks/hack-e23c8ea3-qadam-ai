"""Модель данных приложения — общий файл для всех фич.

Любое изменение здесь нужно повторить на фронтенде и сообщить команде (см. AGENTS.md).
"""

from typing import Literal

from pydantic import BaseModel, HttpUrl, field_validator

CardField = Literal[
    "title",
    "context",
    "need",
    "users",
    "data",
    "constraints",
    "expected_result",
    "success_criteria",
    "contact",
    "interaction_format",
]
Level = Literal["draft", "working", "ready", "priority"]
Source = Literal["ai", "stub"]

DRAFT_MIN_LENGTH = 20


def _require_text(value: str, message: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError(message)
    return value


def _check_draft(value: str) -> str:
    value = value.strip()
    if len(value) < DRAFT_MIN_LENGTH:
        raise ValueError(f"Черновик должен быть не короче {DRAFT_MIN_LENGTH} символов")
    return value


# --- Сущности ---


class Card(BaseModel):
    title: str = ""
    context: str = ""
    need: str = ""
    users: str = ""
    data: str = ""
    constraints: str = ""
    expected_result: str = ""
    success_criteria: str = ""
    contact: str = ""
    interaction_format: str = ""


class BreakdownItem(BaseModel):
    key: str
    label: str
    score: int
    max: int
    comment: str


class MissingItem(BaseModel):
    field: CardField
    hint: str
    gain: int


class NextLevel(BaseModel):
    level: Level
    label: str
    points_needed: int


class Rating(BaseModel):
    total: int
    level: Level
    level_label: str
    breakdown: list[BreakdownItem]
    missing: list[MissingItem]
    next_level: NextLevel | None


class RatingSnapshot(BaseModel):
    total: int
    at: str


class Task(BaseModel):
    id: str
    business_id: str
    industry: str
    draft: str
    card: Card
    rating: Rating
    rating_history: list[RatingSnapshot]
    status: Literal["unpublished", "published"]
    created_at: str
    updated_at: str


class Business(BaseModel):
    id: str
    name: str


class Team(BaseModel):
    id: str
    name: str
    interests: list[str] = []
    skills: list[str] = []
    technologies: list[str] = []
    points: int = 0


class Proposal(BaseModel):
    id: str
    task_id: str
    team_id: str
    idea: str
    plan: str
    deadline: str
    link: str
    status: Literal["pending", "accepted", "rejected"]
    created_at: str


class ProposalWithTeam(Proposal):
    team: Team | None


# --- Задачи и рейтинг (Айгерим) ---


class RatingPreviewRequest(BaseModel):
    card: Card


class TaskCreate(BaseModel):
    business_id: str
    industry: str
    draft: str
    card: Card

    @field_validator("business_id")
    @classmethod
    def _business_required(cls, value: str) -> str:
        return _require_text(value, "Выберите компанию")

    @field_validator("industry")
    @classmethod
    def _industry_required(cls, value: str) -> str:
        return _require_text(value, "Укажите тему или отрасль задачи")

    @field_validator("draft")
    @classmethod
    def _draft_length(cls, value: str) -> str:
        return _check_draft(value)


class TaskUpdate(BaseModel):
    industry: str
    card: Card

    @field_validator("industry")
    @classmethod
    def _industry_required(cls, value: str) -> str:
        return _require_text(value, "Укажите тему или отрасль задачи")


# --- Конструктор (Марат) ---


class AnalyzeRequest(BaseModel):
    draft: str
    industry: str = ""

    @field_validator("draft")
    @classmethod
    def _draft_length(cls, value: str) -> str:
        return _check_draft(value)


class Question(BaseModel):
    field: CardField
    question: str


class AnalyzeResponse(BaseModel):
    known: Card
    missing: list[CardField]
    questions: list[Question]
    source: Source


class Answer(BaseModel):
    field: CardField
    question: str
    answer: str


class BuildCardRequest(BaseModel):
    draft: str
    industry: str = ""
    answers: list[Answer]

    @field_validator("draft")
    @classmethod
    def _draft_length(cls, value: str) -> str:
        return _check_draft(value)


class BuildCardResponse(BaseModel):
    card: Card
    warnings: list[str]
    source: Source


# --- Каталог и отклики (Арсен) ---


class ProposalCreate(BaseModel):
    team_id: str
    idea: str
    plan: str
    deadline: str
    link: HttpUrl  # при сохранении в Proposal приводите к str

    @field_validator("team_id")
    @classmethod
    def _team_required(cls, value: str) -> str:
        return _require_text(value, "Выберите команду")

    @field_validator("idea")
    @classmethod
    def _idea_required(cls, value: str) -> str:
        return _require_text(value, "Опишите идею решения")

    @field_validator("plan")
    @classmethod
    def _plan_required(cls, value: str) -> str:
        return _require_text(value, "Опишите план работы")

    @field_validator("deadline")
    @classmethod
    def _deadline_required(cls, value: str) -> str:
        return _require_text(value, "Укажите срок")


class DecisionRequest(BaseModel):
    decision: Literal["accepted", "rejected"]
