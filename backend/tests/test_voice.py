"""Voice HTTP/SDK contract. All provider calls are replaced; no real audio leaves tests."""

import asyncio
from types import SimpleNamespace

import httpx
import openai
import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.main import app
from app.routers import voice as router
from app.services import voice


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setenv("AI_MODE", "auto")
    monkeypatch.setenv("OPENAI_API_KEY", " test-only-voice-key ")
    # Whisper availability must not depend on the constructor's model.
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    state = SimpleNamespace(
        options=[], calls=[], text="  Нужен бот для записи клиентов.  ",
        error=None, before_result=None, closed=0,
    )

    class FakeClient:
        def __init__(self, **kwargs):
            state.options.append(kwargs)
            self.audio = SimpleNamespace(transcriptions=SimpleNamespace(create=self.create))

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            state.closed += 1

        async def create(self, **kwargs):
            state.calls.append(kwargs)
            if state.before_result:
                await state.before_result()
            if state.error:
                raise state.error
            return SimpleNamespace(text=state.text)

    monkeypatch.setattr(voice.openai, "AsyncOpenAI", FakeClient)
    return state


def post_audio(body=b"sample-audio", mime="audio/webm", **headers):
    return TestClient(app).post(
        "/api/voice/transcribe", content=body,
        headers={"content-type": mime, **headers},
    )


def assert_error(response, status, code):
    assert response.status_code == status
    payload = response.json()
    assert set(payload) == {"error", "code"}
    assert payload["code"] == code
    assert isinstance(payload["error"], str) and payload["error"]


def stream_request(chunks, *, length=None):
    consumed = []
    headers = [(b"content-type", b"audio/webm")]
    if length is not None:
        headers.append((b"content-length", str(length).encode()))

    async def receive():
        index = len(consumed)
        assert index < len(chunks), "The route read beyond the provided body"
        consumed.append(index)
        return {"type": "http.request", "body": chunks[index], "more_body": index < len(chunks) - 1}

    scope = {"type": "http", "method": "POST", "path": "/api/voice/transcribe", "headers": headers}
    return Request(scope, receive), consumed


def test_success_uses_async_whisper_once_without_translation(provider):
    response = post_audio()
    assert response.status_code == 200
    assert response.json() == {"text": "Нужен бот для записи клиентов."}
    assert provider.options == [{"api_key": "test-only-voice-key", "timeout": 20, "max_retries": 0}]
    assert provider.calls == [{
        "model": "whisper-1", "file": ("recording.webm", b"sample-audio", "audio/webm"),
        "response_format": "json",
    }]
    assert provider.closed == 1


@pytest.mark.parametrize(("mime", "filename", "normalized"), [
    ("audio/webm;codecs=opus", "recording.webm", "audio/webm"),
    ("audio/mp4", "recording.mp4", "audio/mp4"),
    ("audio/wav", "recording.wav", "audio/wav"),
    ("audio/x-wav", "recording.wav", "audio/x-wav"),
    ("AUDIO/MPEG", "recording.mp3", "audio/mpeg"),
])
def test_supported_media_types_and_parameters(provider, mime, filename, normalized):
    assert post_audio(mime=mime).status_code == 200
    assert provider.calls[0]["file"] == (filename, b"sample-audio", normalized)


@pytest.mark.parametrize("mime", ["", "application/json", "multipart/form-data", "audio/ogg", "video/webm"])
def test_unsupported_type_never_calls_provider(provider, mime):
    assert_error(post_audio(mime=mime), 415, "unsupported_audio")
    assert provider.options == []


def test_empty_audio_never_calls_provider(provider):
    assert_error(post_audio(b""), 422, "empty_audio")
    assert provider.options == []


def test_oversized_content_length_rejected_before_reading(provider):
    assert router.MAX_AUDIO_BYTES == 5 * 1024 * 1024
    request, consumed = stream_request([b"unread"], length=router.MAX_AUDIO_BYTES + 1)
    response = asyncio.run(router.transcribe(request))
    assert response.status_code == 413
    assert consumed == []
    assert provider.options == []


@pytest.mark.parametrize("length", [None, 1])
def test_stream_limit_stops_early_even_without_or_with_false_length(provider, monkeypatch, length):
    monkeypatch.setattr(router, "MAX_AUDIO_BYTES", 8)
    request, consumed = stream_request([b"1234", b"5678", b"9", b"must-not-read"], length=length)
    response = asyncio.run(router.transcribe(request))
    assert response.status_code == 413
    assert b'"code":"audio_too_large"' in response.body
    assert consumed == [0, 1, 2]
    assert provider.options == []


def test_exact_size_limit_is_accepted(provider, monkeypatch):
    monkeypatch.setattr(router, "MAX_AUDIO_BYTES", 8)
    request, consumed = stream_request([b"1234", b"5678"])
    assert asyncio.run(router.transcribe(request)).status_code == 200
    assert consumed == [0, 1]
    assert provider.calls[0]["file"][1] == b"12345678"


@pytest.mark.parametrize("length", ["-1", "not-a-number"])
def test_invalid_content_length(provider, length):
    assert_error(post_audio(**{"content-length": length}), 422, "invalid_audio")
    assert provider.options == []


@pytest.mark.parametrize(("mode", "key"), [("stub", "key"), ("auto", None), ("auto", ""), ("auto", "   ")])
def test_unavailable_voice_has_no_stub(provider, monkeypatch, mode, key):
    monkeypatch.setenv("AI_MODE", mode)
    if key is None:
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    else:
        monkeypatch.setenv("OPENAI_API_KEY", key)
    assert_error(post_audio(), 503, "voice_unavailable")
    assert provider.options == []


@pytest.mark.parametrize(("text", "status", "code"), [
    (" \n\t", 422, "no_speech"), (None, 502, "transcription_failed"), (123, 502, "transcription_failed"),
])
def test_empty_or_malformed_transcription(provider, text, status, code):
    provider.text = text
    assert_error(post_audio(), status, code)
    assert len(provider.calls) == 1


@pytest.mark.parametrize(("error_type", "expected_status", "code"), [
    ("timeout", 504, "transcription_timeout"),
    ("connection", 502, "transcription_failed"),
    ("bad_audio", 422, "invalid_audio"),
    ("credentials", 503, "voice_unavailable"),
    ("unknown", 502, "transcription_failed"),
])
def test_provider_errors_do_not_leak_or_retry(provider, caplog, error_type, expected_status, code):
    private = "test-only-voice-key private@example.com spoken-private-text"
    request = httpx.Request("POST", "https://api.openai.com/v1/audio/transcriptions")
    errors = {
        "timeout": openai.APITimeoutError(request=request),
        "connection": openai.APIConnectionError(message=private, request=request),
        "bad_audio": openai.BadRequestError(private, response=httpx.Response(400, request=request), body={"error": private}),
        "credentials": openai.AuthenticationError(private, response=httpx.Response(401, request=request), body={"error": private}),
        "unknown": RuntimeError(private),
    }
    provider.error = errors[error_type]
    response = post_audio()
    assert_error(response, expected_status, code)
    assert len(provider.calls) == 1
    assert provider.closed == 1
    for token in private.split():
        assert token not in response.text
        assert token not in caplog.text


def test_transcription_yields_to_other_async_work(provider):
    async def check():
        started, finish = asyncio.Event(), asyncio.Event()

        async def pause():
            started.set()
            await finish.wait()

        provider.before_result = pause
        pending = asyncio.create_task(voice.transcribe_audio(b"audio", "audio/webm"))
        await asyncio.wait_for(started.wait(), timeout=1)
        assert not pending.done()
        finish.set()
        assert await pending == "Нужен бот для записи клиентов."

    asyncio.run(check())


def test_hard_deadline_cancels_slow_provider(provider, monkeypatch):
    monkeypatch.setattr(voice, "TRANSCRIPTION_TIMEOUT_SECONDS", 0.01)

    async def hang():
        await asyncio.Event().wait()

    provider.before_result = hang
    with pytest.raises(voice.VoiceError) as error:
        asyncio.run(voice.transcribe_audio(b"audio", "audio/webm"))
    assert error.value.code == "transcription_timeout"
    assert provider.closed == 1


def test_disconnected_upload_returns_safe_error(provider):
    async def receive():
        return {"type": "http.disconnect"}

    request = Request({"type": "http", "headers": [(b"content-type", b"audio/webm")]}, receive)
    response = asyncio.run(router.transcribe(request))
    assert response.status_code == 422
    assert b'"code":"invalid_audio"' in response.body
    assert provider.options == []
