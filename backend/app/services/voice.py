"""Whisper transcription without stored audio, fake transcripts, or provider error text."""

import asyncio
import os

import openai

from app import llm

TRANSCRIPTION_TIMEOUT_SECONDS = 20
AUDIO_FILENAMES = {
    "audio/webm": "recording.webm",
    "audio/mp4": "recording.mp4",
    "audio/wav": "recording.wav",
    "audio/x-wav": "recording.wav",
    "audio/mpeg": "recording.mp3",
}

_ERRORS = {
    "voice_unavailable": (503, "Голосовой ввод сейчас недоступен. Введите текст вручную."),
    "unsupported_audio": (415, "Этот формат аудио не поддерживается."),
    "audio_too_large": (413, "Запись превышает допустимый размер 5 МиБ."),
    "empty_audio": (422, "Запись пуста. Запишите сообщение ещё раз."),
    "invalid_audio": (422, "Не удалось прочитать запись. Запишите сообщение ещё раз."),
    "no_speech": (422, "Речь не распознана. Повторите запись или введите текст."),
    "transcription_timeout": (504, "Распознавание заняло слишком долго. Повторите попытку."),
    "transcription_failed": (502, "Не удалось распознать речь. Повторите попытку или введите текст."),
}


class VoiceError(Exception):
    """Public error picked from a fixed safe vocabulary, never from provider content."""

    def __init__(self, code: str):
        self.code = code
        self.status_code, message = _ERRORS[code]
        super().__init__(message)


def ensure_available() -> None:
    # llm loads the existing root .env. Whisper does not use OPENAI_MODEL.
    if llm.ai_mode() != "auto" or not llm.has_api_key():
        raise VoiceError("voice_unavailable")


async def transcribe_audio(audio: bytes, mime: str) -> str:
    ensure_available()
    try:
        # HTTPX's SDK timeout also applies to individual I/O operations; the outer
        # deadline additionally bounds the complete call. Never retry paid audio.
        async with asyncio.timeout(TRANSCRIPTION_TIMEOUT_SECONDS):
            async with openai.AsyncOpenAI(
                api_key=os.environ["OPENAI_API_KEY"].strip(),
                timeout=TRANSCRIPTION_TIMEOUT_SECONDS,
                max_retries=0,
            ) as client:
                result = await client.audio.transcriptions.create(
                    model="whisper-1",
                    file=(AUDIO_FILENAMES[mime], audio, mime),
                    response_format="json",
                )
    except (openai.APITimeoutError, TimeoutError):
        raise VoiceError("transcription_timeout") from None
    except (openai.BadRequestError, openai.UnprocessableEntityError):
        raise VoiceError("invalid_audio") from None
    except (openai.AuthenticationError, openai.PermissionDeniedError):
        raise VoiceError("voice_unavailable") from None
    except Exception as exc:
        # Do not log the SDK exception: it may include audio, transcript or keys.
        # The route catches VoiceError and returns only its fixed public message.
        raise VoiceError("transcription_failed") from exc

    text = getattr(result, "text", None)
    if not isinstance(text, str):
        raise VoiceError("transcription_failed")
    text = text.strip()
    if not text:
        raise VoiceError("no_speech")
    return text
