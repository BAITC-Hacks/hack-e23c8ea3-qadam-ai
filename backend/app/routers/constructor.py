"""Конструктор задачи (Марат): POST /api/constructor/analyze и POST /api/constructor/card.

Роутер уже подключён в main.py. Форматы запросов и ответов — в app/schemas.py,
контракты — в AGENTS.md, раздел «API».
"""

from fastapi import APIRouter, HTTPException

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
    try:
        return constructor.analyze(request)
    except constructor.InputScopeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None


@router.post("/card", response_model=BuildCardResponse)
def build_card(request: BuildCardRequest) -> BuildCardResponse:
    try:
        return constructor.build_card(request)
    except constructor.InputScopeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
