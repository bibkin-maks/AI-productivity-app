import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo import UpdateOne

from app.db.client import get_collection
from app.dependencies import get_current_user
from app.models.notes import (
    CreateNotebookRequest,
    CreateNoteRequest,
    ReorderNotesRequest,
    UpdateNotebookRequest,
    UpdateNoteRequest,
)

router = APIRouter()

# Every query is scoped by user_id — one user can never read or touch another's notes.
HIDDEN = {"_id": 0, "user_id": 0}


def notebooks():
    return get_collection("notebooks")


def notes():
    return get_collection("notes")


async def _own_notebook(notebook_id: str, user_id: str) -> bool:
    return await notebooks().count_documents({"_id": notebook_id, "user_id": user_id}, limit=1) > 0

# --- Notebooks ---

@router.get("/notebooks")
async def get_notebooks(current_user: dict = Depends(get_current_user)):
    return await notebooks().find({"user_id": current_user["_id"]}, HIDDEN).sort("created_at", 1).to_list(None)


@router.post("/notebooks")
async def create_notebook(request: CreateNotebookRequest, current_user: dict = Depends(get_current_user)):
    notebook_id = str(uuid.uuid4())
    new_notebook = {"id": notebook_id, "name": request.name, "created_at": datetime.now(timezone.utc)}
    await notebooks().insert_one({**new_notebook, "_id": notebook_id, "user_id": current_user["_id"]})
    return new_notebook


@router.put("/notebooks/{notebook_id}")
async def update_notebook(notebook_id: str, request: UpdateNotebookRequest, current_user: dict = Depends(get_current_user)):
    result = await notebooks().update_one(
        {"_id": notebook_id, "user_id": current_user["_id"]}, {"$set": {"name": request.name}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return {"message": "Notebook updated successfully"}


@router.delete("/notebooks/{notebook_id}")
async def delete_notebook(notebook_id: str, current_user: dict = Depends(get_current_user)):
    result = await notebooks().delete_one({"_id": notebook_id, "user_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notebook not found")
    # Cascade delete notes
    await notes().delete_many({"user_id": current_user["_id"], "notebook_id": notebook_id})
    return {"message": "Notebook deleted successfully"}

# --- Notes ---

@router.get("/notebooks/{notebook_id}/notes")
async def get_notes(notebook_id: str, current_user: dict = Depends(get_current_user)):
    return await notes().find(
        {"user_id": current_user["_id"], "notebook_id": notebook_id}, HIDDEN
    ).sort("order", 1).to_list(None)


@router.post("/notebooks/{notebook_id}/notes")
async def create_note(notebook_id: str, request: CreateNoteRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user["_id"]
    if not await _own_notebook(notebook_id, uid):
        raise HTTPException(status_code=404, detail="Notebook not found")

    last = await notes().find({"user_id": uid, "notebook_id": notebook_id}, {"order": 1}).sort("order", -1).limit(1).to_list(1)
    now = datetime.now(timezone.utc)
    note_id = str(uuid.uuid4())
    new_note = {
        "id": note_id,
        "notebook_id": notebook_id,
        "title": request.title,
        "content": request.content,
        "is_favorite": False,
        "order": (last[0].get("order", 0) + 1) if last else 0,
        "created_at": now,
        "updated_at": now,
    }
    await notes().insert_one({**new_note, "_id": note_id, "user_id": uid})
    return new_note


@router.put("/notebooks/{notebook_id}/reorder")
async def reorder_notes(notebook_id: str, request: ReorderNotesRequest, current_user: dict = Depends(get_current_user)):
    operations = [
        UpdateOne({"_id": item["id"], "user_id": current_user["_id"], "notebook_id": notebook_id},
                  {"$set": {"order": item["order"]}})
        for item in request.notes
    ]
    if operations:
        await notes().bulk_write(operations)
    return {"message": "Notes reordered successfully"}


@router.get("/notes")
async def get_all_notes(current_user: dict = Depends(get_current_user)):
    """Every note across notebooks, most recently edited first (used for search and favourites)."""
    return await notes().find({"user_id": current_user["_id"]}, HIDDEN).sort("updated_at", -1).to_list(None)


@router.get("/notes/{note_id}")
async def get_note(note_id: str, current_user: dict = Depends(get_current_user)):
    note = await notes().find_one({"_id": note_id, "user_id": current_user["_id"]}, HIDDEN)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.put("/notes/{note_id}")
async def update_note(note_id: str, request: UpdateNoteRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user["_id"]
    changes = request.model_dump(exclude_none=True)
    if "notebook_id" in changes and not await _own_notebook(changes["notebook_id"], uid):
        raise HTTPException(status_code=404, detail="Notebook not found")

    result = await notes().update_one(
        {"_id": note_id, "user_id": uid},
        {"$set": {**changes, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note updated successfully"}


@router.delete("/notes/{note_id}")
async def delete_note(note_id: str, current_user: dict = Depends(get_current_user)):
    result = await notes().delete_one({"_id": note_id, "user_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}
