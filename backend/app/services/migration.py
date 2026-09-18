"""One-time, lazy move from the embedded schema to per-entity collections.

Schema 1 kept events, notebooks, notes and the PDF's chunks as arrays inside the user
document, which grows without bound (MongoDB caps documents at 16 MB). Schema 2 stores
each item in its own collection, keyed by user_id.

The first authenticated request of a schema-1 user copies their arrays across. It is
idempotent (items keep their ids as _id, duplicates are skipped) and non-destructive:
the old arrays are left in place, so a deployment still running schema-1 code keeps
working until it is updated. They are ignored by this code.
"""

from pymongo.errors import BulkWriteError

from app.db.client import get_collection

SCHEMA_VERSION = 2
LEGACY_FIELDS = ("events", "notebooks", "notes")


async def _copy(collection_name: str, user_id: str, items: list[dict]) -> None:
    docs = [{**item, "_id": item["id"], "user_id": user_id} for item in items if item.get("id")]
    if not docs:
        return
    try:
        await get_collection(collection_name).insert_many(docs, ordered=False)
    except BulkWriteError as exc:          # already copied by an earlier attempt → fine
        if any(err.get("code") != 11000 for err in exc.details.get("writeErrors", [])):
            raise


async def ensure_migrated(user: dict) -> dict:
    if user.get("schema", 1) >= SCHEMA_VERSION:
        return user
    uid = user["_id"]
    for field in LEGACY_FIELDS:
        await _copy(field, uid, user.get(field) or [])

    document = user.get("document") or {}
    chunks = document.get("chunks") if isinstance(document.get("chunks"), list) else []
    chunks = [c for c in chunks if isinstance(c, str) and c.strip() and c != "Nothing here yet"]
    if chunks and not await get_collection("chunks").count_documents({"user_id": uid}, limit=1):
        await get_collection("chunks").insert_many(
            [{"user_id": uid, "index": i, "text": text} for i, text in enumerate(chunks)]
        )

    new_document = {"name": document.get("name", "") if chunks else "", "chunk_count": len(chunks)}
    await get_collection("users").update_one(
        {"_id": uid}, {"$set": {"schema": SCHEMA_VERSION, "document": new_document}}
    )
    user["schema"] = SCHEMA_VERSION
    user["document"] = new_document
    return user
