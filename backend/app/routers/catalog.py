"""Каталог и отклики (Арсен): каталог, команды, отклики и решения бизнеса.

Роутер уже подключён в main.py. Форматы запросов и ответов есть в app/schemas.py,
контракты — в AGENTS.md, раздел «API».
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["catalog"])
