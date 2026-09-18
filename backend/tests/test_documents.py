import numpy as np

from app.routers import docs as docs_router
from app.services import retrieval
from app.services.users import MAX_MESSAGES, add_messages_to_user

CHUNKS = [
    "Quarterly revenue grew twelve percent on subscription sales.",
    "The Kalman filter estimates state from noisy sensor measurements.",
    "Office plants need watering every Tuesday and Friday.",
]


async def upload(api, headers, monkeypatch, chunks=CHUNKS):
    monkeypatch.setattr(docs_router, "process_pdf_bytes", lambda data: list(chunks))
    files = {"file": ("report.pdf", b"%PDF-1.7 fake", "application/pdf")}
    return await api.post("/upload/", files=files, headers=headers)


def test_rank_orders_by_cosine_similarity():
    chunks = [[1, 0, 0], [0.9, 0.1, 0], [0, 1, 0]]
    assert retrieval.rank([1, 0, 0], chunks, k=2) == [0, 1]
    assert retrieval.rank([0, 1, 0], chunks, k=1) == [2]
    assert retrieval.rank([1, 0, 0], [], k=3) == []


async def test_upload_embeds_chunks_once(api, make_user, monkeypatch, openai_fake, mongo):
    user, headers = await make_user()
    response = await upload(api, headers, monkeypatch)
    assert response.status_code == 200 and response.json()["chunks"] == 3

    stored = await mongo["chunks"].find({"user_id": user["_id"]}).to_list(None)
    assert len(stored) == 3 and all(len(c["embedding"]) > 0 for c in stored)
    assert (await api.get("/me", headers=headers)).json()["document"] == {"name": "report.pdf"}

    # asking a question embeds only the question, not the document again
    openai_fake.embedded.clear()
    await api.post("/query/", json={"question": "What does the Kalman filter do?"}, headers=headers)
    assert openai_fake.embedded == ["What does the Kalman filter do?"]


async def test_query_sends_the_most_relevant_excerpt(api, make_user, monkeypatch, openai_fake):
    _, headers = await make_user()
    await upload(api, headers, monkeypatch)
    body = (await api.post("/query/", json={"question": "How does the Kalman filter handle noisy measurements?"}, headers=headers)).json()

    assert body["answer"] == "Purr's answer." and body["document_used"] == "report.pdf"
    prompt = openai_fake.chats[-1][-1]["content"]
    first_excerpt = prompt.split("Excerpts from the document:\n", 1)[1].split("\n\n")[0]
    assert "Kalman" in first_excerpt


async def test_query_without_a_document_skips_retrieval(api, make_user, openai_fake):
    _, headers = await make_user()
    body = (await api.post("/query/", json={"question": "hello"}, headers=headers)).json()
    assert body["matched_chunks"] == 0 and body["document_used"] is None
    assert openai_fake.embedded == []


async def test_questions_and_answers_are_saved(api, make_user):
    _, headers = await make_user()
    await api.post("/query/", json={"question": "Remember this"}, headers=headers)
    messages = (await api.get("/me", headers=headers)).json()["messages"]
    assert messages[-2:] == [{"role": "user", "content": "Remember this"}, {"role": "AI", "content": "Purr's answer."}]


async def test_chat_history_is_capped(api, make_user, mongo):
    user, _ = await make_user()
    for i in range(MAX_MESSAGES + 30):
        await add_messages_to_user(user["_id"], {"role": "user", "content": str(i)})
    stored = (await mongo["users"].find_one({"_id": user["_id"]}))["messages"]
    assert len(stored) == MAX_MESSAGES and stored[-1]["content"] == str(MAX_MESSAGES + 29)


async def test_remove_document(api, make_user, monkeypatch, mongo):
    user, headers = await make_user()
    await upload(api, headers, monkeypatch)
    assert (await api.post("/removefile/", headers=headers)).status_code == 200
    assert await mongo["chunks"].count_documents({"user_id": user["_id"]}) == 0
    assert (await api.get("/me", headers=headers)).json()["document"] == {"name": ""}


async def test_upload_rejects_non_pdfs(api, make_user):
    _, headers = await make_user()
    wrong_ext = {"file": ("notes.txt", b"hello", "text/plain")}
    fake_pdf = {"file": ("fake.pdf", b"not really a pdf", "application/pdf")}
    assert (await api.post("/upload/", files=wrong_ext, headers=headers)).status_code == 400
    assert (await api.post("/upload/", files=fake_pdf, headers=headers)).status_code == 400


def test_fake_embedding_is_deterministic():
    from tests.conftest import fake_embedding
    assert np.allclose(fake_embedding("kalman filter"), fake_embedding("Kalman  FILTER"))
