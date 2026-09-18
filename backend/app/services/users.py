from secrets import token_hex

from app.db.client import get_collection
from app.services.migration import LEGACY_FIELDS, SCHEMA_VERSION

MAX_MESSAGES = 200  # chat history kept per user; older turns are dropped


def public_user(user: dict) -> dict:
    """The user as the client may see it: no signing secret, no legacy arrays."""
    hidden = {"jwt_secret", *LEGACY_FIELDS}
    out = {k: v for k, v in user.items() if k not in hidden}
    document = out.get("document")
    if isinstance(document, dict):
        out["document"] = {"name": document.get("name", "")}
    return out


async def get_user_by_id(user_id: str):
    return await get_collection("users").find_one({"_id": user_id})


async def get_or_create_user(idinfo: dict):
    users = get_collection("users")
    uid = idinfo["sub"]

    existing = await users.find_one({"_id": uid})
    if existing:
        return existing

    new_user = {
        "_id": uid,
        "email": idinfo["email"],
        "name": idinfo.get("name"),
        "picture": idinfo.get("picture"),
        "messages": [
            {"role": "AI", "content": f"Hello {idinfo.get('name')}! How can I assist you?"}
        ],
        "jwt_secret": token_hex(32),
        "document": {"name": "", "chunk_count": 0},
        "schema": SCHEMA_VERSION,
    }

    await users.insert_one(new_user)
    return new_user


async def add_messages_to_user(user_id: str, *messages: dict):
    """Append chat turns, keeping only the most recent MAX_MESSAGES."""
    await get_collection("users").update_one(
        {"_id": user_id},
        {"$push": {"messages": {"$each": list(messages), "$slice": -MAX_MESSAGES}}}
    )


async def sign_out_user(user_id: str):
    """Rotating the per-user secret invalidates every token issued so far."""
    await get_collection("users").update_one(
        {"_id": user_id},
        {"$set": {"jwt_secret": token_hex(32)}}
    )
