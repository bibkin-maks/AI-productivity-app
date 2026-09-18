# Backend — FastAPI

API for ChatDoc / Purr Assist: Google sign-in, chat with an uploaded PDF, notebooks and notes,
a calendar, and a voice assistant. Data lives in MongoDB; answers come from OpenAI.

## Run

With Docker, from the repo root: `docker compose up --build` (see the root README).

Without Docker:

```bash
cd backend
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                           # fill in the keys
python run_app.py                              # http://localhost:8000
```

## Layout

```
app/
  main.py          app, CORS, rate limiting, /health
  core/            settings (.env), JWT + Google token checks, rate limiter
  db/client.py     MongoDB (Motor, async) and indexes
  dependencies.py  get_current_user — verifies the bearer JWT
  models/          Pydantic request bodies
  routers/         auth, docs, notebooks, events, speech
  services/        AI answers, chat memory, PDF parsing, orb reactions, TTS, speech-to-text
```

## API

| Area | Endpoints |
| --- | --- |
| Auth | `POST /userauth/` (Google ID token → JWT), `POST /signout/`, `GET /me`, `DELETE /messages/clear` |
| Documents | `POST /upload/` (PDF, 20 MB / 100 pages max), `POST /removefile/`, `POST /query/` |
| Notes | `GET/POST /notebooks`, `PUT/DELETE /notebooks/{id}`, `GET/POST /notebooks/{id}/notes`, `PUT /notebooks/{id}/reorder`, `GET /notes`, `GET/PUT/DELETE /notes/{id}` |
| Calendar | `GET/POST /events`, `PUT/DELETE /events/{id}`, `PUT/DELETE /events/series/{id}`, `DELETE /events/all` |
| Voice | `GET /voices`, `POST /speak`, `POST /transcribe` |

Everything except `/userauth/` and `/health` needs `Authorization: Bearer <token>`.

## How it works

- **Sign-in** — the frontend sends Google's ID token; the backend verifies it, finds or creates the
  user, and returns a JWT signed with `SECRET_KEY` plus a per-user secret, so signing out
  invalidates every token for that user.
- **Documents** — PDFs are parsed in memory with `pypdf` and split into overlapping chunks, which are
  embedded once (`text-embedding-3-small`) and stored in the `chunks` collection. A question is embedded,
  ranked against the stored vectors (cosine similarity in numpy), and the top 3 passages go into the
  prompt for `gpt-4o-mini`, together with the last few chat turns.
- **Data** — `users` holds the profile, signing secret and a capped chat history (last 200 messages);
  `events`, `notebooks`, `notes` and `chunks` are separate collections keyed by `user_id`. Users on the
  old embedded layout are migrated on their first request (`app/services/migration.py`).
- **Voice** — `/speak` uses local [Piper](https://github.com/rhasspy/piper) voices
  (see [voices/README.md](voices/README.md)); `/transcribe` uses OpenAI Whisper, or a local
  `faster-whisper` model when `WHISPER_LOCAL_MODEL` is set.
- **Rate limits** — uploads 5/min, questions 30/min, speech 60/min, transcription 30/min per client.

## Tests

```bash
pip install -r requirements-dev.txt
pytest            # in-memory MongoDB, OpenAI/Google stubbed — never touches real services
ruff check app tests
```
