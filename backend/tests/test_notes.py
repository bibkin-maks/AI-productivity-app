async def make_notebook(api, headers, name="Work"):
    return (await api.post("/notebooks", json={"name": name}, headers=headers)).json()


async def make_note(api, headers, notebook_id, title):
    return (await api.post(f"/notebooks/{notebook_id}/notes", json={"title": title, "content": "<p>x</p>"}, headers=headers)).json()


async def test_notebook_and_note_lifecycle(api, make_user):
    _, headers = await make_user()
    nb = await make_notebook(api, headers)
    assert [n["name"] for n in (await api.get("/notebooks", headers=headers)).json()] == ["Work"]

    first = await make_note(api, headers, nb["id"], "First")
    second = await make_note(api, headers, nb["id"], "Second")
    assert (first["order"], second["order"]) == (0, 1)

    await api.put(f"/notes/{first['id']}", json={"title": "First, edited", "is_favorite": True}, headers=headers)
    note = (await api.get(f"/notes/{first['id']}", headers=headers)).json()
    assert note["title"] == "First, edited" and note["is_favorite"] is True
    assert note["content"] == "<p>x</p>"                                   # untouched fields stay

    # most recently edited first
    assert [n["id"] for n in (await api.get("/notes", headers=headers)).json()][0] == first["id"]

    await api.delete(f"/notes/{second['id']}", headers=headers)
    assert (await api.get(f"/notes/{second['id']}", headers=headers)).status_code == 404


async def test_reorder_notes(api, make_user):
    _, headers = await make_user()
    nb = await make_notebook(api, headers)
    a, b, c = [await make_note(api, headers, nb["id"], t) for t in "abc"]
    order = [{"id": c["id"], "order": 0}, {"id": a["id"], "order": 1}, {"id": b["id"], "order": 2}]
    assert (await api.put(f"/notebooks/{nb['id']}/reorder", json={"notes": order}, headers=headers)).status_code == 200
    titles = [n["title"] for n in (await api.get(f"/notebooks/{nb['id']}/notes", headers=headers)).json()]
    assert titles == ["c", "a", "b"]


async def test_deleting_a_notebook_deletes_its_notes(api, make_user):
    _, headers = await make_user()
    work, ideas = await make_notebook(api, headers, "Work"), await make_notebook(api, headers, "Ideas")
    await make_note(api, headers, work["id"], "Work note")
    keep = await make_note(api, headers, ideas["id"], "Idea")

    assert (await api.delete(f"/notebooks/{work['id']}", headers=headers)).status_code == 200
    assert [n["id"] for n in (await api.get("/notes", headers=headers)).json()] == [keep["id"]]


async def test_users_cannot_touch_each_others_notebooks(api, make_user):
    _, alice = await make_user("alice")
    _, bob = await make_user("bob")
    alices = await make_notebook(api, alice, "Private")
    note = await make_note(api, alice, alices["id"], "Secret")
    bobs = await make_notebook(api, bob, "Bob's")

    assert (await api.get("/notebooks", headers=bob)).json()[0]["name"] == "Bob's"
    assert (await api.post(f"/notebooks/{alices['id']}/notes", json={"title": "x", "content": ""}, headers=bob)).status_code == 404
    assert (await api.get(f"/notes/{note['id']}", headers=bob)).status_code == 404
    assert (await api.put(f"/notes/{note['id']}", json={"title": "hacked"}, headers=bob)).status_code == 404
    # nor move their own note into someone else's notebook
    own = await make_note(api, bob, bobs["id"], "Mine")
    assert (await api.put(f"/notes/{own['id']}", json={"notebook_id": alices["id"]}, headers=bob)).status_code == 404
    assert (await api.delete(f"/notebooks/{alices['id']}", headers=bob)).status_code == 404
