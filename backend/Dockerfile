# syntax=docker/dockerfile:1

# ---- voices: download the Piper voice models once, cached as their own layer ----
FROM alpine:3.20 AS voices
ARG WITH_VOICES=true
ARG BASE=https://huggingface.co/rhasspy/piper-voices/resolve/main
WORKDIR /voices
RUN if [ "$WITH_VOICES" = "true" ]; then \
      apk add --no-cache curl && \
      for v in en/en_US/hfc_female/medium/en_US-hfc_female-medium \
               en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium \
               ru/ru_RU/irina/medium/ru_RU-irina-medium; do \
        curl -fsSL -O "$BASE/$v.onnx" && curl -fsSL -O "$BASE/$v.onnx.json" || exit 1; \
      done; \
    fi

# ---- app ----
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

ARG UID=10001
RUN adduser --disabled-password --gecos "" --home /nonexistent \
    --shell /sbin/nologin --no-create-home --uid "${UID}" appuser

# piper-tts is optional in requirements.txt; the image ships it so Purr Assist
# gets the local neural voice out of the box.
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=bind,source=requirements.txt,target=requirements.txt \
    pip install -r requirements.txt piper-tts

COPY --from=voices /voices ./voices
COPY . .

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "app.main:app", "--host=0.0.0.0", "--port=8000"]
