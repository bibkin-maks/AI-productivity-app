"""Reaction animation spec for the Purr Assist ASCII orb.

After each answer we ask the model for a tiny JSON description of how the orb should
react (preset + glow/waves/speed/…). The orb never moves; these values drive which
characters it draws. If the model call fails or is slow we fall back to a spec derived
from the answer text, so the orb always reacts.
"""

import asyncio
import hashlib
import json
import re

from app.core.config import settings

PRESETS = ["calm", "pulse", "ripple", "swirl", "burst", "scan", "bloom"]
MAX_DURATION_MS = 1000
MIN_DURATION_MS = 350
_TIMEOUT_SECONDS = 3.0

_SCHEMA = {
    "name": "orb_animation",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["preset", "mood", "glow", "waves", "speed", "twist", "density", "hue", "duration_ms"],
        "properties": {
            "preset": {"type": "string", "enum": PRESETS, "description": "Overall shape of the reaction"},
            "mood": {"type": "string", "description": "One or two words describing the answer's tone, lowercase"},
            "glow": {"type": "number", "description": "0 = flat, 1 = strong bloom"},
            "waves": {"type": "integer", "description": "Concentric rings, 0-6"},
            "speed": {"type": "number", "description": "0.4 slow … 2.5 frantic"},
            "twist": {"type": "number", "description": "0 = still, 1 = fast character spin"},
            "density": {"type": "number", "description": "0 = sparse characters, 1 = dense"},
            "hue": {"type": "integer", "description": "Base hue 0-360; warm (20-40) calm, 320 playful, 190 factual"},
            "duration_ms": {"type": "integer", "description": f"{MIN_DURATION_MS}-{MAX_DURATION_MS}"},
        },
    },
}

_INSTRUCTIONS = (
    "You choreograph a small ASCII orb that reacts to an assistant's answer. "
    "Pick values that match the answer's tone and length: short confident answers are calm and slow, "
    "lists or step-by-step answers scan, surprising or bad news bursts, warm chatty answers bloom, "
    "uncertainty ripples. Keep it subtle; this plays for under a second."
)


def _clamp(value, low, high, default):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number != number:  # NaN
        return default
    return max(low, min(high, number))


def normalise(raw: dict) -> dict:
    """Clamp whatever we got into something the frontend can trust."""
    preset = raw.get("preset") if isinstance(raw, dict) else None
    mood = raw.get("mood") if isinstance(raw, dict) else None
    return {
        "preset": preset if preset in PRESETS else "pulse",
        "mood": (str(mood)[:24].strip().lower() or "calm") if mood else "calm",
        "glow": round(_clamp(raw.get("glow"), 0.0, 1.0, 0.5), 3),
        "waves": int(_clamp(raw.get("waves"), 0, 6, 2)),
        "speed": round(_clamp(raw.get("speed"), 0.3, 2.5, 1.0), 3),
        "twist": round(_clamp(raw.get("twist"), 0.0, 1.0, 0.4), 3),
        "density": round(_clamp(raw.get("density"), 0.0, 1.0, 0.5), 3),
        "hue": int(_clamp(raw.get("hue"), 0, 360, 28)),
        "duration_ms": int(_clamp(raw.get("duration_ms"), MIN_DURATION_MS, MAX_DURATION_MS, 900)),
    }


def derive_local(text: str) -> dict:
    """Deterministic spec from the answer itself — used when the model call can't be made."""
    body = (text or "").strip()
    digest = hashlib.sha1(body.encode("utf-8", "ignore")).digest()
    lowered = body.lower()

    if re.search(r"^\s*([-*]|\d+[.)])\s", body, re.MULTILINE):
        preset, mood = "scan", "listing"
    elif "```" in body or "http" in lowered:
        preset, mood = "swirl", "technical"
    elif body.endswith("?"):
        preset, mood = "ripple", "curious"
    elif any(word in lowered for word in ("sorry", "can't", "cannot", "error", "unable", "no results")):
        preset, mood = "burst", "apologetic"
    elif len(body) > 600:
        preset, mood = "bloom", "detailed"
    elif "!" in body:
        preset, mood = "pulse", "upbeat"
    else:
        preset, mood = "calm", "steady"

    return normalise({
        "preset": preset,
        "mood": mood,
        "glow": 0.35 + (digest[0] / 255) * 0.5,
        "waves": 1 + digest[1] % 4,
        "speed": 0.7 + (digest[2] / 255) * 1.0,
        "twist": 0.2 + (digest[3] / 255) * 0.6,
        "density": 0.35 + (digest[4] / 255) * 0.5,
        "hue": 15 + digest[5] % 40 if preset != "swirl" else 190 + digest[5] % 40,
        "duration_ms": 600 + digest[6] % 400,
    })


async def animation_for(text: str, client) -> dict:
    """Ask the model for a reaction spec; fall back to the local one on any problem."""
    fallback = derive_local(text)
    if not client or not settings.OPENAI_API_KEY:
        return fallback

    excerpt = (text or "")[:1200]
    loop = asyncio.get_event_loop()

    def call():
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=120,
            temperature=0.8,
            response_format={"type": "json_schema", "json_schema": _SCHEMA},
            messages=[
                {"role": "system", "content": _INSTRUCTIONS},
                {"role": "user", "content": f"Assistant answer:\n{excerpt}"},
            ],
        )
        return json.loads(completion.choices[0].message.content)

    try:
        raw = await asyncio.wait_for(loop.run_in_executor(None, call), timeout=_TIMEOUT_SECONDS)
        spec = normalise(raw)
        spec["source"] = "model"
        return spec
    except Exception:
        fallback["source"] = "local"
        return fallback
