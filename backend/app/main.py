"""FastAPI-приложение: подключение роутеров и единый формат ошибок {"error": "..."}."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import llm, storage
from app.routers import catalog, constructor, tasks

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)

# Понятные тексты для частых ошибок валидации Pydantic.
VALIDATION_MESSAGES = {
    "missing": "обязательное поле",
    "string_type": "должно быть строкой",
    "literal_error": "недопустимое значение",
    "url_parsing": "некорректная ссылка, нужен URL вида https://...",
    "url_scheme": "некорректная ссылка, нужен URL вида https://...",
    "json_invalid": "некорректный JSON",
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    storage.read()  # создаёт db.json из seed, если его ещё нет
    log.info("ИИ: режим %s, доступен: %s", llm.ai_mode(), llm.ai_available())
    yield


app = FastAPI(title="Qadam AI", lifespan=lifespan)
app.include_router(tasks.router)
app.include_router(constructor.router)
app.include_router(catalog.router)


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "ai_mode": llm.ai_mode(),
        "ai_available": llm.ai_available(),
        "openai_key": llm.has_api_key(),
        "model": llm.model_name(),
    }


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse({"error": _describe_validation(exc)}, status_code=422)


@app.exception_handler(llm.LLMError)
async def llm_error(_: Request, exc: llm.LLMError) -> JSONResponse:
    return JSONResponse({"error": str(exc)}, status_code=503)


@app.exception_handler(Exception)
async def unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    log.error("Необработанная ошибка", exc_info=exc)
    return JSONResponse({"error": "Внутренняя ошибка сервера"}, status_code=500)


def _describe_validation(exc: RequestValidationError) -> str:
    parts = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error["loc"] if part != "body")
        message = VALIDATION_MESSAGES.get(error["type"], error["msg"].removeprefix("Value error, "))
        parts.append(f"{location}: {message}" if location else message)
    return "; ".join(parts)
