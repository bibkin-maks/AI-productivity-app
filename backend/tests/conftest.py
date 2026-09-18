"""Test harness: in-memory MongoDB, stubbed OpenAI/Google, real FastAPI app.

Environment is set before the app is imported so tests never read real credentials
(python-dotenv does not override variables that are already set).
"""

import os

os.environ.update({
    "SECRET_KEY": "test-secret",
    "OPENAI_API_KEY": "test-openai-key",
    "GOOGLE_CLIENT_ID": "test-google-client",
    "MONGODB_URI_FIRST": "mongodb://unused:",
    "MONGODB_URI_PASS": "unused",
    "MONGODB_URI_LAST": "@localhost:1/",
})

import hashlib  # noqa: E402
import re  # noqa: E402
from secrets import token_hex  # noqa: E402
from types import SimpleNamespace  # noqa: E402

import httpx  # noqa: E402
import mongomock.collection  # noqa: E402
import pytest  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

from app.core.limiter import limiter  # noqa: E402
from app.core.security import create_jwt  # noqa: E402
from app.db.client import db  # noqa: E402
from app.main import app  # noqa: E402
from app.services import ai  # noqa: E402

# Newer pymongo passes `sort=` to bulk update builders; mongomock doesn't accept it yet.
_add_update = mongomock.collection.BulkOperationBuilder.add_update
mongomock.collection.BulkOperationBuilder.add_update = (
    lambda self, *args, sort=None, **kwargs: _add_update(self, *args, **kwargs)
)

DIM = 64


def fake_embedding(text: str) -> list[float]:
    """Deterministic bag-of-words vector: texts sharing words point the same way."""
    vec = [0.0] * DIM
    for word in re.findall(r"[a-z0-9]+", text.lower()):
        vec[int(hashlib.md5(word.encode()).hexdigest(), 16) % DIM] += 1.0
    return vec


class FakeOpenAI:
    """Just enough of the OpenAI client for embeddings and chat completions."""

    def __init__(self):
        self.embedded: list[str] = []
        self.chats: list[list[dict]] = []
        self.embeddings = SimpleNamespace(create=self._embed)
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._chat))

    def _embed(self, model, input):
        self.embedded.extend(input)
        return SimpleNamespace(data=[SimpleNamespace(embedding=fake_embedding(t)) for t in input])

    def _chat(self, model, messages, **_):
        self.chats.append(messages)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="Purr's answer."))])


@pytest.fixture
async def mongo():
    client = AsyncMongoMockClient()
    db.client = client
    db.db = client["test"]
    await db.create_indexes()
    yield db.db
    db.client = db.db = None


@pytest.fixture
def openai_fake(monkeypatch):
    fake = FakeOpenAI()
    monkeypatch.setattr(ai, "client", fake)

    async def no_orb(text, client):
        return {"preset": "calm"}

    monkeypatch.setattr(ai, "animation_for", no_orb)
    return fake


@pytest.fixture
async def api(mongo, openai_fake):
    limiter.enabled = False
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    limiter.enabled = True


@pytest.fixture
def make_user(mongo):
    """Insert a user and return (user, auth headers)."""
    async def _make(uid="user-1", **fields):
        user = {
            "_id": uid, "email": f"{uid}@example.com", "name": uid.title(), "picture": None,
            "jwt_secret": token_hex(16), "messages": [], "document": {"name": "", "chunk_count": 0},
            "schema": 2, **fields,
        }
        await mongo["users"].insert_one(user)
        return user, {"Authorization": f"Bearer {create_jwt(user)}"}
    return _make
