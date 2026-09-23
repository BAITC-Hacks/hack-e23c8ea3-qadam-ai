"""Ручной прогон пяти синтетических примеров через реальный провайдер.

Из backend: .venv/bin/python -m tests.manual_constructor --live > /tmp/qadam-ai-review.json
Требует настроенного локального окружения. Не запускается автоматически через pytest.
"""

import argparse
import json
from pathlib import Path

from app import llm
from app.schemas import AnalyzeRequest, BuildCardRequest
from app.services.constructor import analyze, build_card


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--live",
        action="store_true",
        help="Разрешить реальные запросы к настроенному AI API",
    )
    args = parser.parse_args()
    if not args.live:
        parser.error("Для реального прогона укажите --live")
    if not llm.ai_available():
        parser.error(
            "ИИ недоступен: настройте ключ, модель и AI_MODE=auto локально; не передавайте ключ в командной строке"
        )
    cases = json.loads(
        (Path(__file__).parent / "fixtures/constructor_cases.json").read_text()
    )
    report = {"model": llm.model_name(), "cases": []}
    for case in cases:
        item = {"id": case["id"], "review": case["review"]}
        for operation, request, call in [
            (
                "analyze",
                AnalyzeRequest(draft=case["draft"], industry=case["industry"]),
                analyze,
            ),
            (
                "card",
                BuildCardRequest(
                    draft=case["draft"],
                    industry=case["industry"],
                    answers=case["answers"],
                ),
                build_card,
            ),
        ]:
            try:
                item[operation] = call(request).model_dump()
            except llm.LLMError:
                item[operation] = {
                    "error": "Провайдер или проверка ответа не прошли; нужен ручной разбор."
                }
        report["cases"].append(item)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return (
        1
        if any(
            "error" in case[op]
            for case in report["cases"]
            for op in ("analyze", "card")
        )
        else 0
    )


if __name__ == "__main__":
    raise SystemExit(main())
