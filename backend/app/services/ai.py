import asyncio

from openai import OpenAI

from app.core.config import settings
from app.services.context import build_history, system_prompt
from app.services.orb import animation_for
from app.services.retrieval import relevant_chunks
from app.services.users import add_messages_to_user

CHAT_MODEL = "gpt-4o-mini"
client = OpenAI(api_key=settings.OPENAI_API_KEY)


def _complete(messages):
    return client.chat.completions.create(model=CHAT_MODEL, messages=messages)


async def query_doc(user: dict, question: str):
    document_name = (user.get("document") or {}).get("name") or None

    # Top chunks of the uploaded document, if there is one (embedded once at upload)
    excerpts = await relevant_chunks(client, user["_id"], question) if document_name else []
    context = "\n\n".join(excerpts) or None

    # Who Purr is + a bounded slice of the conversation + this question
    user_prompt = (
        f"Question: {question}\n\nExcerpts from the document:\n{context}"
        if context
        else question
    )
    messages = [
        {"role": "system", "content": system_prompt(user, document_name, bool(context))},
        *build_history(user.get("messages")),
        {"role": "user", "content": user_prompt},
    ]

    # The OpenAI SDK is synchronous — keep it off the event loop
    response = await asyncio.get_running_loop().run_in_executor(None, _complete, messages)
    ai_text = response.choices[0].message.content

    # How the Purr Assist orb should react to this answer (never blocks the reply for long)
    orb = await animation_for(ai_text, client)

    await add_messages_to_user(user["_id"], {"role": "user", "content": question}, {"role": "AI", "content": ai_text})

    return {
        "answer": ai_text,
        "matched_chunks": len(excerpts),
        "document_used": document_name if context else None,
        "orb": orb,
    }
