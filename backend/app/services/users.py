from datetime import datetime, timezone
from secrets import token_hex
from app.db.client import get_collection
from app.core.config import settings

async def get_user_by_id(user_id: str):
    users = get_collection("users")
    return await users.find_one({"_id": user_id})

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
        "document": {"name": "", "chunks": []},
        "notebooks": [],
        "notes": [],
        "events": []
    }
    
    await users.insert_one(new_user)
    return new_user

async def add_message_to_user(user_id: str, role: str, content: str):
    users = get_collection("users")
    await users.update_one(
        {"_id": user_id},
        {"$push": {"messages": {"role": role, "content": content}}}
    )

async def sign_out_user(user_id: str):
    users = get_collection("users")
    await users.update_one(
        {"_id": user_id},
        {"$set": {"jwt_secret": token_hex(32)}}
    )
