"""Document retrieval: embed chunks once at upload, rank them per question.

Previously every question re-embedded the whole PDF into a throwaway FAISS index — one
embedding call per chunk, per question. Now chunks are embedded once and stored in the
`chunks` collection; a question costs a single embedding call plus a cosine-similarity
ranking in numpy (a few hundred vectors per document, so no vector database is needed).
"""

import asyncio

import numpy as np

from app.db.client import get_collection

EMBEDDING_MODEL = "text-embedding-3-small"
TOP_K = 3
_BATCH = 96  # inputs per embeddings request


def _embed_sync(client, texts: list[str]) -> list[list[float]]:
    vectors = []
    for i in range(0, len(texts), _BATCH):
        response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts[i:i + _BATCH])
        vectors.extend(item.embedding for item in response.data)
    return vectors


async def embed_texts(client, texts: list[str]) -> list[list[float]]:
    """The OpenAI SDK is synchronous — run it off the event loop."""
    if not texts:
        return []
    return await asyncio.get_running_loop().run_in_executor(None, _embed_sync, client, texts)


async def store_document(client, user_id: str, name: str, chunks: list[str]) -> int:
    """Replace the user's document with freshly embedded chunks. Returns the chunk count."""
    vectors = await embed_texts(client, chunks)
    collection = get_collection("chunks")
    await collection.delete_many({"user_id": user_id})
    if chunks:
        await collection.insert_many([
            {"user_id": user_id, "index": i, "text": text, "embedding": vector}
            for i, (text, vector) in enumerate(zip(chunks, vectors))
        ])
    await get_collection("users").update_one(
        {"_id": user_id}, {"$set": {"document": {"name": name, "chunk_count": len(chunks)}}}
    )
    return len(chunks)


async def remove_document(user_id: str) -> None:
    await get_collection("chunks").delete_many({"user_id": user_id})
    await get_collection("users").update_one({"_id": user_id}, {"$set": {"document": {"name": "", "chunk_count": 0}}})


def rank(question_vector, chunk_vectors, k: int = TOP_K) -> list[int]:
    """Indices of the k chunks most similar (cosine) to the question, best first."""
    if len(chunk_vectors) == 0:
        return []
    matrix = np.asarray(chunk_vectors, dtype=np.float32)
    q = np.asarray(question_vector, dtype=np.float32)
    scores = matrix @ q / (np.linalg.norm(matrix, axis=1) * np.linalg.norm(q) + 1e-10)
    return [int(i) for i in np.argsort(-scores)[:k]]


async def relevant_chunks(client, user_id: str, question: str, k: int = TOP_K) -> list[str]:
    collection = get_collection("chunks")
    docs = await collection.find({"user_id": user_id}, {"_id": 1, "text": 1, "embedding": 1}).sort("index", 1).to_list(None)
    if not docs:
        return []

    # chunks migrated from the old schema have no vectors yet: embed them once, now
    missing = [d for d in docs if not d.get("embedding")]
    if missing:
        vectors = await embed_texts(client, [d["text"] for d in missing])
        for doc, vector in zip(missing, vectors):
            doc["embedding"] = vector
            await collection.update_one({"_id": doc["_id"]}, {"$set": {"embedding": vector}})

    [question_vector] = await embed_texts(client, [question])
    order = rank(question_vector, [d["embedding"] for d in docs], k)
    return [docs[i]["text"] for i in order]
