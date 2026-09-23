"""Хранилище в JSON-файле data/db.json.

Файл создаётся из data/seed/*.json при первом запуске и при сбросе (POST /api/demo/reset).
Рейтинг seed-задач не хранится в seed, а считается здесь при загрузке.
"""

import json
import logging
import os
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, ValidationError

from app.schemas import Business, Card, Proposal, RatingSnapshot, Task, Team
from app.services.rating import compute_rating

log = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
SEED_DIR = os.path.join(DATA_DIR, "seed")
DB_PATH = os.path.join(DATA_DIR, "db.json")
COLLECTIONS = ("businesses", "drafts", "tasks", "teams", "proposals")

_lock = threading.RLock()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:8]}"


def read() -> dict:
    """Текущее состояние всех коллекций. Для изменений используйте transaction()."""
    with _lock:
        if not os.path.exists(DB_PATH):
            reset()
        with open(DB_PATH, encoding="utf-8") as file:
            return json.load(file)


@contextmanager
def transaction() -> Iterator[dict]:
    """Прочитать, изменить и сохранить базу под одной блокировкой.

    Если внутри блока возникло исключение, изменения не сохраняются.
    """
    with _lock:
        db = read()
        yield db
        _write(db)


def reset() -> None:
    """Пересоздать db.json из seed-файлов."""
    with _lock:
        now = now_iso()
        db = {name: _load_seed(name, now) for name in COLLECTIONS}
        _write(db)
        counts = ", ".join(f"{name}: {len(items)}" for name, items in db.items())
        log.info("db.json пересоздан из seed (%s)", counts)


def _write(db: dict) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp_path = DB_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as file:
        json.dump(db, file, ensure_ascii=False, indent=2)
    os.replace(tmp_path, DB_PATH)


def _load_seed(name: str, now: str) -> list[dict]:
    path = os.path.join(SEED_DIR, f"{name}.json")
    if not os.path.exists(path):
        return []
    try:
        with open(path, encoding="utf-8") as file:
            items = json.load(file)
    except json.JSONDecodeError as exc:
        log.error("seed/%s.json не читается как JSON (%s), коллекция будет пустой", name, exc)
        return []

    prepared = []
    for raw in items:
        try:
            prepared.append(_prepare_seed_item(name, raw, now))
        except ValidationError as exc:
            # Плохой элемент seed не должен ронять весь сервер.
            log.warning("Пропущен элемент %r из seed/%s.json: %s", raw.get("id"), name, exc.errors()[0]["msg"])
    return prepared


def _prepare_seed_item(name: str, raw: dict, now: str) -> dict:
    if name == "tasks":
        card = Card.model_validate(raw.get("card", {}))
        rating = compute_rating(card)
        updated_at = raw.get("updated_at") or now
        task = Task(
            id=raw.get("id") or new_id("t"),
            business_id=raw.get("business_id", ""),
            industry=raw.get("industry", ""),
            draft=raw.get("draft", ""),
            card=card,
            rating=rating,
            rating_history=[RatingSnapshot(total=rating.total, at=updated_at)],
            status=raw.get("status", "published"),
            created_at=raw.get("created_at") or now,
            updated_at=updated_at,
        )
        return task.model_dump()

    models: dict[str, type[BaseModel]] = {"businesses": Business, "teams": Team, "proposals": Proposal}
    if name == "proposals":
        raw = {"status": "pending", "created_at": now, **raw}
    model = models.get(name)
    return model.model_validate(raw).model_dump() if model else raw
