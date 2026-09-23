"""Raw-body audio upload; bounded in memory before one asynchronous Whisper call."""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.requests import ClientDisconnect

from app.services import voice

router = APIRouter(prefix="/api/voice", tags=["voice"])
MAX_AUDIO_BYTES = 5 * 1024 * 1024


@router.post("/transcribe")
async def transcribe(request: Request) -> JSONResponse:
    try:
        mime = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
        if mime not in voice.AUDIO_FILENAMES:
            raise voice.VoiceError("unsupported_audio")

        length_header = request.headers.get("content-length")
        if length_header is not None:
            try:
                length = int(length_header)
            except ValueError:
                raise voice.VoiceError("invalid_audio") from None
            if length < 0:
                raise voice.VoiceError("invalid_audio")
            if length > MAX_AUDIO_BYTES:
                raise voice.VoiceError("audio_too_large")

        voice.ensure_available()
        audio = bytearray()
        # Content-Length may be missing or incorrect. Do not use request.body(),
        # which would consume an unbounded upload before checking the limit.
        async for chunk in request.stream():
            if len(audio) + len(chunk) > MAX_AUDIO_BYTES:
                raise voice.VoiceError("audio_too_large")
            audio.extend(chunk)
        if not audio:
            raise voice.VoiceError("empty_audio")

        text = await voice.transcribe_audio(bytes(audio), mime)
        return JSONResponse({"text": text})
    except ClientDisconnect:
        error = voice.VoiceError("invalid_audio")
        return JSONResponse({"error": str(error), "code": error.code}, status_code=error.status_code)
    except voice.VoiceError as error:
        return JSONResponse({"error": str(error), "code": error.code}, status_code=error.status_code)
