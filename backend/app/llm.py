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

from app.contact_context import DATE_CANDIDATE, is_monetary_number

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

log = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
# Один вызов не должен ждать дольше установленного для демо лимита.
REQUEST_TIMEOUT_SECONDS = 20

T = TypeVar("T", bound=BaseModel)

_client: openai.OpenAI | None = None
_PROMPT_VARIABLE = re.compile(r"\{\{\s*(\w+)\s*\}\}")
_EMAIL = re.compile(r"(?<![\w@])[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}(?![\w@])")
_PHONE_CANDIDATE = re.compile(
    rf"(?P<date>{DATE_CANDIDATE})|(?<![\w@])\+?\d(?:[\d ()-]|\.(?=\d)){{6,}}\d(?![\w@])"
)
_TOKEN = re.compile(r"\bsk-[A-Za-z0-9_-]{8,}\b")
_HANDLE = re.compile(r"(?<!\w)@[A-Za-z][A-Za-z0-9_]{4,}\b")
_URL = re.compile(r"https?://\S+")


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


def _mask_contacts(value: str) -> str:
    """Remove recognizable addresses and 10–15 digit phone numbers from free text."""
    value = _EMAIL.sub("[email]", value)

    def mask_phone(match: re.Match[str]) -> str:
        if match.group("date") is not None:
            return match.group()
        digits = sum(character.isdigit() for character in match.group())
        if 10 <= digits <= 15 and not is_monetary_number(value, match.start(), match.end()):
            return "[phone]"
        return match.group()

    return _PHONE_CANDIDATE.sub(mask_phone, value)


def _safe_excerpt(content: object) -> str:
    """Bounded diagnostic excerpt, without recognizable contacts or the API key."""
    if not isinstance(content, str):
        return "<недоступен>"
    excerpt = _mask_contacts(content)
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if key:
        excerpt = excerpt.replace(key, "[key]")
    excerpt = _TOKEN.sub("[key]", excerpt)
    excerpt = _URL.sub("[url]", excerpt)
    excerpt = _HANDLE.sub("[handle]", excerpt)
    return repr(excerpt[:120])


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
        messages.append({"role": "system", "content": _mask_contacts(system)})
    messages.append({"role": "user", "content": _mask_contacts(prompt)})

    try:
        completion = _get_client().chat.completions.parse(
            model=model_name(),
            messages=messages,
            response_format=schema,
        )
    except ValidationError as exc:
        first = exc.errors()[0]
        log.warning("Ответ модели не прошёл проверку схемы %s: %s", schema.__name__, first["type"])
        raise LLMError("Модель вернула ответ не по схеме") from exc
    except ValueError as exc:
        # Парсер SDK может бросить ValueError для повреждённого JSON.
        log.warning("Ответ модели не разобран: %s", type(exc).__name__)
        raise LLMError("Модель вернула ответ не по схеме") from exc
    except openai.OpenAIError as exc:
        # Текст исключения SDK может включать запрос или ответ провайдера.
        log.warning("Ошибка OpenAI API: %s", type(exc).__name__)
        raise LLMError(f"OpenAI API недоступен: {type(exc).__name__}") from exc

    try:
        message = completion.choices[0].message
        refusal = message.refusal
        parsed = message.parsed
    except (AttributeError, IndexError, KeyError, TypeError) as exc:
        log.warning("Модель вернула некорректный формат ответа")
        raise LLMError("Модель вернула некорректный формат ответа") from exc
    if refusal:
        log.warning("Модель отказалась отвечать")
        raise LLMError("Модель отказалась отвечать")
    if parsed is None:
        log.warning("Модель вернула пустой ответ: %s", _safe_excerpt(getattr(message, "content", None)))
        raise LLMError("Модель вернула пустой ответ")
    try:
        return schema.model_validate(parsed)
    except ValidationError as exc:
        log.warning(
            "Ответ модели не прошёл проверку схемы %s: %s; фрагмент: %s",
            schema.__name__, exc.errors()[0]["type"],
            _safe_excerpt(getattr(message, "content", None)),
        )
        raise LLMError("Модель вернула ответ не по схеме") from exc


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
