"""Рейтинг готовности задачи.

Пока заготовка: всегда 0 баллов. Формулу из AGENTS.md добавим в фиче рейтинга (ветка feat/rating).
"""

from app.schemas import Card, NextLevel, Rating


def compute_rating(card: Card) -> Rating:
    """Заготовка: рейтинг с нулём баллов в правильном формате."""
    return Rating(
        total=0,
        level="draft",
        level_label="Черновик",
        breakdown=[],
        missing=[],
        next_level=NextLevel(level="working", label="Рабочая", points_needed=40),
    )
