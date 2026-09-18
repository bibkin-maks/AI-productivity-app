import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.db.client import get_collection
from app.dependencies import get_current_user
from app.models.events import CreateEventRequest, UpdateEventRequest

router = APIRouter()

# Every query is scoped by user_id — one user can never read or touch another's events.
HIDDEN = {"_id": 0, "user_id": 0}
# Fields shared by a recurring series; per-occurrence fields (start, end, color) stay untouched
SERIES_FIELDS = ("title", "recurrence", "recurrenceEnd", "type", "status", "priority", "description", "workoutLog")


def events():
    return get_collection("events")


@router.get("/events")
async def get_events(current_user: dict = Depends(get_current_user)):
    return await events().find({"user_id": current_user["_id"]}, HIDDEN).sort("start", 1).to_list(None)


@router.post("/events")
async def create_event(request: CreateEventRequest, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    event_id = str(uuid.uuid4())
    new_event = {"id": event_id, **request.model_dump(mode="json"), "created_at": now, "updated_at": now}
    await events().insert_one({**new_event, "_id": event_id, "user_id": current_user["_id"]})
    return new_event


@router.put("/events/{event_id}")
async def update_event(event_id: str, request: UpdateEventRequest, current_user: dict = Depends(get_current_user)):
    result = await events().update_one(
        {"_id": event_id, "user_id": current_user["_id"]},
        {"$set": {**request.model_dump(mode="json"), "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event updated successfully"}

# -------------------------------------------------------------------
# Series endpoints
# -------------------------------------------------------------------

@router.put("/events/series/{series_id}")
async def update_event_series(series_id: str, request: UpdateEventRequest, current_user: dict = Depends(get_current_user)):
    """Update shared fields across all events in a recurring series."""
    data = request.model_dump(mode="json")
    result = await events().update_many(
        {"user_id": current_user["_id"], "seriesId": series_id},
        {"$set": {**{f: data[f] for f in SERIES_FIELDS}, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Series not found")
    return {"message": f"Series updated: {result.modified_count} events affected"}


@router.delete("/events/series/{series_id}")
async def delete_event_series(series_id: str, current_user: dict = Depends(get_current_user)):
    """Delete all events belonging to a recurring series."""
    result = await events().delete_many({"user_id": current_user["_id"], "seriesId": series_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Series not found")
    return {"message": "Series deleted successfully"}


@router.delete("/events/all")
async def delete_all_events(current_user: dict = Depends(get_current_user)):
    await events().delete_many({"user_id": current_user["_id"]})
    return {"message": "All events deleted successfully"}


@router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    result = await events().delete_one({"_id": event_id, "user_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event deleted successfully"}
