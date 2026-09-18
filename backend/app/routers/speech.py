from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)

from app.core.limiter import limiter
from app.dependencies import get_current_user
from app.models.chat import SpeakRequest
from app.services.ai import client as openai_client
from app.services.speech import DEFAULT_VOICE, available_voices, synthesize
from app.services.transcribe import transcribe

router = APIRouter()


@router.get("/voices")
async def list_voices(current_user: dict = Depends(get_current_user)):
    """Which local Piper voices are installed (empty list → the client uses the browser voice)."""
    return {"voices": available_voices(), "default": DEFAULT_VOICE}


@router.post("/speak")
@limiter.limit("60/minute")
async def speak(request: Request, body: SpeakRequest, current_user: dict = Depends(get_current_user)):
    """Read text aloud with a local neural voice and return a WAV."""
    try:
        audio = await synthesize(body.text, body.voice)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except (FileNotFoundError, ImportError) as exc:
        # no model or piper isn't installed — the client falls back to the browser voice
        raise HTTPException(503, str(exc))
    except Exception as exc:  # noqa: BLE001 - surface synthesis failures as a clean 500
        raise HTTPException(500, f"Speech synthesis failed: {exc}")

    return Response(content=audio, media_type="audio/wav", headers={"Cache-Control": "no-store"})


@router.post("/transcribe")
@limiter.limit("30/minute")
async def transcribe_audio(
    request: Request,
    audio: UploadFile = File(...),
    language: str | None = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """Transcribe a recorded clip — the fallback when the browser's own speech API fails."""
    data = await audio.read()
    try:
        text = await transcribe(data, audio.filename or "speech.webm", language, openai_client)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"Transcription failed: {exc}")
    return {"text": text}
