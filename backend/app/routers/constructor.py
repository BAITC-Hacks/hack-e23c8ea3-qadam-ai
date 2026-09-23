"""Конструктор задачи (Марат): POST /api/constructor/analyze и POST /api/constructor/card.

Роутер уже подключён в main.py. Форматы запросов и ответов — в app/schemas.py,
контракты — в AGENTS.md, раздел «API».
"""

from fastapi import APIRouter

from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    BuildCardRequest,
    BuildCardResponse,
)
from app.services import constructor

router = APIRouter(prefix="/api/constructor", tags=["constructor"])


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    return constructor.analyze(request)


@router.post("/card", response_model=BuildCardResponse)
def build_card(request: BuildCardRequest) -> BuildCardResponse:
    return constructor.build_card(request)
