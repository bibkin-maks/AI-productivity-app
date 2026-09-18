def event(**overrides):
    return {
        "title": "Standup", "start": "2026-09-18T09:00:00Z", "end": "2026-09-18T09:15:00Z",
        "allDay": False, "color": "", "description": "", "recurrence": "none",
        "workoutLog": [], "type": "task", "status": "pending", "priority": "medium", **overrides,
    }


async def test_create_list_update_delete(api, make_user):
    _, headers = await make_user()
    created = (await api.post("/events", json=event(), headers=headers)).json()
    assert created["title"] == "Standup" and created["id"]
    assert "_id" not in created and "user_id" not in created

    listed = (await api.get("/events", headers=headers)).json()
    assert [e["id"] for e in listed] == [created["id"]]

    updated = event(title="Standup (moved)", start="2026-09-18T10:00:00Z", end="2026-09-18T10:15:00Z")
    assert (await api.put(f"/events/{created['id']}", json=updated, headers=headers)).status_code == 200
    assert (await api.get("/events", headers=headers)).json()[0]["title"] == "Standup (moved)"

    assert (await api.delete(f"/events/{created['id']}", headers=headers)).status_code == 200
    assert (await api.get("/events", headers=headers)).json() == []


async def test_events_are_listed_in_start_order(api, make_user):
    _, headers = await make_user()
    for hour in ("15", "09", "12"):
        await api.post("/events", json=event(title=hour, start=f"2026-09-18T{hour}:00:00Z", end=f"2026-09-18T{hour}:30:00Z"), headers=headers)
    assert [e["title"] for e in (await api.get("/events", headers=headers)).json()] == ["09", "12", "15"]


async def test_end_before_start_is_rejected(api, make_user):
    _, headers = await make_user()
    bad = event(start="2026-09-18T10:00:00Z", end="2026-09-18T09:00:00Z")
    assert (await api.post("/events", json=bad, headers=headers)).status_code == 422


async def test_missing_event_is_404(api, make_user):
    _, headers = await make_user()
    assert (await api.put("/events/nope", json=event(), headers=headers)).status_code == 404
    assert (await api.delete("/events/nope", headers=headers)).status_code == 404


async def test_series_update_changes_shared_fields_only(api, make_user):
    _, headers = await make_user()
    days = ("18", "19", "20")
    for d in days:
        await api.post("/events", json=event(seriesId="s1", recurrence="daily", start=f"2026-09-{d}T09:00:00Z", end=f"2026-09-{d}T09:15:00Z"), headers=headers)

    change = event(title="Daily sync", priority="high", start="2030-01-01T00:00:00Z", end="2030-01-01T01:00:00Z", recurrence="daily")
    assert (await api.put("/events/series/s1", json=change, headers=headers)).status_code == 200

    events = (await api.get("/events", headers=headers)).json()
    assert {e["title"] for e in events} == {"Daily sync"}
    assert {e["priority"] for e in events} == {"high"}
    assert [e["start"][8:10] for e in events] == list(days)       # occurrences keep their own dates


async def test_series_delete_and_delete_all(api, make_user):
    _, headers = await make_user()
    await api.post("/events", json=event(seriesId="s1"), headers=headers)
    await api.post("/events", json=event(seriesId="s1"), headers=headers)
    await api.post("/events", json=event(title="Solo"), headers=headers)

    assert (await api.delete("/events/series/s1", headers=headers)).status_code == 200
    assert [e["title"] for e in (await api.get("/events", headers=headers)).json()] == ["Solo"]
    assert (await api.delete("/events/series/s1", headers=headers)).status_code == 404

    await api.delete("/events/all", headers=headers)
    assert (await api.get("/events", headers=headers)).json() == []


async def test_users_cannot_see_or_change_each_others_events(api, make_user):
    _, alice = await make_user("alice")
    _, bob = await make_user("bob")
    mine = (await api.post("/events", json=event(title="Alice only"), headers=alice)).json()

    assert (await api.get("/events", headers=bob)).json() == []
    assert (await api.put(f"/events/{mine['id']}", json=event(title="hacked"), headers=bob)).status_code == 404
    assert (await api.delete(f"/events/{mine['id']}", headers=bob)).status_code == 404
    await api.delete("/events/all", headers=bob)
    assert [e["title"] for e in (await api.get("/events", headers=alice)).json()] == ["Alice only"]
