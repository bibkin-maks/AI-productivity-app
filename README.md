# AI Doc Parser

Monorepo for the PDF AI Reader.

## Run with Docker

```bash
cp backend/.env.example backend/.env   # first time only — fill in the keys
cp frontend/.env.example frontend/.env # optional — public defaults are used if missing
docker compose up --build
```

Open http://localhost:5173 (API on http://localhost:8000). Stop with `Ctrl+C` or `docker compose down`.

The backend image includes the Piper voices for Purr Assist (~180 MB, downloaded on the first build).
To skip them, run `WITH_VOICES=false docker compose up --build`; the app then uses the browser's voice.

## Run without Docker

| Folder | Stack | Run locally |
| --- | --- | --- |
| [`backend/`](backend) | FastAPI, MongoDB, FAISS | `cd backend && pip install -r requirements.txt && python run_app.py` |
| [`frontend/`](frontend) | React, Vite, Tailwind, RTK Query | `cd frontend && npm install && npm run dev` |

See each folder's README for details.
