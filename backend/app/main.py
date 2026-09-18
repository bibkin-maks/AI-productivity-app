from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.db.client import db
from app.routers import auth, docs, notebooks, events, speech
from app.core.config import settings
from app.core.limiter import limiter

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    db.connect()
    await db.create_indexes()
    yield
    # Shutdown
    db.close()

app = FastAPI(lifespan=lifespan)

# Attach limiter to app state so decorators can use it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(docs.router)
app.include_router(notebooks.router)
app.include_router(events.router)
app.include_router(speech.router)

@app.get("/health")
async def health_check():
    if db.client:
        try:
            await db.client.admin.command('ping')
            return {"status": "healthy", "database": "connected"}
        except Exception as e:
            return {"status": "unhealthy", "database": f"error: {str(e)}"}
    return {"status": "unhealthy", "database": "disconnected"}
