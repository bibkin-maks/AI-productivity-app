from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from openai import OpenAI
from app.core.config import settings
from app.services.users import add_message_to_user
from app.services.orb import animation_for
from app.services.context import build_history, system_prompt
import asyncio

# Global instances
embeddings = OpenAIEmbeddings(model="text-embedding-3-large", openai_api_key=settings.OPENAI_API_KEY)
client = OpenAI(api_key=settings.OPENAI_API_KEY)

def is_document_empty(doc):
    """Return True if document struct has no real content."""
    if not doc:
        return True
    name = doc.get("name", "")
    chunks = doc.get("chunks", "")
    if not name or name == "empty file":
        return True
    if isinstance(chunks, list) and (len(chunks) == 0 or (chunks and chunks[0] == "Nothing here yet")):
        return True
    if isinstance(chunks, str) and chunks.strip() == "":
        return True
    return False

async def query_doc(user: dict, question: str):
    doc = user.get("document")

    context = None
    matched_chunks = 0
    document_used = None

    # If PDF exists AND has chunks → use them
    if not is_document_empty(doc) and doc.get("chunks"):
        chunks = doc["chunks"]

        if len(chunks) > 0:
            loop = asyncio.get_event_loop()
            # FAISS.from_texts is CPU-bound/sync — run in thread pool to avoid
            # blocking the event loop while the vector index is being built
            vector_store = await loop.run_in_executor(
                None, lambda: FAISS.from_texts(chunks, embedding=embeddings)
            )
            docs = await loop.run_in_executor(
                None, lambda: vector_store.similarity_search(question, k=3)
            )

            context = "\n".join(d.page_content for d in docs)
            matched_chunks = len(docs)
            document_used = doc["name"]

    # Build messages: who Purr is + a bounded slice of the conversation + this question
    user_prompt = (
        f"Question: {question}\n\nExcerpts from the document:\n{context}"
        if context
        else question
    )
    messages = [
        {"role": "system", "content": system_prompt(user, (doc or {}).get("name"), bool(context))},
        *build_history(user.get("messages")),
        {"role": "user", "content": user_prompt},
    ]

    # OpenAI SDK is also synchronous — offload to thread pool
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages
        )
    )

    ai_text = response.choices[0].message.content

    # How the Purr Assist orb should react to this answer (never blocks the reply for long)
    orb = await animation_for(ai_text, client)

    # Save messages to history
    await add_message_to_user(user["_id"], "user", question)
    await add_message_to_user(user["_id"], "AI", ai_text)

    return {
        "answer": ai_text,
        "matched_chunks": matched_chunks,
        "document_used": document_used,
        "orb": orb
    }
