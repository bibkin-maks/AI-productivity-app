"""Schema 1 (everything embedded in the user document) → schema 2 (collections)."""

from app.services.migration import ensure_migrated

LEGACY = {
    "schema": None,
    "events": [
        {"id": "e1", "title": "Gym", "start": "2026-09-18T07:00:00Z", "end": "2026-09-18T08:00:00Z"},
        {"id": "e2", "title": "Review", "start": "2026-09-18T09:00:00Z", "end": "2026-09-18T10:00:00Z"},
    ],
    "notebooks": [{"id": "nb1", "name": "Work", "created_at": "2026-01-01"}],
    "notes": [{"id": "n1", "notebook_id": "nb1", "title": "Plan", "content": "", "order": 0, "updated_at": "2026-01-02"}],
    "document": {"name": "old.pdf", "chunks": ["alpha text", "beta text"]},
}


async def legacy_user(make_user):
    fields = {k: v for k, v in LEGACY.items() if k != "schema"}
    user, headers = await make_user("legacy", **fields)
    return user, headers


async def test_first_request_moves_embedded_data_into_collections(api, make_user, mongo):
    await mongo["users"].update_one({"_id": "nobody"}, {"$set": {}})  # no-op, keeps mongo warm
    user, headers = await legacy_user(make_user)
    await mongo["users"].update_one({"_id": "legacy"}, {"$unset": {"schema": ""}})

    assert [e["title"] for e in (await api.get("/events", headers=headers)).json()] == ["Gym", "Review"]
    assert [n["name"] for n in (await api.get("/notebooks", headers=headers)).json()] == ["Work"]
    assert [n["title"] for n in (await api.get("/notebooks/nb1/notes", headers=headers)).json()] == ["Plan"]
    assert await mongo["chunks"].count_documents({"user_id": "legacy"}) == 2

    stored = await mongo["users"].find_one({"_id": "legacy"})
    assert stored["schema"] == 2
    assert stored["document"] == {"name": "old.pdf", "chunk_count": 2}
    assert len(stored["events"]) == 2          # originals kept for deployments still on schema 1


async def test_me_hides_legacy_arrays(api, make_user, mongo):
    _, headers = await legacy_user(make_user)
    await mongo["users"].update_one({"_id": "legacy"}, {"$unset": {"schema": ""}})
    body = (await api.get("/me", headers=headers)).json()
    assert not {"events", "notes", "notebooks", "jwt_secret"} & body.keys()
    assert body["document"] == {"name": "old.pdf"}


async def test_migration_is_idempotent(make_user, mongo):
    user, _ = await legacy_user(make_user)
    user.pop("schema", None)
    await ensure_migrated(dict(user))
    await ensure_migrated(dict(user))            # stale copy still says schema 1 → runs again
    assert await mongo["events"].count_documents({"user_id": "legacy"}) == 2
    assert await mongo["chunks"].count_documents({"user_id": "legacy"}) == 2


async def test_migrated_chunks_are_embedded_on_first_question(api, make_user, mongo, openai_fake):
    _, headers = await legacy_user(make_user)
    await mongo["users"].update_one({"_id": "legacy"}, {"$unset": {"schema": ""}})
    await api.post("/query/", json={"question": "what about beta?"}, headers=headers)
    chunks = await mongo["chunks"].find({"user_id": "legacy"}).to_list(None)
    assert all(c.get("embedding") for c in chunks)
    assert set(openai_fake.embedded) == {"alpha text", "beta text", "what about beta?"}
