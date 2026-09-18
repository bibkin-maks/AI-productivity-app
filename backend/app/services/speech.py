"""Local neural text-to-speech with Piper (github.com/rhasspy/piper, MIT).

Runs on CPU, no API cost, and sounds far warmer than the browser's built-in voice.
Voice models (.onnx + .onnx.json) live in backend/voices/ and are not committed —
see backend/voices/README.md for the download commands.

If piper or the model is missing, the API says so and the frontend falls back to the
browser's own speech synthesis.
"""

import asyncio
import io
import os
import re
import wave
from pathlib import Path

VOICES_DIR = Path(__file__).resolve().parents[2] / "voices"
DEFAULT_VOICE = os.getenv("PIPER_VOICE", "en_US-hfc_female-medium")
MAX_CHARS = 1200  # keep responses snappy; the UI only reads answers aloud

_voices = {}
_lock = asyncio.Lock()


def available_voices():
    if not VOICES_DIR.is_dir():
        return []
    return sorted(p.stem for p in VOICES_DIR.glob("*.onnx"))


def speakable(text: str) -> str:
    """Strip markdown and URLs so the reader doesn't say 'asterisk' or spell out links."""
    text = re.sub(r"```[\s\S]*?```", " (code) ", text or "")
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"https?://\S+", "a link", text)
    text = re.sub(r"[*_#>|]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_CHARS]


def _load(name: str):
    """Load (and cache) a Piper voice. Raises FileNotFoundError / ImportError if unavailable."""
    if name in _voices:
        return _voices[name]
    model = VOICES_DIR / f"{name}.onnx"
    if not model.exists():
        raise FileNotFoundError(f"Voice '{name}' is not installed")
    from piper import PiperVoice  # imported lazily: optional dependency

    voice = PiperVoice.load(str(model), config_path=str(model.with_suffix(".onnx.json")))
    _voices[name] = voice
    return voice


def _synthesize_sync(text: str, name: str) -> bytes:
    voice = _load(name)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        if hasattr(voice, "synthesize_wav"):
            voice.synthesize_wav(text, wav_file)
        else:  # older piper-tts
            voice.synthesize(text, wav_file)
    return buffer.getvalue()


async def synthesize(text: str, voice: str | None = None) -> bytes:
    """WAV bytes for `text`. Serialised: one ONNX session, one request at a time."""
    clean = speakable(text)
    if not clean:
        raise ValueError("Nothing to read out")
    name = voice or DEFAULT_VOICE
    async with _lock:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: _synthesize_sync(clean, name))
