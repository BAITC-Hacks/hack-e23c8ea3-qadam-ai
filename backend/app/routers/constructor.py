"""Конструктор задачи (Марат): POST /api/constructor/analyze и POST /api/constructor/card.

Роутер уже подключён в main.py. Форматы запросов и ответов — в app/schemas.py,
контракты — в AGENTS.md, раздел «API».
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/constructor", tags=["constructor"])
