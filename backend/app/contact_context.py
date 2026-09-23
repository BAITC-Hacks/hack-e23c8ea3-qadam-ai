"""Shared, bounded date and monetary context for numeric contact candidates."""

import re

# Consume a complete date separately, never a prefix of a longer phone number.
DATE_CANDIDATE = (
    r"(?<![\w+])(?:\d{4}[-.]\d{2}[-.]\d{2}|\d{2}[-.]\d{2}[-.]\d{4})"
    r"(?!\w|[.-]\d)"
)

_CURRENCY = r"(?:тенге|тг|руб(?:лей|ля|ль)?|доллар(?:ов|а)?|евро|KZT|USD|EUR|RUB)\b|[₸₽$€]"
_MONEY_BEFORE = re.compile(
    r"(?:\b(?:бюджет|стоимость|цена|сумма|budget|cost|price|amount)\s*[:=]?\s*"
    r"|\b(?:KZT|USD|EUR|RUB)\s*|[₸₽$€]\s*)$",
    re.IGNORECASE,
)
_MONEY_AFTER = re.compile(r"^\s*(?:,\d{1,2}\s*)?(?:" + _CURRENCY + r")", re.IGNORECASE)


def is_monetary_number(text: str, start: int, end: int) -> bool:
    """Use adjacent labels/currency, not digit count alone, to identify an amount.

    This is a narrow heuristic, not semantic classification or PII detection.
    Fixed context windows avoid rescanning the full input for every candidate.
    """
    return bool(
        _MONEY_BEFORE.search(text[max(0, start - 48):start])
        or _MONEY_AFTER.match(text[end:end + 32])
    )
