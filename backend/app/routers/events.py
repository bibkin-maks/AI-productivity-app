from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from app.dependencies import get_current_user
from app.db.client import get_collection
from app.models.events import CreateEventRequest, UpdateEventRequest

router = APIRouter()

@router.get("/events")
async def get_events(current_user: dict = Depends(get_current_user)):
    return current_user.get("events", [])

@router.post("/events")
async def create_event(request: CreateEventRequest, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    new_event = {
        "id": str(uuid.uuid4()),
        "title": request.title,
        "start": request.start,
        "end": request.end,
        "allDay": request.allDay,
        "color": request.color,
        "description": request.description,
        "seriesId": request.seriesId,
        "recurrence": request.recurrence,
        "recurrenceEnd": request.recurrenceEnd,
        "recurrenceDays": request.recurrenceDays,
        "recurrenceInterval": request.recurrenceInterval,
        "workoutLog": [item.model_dump() for item in request.workoutLog],
        "type": request.type,
        "status": request.status,
        "priority": request.priority,
        "exceptDates": request.exceptDates,
        "amount": request.amount,
        "created_at": now,
        "updated_at": now,   # set on creation for consistency
    }

    users = get_collection("users")
    await users.update_one(
        {"_id": current_user["_id"]},
        {"$push": {"events": new_event}}
    )
    return new_event

@router.put("/events/{event_id}")
async def update_event(event_id: str, request: UpdateEventRequest, current_user: dict = Depends(get_current_user)):
    users = get_collection("users")
    result = await users.update_one(
        {"_id": current_user["_id"], "events.id": event_id},
        {
            "$set": {
                "events.$.title": request.title,
                "events.$.start": request.start,
                "events.$.end": request.end,
                "events.$.allDay": request.allDay,
                "events.$.color": request.color,
                "events.$.description": request.description,
                "events.$.seriesId": request.seriesId,
                "events.$.recurrence": request.recurrence,
                "events.$.recurrenceEnd": request.recurrenceEnd,
                "events.$.recurrenceDays": request.recurrenceDays,
                "events.$.recurrenceInterval": request.recurrenceInterval,
                "events.$.workoutLog": [item.model_dump() for item in request.workoutLog],
                "events.$.type": request.type,
                "events.$.status": request.status,
                "events.$.priority": request.priority,
                "events.$.exceptDates": request.exceptDates,
                "events.$.amount": request.amount,
                "events.$.updated_at": datetime.now(timezone.utc)
            }
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event updated successfully"}

# -------------------------------------------------------------------
# Series endpoints
# -------------------------------------------------------------------

@router.put("/events/series/{series_id}")
async def update_event_series(series_id: str, request: UpdateEventRequest, current_user: dict = Depends(get_current_user)):
    """Update shared fields across all events in a recurring series.
    Per-occurrence fields (start, end, color) are intentionally NOT overwritten."""
    users = get_collection("users")
    result = await users.update_many(
        {"_id": current_user["_id"], "events.seriesId": series_id},
        {
            "$set": {
                "events.$[elem].title": request.title,
                "events.$[elem].recurrence": request.recurrence,
                "events.$[elem].recurrenceEnd": request.recurrenceEnd,
                "events.$[elem].type": request.type,
                "events.$[elem].status": request.status,
                "events.$[elem].priority": request.priority,
                "events.$[elem].description": request.description,
                "events.$[elem].workoutLog": [item.model_dump() for item in request.workoutLog],
                "events.$[elem].updated_at": datetime.now(timezone.utc),
            }
        },
        array_filters=[{"elem.seriesId": series_id}]
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Series not found")
    return {"message": f"Series updated: {result.modified_count} events affected"}

@router.delete("/events/series/{series_id}")
async def delete_event_series(series_id: str, current_user: dict = Depends(get_current_user)):
    """Delete all events belonging to a recurring series."""
    users = get_collection("users")
    # Pull all events whose seriesId matches
    result = await users.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"events": {"seriesId": series_id}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Series not found")
    return {"message": "Series deleted successfully"}

@router.delete("/events/all")
async def delete_all_events(current_user: dict = Depends(get_current_user)):
    users = get_collection("users")
    await users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"events": []}}
    )
    return {"message": "All events deleted successfully"}

@router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    users = get_collection("users")
    result = await users.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"events": {"id": event_id}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event deleted successfully"}
