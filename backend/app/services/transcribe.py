"""Speech-to-text fallback.

The browser's Web Speech API streams audio to the browser vendor's own servers and
fails with a bare "network" error in Edge and in Chromium builds without Google's
speech service. When that happens the frontend records a clip and posts it here.

Uses OpenAI Whisper (the app already has an OpenAI key). If `faster-whisper` is
installed the local model is used instead — no audio leaves the machine.
Set WHISPER_LOCAL_MODEL (e.g. "base.en") to enable it.
"""

import asyncio
import io
import os

MAX_AUDIO_BYTES = 12 * 1024 * 1024  # ~10 minutes of opus; the UI records far less
LOCAL_MODEL = os.getenv("WHISPER_LOCAL_MODEL")

_local_model = None
_lock = asyncio.Lock()


def _load_local():
    global _local_model
    if _local_model is None:
        from faster_whisper import WhisperModel  # optional dependency

        _local_model = WhisperModel(LOCAL_MODEL, device="cpu", compute_type="int8")
    return _local_model


def _transcribe_local(data: bytes, language: str | None) -> str:
    model = _load_local()
    segments, _info = model.transcribe(io.BytesIO(data), language=language, vad_filter=True)
    return " ".join(segment.text.strip() for segment in segments).strip()


def _transcribe_openai(client, data: bytes, filename: str, language: str | None) -> str:
    audio = io.BytesIO(data)
    audio.name = filename or "speech.webm"
    result = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio,
        language=language,
        temperature=0,
    )
    return (result.text or "").strip()


async def transcribe(data: bytes, filename: str, language: str | None, client) -> str:
    if not data:
        raise ValueError("Empty recording")
    if len(data) > MAX_AUDIO_BYTES:
        raise ValueError("Recording is too long")

    # "en-US" → "en"; Whisper wants a two-letter code (None = auto-detect)
    lang = (language or "").split("-")[0].lower() or None

    loop = asyncio.get_event_loop()
    async with _lock:
        if LOCAL_MODEL:
            try:
                return await loop.run_in_executor(None, lambda: _transcribe_local(data, lang))
            except ImportError:
                pass  # faster-whisper not installed: fall through to the API
        if not client:
            raise RuntimeError("No transcription backend available")
        return await loop.run_in_executor(None, lambda: _transcribe_openai(client, data, filename, lang))
