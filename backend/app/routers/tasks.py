"""Задачи и рейтинг (Айгерим).

Пока здесь только компании и сброс данных. Эндпоинты задач и рейтинга добавим в фиче feat/rating.
"""

from fastapi import APIRouter

from app import storage
from app.schemas import Business

router = APIRouter(prefix="/api", tags=["tasks"])


@router.get("/businesses", response_model=list[Business])
def list_businesses() -> list[dict]:
    return storage.read()["businesses"]


@router.post("/demo/reset")
def reset_demo() -> dict:
    """Пересоздать db.json из seed: перед демо и после обновления seed-файлов."""
    storage.reset()
    return {"ok": True}
