"""Единственное место, где вызывается модель: OpenAI через Chat Completions API.

ask_json делает одну попытку и при любой проблеме бросает LLMError.
Повтор и переход на заглушку решает вызывающий код (см. AGENTS.md, раздел «ИИ-функция»).
"""

import logging
import os
import re
from pathlib import Path
from typing import TypeVar

import openai
from dotenv import load_dotenv
from pydantic import BaseModel, ValidationError

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

log = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
# По умолчанию библиотека openai ждёт ответа до 10 минут — для демо это слишком долго.
REQUEST_TIMEOUT_SECONDS = 30

T = TypeVar("T", bound=BaseModel)

_client: openai.OpenAI | None = None
_PROMPT_VARIABLE = re.compile(r"\{\{\s*(\w+)\s*\}\}")


class LLMError(Exception):
    """Модель недоступна или вернула непригодный ответ."""


def ai_mode() -> str:
    return os.getenv("AI_MODE", "auto").strip().lower() or "auto"


def has_api_key() -> bool:
    return bool(os.getenv("OPENAI_API_KEY", "").strip())


def model_name() -> str:
    return os.getenv("OPENAI_MODEL", "").strip()


def ai_available() -> bool:
    """True, если AI_MODE=auto и заданы ключ и модель."""
    return ai_mode() == "auto" and has_api_key() and bool(model_name())


def load_prompt(name: str, **variables: object) -> str:
    """Прочитать app/prompts/<name>.md и заменить {{переменная}} на значения."""
    template = (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")

    def substitute(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in variables:
            raise KeyError(f"Для промпта {name}.md не передано значение {{{{{key}}}}}")
        return str(variables[key])

    return _PROMPT_VARIABLE.sub(substitute, template)


def ask_json(prompt: str, schema: type[T], *, system: str | None = None) -> T:
    """Запрос к модели с ответом строго по Pydantic-схеме (Structured Outputs).

    У схемы не должно быть значений по умолчанию: этого требует Structured Outputs.
    """
    if not ai_available():
        raise LLMError("ИИ выключен: AI_MODE=stub или в .env не заданы OPENAI_API_KEY и OPENAI_MODEL")

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    try:
        completion = _get_client().chat.completions.parse(
            model=model_name(),
            messages=messages,
            response_format=schema,
        )
    except ValidationError as exc:
        # Текст ответа модели в лог не пишем: в нём могут быть контакты пользователя.
        first = exc.errors()[0]
        log.warning("Ответ модели не прошёл проверку схемы %s: %s в %s", schema.__name__, first["type"], first["loc"])
        raise LLMError("Модель вернула ответ не по схеме") from exc
    except openai.OpenAIError as exc:
        log.warning("Ошибка OpenAI API: %s: %s", type(exc).__name__, str(exc)[:300])
        raise LLMError(f"OpenAI API недоступен: {type(exc).__name__}") from exc

    message = completion.choices[0].message
    if message.refusal:
        log.warning("Модель отказалась отвечать: %s", message.refusal[:300])
        raise LLMError("Модель отказалась отвечать")
    if message.parsed is None:
        raise LLMError("Модель вернула пустой ответ")
    return message.parsed


def _get_client() -> openai.OpenAI:
    global _client
    if _client is None:
        # Ключ передаём явно: без него SDK сам ищет OPENAI_API_KEY в окружении.
        _client = openai.OpenAI(
            api_key=os.environ["OPENAI_API_KEY"].strip(),
            timeout=REQUEST_TIMEOUT_SECONDS,
            max_retries=0,
        )
    return _client
